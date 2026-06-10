import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
}
