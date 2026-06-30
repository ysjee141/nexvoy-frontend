import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ChecklistItem,
  ChecklistItemAssignee,
  ChecklistItemUserCheck,
} from '@nexvoy/types'
import {
  createChecklistItem,
  createTrip,
  deleteChecklistItem,
  ensureChecklist,
  getChecklistItemAssignees,
  getChecklistItemUserChecks,
  getPlansByTrip,
  getTripById,
  getTripsByUser,
  toggleChecklistItem,
  toggleChecklistItemForUser,
  updateChecklistItem,
  updateTrip,
  type ChecklistItemInput,
} from './queries'
import type { LegacyTripRowBundle } from '../local-first/migrations'
import type {
  ChecklistRepository,
  ChecklistRepositorySnapshot,
  ChecklistItemMutationResult,
  ChecklistMemberSnapshot,
  ToggleChecklistItemForUserInput,
  TripRepository,
} from '../repositories/types'
import type { CreateTripInput, UpdateTripInput } from './queries'

export interface LegacyRepositories {
  trips: TripRepository
  checklists: ChecklistRepository
}

export function createSupabaseLegacyRepositories(sb: SupabaseClient): LegacyRepositories {
  return {
    trips: createSupabaseTripRepository(sb),
    checklists: createSupabaseChecklistRepository(sb),
  }
}

export function createSupabaseTripRepository(sb: SupabaseClient): TripRepository {
  return {
    listTrips: (userId) => getTripsByUser(sb, userId),
    getTrip: (tripId) => getTripById(sb, tripId),
    getTripDocument: async () => null,
    getTripWithPlans: async (tripId) => {
      const trip = await getTripById(sb, tripId)
      if (!trip) throw new Error('여행을 찾을 수 없어요.')
      const plans = await getPlansByTrip(sb, tripId)
      return { trip, plans }
    },
    createTrip: (input: CreateTripInput) => createTrip(sb, input),
    updateTrip: (tripId: string, input: UpdateTripInput) => updateTrip(sb, tripId, input),
    deleteTrip: async (tripId: string, ownerId?: string) => {
      let query = sb.from('trips').delete().eq('id', tripId)
      if (ownerId) query = query.eq('user_id', ownerId)
      const { error } = await query
      if (error) throw error
    },
  }
}

export function createSupabaseChecklistRepository(sb: SupabaseClient): ChecklistRepository {
  return {
    getChecklist: (tripId) => getLegacyChecklistSnapshot(sb, tripId),
    createItem: async (checklistId, input) => {
      const item = await createChecklistItem(sb, checklistId, input)
      return toChecklistItemMutationResult(sb, item)
    },
    updateItem: async (itemId, input) => {
      const item = await updateChecklistItem(sb, itemId, input)
      return toChecklistItemMutationResult(sb, item)
    },
    deleteItem: (itemId) => deleteChecklistItem(sb, itemId),
    toggleItem: (itemId, isChecked) => toggleChecklistItem(sb, itemId, isChecked),
    toggleItemForUser: async (input) => {
      await toggleChecklistItemForUser(
        sb,
        input.item,
        input.currentUserId,
        input.nextChecked,
        input.participantIds,
      )
      return getChecklistItemUserChecks(sb, [input.item.id])
    },
  }
}

export async function getLegacyTripRowBundle(
  sb: SupabaseClient,
  tripId: string,
  currentUserId?: string | null,
): Promise<LegacyTripRowBundle | null> {
  const { data: trip, error: tripError } = await sb
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .maybeSingle()
  if (tripError) throw tripError
  if (!trip) return null

  const [
    plansRes,
    checklistsRes,
    checklistCategoriesRes,
    membersRes,
    sharesRes,
    invitationLinksRes,
  ] = await Promise.all([
    sb.from('plans').select('*').eq('trip_id', tripId),
    sb.from('checklists').select('*').eq('trip_id', tripId).order('created_at', { ascending: true }),
    currentUserId
      ? sb
        .from('checklist_categories')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${currentUserId}`)
        .order('sort_order', { ascending: true })
      : sb
        .from('checklist_categories')
        .select('*')
        .is('user_id', null)
        .order('sort_order', { ascending: true }),
    sb
      .from('trip_members')
      .select('id, trip_id, user_id, invited_email, role, status, created_at, profiles(nickname, email)')
      .eq('trip_id', tripId),
    sb.from('trip_shares').select('*').eq('trip_id', tripId),
    sb.from('trip_invitation_links').select('*').eq('trip_id', tripId),
  ])

  if (plansRes.error) throw plansRes.error
  if (checklistsRes.error) throw checklistsRes.error
  if (checklistCategoriesRes.error) throw checklistCategoriesRes.error
  if (membersRes.error) throw membersRes.error
  if (sharesRes.error) throw sharesRes.error
  if (invitationLinksRes.error) throw invitationLinksRes.error

  const checklists = checklistsRes.data ?? []
  const checklistIds = checklists.map((checklist) => checklist.id)
  const plans = plansRes.data ?? []
  const planIds = plans.map((plan) => plan.id)

  const [planUrlsRes, checklistItemsRes] = await Promise.all([
    planIds.length > 0
      ? sb.from('plan_urls').select('*').in('plan_id', planIds)
      : Promise.resolve({ data: [], error: null }),
    checklistIds.length > 0
      ? sb.from('checklist_items').select('*').in('checklist_id', checklistIds).order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ])

  if (planUrlsRes.error) throw planUrlsRes.error
  if (checklistItemsRes.error) throw checklistItemsRes.error

  const checklistItems = checklistItemsRes.data ?? []
  const checklistItemIds = checklistItems.map((item) => item.id)
  const [assigneesRes, userChecksRes] = await Promise.all([
    checklistItemIds.length > 0
      ? sb.from('checklist_item_assignees').select('*').in('item_id', checklistItemIds)
      : Promise.resolve({ data: [], error: null }),
    checklistItemIds.length > 0
      ? sb.from('checklist_item_user_checks').select('*').in('item_id', checklistItemIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (assigneesRes.error) throw assigneesRes.error
  if (userChecksRes.error) throw userChecksRes.error

  return {
    exportedAt: new Date().toISOString(),
    trip,
    plans,
    planUrls: planUrlsRes.data ?? [],
    checklists,
    checklistItems,
    checklistCategories: checklistCategoriesRes.data ?? [],
    checklistItemAssignees: assigneesRes.data ?? [],
    checklistItemUserChecks: userChecksRes.data ?? [],
    members: (membersRes.data ?? []).map(normalizeLegacyTripMemberRow),
    shares: sharesRes.data ?? [],
    invitationLinks: invitationLinksRes.data ?? [],
  } satisfies LegacyTripRowBundle
}

async function getLegacyChecklistSnapshot(
  sb: SupabaseClient,
  tripId: string,
): Promise<ChecklistRepositorySnapshot> {
  const { data: checklistRows, error: checklistsError } = await sb
    .from('checklists')
    .select('id, trip_id, title, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })
  if (checklistsError) throw checklistsError

  const checklists = checklistRows ?? []
  const defaultChecklist = checklists[0] ?? await ensureChecklist(sb, tripId)
  const allChecklists = checklists.length > 0 ? checklists : [defaultChecklist]
  const checklistIds = allChecklists.map((checklist) => checklist.id)

  const [tripRes, itemsRes, membersRes] = await Promise.all([
    sb.from('trips').select('*, profiles(nickname, email)').eq('id', tripId).single(),
    checklistIds.length > 0
      ? sb
        .from('checklist_items')
        .select('*')
        .in('checklist_id', checklistIds)
        .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as ChecklistItem[], error: null }),
    sb
      .from('trip_members')
      .select('id, trip_id, user_id, invited_email, role, status, created_at, profiles(nickname, email)')
      .eq('trip_id', tripId)
      .eq('status', 'accepted'),
  ])
  if (tripRes.error) throw tripRes.error
  if (itemsRes.error) throw itemsRes.error
  if (membersRes.error) throw membersRes.error

  const items = itemsRes.data ?? []
  const itemIds = items.map((item: ChecklistItem) => item.id)
  const [userChecks, itemAssignees] = await Promise.all([
    getChecklistItemUserChecks(sb, itemIds),
    getChecklistItemAssignees(sb, itemIds),
  ])
  const checklistIdWithItems = checklistIds.find((id) =>
    items.some((item: ChecklistItem) => item.checklist_id === id),
  )

  return {
    checklistId: checklistIdWithItems ?? defaultChecklist.id,
    checklists: allChecklists,
    trip: tripRes.data,
    items,
    members: (membersRes.data ?? []).map(toChecklistMemberSnapshot),
    userChecks,
    itemAssignees,
  }
}

function toChecklistMemberSnapshot(member: {
  id: string
  trip_id: string
  user_id: string | null
  invited_email: string | null
  role: 'owner' | 'editor' | 'viewer'
  status: 'pending' | 'accepted'
  created_at: string
  profiles?: { nickname: string | null; email: string | null } | { nickname: string | null; email: string | null }[] | null
}): ChecklistMemberSnapshot {
  const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles

  return {
    ...member,
    invited_email: member.invited_email ?? '',
    profiles: profile ?? undefined,
  }
}

function normalizeLegacyTripMemberRow(member: {
  id: string
  trip_id: string
  user_id: string | null
  invited_email: string | null
  role: string
  status: string
  created_at: string
  updated_at?: string | null
  profiles?: { nickname: string | null; email: string | null } | { nickname: string | null; email: string | null }[] | null
}): NonNullable<LegacyTripRowBundle['members']>[number] {
  const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles

  return {
    id: member.id,
    trip_id: member.trip_id,
    user_id: member.user_id,
    invited_email: member.invited_email,
    role: member.role,
    status: member.status,
    created_at: member.created_at,
    updated_at: member.updated_at ?? member.created_at,
    profiles: profile ?? null,
  }
}

async function toChecklistItemMutationResult(
  sb: SupabaseClient,
  item: ChecklistItem,
): Promise<ChecklistItemMutationResult> {
  const assignees = await getChecklistItemAssignees(sb, [item.id])
  return { item, assignees }
}
