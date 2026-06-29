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

async function toChecklistItemMutationResult(
  sb: SupabaseClient,
  item: ChecklistItem,
): Promise<ChecklistItemMutationResult> {
  const assignees = await getChecklistItemAssignees(sb, [item.id])
  return { item, assignees }
}
