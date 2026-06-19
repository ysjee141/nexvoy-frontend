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
  TripSummary,
  TemplateWithCount,
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
  if (error) throw error
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
  if (error) throw error
  return data
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
