import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Checklist,
  ChecklistItem,
  ChecklistItemAssignee,
  ChecklistItemUserCheck,
  Trip,
  TripMember,
} from '@nexvoy/types'
import {
  createEmptyTripDocumentV1,
  convertLegacyTripRowsToDocument,
  materializeChecklists,
  type ChecklistRepository,
  type ChecklistRepositorySnapshot,
  type ChecklistItemMutationResult,
  type ToggleChecklistItemForUserInput,
  type TripDocumentV1,
} from '@nexvoy/core'
import {
  applyTripDocumentUpdate,
  createYjsTripDocument,
  encodeTripDocumentUpdate,
  mutateTripDocumentInYjs,
  readTripDocumentFromYjs,
  writeTripDocumentToYjs,
} from '@nexvoy/core/local-first/yjsTripDocument'
import type { ChecklistItemInput } from '@nexvoy/core/supabase/queries'
import { getLegacyTripRowBundle } from '@nexvoy/core/supabase/legacyRepository'
import {
  loadAllTripDocumentUpdates,
  loadTripDocumentUpdate,
  saveTripDocumentUpdate,
} from './indexedDbStore'

const SPIKE_USER_ID = 'local-first-spike-user'

export function createWebLocalFirstChecklistRepository(
  supabase: SupabaseClient,
): ChecklistRepository {
  return {
    getChecklist: (tripId) => getLocalChecklistSnapshot(supabase, tripId),
    createItem: async (checklistId, input) => {
      const tripId = await resolveTripIdForChecklistId(checklistId)
      if (!tripId) throw new Error('Local-first checklist id is invalid.')
      let createdItemId = ''
      const document = await mutateLocalTripDocument(supabase, tripId, (tripDocument) => {
        const now = new Date().toISOString()
        const itemId = createLocalEntityId('item', tripId)
        createdItemId = itemId
        const assigneeIds = normalizeAssigneeIds(input)

        tripDocument.checklistItems[itemId] = {
          id: itemId,
          checklistId,
          name: input.item_name.trim(),
          categoryName: input.category ?? '기타',
          legacyIsChecked: false,
          isPrivate: input.is_private ?? false,
          assignmentType: input.assignment_type ?? 'anyone',
          assignedUserId: assigneeIds[0] ?? input.assigned_user_id ?? null,
          sourceTemplateName: input.source_template_name ?? null,
          createdAt: now,
          updatedAt: now,
        }
        replaceAssignees(tripDocument, itemId, assigneeIds, now)
      })
      return toMutationResult(document, createdItemId)
    },
    updateItem: async (itemId, input) => {
      const tripId = await resolveTripIdForItemId(itemId)
      if (!tripId) throw new Error('Local-first item id is invalid.')
      const document = await mutateLocalTripDocument(supabase, tripId, (tripDocument) => {
        const item = tripDocument.checklistItems[itemId]
        if (!item) throw new Error('Local-first checklist item was not found.')
        const now = new Date().toISOString()
        const assigneeIds = normalizeAssigneeIds(input)

        item.name = input.item_name.trim()
        item.categoryName = input.category ?? '기타'
        item.isPrivate = input.is_private ?? false
        item.assignmentType = input.assignment_type ?? 'anyone'
        item.assignedUserId = assigneeIds[0] ?? input.assigned_user_id ?? null
        item.sourceTemplateName = input.source_template_name ?? item.sourceTemplateName
        item.updatedAt = now
        replaceAssignees(tripDocument, itemId, assigneeIds, now)
      })
      return toMutationResult(document, itemId)
    },
    deleteItem: async (itemId) => {
      const tripId = await resolveTripIdForItemId(itemId)
      if (!tripId) throw new Error('Local-first item id is invalid.')
      await mutateLocalTripDocument(supabase, tripId, (tripDocument) => {
        const now = new Date().toISOString()
        tripDocument.tombstones[`tombstone:${itemId}`] = {
          id: `tombstone:${itemId}`,
          entityType: 'checklistItem',
          entityId: itemId,
          deletedBy: tripDocument.trip.ownerId,
          deletedAt: now,
        }
      })
    },
    toggleItem: async (itemId, isChecked) => {
      const tripId = await resolveTripIdForItemId(itemId)
      if (!tripId) throw new Error('Local-first item id is invalid.')
      await mutateLocalTripDocument(supabase, tripId, (tripDocument) => {
        const item = tripDocument.checklistItems[itemId]
        if (!item) throw new Error('Local-first checklist item was not found.')
        item.legacyIsChecked = isChecked
        item.updatedAt = new Date().toISOString()
      })
    },
    toggleItemForUser: async (input) => {
      const tripId = await resolveTripIdForChecklistId(input.item.checklist_id)
        ?? await resolveTripIdForItemId(input.item.id)
      if (!tripId) throw new Error('Local-first item id is invalid.')
      const document = await mutateLocalTripDocument(supabase, tripId, (tripDocument) => {
        const item = tripDocument.checklistItems[input.item.id]
        if (!item) throw new Error('Local-first checklist item was not found.')
        const checkId = createUserCheckId(input.item.id, input.currentUserId)

        if (input.nextChecked) {
          tripDocument.checklistItemUserChecks[checkId] = {
            id: checkId,
            itemId: input.item.id,
            userId: input.currentUserId,
            createdAt: new Date().toISOString(),
          }
        } else {
          delete tripDocument.checklistItemUserChecks[checkId]
        }

        const requiredIds = item.assignmentType === 'everyone'
          ? input.participantIds ?? []
          : getAssigneeIds(tripDocument, input.item.id)
        if (requiredIds.length > 0) {
          const checkedIds = new Set(
            Object.values(tripDocument.checklistItemUserChecks)
              .filter((check) => check.itemId === input.item.id)
              .map((check) => check.userId),
          )
          item.legacyIsChecked = requiredIds.every((userId) => checkedIds.has(userId))
          item.updatedAt = new Date().toISOString()
        }
      })

      return toChecklistItemUserCheckRows(document, input.item.id)
    },
  }
}

async function getLocalChecklistSnapshot(
  supabase: SupabaseClient,
  tripId: string,
): Promise<ChecklistRepositorySnapshot> {
  const document = await loadOrCreateTripDocument(supabase, tripId)
  return toChecklistRepositorySnapshot(document, await getCurrentUserId(supabase))
}

async function mutateLocalTripDocument(
  supabase: SupabaseClient,
  tripId: string,
  mutate: (tripDocument: TripDocumentV1) => void,
): Promise<TripDocumentV1> {
  const ydoc = await loadYjsTripDocument(supabase, tripId)
  const document = mutateTripDocumentInYjs(ydoc, (tripDocument) => {
    mutate(tripDocument)
  })
  await saveTripDocumentUpdate(tripId, encodeTripDocumentUpdate(ydoc))
  return document
}

async function loadOrCreateTripDocument(
  supabase: SupabaseClient,
  tripId: string,
): Promise<TripDocumentV1> {
  const ydoc = createYjsTripDocument()
  const update = await loadTripDocumentUpdate(tripId)
  if (update) {
    applyTripDocumentUpdate(ydoc, update)
  }
  const document = readTripDocumentFromYjs(ydoc)
  if (document) return document

  const initialDocument = await createInitialTripDocument(supabase, tripId)
  writeTripDocumentToYjs(ydoc, initialDocument)
  await saveTripDocumentUpdate(tripId, encodeTripDocumentUpdate(ydoc))
  return initialDocument
}

async function loadYjsTripDocument(
  supabase: SupabaseClient,
  tripId: string,
) {
  const ydoc = createYjsTripDocument()
  const update = await loadTripDocumentUpdate(tripId)
  if (update) {
    applyTripDocumentUpdate(ydoc, update)
  } else {
    writeTripDocumentToYjs(ydoc, await createInitialTripDocument(supabase, tripId))
  }
  return ydoc
}

async function createInitialTripDocument(
  supabase: SupabaseClient,
  tripId: string,
): Promise<TripDocumentV1> {
  const hydratedDocument = await hydrateTripDocumentFromLegacyRows(supabase, tripId)
  if (hydratedDocument) return hydratedDocument

  const now = new Date().toISOString()
  const ownerId = await getCurrentUserId(supabase) ?? SPIKE_USER_ID
  const checklistId = createLocalChecklistId(tripId)
  const today = now.slice(0, 10)
  const tripDocument = createEmptyTripDocumentV1({
    id: tripId,
    ownerId,
    destination: 'Local-first checklist spike',
    startDate: today,
    endDate: today,
    adultsCount: 1,
    childrenCount: 0,
    createdAt: now,
    createdFromLegacyAt: now,
  })

  tripDocument.checklists[checklistId] = {
    id: checklistId,
    title: '로컬 준비물',
    createdAt: now,
  }
  tripDocument.members[`member:${ownerId}`] = {
    id: `member:${ownerId}`,
    userId: ownerId,
    invitedEmail: null,
    role: 'owner',
    status: 'accepted',
    nickname: '나',
    email: null,
    createdAt: now,
    updatedAt: now,
  }

  return tripDocument
}

async function hydrateTripDocumentFromLegacyRows(
  supabase: SupabaseClient,
  tripId: string,
): Promise<TripDocumentV1 | null> {
  try {
    const bundle = await getLegacyTripRowBundle(supabase, tripId, await getCurrentUserId(supabase))
    if (!bundle) return null

    const result = convertLegacyTripRowsToDocument(bundle)
    if (result.validationMessages.length > 0) {
      console.warn('[local-first hydration]', {
        tripId,
        validationCodes: result.validationMessages.map((message) => message.code),
      })
    }
    return result.document
  } catch (error) {
    console.warn('[local-first hydration] fallback to empty document', {
      tripId,
      error: error instanceof Error ? error.message : 'unknown error',
    })
    return null
  }
}

function toChecklistRepositorySnapshot(
  tripDocument: TripDocumentV1,
  currentUserId: string | null,
): ChecklistRepositorySnapshot {
  const materializedChecklists = materializeChecklists(tripDocument, { currentUserId })
  const checklists = materializedChecklists.map((checklist): Checklist => ({
    id: checklist.id,
    trip_id: tripDocument.trip.id,
    title: checklist.title,
    created_at: checklist.createdAt,
  }))
  const items = materializedChecklists.flatMap((checklist) =>
    checklist.items.map((item): ChecklistItem => ({
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
    })),
  )
  const trip = toTripRow(tripDocument)

  return {
    checklistId: checklists[0]?.id ?? null,
    checklists,
    trip,
    items,
    members: toTripMemberRows(tripDocument),
    userChecks: Object.values(tripDocument.checklistItemUserChecks).map(toUserCheckRow),
    itemAssignees: Object.values(tripDocument.checklistItemAssignees).map(toAssigneeRow),
  }
}

function toMutationResult(
  tripDocument: TripDocumentV1,
  itemId: string,
): ChecklistItemMutationResult {
  const snapshot = toChecklistRepositorySnapshot(tripDocument, null)
  const item = snapshot.items.find((row) => row.id === itemId)
  if (!item) throw new Error('Local-first checklist item mutation result was not found.')

  return {
    item,
    assignees: snapshot.itemAssignees.filter((assignee) => assignee.item_id === itemId),
  }
}

function toTripRow(tripDocument: TripDocumentV1): Trip {
  return {
    id: tripDocument.trip.id,
    user_id: tripDocument.trip.ownerId,
    destination: tripDocument.trip.destination,
    start_date: tripDocument.trip.startDate,
    end_date: tripDocument.trip.endDate,
    adults_count: tripDocument.trip.adultsCount,
    children_count: tripDocument.trip.childrenCount,
    created_at: tripDocument.trip.createdAt,
    updated_at: tripDocument.trip.updatedAt,
  }
}

function toTripMemberRows(tripDocument: TripDocumentV1): TripMember[] {
  return Object.values(tripDocument.members)
    .filter((member) => member.status === 'accepted')
    .map((member) => ({
      id: member.id,
      trip_id: tripDocument.trip.id,
      user_id: member.userId,
      invited_email: member.invitedEmail ?? '',
      role: member.role,
      status: member.status === 'revoked' ? 'pending' : member.status,
      created_at: member.createdAt,
      profiles: {
        nickname: member.nickname,
        email: member.email,
      },
    }))
}

function toAssigneeRow(assignee: {
  id: string
  itemId: string
  userId: string
  createdAt: string
}): ChecklistItemAssignee {
  return {
    id: assignee.id,
    item_id: assignee.itemId,
    user_id: assignee.userId,
    created_at: assignee.createdAt,
  }
}

function toUserCheckRow(check: {
  id: string
  itemId: string
  userId: string
  createdAt: string
}): ChecklistItemUserCheck {
  return {
    id: check.id,
    item_id: check.itemId,
    user_id: check.userId,
    created_at: check.createdAt,
  }
}

function toChecklistItemUserCheckRows(
  tripDocument: TripDocumentV1,
  itemId: string,
): ChecklistItemUserCheck[] {
  return Object.values(tripDocument.checklistItemUserChecks)
    .filter((check) => check.itemId === itemId)
    .map(toUserCheckRow)
}

function replaceAssignees(
  tripDocument: TripDocumentV1,
  itemId: string,
  assigneeIds: string[],
  createdAt: string,
): void {
  for (const assignee of Object.values(tripDocument.checklistItemAssignees)) {
    if (assignee.itemId === itemId) {
      delete tripDocument.checklistItemAssignees[assignee.id]
    }
  }

  for (const userId of assigneeIds) {
    const assigneeId = createAssigneeId(itemId, userId)
    tripDocument.checklistItemAssignees[assigneeId] = {
      id: assigneeId,
      itemId,
      userId,
      createdAt,
    }
  }
}

function normalizeAssigneeIds(input: ChecklistItemInput): string[] {
  return Array.from(new Set((input.assignee_ids ?? [input.assigned_user_id]).filter(isPresent)))
}

function getAssigneeIds(tripDocument: TripDocumentV1, itemId: string): string[] {
  const assigneeIds = Object.values(tripDocument.checklistItemAssignees)
    .filter((assignee) => assignee.itemId === itemId)
    .map((assignee) => assignee.userId)
  const legacyAssignedUserId = tripDocument.checklistItems[itemId]?.assignedUserId
  return assigneeIds.length > 0
    ? assigneeIds
    : legacyAssignedUserId
      ? [legacyAssignedUserId]
      : []
}

async function getCurrentUserId(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

function createLocalChecklistId(tripId: string): string {
  return `local-checklist:${tripId}`
}

function createLocalEntityId(entity: 'item', tripId: string): string {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `local-${entity}:${tripId}:${id}`
}

function createAssigneeId(itemId: string, userId: string): string {
  return `assignee:${itemId}:${userId}`
}

function createUserCheckId(itemId: string, userId: string): string {
  return `check:${itemId}:${userId}`
}

function parseTripIdFromChecklistId(checklistId: string): string | null {
  return checklistId.startsWith('local-checklist:')
    ? checklistId.slice('local-checklist:'.length)
    : null
}

function parseTripIdFromItemId(itemId: string): string | null {
  if (!itemId.startsWith('local-item:')) return null
  const [, tripId] = itemId.split(':')
  return tripId || null
}

async function resolveTripIdForChecklistId(checklistId: string): Promise<string | null> {
  return parseTripIdFromChecklistId(checklistId)
    ?? findTripIdInLocalDocuments((tripDocument) => Boolean(tripDocument.checklists[checklistId]))
}

async function resolveTripIdForItemId(itemId: string): Promise<string | null> {
  return parseTripIdFromItemId(itemId)
    ?? findTripIdInLocalDocuments((tripDocument) => Boolean(tripDocument.checklistItems[itemId]))
}

async function findTripIdInLocalDocuments(
  matches: (tripDocument: TripDocumentV1) => boolean,
): Promise<string | null> {
  const rows = await loadAllTripDocumentUpdates()
  for (const row of rows) {
    const ydoc = createYjsTripDocument()
    applyTripDocumentUpdate(ydoc, new Uint8Array(row.update))
    const tripDocument = readTripDocumentFromYjs(ydoc)
    if (tripDocument && matches(tripDocument)) return tripDocument.trip.id
  }
  return null
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}
