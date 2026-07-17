import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { assertLocalSupabaseUrl } from './supabase';
import type { TestUser } from './supabase';

/**
 * E2E 시드/정리/검증 헬퍼.
 *
 * service role 키로 생성한 클라이언트는 RLS를 우회한다. 따라서 trips insert 시
 * user_id를 반드시 인자로 받아 명시적으로 지정해 RLS 정합성을 유지한다.
 *
 * 보안:
 * - SUPABASE_SERVICE_ROLE_KEY는 process.env에서만 읽으며 하드코딩하지 않는다.
 * - 키/토큰을 로그로 출력하지 않는다.
 * - 테스트 전용 데이터만 다루며 실제 고객/임직원 데이터를 사용하지 않는다.
 */

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`환경변수 누락: ${key}`);
  return val;
}

let cachedClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  assertLocalSupabaseUrl(url);

  cachedClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cachedClient;
}

/** YYYY-MM-DD 형식으로 오늘 기준 offset일 후 날짜를 반환 */
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface SeededTrip {
  id: string;
  user_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  adults_count: number;
  children_count: number;
}

type TripOverrides = Partial<{
  destination: string;
  start_date: string;
  end_date: string;
  adults_count: number;
  children_count: number;
}>;

/**
 * trips 테이블에 직접 여행을 시드한다.
 * @param userId 소유자 user_id (RLS 정합성을 위해 반드시 인자로 받음)
 */
export async function seedTrip(
  userId: string,
  overrides: TripOverrides = {}
): Promise<SeededTrip> {
  const client = getServiceClient();

  const payload = {
    user_id: userId,
    destination: overrides.destination ?? 'E2E 테스트 여행지',
    start_date: overrides.start_date ?? dateOffset(1),
    end_date: overrides.end_date ?? dateOffset(2),
    adults_count: overrides.adults_count ?? 1,
    children_count: overrides.children_count ?? 0,
  };

  const { data, error } = await client
    .from('trips')
    .insert(payload)
    .select('id, user_id, destination, start_date, end_date, adults_count, children_count')
    .single();

  if (error || !data) {
    throw new Error(`seedTrip 실패: ${error?.message ?? '데이터 없음'}`);
  }

  return data as SeededTrip;
}

export async function seedAuthorityTrip(
  owner: TestUser,
  overrides: TripOverrides = {},
): Promise<SeededTrip> {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  assertLocalSupabaseUrl(url);
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${owner.accessToken}` } },
  });
  const tripId = randomUUID();
  const checklistId = randomUUID();
  const createdAt = new Date().toISOString();
  const payload = {
    user_id: owner.id,
    destination: overrides.destination ?? 'TASK-050 서버 권위 여행',
    start_date: overrides.start_date ?? dateOffset(1),
    end_date: overrides.end_date ?? dateOffset(2),
    adults_count: overrides.adults_count ?? 1,
    children_count: overrides.children_count ?? 0,
  };
  const commands = [
    {
      operation_id: randomUUID(),
      entity_type: 'trip',
      entity_id: tripId,
      action: 'upsert',
      payload,
      created_at: createdAt,
    },
    {
      operation_id: randomUUID(),
      entity_type: 'checklist',
      entity_id: checklistId,
      action: 'upsert',
      payload: { title: '준비물' },
      created_at: new Date(Date.parse(createdAt) + 1).toISOString(),
    },
  ];

  const { error } = await client.rpc('apply_trip_commands', {
    p_trip_id: tripId,
    p_commands: commands,
    p_base_revision: 0,
  });
  if (error) throw new Error(`seedAuthorityTrip 실패: ${error.message}`);

  return { id: tripId, ...payload };
}

export async function seedAuthorityDocumentMember(
  documentId: string,
  user: TestUser,
  role: 'editor' | 'viewer',
): Promise<void> {
  const client = getServiceClient();
  const { error } = await client.from('document_members').upsert({
    document_id: documentId,
    user_id: user.id,
    invited_email: user.email,
    role,
    status: 'accepted',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'document_id,user_id' });
  if (error) throw new Error(`seedAuthorityDocumentMember 실패: ${error.message}`);
}

export interface SeededTripMember {
  id: string;
  trip_id: string;
  user_id: string;
  role: 'editor' | 'viewer';
  status: 'accepted';
}

export async function seedTripMember(
  tripId: string,
  userId: string,
  email: string,
  role: 'editor' | 'viewer'
): Promise<SeededTripMember> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('trip_members')
    .upsert({
      trip_id: tripId,
      user_id: userId,
      invited_email: email,
      role,
      status: 'accepted',
    }, { onConflict: 'trip_id,user_id' })
    .select('id, trip_id, user_id, role, status')
    .single();

  if (error || !data) {
    throw new Error(`seedTripMember 실패: ${error?.message ?? '데이터 없음'}`);
  }

  return data as SeededTripMember;
}

export async function getTripMemberRole(
  tripId: string,
  userId: string
): Promise<'owner' | 'editor' | 'viewer' | null> {
  const client = getServiceClient();

  const { data: trip, error: tripError } = await client
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .maybeSingle();

  if (tripError) throw new Error(`getTripMemberRole trip 조회 실패: ${tripError.message}`);
  if (trip?.user_id === userId) return 'owner';

  const { data, error } = await client
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .maybeSingle();

  if (error) throw new Error(`getTripMemberRole member 조회 실패: ${error.message}`);
  return (data?.role as 'editor' | 'viewer' | undefined) ?? null;
}

/**
 * 해당 trip의 체크리스트를 조회하고, 없으면 생성한다.
 */
export async function getOrCreateChecklist(tripId: string): Promise<{ id: string }> {
  const client = getServiceClient();

  const { data: existing, error: selectError } = await client
    .from('checklists')
    .select('id')
    .eq('trip_id', tripId)
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw new Error(`getOrCreateChecklist 조회 실패: ${selectError.message}`);
  }

  if (existing?.id) {
    return { id: existing.id };
  }

  const { data: created, error: insertError } = await client
    .from('checklists')
    .insert({ trip_id: tripId, title: '기본 준비물' })
    .select('id')
    .single();

  if (insertError || !created) {
    throw new Error(`getOrCreateChecklist 생성 실패: ${insertError?.message ?? '데이터 없음'}`);
  }

  return { id: created.id };
}

export interface SeededChecklistItem {
  id: string;
  item_name: string;
  is_checked: boolean;
}

type ChecklistItemOverrides = Partial<{
  category: string;
  assignment_type: 'anyone' | 'specific' | 'everyone';
  is_checked: boolean;
  is_private: boolean;
  assigned_user_id: string | null;
}>;

/**
 * checklist_items 테이블에 항목을 시드한다.
 */
export async function seedChecklistItem(
  checklistId: string,
  itemName: string,
  overrides: ChecklistItemOverrides = {}
): Promise<SeededChecklistItem> {
  const client = getServiceClient();

  const payload = {
    checklist_id: checklistId,
    item_name: itemName,
    category: overrides.category ?? '기타',
    assignment_type: overrides.assignment_type ?? 'anyone',
    is_checked: overrides.is_checked ?? false,
    is_private: overrides.is_private ?? false,
    assigned_user_id: overrides.assigned_user_id ?? null,
  };

  const { data, error } = await client
    .from('checklist_items')
    .insert(payload)
    .select('id, item_name, is_checked')
    .single();

  if (error || !data) {
    throw new Error(`seedChecklistItem 실패: ${error?.message ?? '데이터 없음'}`);
  }

  return data as SeededChecklistItem;
}

/**
 * 검증용: 체크리스트 내 item_name으로 항목을 조회한다.
 * UI로 추가된 항목의 DB 상태를 검증할 때 사용한다.
 */
export async function getChecklistItemByName(
  checklistId: string,
  itemName: string
): Promise<{ id: string; is_checked: boolean } | null> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('checklist_items')
    .select('id, is_checked')
    .eq('checklist_id', checklistId)
    .eq('item_name', itemName)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getChecklistItemByName 실패: ${error.message}`);
  }

  return (data as { id: string; is_checked: boolean } | null) ?? null;
}

/**
 * 검증용 단일 항목 조회.
 */
export async function getChecklistItem(
  itemId: string
): Promise<{ id: string; is_checked: boolean }> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('checklist_items')
    .select('id, is_checked')
    .eq('id', itemId)
    .single();

  if (error || !data) {
    throw new Error(`getChecklistItem 실패: ${error?.message ?? '데이터 없음'}`);
  }

  return data as { id: string; is_checked: boolean };
}

/**
 * 해당 유저의 모든 trips를 삭제한다.
 * trips → checklists → checklist_items는 on delete cascade로 함께 정리된다.
 */
export async function cleanupTripsByUser(userId: string): Promise<void> {
  const client = getServiceClient();

  const { error } = await client.from('trips').delete().eq('user_id', userId);

  if (error) {
    throw new Error(`cleanupTripsByUser 실패: ${error.message}`);
  }

  const { error: documentError } = await client
    .from('documents')
    .delete()
    .eq('owner_id', userId)
    .eq('type', 'trip');
  if (documentError) {
    throw new Error(`cleanupTripsByUser document 정리 실패: ${documentError.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 템플릿 시드/정리/검증 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

export interface SeededTemplate {
  id: string;
  title: string;
}

type TemplateOverrides = Partial<{
  title: string;
}>;

/**
 * checklist_templates 테이블에 직접 템플릿을 시드한다.
 * @param userId 소유자 user_id (RLS 정합성을 위해 반드시 인자로 받음)
 */
export async function seedTemplate(
  userId: string,
  overrides: TemplateOverrides = {}
): Promise<SeededTemplate> {
  const client = getServiceClient();

  const payload = {
    user_id: userId,
    title: overrides.title ?? 'E2E 테스트 템플릿',
  };

  const { data, error } = await client
    .from('checklist_templates')
    .insert(payload)
    .select('id, title')
    .single();

  if (error || !data) {
    throw new Error(`seedTemplate 실패: ${error?.message ?? '데이터 없음'}`);
  }

  return data as SeededTemplate;
}

/**
 * 검증용: 해당 유저의 템플릿 중 title로 단건을 조회한다.
 * UI로 생성된 템플릿의 DB 반영 여부를 검증할 때 사용한다.
 */
export async function getTemplateByTitle(
  userId: string,
  title: string
): Promise<{ id: string; title: string } | null> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('checklist_templates')
    .select('id, title')
    .eq('user_id', userId)
    .eq('title', title)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getTemplateByTitle 실패: ${error.message}`);
  }

  return (data as { id: string; title: string } | null) ?? null;
}

export interface SeededTemplateItem {
  id: string;
  item_name: string;
}

type TemplateItemOverrides = Partial<{
  category: string;
  is_private: boolean;
}>;

/**
 * checklist_template_items 테이블에 항목을 시드한다.
 */
export async function seedTemplateItem(
  templateId: string,
  itemName: string,
  overrides: TemplateItemOverrides = {}
): Promise<SeededTemplateItem> {
  const client = getServiceClient();

  const payload = {
    template_id: templateId,
    item_name: itemName,
    category: overrides.category ?? '기타',
    is_private: overrides.is_private ?? false,
  };

  const { data, error } = await client
    .from('checklist_template_items')
    .insert(payload)
    .select('id, item_name')
    .single();

  if (error || !data) {
    throw new Error(`seedTemplateItem 실패: ${error?.message ?? '데이터 없음'}`);
  }

  return data as SeededTemplateItem;
}

/**
 * 검증용: template_id로 템플릿 항목 목록을 조회한다.
 */
export async function getTemplateItems(
  templateId: string
): Promise<{ id: string; item_name: string }[]> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('checklist_template_items')
    .select('id, item_name')
    .eq('template_id', templateId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`getTemplateItems 실패: ${error.message}`);
  }

  return (data as { id: string; item_name: string }[] | null) ?? [];
}

/**
 * 검증용: template_id + item_name으로 템플릿 항목 단건을 조회한다.
 * UI로 추가된 항목의 DB 반영 여부를 검증할 때 사용한다.
 */
export async function getTemplateItemByName(
  templateId: string,
  itemName: string
): Promise<{ id: string; item_name: string } | null> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('checklist_template_items')
    .select('id, item_name')
    .eq('template_id', templateId)
    .eq('item_name', itemName)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getTemplateItemByName 실패: ${error.message}`);
  }

  return (data as { id: string; item_name: string } | null) ?? null;
}

/**
 * 검증용: 체크리스트 내 source_template_name 기준으로 항목 목록을 조회한다.
 * 템플릿 불러오기 적용 결과를 검증할 때 사용한다.
 */
export async function getChecklistItemBySourceTemplate(
  checklistId: string,
  sourceTemplateName: string
): Promise<{ id: string; item_name: string; source_template_name: string }[]> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('checklist_items')
    .select('id, item_name, source_template_name')
    .eq('checklist_id', checklistId)
    .eq('source_template_name', sourceTemplateName);

  if (error) {
    throw new Error(`getChecklistItemBySourceTemplate 실패: ${error.message}`);
  }

  return (
    (data as { id: string; item_name: string; source_template_name: string }[] | null) ?? []
  );
}

/**
 * 해당 유저의 모든 템플릿을 삭제한다.
 * checklist_templates → checklist_template_items는 on delete cascade로 함께 정리된다.
 */
export async function cleanupTemplatesByUser(userId: string): Promise<void> {
  const client = getServiceClient();

  const { error } = await client
    .from('checklist_templates')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(`cleanupTemplatesByUser 실패: ${error.message}`);
  }
}
