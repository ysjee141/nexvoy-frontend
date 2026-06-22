import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Trip,
  Plan,
  PlanUrl,
  Checklist,
  ChecklistItem,
  ChecklistTemplate,
  ChecklistTemplateItem,
  Profile,
  TripMember,
  TripShare,
  TripSummary,
  TemplateWithCount,
  TemplateWithPreview,
  TripWithProgress,
  VisitedPlace,
  TravelStats,
} from '@nexvoy/types'

export interface CreateTripInput {
  user_id: string
  destination: string
  start_date: string
  end_date: string
  adults_count: number
  children_count: number
}

export interface UpdateTripInput {
  destination: string
  start_date: string
  end_date: string
  adults_count: number
  children_count: number
}

export interface PlanInput {
  trip_id: string
  title: string
  location?: string | null
  address?: string | null
  location_lat?: number | null
  location_lng?: number | null
  google_place_id?: string | null
  image_url?: string | null
  photo_reference?: string | null
  start_datetime_local: string
  end_datetime_local: string
  cost?: number
  memo?: string | null
  alarm_minutes_before?: number | null
  timezone_string?: string
  urls?: string[]
}

export interface ChecklistItemInput {
  item_name: string
  category?: string
  is_private?: boolean
  assignment_type?: 'anyone' | 'specific' | 'everyone'
  assigned_user_id?: string | null
  source_template_name?: string | null
}

function throwDbError(error: { message?: string; code?: string; details?: string } | null): never {
  const parts = [error?.message, error?.details, error?.code].filter(Boolean)
  throw new Error(parts.join(' · ') || '데이터 저장에 실패했어요.')
}

// ─── Trips ───────────────────────────────────────────────────────────────────

export async function getTripsByUser(
  sb: SupabaseClient,
  userId: string
): Promise<Trip[]> {
  const [ownedRes, memberRes] = await Promise.all([
    sb.from('trips').select('*').eq('user_id', userId).order('start_date'),
    sb
      .from('trip_members')
      .select('trips(*)')
      .eq('user_id', userId)
      .eq('status', 'accepted'),
  ])

  if (ownedRes.error) throw ownedRes.error
  if (memberRes.error) throw memberRes.error

  const memberTrips = (memberRes.data ?? [])
    .map((m: { trips: Trip | Trip[] | null }) => m.trips)
    .filter((t): t is Trip => t !== null && !Array.isArray(t))

  const owned = ownedRes.data ?? []
  const ownedIds = new Set(owned.map((t) => t.id))
  const unique = [...owned, ...memberTrips.filter((t) => !ownedIds.has(t.id))]

  return unique.sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  )
}

export async function getTripById(
  sb: SupabaseClient,
  tripId: string
): Promise<Trip | null> {
  const { data, error } = await sb
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()
  if (error) throwDbError(error)
  return data
}

export async function getTripWithPlans(
  sb: SupabaseClient,
  tripId: string
): Promise<{ trip: Trip; plans: Plan[] }> {
  const [tripRes, plansRes] = await Promise.all([
    sb.from('trips').select('*').eq('id', tripId).single(),
    sb
      .from('plans')
      .select('*')
      .eq('trip_id', tripId)
      .order('start_datetime_local'),
  ])
  if (tripRes.error) throw tripRes.error
  if (plansRes.error) throw plansRes.error
  return { trip: tripRes.data, plans: plansRes.data ?? [] }
}

export async function createTrip(
  sb: SupabaseClient,
  input: CreateTripInput
): Promise<Trip> {
  const { data, error } = await sb
    .from('trips')
    .insert(input)
    .select('*')
    .single()
  if (error) throwDbError(error)
  return data
}

export async function updateTrip(
  sb: SupabaseClient,
  tripId: string,
  input: UpdateTripInput
): Promise<Trip> {
  const { data, error } = await sb
    .from('trips')
    .update(input)
    .eq('id', tripId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

/**
 * 사용자의 여행 목록 + 체크리스트 진행률(progressPercent) + 소유 여부(isOwner).
 * 목록 카드 정렬/표시용 view-model 을 반환한다.
 *
 * RLS graceful degrade: checklists/checklist_items 접근이 실패하거나
 * 데이터가 없으면 progressPercent 를 0 으로 처리하고 throw 하지 않는다.
 * (trips 자체 조회 실패만 throw)
 *
 * 참고: getTripsByUser 와 달리 trip_members 참여 여정은 포함하지 않고
 * owner 기준(trips.user_id) 으로 조회한다. 진행률은 본인 소유 여정 카드용.
 */
export async function getTripsWithProgress(
  sb: SupabaseClient,
  userId: string
): Promise<TripWithProgress[]> {
  const { data, error } = await sb
    .from('trips')
    .select('*, checklists(checklist_items(is_checked))')
    .eq('user_id', userId)
    .order('start_date', { ascending: true })
  if (error) throw error

  type ChecklistRow = { checklist_items: { is_checked: boolean }[] | null }
  type Row = Trip & { checklists: ChecklistRow[] | null }

  return (data ?? []).map((trip: Row) => {
    // RLS 로 checklists/checklist_items 가 가려지면 빈 배열로 graceful degrade
    const items = (trip.checklists ?? []).flatMap(
      (c) => c.checklist_items ?? []
    )
    const progressPercent =
      items.length === 0
        ? 0
        : Math.round(
            (items.filter((i) => i.is_checked).length / items.length) * 100
          )

    // 조인 필드는 view-model 에서 제외
    const { checklists: _checklists, ...rest } = trip
    void _checklists
    return {
      ...(rest as Trip),
      progressPercent,
      isOwner: trip.user_id === userId,
    }
  })
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export async function getPlansByTrip(
  sb: SupabaseClient,
  tripId: string
): Promise<Plan[]> {
  const { data, error } = await sb
    .from('plans')
    .select('*')
    .eq('trip_id', tripId)
    .order('start_datetime_local')
  if (error) throw error
  return data ?? []
}

/** 일정 + 첨부 링크(plan_urls) 조인 조회 — 상세 모달용 */
export async function getPlansWithUrls(
  sb: SupabaseClient,
  tripId: string
): Promise<(Plan & { plan_urls: PlanUrl[] })[]> {
  const { data, error } = await sb
    .from('plans')
    .select('*, plan_urls(*)')
    .eq('trip_id', tripId)
    .order('start_datetime_local')
  if (error) throw error
  return (data ?? []).map((p: Plan & { plan_urls: PlanUrl[] | null }) => ({
    ...p,
    plan_urls: p.plan_urls ?? [],
  }))
}

function toPlanRow(input: PlanInput) {
  return {
    trip_id: input.trip_id,
    title: input.title,
    location: input.location ?? null,
    address: input.address ?? input.location ?? null,
    location_lat: input.location_lat ?? null,
    location_lng: input.location_lng ?? null,
    google_place_id: input.google_place_id ?? null,
    image_url: input.image_url ?? null,
    photo_reference: input.photo_reference ?? null,
    start_datetime_local: input.start_datetime_local,
    end_datetime_local: input.end_datetime_local,
    cost: input.cost ?? 0,
    memo: input.memo ?? '',
    alarm_minutes_before: input.alarm_minutes_before ?? null,
    timezone_string: input.timezone_string ?? 'Asia/Seoul',
  }
}

async function replacePlanUrls(
  sb: SupabaseClient,
  planId: string,
  urls: string[] | undefined
): Promise<void> {
  if (!urls) return
  const normalized = urls.map((url) => url.trim()).filter(Boolean)
  const { error: delErr } = await sb.from('plan_urls').delete().eq('plan_id', planId)
  if (delErr) throwDbError(delErr)
  if (normalized.length === 0) return
  const { error: insErr } = await sb
    .from('plan_urls')
    .insert(normalized.map((url) => ({ plan_id: planId, url })))
  if (insErr) throwDbError(insErr)
}

export async function createPlan(
  sb: SupabaseClient,
  input: PlanInput
): Promise<Plan & { plan_urls: PlanUrl[] }> {
  const { data, error } = await sb
    .from('plans')
    .insert(toPlanRow(input))
    .select('*')
    .single()
  if (error) throwDbError(error)
  await replacePlanUrls(sb, data.id, input.urls)
  const plans = await getPlansWithUrls(sb, data.trip_id)
  const saved = plans.find((plan) => plan.id === data.id)
  return saved ?? { ...data, plan_urls: [] }
}

export async function updatePlan(
  sb: SupabaseClient,
  planId: string,
  input: PlanInput
): Promise<Plan & { plan_urls: PlanUrl[] }> {
  const { data, error } = await sb
    .from('plans')
    .update(toPlanRow(input))
    .eq('id', planId)
    .select('*')
    .single()
  if (error) throwDbError(error)
  await replacePlanUrls(sb, data.id, input.urls)
  const plans = await getPlansWithUrls(sb, data.trip_id)
  const saved = plans.find((plan) => plan.id === data.id)
  return saved ?? { ...data, plan_urls: [] }
}

/** 일정 삭제 (plan_urls는 FK cascade 가정) */
export async function deletePlan(sb: SupabaseClient, planId: string): Promise<void> {
  const { error } = await sb.from('plans').delete().eq('id', planId)
  if (error) throw error
}

/** 방문 여부 토글 */
export async function togglePlanVisited(
  sb: SupabaseClient,
  planId: string,
  isVisited: boolean
): Promise<void> {
  const { error } = await sb
    .from('plans')
    .update({ is_visited: isVisited })
    .eq('id', planId)
  if (error) throw error
}

// ─── Checklists ───────────────────────────────────────────────────────────────

export async function getChecklistByTrip(
  sb: SupabaseClient,
  tripId: string
): Promise<{ checklist: Checklist; items: ChecklistItem[] } | null> {
  const { data: checklist, error: clErr } = await sb
    .from('checklists')
    .select('*')
    .eq('trip_id', tripId)
    .single()
  if (clErr) {
    if (clErr.code === 'PGRST116') return null // not found
    throw clErr
  }
  const { data: items, error: itemErr } = await sb
    .from('checklist_items')
    .select('*')
    .eq('checklist_id', checklist.id)
    .order('category')
  if (itemErr) throw itemErr
  return { checklist, items: items ?? [] }
}

export async function toggleChecklistItem(
  sb: SupabaseClient,
  itemId: string,
  isChecked: boolean
): Promise<void> {
  const { error } = await sb
    .from('checklist_items')
    .update({ is_checked: isChecked })
    .eq('id', itemId)
  if (error) throw error
}

export async function ensureChecklist(
  sb: SupabaseClient,
  tripId: string,
  title = '기본 준비물'
): Promise<Checklist> {
  const { data: existing, error: findErr } = await sb
    .from('checklists')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle()
  if (findErr) throw findErr
  if (existing) return existing

  const { data, error } = await sb
    .from('checklists')
    .insert({ trip_id: tripId, title })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function createChecklistItem(
  sb: SupabaseClient,
  checklistId: string,
  input: ChecklistItemInput
): Promise<ChecklistItem> {
  const { data, error } = await sb
    .from('checklist_items')
    .insert({
      checklist_id: checklistId,
      item_name: input.item_name,
      category: input.category ?? '기타',
      is_private: input.is_private ?? false,
      assignment_type: input.assignment_type ?? 'anyone',
      assigned_user_id: input.assigned_user_id ?? null,
      source_template_name: input.source_template_name ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateChecklistItem(
  sb: SupabaseClient,
  itemId: string,
  input: ChecklistItemInput
): Promise<ChecklistItem> {
  const { data, error } = await sb
    .from('checklist_items')
    .update({
      item_name: input.item_name,
      category: input.category ?? '기타',
      is_private: input.is_private ?? false,
      assignment_type: input.assignment_type ?? 'anyone',
      assigned_user_id: input.assigned_user_id ?? null,
      source_template_name: input.source_template_name ?? null,
    })
    .eq('id', itemId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteChecklistItem(
  sb: SupabaseClient,
  itemId: string
): Promise<void> {
  const { error } = await sb.from('checklist_items').delete().eq('id', itemId)
  if (error) throw error
}

export async function applyTemplateToChecklist(
  sb: SupabaseClient,
  checklistId: string,
  templateId: string
): Promise<ChecklistItem[]> {
  const result = await getTemplateWithItems(sb, templateId)
  if (!result) throw new Error('템플릿을 찾을 수 없어요.')
  if (result.items.length === 0) return []

  const { data, error } = await sb
    .from('checklist_items')
    .insert(
      result.items.map((item) => ({
        checklist_id: checklistId,
        item_name: item.item_name,
        category: item.category || '기타',
        is_private: item.is_private ?? false,
        assignment_type: 'anyone',
        assigned_user_id: null,
        source_template_name: result.template.title,
      }))
    )
    .select('*')
  if (error) throw error
  return data ?? []
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates(
  sb: SupabaseClient,
  userId: string
): Promise<ChecklistTemplate[]> {
  const { data, error } = await sb
    .from('checklist_templates')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getTemplateWithItems(
  sb: SupabaseClient,
  templateId: string
): Promise<{ template: ChecklistTemplate; items: ChecklistTemplateItem[] } | null> {
  const { data: template, error: tErr } = await sb
    .from('checklist_templates')
    .select('*')
    .eq('id', templateId)
    .single()
  if (tErr) {
    if (tErr.code === 'PGRST116') return null
    throw tErr
  }
  const { data: items, error: iErr } = await sb
    .from('checklist_template_items')
    .select('*')
    .eq('template_id', templateId)
    .order('category')
  if (iErr) throw iErr
  return { template, items: items ?? [] }
}

/** 템플릿 목록 + 아이템 개수 (목록 카드용) */
export async function getTemplatesWithItemCount(
  sb: SupabaseClient,
  userId: string
): Promise<TemplateWithCount[]> {
  const { data, error } = await sb
    .from('checklist_templates')
    .select('id, title, user_id, checklist_template_items(id)')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(
    (t: {
      id: string
      title: string
      user_id: string | null
      checklist_template_items: { id: string }[] | null
    }) => ({
      id: t.id,
      title: t.title,
      user_id: t.user_id,
      item_count: t.checklist_template_items?.length ?? 0,
    })
  )
}

/**
 * 템플릿 목록 + 아이템 개수 + 미리보기 항목명(최대 3개) (목록 카드용).
 * getTemplatesWithItemCount 의 확장 버전으로, 항목명(item_name)과
 * created_at 을 추가로 반환한다. 공개 템플릿(user_id is null)도 포함한다.
 */
export async function getTemplatesWithPreview(
  sb: SupabaseClient,
  userId: string
): Promise<TemplateWithPreview[]> {
  const { data, error } = await sb
    .from('checklist_templates')
    .select('id, title, user_id, created_at, checklist_template_items(item_name)')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(
    (t: {
      id: string
      title: string
      user_id: string | null
      created_at: string
      checklist_template_items: { item_name: string }[] | null
    }) => {
      const items = t.checklist_template_items ?? []
      return {
        id: t.id,
        title: t.title,
        user_id: t.user_id,
        item_count: items.length,
        preview_items: items.slice(0, 3).map((it) => it.item_name),
        created_at: t.created_at,
      }
    }
  )
}

/** 템플릿 생성 */
export async function createTemplate(
  sb: SupabaseClient,
  input: { title: string; user_id: string }
): Promise<ChecklistTemplate> {
  const { data, error } = await sb
    .from('checklist_templates')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data
}

/** 템플릿 제목 수정 */
export async function updateTemplate(
  sb: SupabaseClient,
  templateId: string,
  input: { title: string }
): Promise<void> {
  const { error } = await sb
    .from('checklist_templates')
    .update({ title: input.title })
    .eq('id', templateId)
  if (error) throw error
}

/** 템플릿 삭제 (template_items는 FK cascade 가정) */
export async function deleteTemplate(
  sb: SupabaseClient,
  templateId: string
): Promise<void> {
  const { error } = await sb
    .from('checklist_templates')
    .delete()
    .eq('id', templateId)
  if (error) throw error
}

/**
 * 템플릿 아이템 전체 교체 (편집 저장 시).
 * 트랜잭션이 아니므로 DELETE → INSERT 순서를 보장한다.
 */
export async function replaceTemplateItems(
  sb: SupabaseClient,
  templateId: string,
  items: Array<{ item_name: string; category?: string; is_private?: boolean }>
): Promise<void> {
  // 1) 기존 아이템 전체 삭제
  const { error: delErr } = await sb
    .from('checklist_template_items')
    .delete()
    .eq('template_id', templateId)
  if (delErr) throw delErr

  // 2) 신규 아이템 삽입 (빈 배열이면 삽입 생략)
  if (items.length === 0) return

  const rows = items.map((it) => ({
    template_id: templateId,
    item_name: it.item_name,
    category: it.category ?? '기타',
    is_private: it.is_private ?? false,
  }))
  const { error: insErr } = await sb
    .from('checklist_template_items')
    .insert(rows)
  if (insErr) throw insErr
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(
  sb: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

/**
 * 'YYYY-MM-DD' 문자열을 로컬 자정 Date로 파싱.
 * new Date('YYYY-MM-DD')는 UTC 00:00으로 해석되어 타임존 밀림이 생기므로
 * split 후 직접 조합하여 로컬 자정으로 만든다.
 */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10))
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** 두 날짜(YYYY-MM-DD) 사이의 박수 포함 일수 (start, end 포함) */
function inclusiveDays(start: string, end: string): number {
  const s = parseLocalDate(start)
  const e = parseLocalDate(end)
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000)
  return diff >= 0 ? diff + 1 : 1
}

// ─── Stats / Visited Places ─────────────────────────────────────────────────────

/**
 * 사용자의 방문 목적지 집계.
 * plans.location 이 비어있지 않은 일정을 trip 과 조인해 조회한 뒤
 * location 기준으로 애플리케이션 레벨에서 group by 한다.
 */
export async function getVisitedPlacesByUser(
  sb: SupabaseClient,
  userId: string
): Promise<VisitedPlace[]> {
  const { data, error } = await sb
    .from('plans')
    .select('location, trips!inner(id, destination, start_date, user_id)')
    .not('location', 'is', null)
    .neq('location', '')
    .eq('trips.user_id', userId)
  if (error) throw error

  type Row = {
    location: string | null
    trips:
      | { id: string; destination: string; start_date: string; user_id: string }
      | { id: string; destination: string; start_date: string; user_id: string }[]
      | null
  }

  const byLocation = new Map<string, VisitedPlace>()
  for (const row of (data ?? []) as Row[]) {
    const location = row.location
    if (!location) continue
    const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips
    if (!trip) continue

    let entry = byLocation.get(location)
    if (!entry) {
      entry = { location, trip_count: 0, trips: [] }
      byLocation.set(location, entry)
    }
    // 동일 location 내 trip 중복 제거
    if (!entry.trips.some((t) => t.id === trip.id)) {
      entry.trips.push({
        id: trip.id,
        destination: trip.destination,
        start_date: trip.start_date,
      })
      entry.trip_count = entry.trips.length
    }
  }

  return [...byLocation.values()].sort((a, b) => b.trip_count - a.trip_count)
}

/**
 * 여행 통계 집계.
 * trips 를 userId 기준 조회 후 날짜 diff 를 로컬 파싱으로 계산한다.
 */
export async function getTravelStats(
  sb: SupabaseClient,
  userId: string
): Promise<TravelStats> {
  const { data, error } = await sb
    .from('trips')
    .select('id, destination, start_date, end_date')
    .eq('user_id', userId)
    .order('start_date', { ascending: true })
  if (error) throw error

  const trips = (data ?? []) as Array<{
    id: string
    destination: string
    start_date: string
    end_date: string
  }>

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let totalDays = 0
  let completedCount = 0
  let longestTripDays = 0
  const destinations = new Set<string>()
  const pastTrips: TravelStats['pastTrips'] = []
  const upcomingTrips: TravelStats['upcomingTrips'] = []

  for (const t of trips) {
    const days = inclusiveDays(t.start_date, t.end_date)
    totalDays += days
    if (days > longestTripDays) longestTripDays = days
    if (t.destination) destinations.add(t.destination)

    const end = parseLocalDate(t.end_date)
    const entry = {
      id: t.id,
      destination: t.destination,
      start_date: t.start_date,
      end_date: t.end_date,
    }
    if (end.getTime() < today.getTime()) {
      completedCount += 1
      pastTrips.push(entry)
    } else {
      upcomingTrips.push(entry)
    }
  }

  // 과거 여행: 최신순, 다가오는 여행: 임박순
  pastTrips.sort(
    (a, b) => parseLocalDate(b.start_date).getTime() - parseLocalDate(a.start_date).getTime()
  )
  upcomingTrips.sort(
    (a, b) => parseLocalDate(a.start_date).getTime() - parseLocalDate(b.start_date).getTime()
  )

  return {
    totalDays,
    completedCount,
    longestTripDays,
    uniqueDestinations: destinations.size,
    pastTrips,
    upcomingTrips,
  }
}

/**
 * 회원 탈퇴 — delete_user RPC 래퍼.
 * 실제 삭제 권한 검증은 SECURITY DEFINER RPC(서버측)에서 수행하며,
 * 클라이언트 입력을 신뢰하지 않는다.
 */
export async function deleteUser(sb: SupabaseClient): Promise<void> {
  const { error } = await sb.rpc('delete_user')
  if (error) throw error
}

// ─── Collaboration / Share ──────────────────────────────────────────────────────

/**
 * 특정 여행에서 현재 로그인 사용자의 역할 조회.
 * owner(소유자) → trips.user_id 일치, 아니면 trip_members(accepted)에서 role 조회.
 * 비로그인/미참여 시 null.
 */
export async function getUserTripRole(
  sb: SupabaseClient,
  tripId: string
): Promise<string | null> {
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null

  const { data: trip, error: tripErr } = await sb
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .maybeSingle()
  if (tripErr) throw tripErr
  if (trip?.user_id === user.id) return 'owner'

  const { data: member, error: memberErr } = await sb
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .eq('status', 'accepted')
    .maybeSingle()
  if (memberErr) throw memberErr

  return member?.role ?? null
}

/** 초대 토큰으로 여정 요약 조회 — get_trip_summary_by_token RPC */
export async function getTripSummaryByToken(
  sb: SupabaseClient,
  token: string
): Promise<TripSummary | null> {
  const { data, error } = await sb.rpc('get_trip_summary_by_token', {
    p_token: token,
  })
  if (error) throw error
  if (!data) return null
  // RPC가 배열을 반환할 수 있어 단일 객체로 정규화
  const row = Array.isArray(data) ? data[0] : data
  return (row as TripSummary) ?? null
}

/** 초대 토큰으로 여행 참여 — join_trip_via_token RPC */
export async function joinTripViaToken(
  sb: SupabaseClient,
  token: string
): Promise<void> {
  const { error } = await sb.rpc('join_trip_via_token', { p_token: token })
  if (error) throw error
}

/** 여행 동행자 목록 조회 (profiles 조인) */
export async function getTripMembers(
  sb: SupabaseClient,
  tripId: string
): Promise<TripMember[]> {
  const { data, error } = await sb
    .from('trip_members')
    .select('*, profiles(nickname, email)')
    .eq('trip_id', tripId)
  if (error) throw error
  return (data ?? []) as TripMember[]
}

export async function inviteTripMember(
  sb: SupabaseClient,
  tripId: string,
  email: string,
  role: 'editor' | 'viewer' = 'editor'
): Promise<TripMember> {
  const { data, error } = await sb
    .from('trip_members')
    .insert({
      trip_id: tripId,
      invited_email: email,
      role,
      status: 'pending',
    })
    .select('*, profiles(nickname, email)')
    .single()
  if (error) throw error
  return data as TripMember
}

export async function updateTripMemberRole(
  sb: SupabaseClient,
  memberId: string,
  role: 'editor' | 'viewer'
): Promise<TripMember> {
  const { data, error } = await sb
    .from('trip_members')
    .update({ role })
    .eq('id', memberId)
    .select('*, profiles(nickname, email)')
    .single()
  if (error) throw error
  return data as TripMember
}

export async function removeTripMember(
  sb: SupabaseClient,
  memberId: string
): Promise<void> {
  const { error } = await sb.from('trip_members').delete().eq('id', memberId)
  if (error) throw error
}

export async function createInvitationLink(
  sb: SupabaseClient,
  tripId: string
): Promise<string> {
  const { data, error } = await sb.rpc('generate_invitation_link', {
    p_trip_id: tripId,
  })
  if (error) throw error
  return String(data)
}

function generateShareToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export async function getOrCreateTripShareLink(
  sb: SupabaseClient,
  tripId: string,
  shareType: 'public' | 'password' = 'public',
  password?: string
): Promise<TripShare> {
  const { data: existing, error: existingError } = await sb
    .from('trip_shares')
    .select('*')
    .eq('trip_id', tripId)
    .eq('share_type', shareType)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return existing as TripShare

  const { data, error } = await sb
    .from('trip_shares')
    .insert({
      trip_id: tripId,
      share_token: generateShareToken(),
      share_type: shareType,
      password_hash: shareType === 'password' ? password ?? null : null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as TripShare
}
