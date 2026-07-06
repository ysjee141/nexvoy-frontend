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
  type ChecklistItemMutationResult,
  type ChecklistRepositorySnapshot,
  type DualWriteChecklistLocalWriter,
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

export function createWebChecklistDocumentWriter(
  supabase: SupabaseClient,
): DualWriteChecklistLocalWriter {
  return {
    getChecklist: async (tripId) => toChecklistRepositorySnapshot(
      await loadOrCreateTripDocument(supabase, tripId),
      await getCurrentUserId(supabase),
    ),
    applyCreateItem: async (checklistId, input, result) => {
      const tripId = await resolveTripIdForChecklistId(supabase, checklistId)
      if (!tripId) throw new Error('Dual-write checklist id is invalid.')
      await mutateLocalTripDocument(supabase, tripId, (tripDocument) => {
        upsertItemFromLegacyResult(tripDocument, input, result)
      })
      return { tripId }
    },
    applyUpdateItem: async (itemId, input) => {
      const tripId = await resolveTripIdForItemId(supabase, itemId)
      if (!tripId) throw new Error('Dual-write item id is invalid.')
      await mutateLocalTripDocument(supabase, tripId, (tripDocument) => {
        const item = tripDocument.checklistItems[itemId]
        if (!item) throw new Error('Dual-write checklist item was not found.')
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
      return { tripId }
    },
    applyDeleteItem: async (itemId) => {
      const tripId = await resolveTripIdForItemId(supabase, itemId)
      if (!tripId) throw new Error('Dual-write item id is invalid.')
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
      return { tripId }
    },
    applyToggleItem: async (itemId, isChecked) => {
      const tripId = await resolveTripIdForItemId(supabase, itemId)
      if (!tripId) throw new Error('Dual-write item id is invalid.')
      await mutateLocalTripDocument(supabase, tripId, (tripDocument) => {
        const item = tripDocument.checklistItems[itemId]
        if (!item) throw new Error('Dual-write checklist item was not found.')
        item.legacyIsChecked = isChecked
        item.updatedAt = new Date().toISOString()
      })
      return { tripId }
    },
    applyToggleItemForUser: async (input, result) => {
      const tripId = await resolveTripIdForChecklistId(supabase, input.item.checklist_id)
        ?? await resolveTripIdForItemId(supabase, input.item.id)
      if (!tripId) throw new Error('Dual-write item id is invalid.')
      await mutateLocalTripDocument(supabase, tripId, (tripDocument) => {
        const item = tripDocument.checklistItems[input.item.id]
        if (!item) throw new Error('Dual-write checklist item was not found.')

        replaceUserChecksForItem(tripDocument, input.item.id, result)
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
        } else {
          item.legacyIsChecked = input.nextChecked
        }
        item.updatedAt = new Date().toISOString()
      })
      return { tripId }
    },
  }
}

async function mutateLocalTripDocument(
  supabase: SupabaseClient,
  tripId: string,
  mutate: (tripDocument: TripDocumentV1) => void,
): Promise<TripDocumentV1> {
  const ydoc = await loadYjsTripDocument(supabase, tripId)
  const document = mutateTripDocumentInYjs(ydoc, mutate)
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
    destination: 'Local-first checklist dual-write',
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
  return tripDocument
}

async function hydrateTripDocumentFromLegacyRows(
  supabase: SupabaseClient,
  tripId: string,
): Promise<TripDocumentV1 | null> {
  try {
    const bundle = await getLegacyTripRowBundle(supabase, tripId, await getCurrentUserId(supabase))
    if (!bundle) return null
    return convertLegacyTripRowsToDocument(bundle).document
  } catch {
    return null
  }
}

function upsertItemFromLegacyResult(
  tripDocument: TripDocumentV1,
  input: ChecklistItemInput,
  result: ChecklistItemMutationResult,
): void {
  const now = result.item.updated_at ?? new Date().toISOString()
  const assigneeIds = result.assignees.map((assignee) => assignee.user_id)
  tripDocument.checklistItems[result.item.id] = {
    id: result.item.id,
    checklistId: result.item.checklist_id,
    name: result.item.item_name.trim(),
    categoryName: result.item.category ?? input.category ?? '기타',
    legacyIsChecked: result.item.is_checked,
    isPrivate: result.item.is_private ?? false,
    assignmentType: result.item.assignment_type ?? input.assignment_type ?? 'anyone',
    assignedUserId: assigneeIds[0] ?? result.item.assigned_user_id ?? input.assigned_user_id ?? null,
    sourceTemplateName: result.item.source_template_name ?? input.source_template_name ?? null,
    createdAt: result.item.created_at,
    updatedAt: now,
  }
  replaceAssignees(tripDocument, result.item.id, assigneeIds, now)
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
  const activeItemIds = new Set(items.map((item) => item.id))

  return {
    checklistId: checklists[0]?.id ?? null,
    checklists,
    trip: toTripRow(tripDocument),
    items,
    members: toTripMemberRows(tripDocument),
    userChecks: Object.values(tripDocument.checklistItemUserChecks)
      .filter((check) => activeItemIds.has(check.itemId))
      .map(toUserCheckRow),
    itemAssignees: Object.values(tripDocument.checklistItemAssignees)
      .filter((assignee) => activeItemIds.has(assignee.itemId))
      .map(toAssigneeRow),
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

function replaceUserChecksForItem(
  tripDocument: TripDocumentV1,
  itemId: string,
  checks: ChecklistItemUserCheck[],
): void {
  for (const check of Object.values(tripDocument.checklistItemUserChecks)) {
    if (check.itemId === itemId) {
      delete tripDocument.checklistItemUserChecks[check.id]
    }
  }
  for (const check of checks) {
    const checkId = createUserCheckId(check.item_id, check.user_id)
    tripDocument.checklistItemUserChecks[checkId] = {
      id: checkId,
      itemId: check.item_id,
      userId: check.user_id,
      createdAt: check.created_at,
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

async function resolveTripIdForChecklistId(
  supabase: SupabaseClient,
  checklistId: string,
): Promise<string | null> {
  return parseTripIdFromChecklistId(checklistId)
    ?? findTripIdInLocalDocuments((tripDocument) => Boolean(tripDocument.checklists[checklistId]))
    ?? findTripIdForLegacyChecklistId(supabase, checklistId)
}

async function resolveTripIdForItemId(
  supabase: SupabaseClient,
  itemId: string,
): Promise<string | null> {
  return findTripIdInLocalDocuments((tripDocument) => Boolean(tripDocument.checklistItems[itemId]))
    ?? findTripIdForLegacyItemId(supabase, itemId)
}

async function findTripIdForLegacyChecklistId(
  supabase: SupabaseClient,
  checklistId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('checklists')
    .select('trip_id')
    .eq('id', checklistId)
    .maybeSingle()
  if (error) throw error
  return data?.trip_id ?? null
}

async function findTripIdForLegacyItemId(
  supabase: SupabaseClient,
  itemId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('checklist_id')
    .eq('id', itemId)
    .maybeSingle()
  if (error) throw error
  return data?.checklist_id
    ? findTripIdForLegacyChecklistId(supabase, data.checklist_id)
    : null
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
