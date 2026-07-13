import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ChecklistItem,
  ChecklistItemAssignee,
  ChecklistItemUserCheck,
} from '@nexvoy/types'
import type {
  ChecklistRepository,
  ChecklistRepositorySnapshot,
  ChecklistItemMutationResult,
  ChecklistMemberSnapshot,
  ToggleChecklistItemForUserInput,
} from '@nexvoy/core/repositories/types'
import type { ChecklistItemInput } from '@nexvoy/core/supabase/queries'
import type {
  ChecklistItemReadModel,
  ChecklistReadModel,
  TripDetailReadModel,
  TripMemberReadModel,
} from '@nexvoy/core/local-first/materialize'
import type { TripDocumentV1 } from '@nexvoy/core/local-first/documentModel'
import { createWebDocumentPrimaryRepositories } from './documentPrimaryRepositories'

export function createWebDocumentPrimaryChecklistRepository(
  supabase: SupabaseClient,
): ChecklistRepository {
  return {
    getChecklist: async (tripId) => {
      const repositories = await createWebDocumentPrimaryRepositories(supabase)
      const [trip, checklists] = await Promise.all([
        repositories.trips.getTrip(tripId),
        repositories.checklists.getChecklist(tripId),
      ])
      if (!trip) throw new Error('Trip document was not found.')
      return toChecklistSnapshot(trip, checklists)
    },
    createItem: async (checklistId, input) => {
      const repositories = await createWebDocumentPrimaryRepositories(supabase)
      const tripId = await resolveTripIdForChecklist(repositories, checklistId)
      if (!tripId) throw new Error('Checklist document was not found.')
      const role = await resolveCurrentTripRole(supabase, repositories, tripId)
      const writeRepositories = await createWebDocumentPrimaryRepositories(supabase, { actorRole: role })
      const itemId = createEntityId('checklist-item')
      const result = await writeRepositories.checklists.createItem(tripId, {
        id: itemId,
        checklistId,
        name: input.item_name.trim(),
        categoryName: input.category ?? '기타',
        legacyIsChecked: false,
        isPrivate: input.is_private ?? false,
        assignmentType: input.assignment_type ?? 'anyone',
        assignedUserId: input.assigned_user_id ?? input.assignee_ids?.[0] ?? null,
        sourceTemplateName: input.source_template_name ?? null,
        assigneeIds: input.assignee_ids ?? [],
      })
      return toMutationResult(result.document, itemId)
    },
    updateItem: async (itemId, input) => {
      const repositories = await createWebDocumentPrimaryRepositories(supabase)
      const resolved = await resolveTripAndItem(repositories, itemId)
      if (!resolved) throw new Error('Checklist item document was not found.')
      const role = await resolveCurrentTripRole(supabase, repositories, resolved.tripId)
      const writeRepositories = await createWebDocumentPrimaryRepositories(supabase, { actorRole: role })
      const result = await writeRepositories.checklists.updateItem(resolved.tripId, {
        itemId,
        patch: {
          name: input.item_name.trim(),
          categoryName: input.category ?? '기타',
          isPrivate: input.is_private ?? false,
          assignmentType: input.assignment_type ?? 'anyone',
          assignedUserId: input.assigned_user_id ?? input.assignee_ids?.[0] ?? null,
          sourceTemplateName: input.source_template_name ?? resolved.item.sourceTemplateName,
        },
        assigneeIds: input.assignee_ids ?? [],
      })
      return toMutationResult(result.document, itemId)
    },
    deleteItem: async (itemId) => {
      const repositories = await createWebDocumentPrimaryRepositories(supabase)
      const resolved = await resolveTripAndItem(repositories, itemId)
      if (!resolved) throw new Error('Checklist item document was not found.')
      const role = await resolveCurrentTripRole(supabase, repositories, resolved.tripId)
      const writeRepositories = await createWebDocumentPrimaryRepositories(supabase, { actorRole: role })
      await writeRepositories.checklists.deleteItem(resolved.tripId, itemId)
    },
    toggleItem: async (itemId, isChecked) => {
      const repositories = await createWebDocumentPrimaryRepositories(supabase)
      const resolved = await resolveTripAndItem(repositories, itemId)
      if (!resolved) throw new Error('Checklist item document was not found.')
      const role = await resolveCurrentTripRole(supabase, repositories, resolved.tripId)
      const writeRepositories = await createWebDocumentPrimaryRepositories(supabase, { actorRole: role })
      await writeRepositories.checklists.toggleItem(resolved.tripId, {
        itemId,
        nextChecked: isChecked,
      })
    },
    toggleItemForUser: async (input) => {
      const repositories = await createWebDocumentPrimaryRepositories(supabase)
      const resolved = await resolveTripAndItem(repositories, input.item.id)
      if (!resolved) throw new Error('Checklist item document was not found.')
      const role = await resolveCurrentTripRole(supabase, repositories, resolved.tripId)
      const writeRepositories = await createWebDocumentPrimaryRepositories(supabase, { actorRole: role })
      const result = await writeRepositories.checklists.toggleItem(resolved.tripId, {
        itemId: input.item.id,
        nextChecked: input.nextChecked,
        currentUserId: input.currentUserId,
        participantIds: input.participantIds,
      })
      const checklists = await repositories.checklists.getChecklist(result.document.trip.id)
      return checklists.flatMap((checklist) => checklist.items)
        .find((item) => item.id === input.item.id)?.userChecks
        .map(toUserCheckRow) ?? []
    },
  }
}

function toChecklistSnapshot(
  trip: TripDetailReadModel,
  checklists: ChecklistReadModel[],
): ChecklistRepositorySnapshot {
  const items = checklists.flatMap((checklist) => checklist.items.map(toChecklistItemRow))
  return {
    checklistId: checklists[0]?.id ?? null,
    checklists: checklists.map((checklist) => ({
      id: checklist.id,
      trip_id: trip.id,
      title: checklist.title,
      created_at: checklist.createdAt,
    })),
    trip: {
      id: trip.id,
      user_id: trip.ownerId,
      destination: trip.destination,
      start_date: trip.startDate,
      end_date: trip.endDate,
      adults_count: trip.adultsCount,
      children_count: trip.childrenCount,
      created_at: trip.updatedAt,
      updated_at: trip.updatedAt,
    },
    items,
    members: trip.members
      .filter((member) => member.status !== 'revoked')
      .map(toChecklistMemberRow),
    userChecks: checklists.flatMap((checklist) =>
      checklist.items.flatMap((item) => item.userChecks.map(toUserCheckRow)),
    ),
    itemAssignees: checklists.flatMap((checklist) =>
      checklist.items.flatMap((item) => item.assignees.map(toAssigneeRow)),
    ),
  }
}

function toChecklistItemRow(item: ChecklistItemReadModel): ChecklistItem {
  return {
    id: item.id,
    checklist_id: item.checklistId,
    item_name: item.name,
    category: item.categoryName,
    is_checked: item.status.isChecked,
    is_private: item.isPrivate,
    assignment_type: item.assignmentType,
    assigned_user_id: item.assignedUserId,
    source_template_name: item.sourceTemplateName,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }
}

function toChecklistMemberRow(member: TripMemberReadModel): ChecklistMemberSnapshot {
  return {
    id: member.id,
    trip_id: '',
    user_id: member.userId,
    invited_email: member.invitedEmail ?? '',
    role: member.role,
    status: member.status === 'pending' ? 'pending' : 'accepted',
    created_at: '',
    email: member.email,
    profiles: {
      nickname: member.nickname,
      email: member.email,
    },
  }
}

function toUserCheckRow(check: ChecklistItemReadModel['userChecks'][number]): ChecklistItemUserCheck {
  return {
    id: check.id,
    item_id: check.itemId,
    user_id: check.userId,
    created_at: check.createdAt,
  }
}

function toAssigneeRow(assignee: ChecklistItemReadModel['assignees'][number]): ChecklistItemAssignee {
  return {
    id: assignee.id,
    item_id: assignee.itemId,
    user_id: assignee.userId,
    created_at: assignee.createdAt,
  }
}

async function resolveTripIdForChecklist(
  repositories: Awaited<ReturnType<typeof createWebDocumentPrimaryRepositories>>,
  checklistId: string,
): Promise<string | null> {
  const trips = await repositories.trips.listTrips('')
  for (const trip of trips) {
    const document = await repositories.trips.getTripDocument(trip.id)
    if (document?.checklists[checklistId]) return trip.id
  }
  return null
}

async function resolveTripAndItem(
  repositories: Awaited<ReturnType<typeof createWebDocumentPrimaryRepositories>>,
  itemId: string,
): Promise<{ tripId: string; item: ChecklistItemReadModel } | null> {
  const trips = await repositories.trips.listTrips('')
  for (const trip of trips) {
    const checklists = await repositories.checklists.getChecklist(trip.id)
    for (const item of checklists.flatMap((checklist) => checklist.items)) {
      if (item.id === itemId) return { tripId: trip.id, item }
    }
  }
  return null
}

async function resolveCurrentTripRole(
  supabase: SupabaseClient,
  repositories: Awaited<ReturnType<typeof createWebDocumentPrimaryRepositories>>,
  tripId: string,
): Promise<'owner' | 'editor' | 'viewer' | null> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) return null
  const document = await repositories.trips.getTripDocument(tripId)
  if (!document) return null
  if (document.trip.ownerId === userId) return 'owner'
  return Object.values(document.members)
    .find((member) => member.userId === userId && member.status === 'accepted')
    ?.role ?? null
}

function toMutationResult(
  document: TripDocumentV1,
  itemId: string,
): ChecklistItemMutationResult {
  const item = Object.values(document.checklistItems).find((candidate) => candidate.id === itemId)
  if (!item) throw new Error('Checklist item mutation result was not found.')
  return {
    item: {
      id: item.id,
      checklist_id: item.checklistId,
      item_name: item.name,
      category: item.categoryName,
      is_checked: item.legacyIsChecked,
      is_private: item.isPrivate,
      assignment_type: item.assignmentType,
      assigned_user_id: item.assignedUserId,
      source_template_name: item.sourceTemplateName,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    },
    assignees: Object.values(document.checklistItemAssignees)
      .filter((assignee) => assignee.itemId === itemId)
      .map(toAssigneeRow),
  }
}

function createEntityId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
