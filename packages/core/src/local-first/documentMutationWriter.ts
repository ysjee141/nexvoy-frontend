import {
  type ChecklistItemNode,
  type ChecklistNode,
  type EntityId,
  type IsoDateTimeString,
  type PlanNode,
  type PlanUrlNode,
  type TombstoneEntityType,
  type TripDocumentV1,
  type TripMemberNode,
  type UserId,
} from './documentModel'
import {
  createYjsTripDocument,
  encodeTripDocumentUpdate,
  mutateTripDocumentInYjs,
} from './yjsTripDocument'
import {
  createYjsTemplateDocument,
  encodeTemplateDocumentUpdate,
  mutateTemplateDocumentInYjs,
  type TemplateDocumentV1,
  type TemplateItemNode,
  type TemplateShareNode,
  type TemplateTombstoneEntityType,
} from './templateDocument'
import { canWriteDocument, type DocumentPermissionSubject } from './permissions'

export type DocumentMutationDocumentType = 'trip' | 'template'
export type DocumentMutationOperation =
  | 'trip.update'
  | 'trip.delete'
  | 'plan.create'
  | 'plan.update'
  | 'plan.delete'
  | 'planUrl.upsert'
  | 'planUrl.delete'
  | 'checklist.create'
  | 'checklistItem.create'
  | 'checklistItem.update'
  | 'checklistItem.delete'
  | 'checklistItem.toggle'
  | 'checklistItem.applyTemplate'
  | 'member.upsert'
  | 'member.revoke'
  | 'template.update'
  | 'template.delete'
  | 'templateItem.replaceAll'
  | 'templateShare.upsert'
  | 'templateShare.remove'

export interface DocumentMutationActor extends DocumentPermissionSubject {
  userId: UserId
}

export interface DocumentMutationChangedEntity {
  entityType: string
  entityId: EntityId
}

export interface DocumentMutationResult<TDocument> {
  documentType: DocumentMutationDocumentType
  documentId: EntityId
  operation: DocumentMutationOperation
  document: TDocument
  update: Uint8Array
  changedEntities: DocumentMutationChangedEntity[]
}

export interface DocumentMutationPublisher {
  publishMutation(result: DocumentMutationResult<TripDocumentV1 | TemplateDocumentV1>): Promise<void> | void
}

export interface CreatePlanMutationInput extends Omit<PlanNode, 'createdAt' | 'updatedAt'> {
  createdAt?: IsoDateTimeString
  updatedAt?: IsoDateTimeString
}

export interface UpdatePlanMutationInput {
  planId: EntityId
  patch: Partial<Omit<PlanNode, 'id' | 'createdAt' | 'updatedAt'>>
  updatedAt?: IsoDateTimeString
}

export interface UpsertPlanUrlMutationInput extends Omit<PlanUrlNode, 'createdAt'> {
  createdAt?: IsoDateTimeString
}

export interface CreateChecklistMutationInput extends Omit<ChecklistNode, 'createdAt'> {
  createdAt?: IsoDateTimeString
}

export interface CreateChecklistItemMutationInput extends Omit<ChecklistItemNode, 'createdAt' | 'updatedAt'> {
  assigneeIds?: UserId[]
  checkedUserIds?: UserId[]
  createdAt?: IsoDateTimeString
  updatedAt?: IsoDateTimeString
}

export interface UpdateChecklistItemMutationInput {
  itemId: EntityId
  patch: Partial<Omit<ChecklistItemNode, 'id' | 'checklistId' | 'createdAt' | 'updatedAt'>>
  assigneeIds?: UserId[]
  updatedAt?: IsoDateTimeString
}

export interface ToggleChecklistItemMutationInput {
  itemId: EntityId
  nextChecked: boolean
  currentUserId?: UserId | null
  participantIds?: UserId[]
  updatedAt?: IsoDateTimeString
}

export interface ApplyTemplateToChecklistMutationInput {
  checklistId: EntityId
  template: TemplateDocumentV1
  itemIds: EntityId[]
  now?: IsoDateTimeString
}

export interface UpsertMemberMutationInput {
  member: TripMemberNode
}

export interface ReplaceTemplateItemsMutationInput {
  items: Array<Omit<TemplateItemNode, 'templateId' | 'createdAt' | 'updatedAt'> & {
    createdAt?: IsoDateTimeString
    updatedAt?: IsoDateTimeString
  }>
  now?: IsoDateTimeString
}

export interface UpsertTemplateShareMutationInput {
  share: TemplateShareNode
}

export function updateTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  patch: Partial<Omit<TripDocumentV1['trip'], 'id' | 'ownerId' | 'createdAt'>>,
): DocumentMutationResult<TripDocumentV1> {
  return mutateTripDocument(document, actor, 'trip.update', (draft) => {
    draft.trip = {
      ...draft.trip,
      ...patch,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    }
    return [{ entityType: 'trip', entityId: draft.trip.id }]
  })
}

export function deleteTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  deletedAt = new Date().toISOString(),
): DocumentMutationResult<TripDocumentV1> {
  return tombstoneTripEntity(document, actor, 'trip.delete', 'trip', document.trip.id, deletedAt)
}

export function createPlanInTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  input: CreatePlanMutationInput,
): DocumentMutationResult<TripDocumentV1> {
  return mutateTripDocument(document, actor, 'plan.create', (draft) => {
    const now = input.createdAt ?? new Date().toISOString()
    draft.plans[input.id] = {
      ...input,
      createdAt: now,
      updatedAt: input.updatedAt ?? now,
    }
    draft.planOrder = appendUnique(draft.planOrder, input.id)
    draft.trip.updatedAt = input.updatedAt ?? now
    return [{ entityType: 'plan', entityId: input.id }]
  })
}

export function updatePlanInTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  input: UpdatePlanMutationInput,
): DocumentMutationResult<TripDocumentV1> {
  return mutateTripDocument(document, actor, 'plan.update', (draft) => {
    const plan = draft.plans[input.planId]
    if (!plan) throw new Error('Plan was not found in trip document.')
    const updatedAt = input.updatedAt ?? new Date().toISOString()
    draft.plans[input.planId] = {
      ...plan,
      ...input.patch,
      updatedAt,
    }
    draft.trip.updatedAt = updatedAt
    return [{ entityType: 'plan', entityId: input.planId }]
  })
}

export function deletePlanInTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  planId: EntityId,
  deletedAt = new Date().toISOString(),
): DocumentMutationResult<TripDocumentV1> {
  return tombstoneTripEntity(document, actor, 'plan.delete', 'plan', planId, deletedAt)
}

export function upsertPlanUrlInTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  input: UpsertPlanUrlMutationInput,
): DocumentMutationResult<TripDocumentV1> {
  return mutateTripDocument(document, actor, 'planUrl.upsert', (draft) => {
    if (!draft.plans[input.planId]) throw new Error('Plan URL references missing plan.')
    draft.planUrls[input.id] = {
      ...input,
      createdAt: input.createdAt ?? new Date().toISOString(),
    }
    return [{ entityType: 'planUrl', entityId: input.id }]
  })
}

export function deletePlanUrlInTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  planUrlId: EntityId,
  deletedAt = new Date().toISOString(),
): DocumentMutationResult<TripDocumentV1> {
  return tombstoneTripEntity(document, actor, 'planUrl.delete', 'planUrl', planUrlId, deletedAt)
}

export function createChecklistInTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  input: CreateChecklistMutationInput,
): DocumentMutationResult<TripDocumentV1> {
  return mutateTripDocument(document, actor, 'checklist.create', (draft) => {
    draft.checklists[input.id] = {
      ...input,
      createdAt: input.createdAt ?? new Date().toISOString(),
    }
    return [{ entityType: 'checklist', entityId: input.id }]
  })
}

export function createChecklistItemInTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  input: CreateChecklistItemMutationInput,
): DocumentMutationResult<TripDocumentV1> {
  return mutateTripDocument(document, actor, 'checklistItem.create', (draft) => {
    if (!draft.checklists[input.checklistId]) throw new Error('Checklist item references missing checklist.')
    const now = input.createdAt ?? new Date().toISOString()
    const assigneeIds = input.assigneeIds ?? []
    const checkedUserIds = input.checkedUserIds ?? []
    draft.checklistItems[input.id] = {
      id: input.id,
      checklistId: input.checklistId,
      name: input.name,
      categoryName: input.categoryName,
      legacyIsChecked: input.legacyIsChecked,
      isPrivate: input.isPrivate,
      assignmentType: input.assignmentType,
      assignedUserId: input.assignedUserId,
      sourceTemplateName: input.sourceTemplateName,
      createdAt: now,
      updatedAt: input.updatedAt ?? now,
    }
    replaceChecklistItemAssignees(draft, input.id, assigneeIds, now)
    replaceChecklistItemUserChecks(draft, input.id, checkedUserIds, now)
    return [{ entityType: 'checklistItem', entityId: input.id }]
  })
}

export function updateChecklistItemInTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  input: UpdateChecklistItemMutationInput,
): DocumentMutationResult<TripDocumentV1> {
  return mutateTripDocument(document, actor, 'checklistItem.update', (draft) => {
    const item = draft.checklistItems[input.itemId]
    if (!item) throw new Error('Checklist item was not found in trip document.')
    const updatedAt = input.updatedAt ?? new Date().toISOString()
    draft.checklistItems[input.itemId] = {
      ...item,
      ...input.patch,
      updatedAt,
    }
    if (input.assigneeIds) replaceChecklistItemAssignees(draft, input.itemId, input.assigneeIds, updatedAt)
    return [{ entityType: 'checklistItem', entityId: input.itemId }]
  })
}

export function deleteChecklistItemInTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  itemId: EntityId,
  deletedAt = new Date().toISOString(),
): DocumentMutationResult<TripDocumentV1> {
  return tombstoneTripEntity(document, actor, 'checklistItem.delete', 'checklistItem', itemId, deletedAt)
}

export function toggleChecklistItemInTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  input: ToggleChecklistItemMutationInput,
): DocumentMutationResult<TripDocumentV1> {
  return mutateTripDocument(document, actor, 'checklistItem.toggle', (draft) => {
    const item = draft.checklistItems[input.itemId]
    if (!item) throw new Error('Checklist item was not found in trip document.')
    const updatedAt = input.updatedAt ?? new Date().toISOString()
    const currentUserId = input.currentUserId ?? actor.userId

    if (item.assignmentType === 'everyone' || item.assignmentType === 'specific') {
      const checkedUserIds = new Set(
        Object.values(draft.checklistItemUserChecks)
          .filter((check) => check.itemId === input.itemId)
          .map((check) => check.userId),
      )
      if (input.nextChecked) {
        checkedUserIds.add(currentUserId)
      } else {
        checkedUserIds.delete(currentUserId)
      }
      replaceChecklistItemUserChecks(draft, input.itemId, Array.from(checkedUserIds), updatedAt)

      const requiredIds = item.assignmentType === 'everyone'
        ? input.participantIds ?? getAcceptedMemberUserIds(draft)
        : getChecklistItemAssigneeIds(draft, input.itemId, item.assignedUserId)
      item.legacyIsChecked = requiredIds.length > 0 && requiredIds.every((id) => checkedUserIds.has(id))
    } else {
      item.legacyIsChecked = input.nextChecked
    }

    item.updatedAt = updatedAt
    return [{ entityType: 'checklistItem', entityId: input.itemId }]
  })
}

export function applyTemplateToChecklistInTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  input: ApplyTemplateToChecklistMutationInput,
): DocumentMutationResult<TripDocumentV1> {
  return mutateTripDocument(document, actor, 'checklistItem.applyTemplate', (draft) => {
    if (!draft.checklists[input.checklistId]) throw new Error('Template apply references missing checklist.')
    const now = input.now ?? new Date().toISOString()
    const templateItems = activeTemplateItems(input.template)
    if (input.itemIds.length !== templateItems.length) {
      throw new Error('Template apply item id count must match active template item count.')
    }

    const changed: DocumentMutationChangedEntity[] = []
    templateItems.forEach((templateItem, index) => {
      const itemId = input.itemIds[index]
      draft.checklistItems[itemId] = {
        id: itemId,
        checklistId: input.checklistId,
        name: templateItem.name,
        categoryName: templateItem.categoryName,
        legacyIsChecked: false,
        isPrivate: templateItem.isPrivate,
        assignmentType: 'anyone',
        assignedUserId: null,
        sourceTemplateName: input.template.template.title,
        createdAt: now,
        updatedAt: now,
      }
      changed.push({ entityType: 'checklistItem', entityId: itemId })
    })
    return changed
  })
}

export function upsertMemberInTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  input: UpsertMemberMutationInput,
): DocumentMutationResult<TripDocumentV1> {
  return mutateTripDocument(document, actor, 'member.upsert', (draft) => {
    draft.members[input.member.id] = input.member
    return [{ entityType: 'member', entityId: input.member.id }]
  })
}

export function revokeMemberInTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  memberId: EntityId,
  revokedAt = new Date().toISOString(),
): DocumentMutationResult<TripDocumentV1> {
  return mutateTripDocument(document, actor, 'member.revoke', (draft) => {
    const member = draft.members[memberId]
    if (!member) throw new Error('Member was not found in trip document.')
    member.status = 'revoked'
    member.updatedAt = revokedAt
    return [{ entityType: 'member', entityId: memberId }]
  })
}

export function updateTemplateDocument(
  document: TemplateDocumentV1,
  actor: DocumentMutationActor,
  patch: Partial<Omit<TemplateDocumentV1['template'], 'id' | 'ownerId' | 'createdAt'>>,
): DocumentMutationResult<TemplateDocumentV1> {
  return mutateTemplateDocument(document, actor, 'template.update', (draft) => {
    draft.template = {
      ...draft.template,
      ...patch,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    }
    return [{ entityType: 'template', entityId: draft.template.id }]
  })
}

export function deleteTemplateDocument(
  document: TemplateDocumentV1,
  actor: DocumentMutationActor,
  deletedAt = new Date().toISOString(),
): DocumentMutationResult<TemplateDocumentV1> {
  return mutateTemplateDocument(document, actor, 'template.delete', (draft) => {
    draft.tombstones[`tombstone:template:${draft.template.id}`] = {
      id: `tombstone:template:${draft.template.id}`,
      entityType: 'template',
      entityId: draft.template.id,
      deletedBy: actor.userId,
      deletedAt,
    }
    return [{ entityType: 'template', entityId: draft.template.id }]
  })
}

export function replaceTemplateItemsInDocument(
  document: TemplateDocumentV1,
  actor: DocumentMutationActor,
  input: ReplaceTemplateItemsMutationInput,
): DocumentMutationResult<TemplateDocumentV1> {
  return mutateTemplateDocument(document, actor, 'templateItem.replaceAll', (draft) => {
    const now = input.now ?? new Date().toISOString()
    for (const item of Object.values(draft.items)) {
      draft.tombstones[`tombstone:templateItem:${item.id}`] = {
        id: `tombstone:templateItem:${item.id}`,
        entityType: 'templateItem',
        entityId: item.id,
        deletedBy: actor.userId,
        deletedAt: now,
      }
    }

    draft.items = {}
    for (const item of input.items) {
      draft.items[item.id] = {
        ...item,
        templateId: draft.template.id,
        createdAt: item.createdAt ?? now,
        updatedAt: item.updatedAt ?? now,
      }
    }
    draft.template.updatedAt = now
    return input.items.map((item) => ({ entityType: 'templateItem', entityId: item.id }))
  })
}

export function upsertTemplateShareInDocument(
  document: TemplateDocumentV1,
  actor: DocumentMutationActor,
  input: UpsertTemplateShareMutationInput,
): DocumentMutationResult<TemplateDocumentV1> {
  return mutateTemplateDocument(document, actor, 'templateShare.upsert', (draft) => {
    draft.shares[input.share.id] = input.share
    draft.template.visibility = draft.template.visibility === 'public' ? 'public' : 'shared'
    draft.template.updatedAt = input.share.updatedAt ?? input.share.createdAt
    return [{ entityType: 'templateShare', entityId: input.share.id }]
  })
}

export function removeTemplateShareInDocument(
  document: TemplateDocumentV1,
  actor: DocumentMutationActor,
  shareId: EntityId,
  deletedAt = new Date().toISOString(),
): DocumentMutationResult<TemplateDocumentV1> {
  return tombstoneTemplateEntity(document, actor, 'templateShare.remove', 'templateShare', shareId, deletedAt)
}

function mutateTripDocument(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  operation: DocumentMutationOperation,
  mutate: (draft: TripDocumentV1) => DocumentMutationChangedEntity[],
): DocumentMutationResult<TripDocumentV1> {
  assertCanWrite(actor)
  const ydoc = createYjsTripDocument(document)
  let changedEntities: DocumentMutationChangedEntity[] = []
  const nextDocument = mutateTripDocumentInYjs(ydoc, (draft) => {
    changedEntities = mutate(draft)
  })
  return {
    documentType: 'trip',
    documentId: nextDocument.trip.id,
    operation,
    document: nextDocument,
    update: encodeTripDocumentUpdate(ydoc),
    changedEntities,
  }
}

function mutateTemplateDocument(
  document: TemplateDocumentV1,
  actor: DocumentMutationActor,
  operation: DocumentMutationOperation,
  mutate: (draft: TemplateDocumentV1) => DocumentMutationChangedEntity[],
): DocumentMutationResult<TemplateDocumentV1> {
  assertCanWrite(actor)
  const ydoc = createYjsTemplateDocument(document)
  let changedEntities: DocumentMutationChangedEntity[] = []
  const nextDocument = mutateTemplateDocumentInYjs(ydoc, (draft) => {
    changedEntities = mutate(draft)
  })
  return {
    documentType: 'template',
    documentId: nextDocument.template.id,
    operation,
    document: nextDocument,
    update: encodeTemplateDocumentUpdate(ydoc),
    changedEntities,
  }
}

function tombstoneTripEntity(
  document: TripDocumentV1,
  actor: DocumentMutationActor,
  operation: DocumentMutationOperation,
  entityType: TombstoneEntityType,
  entityId: EntityId,
  deletedAt: IsoDateTimeString,
): DocumentMutationResult<TripDocumentV1> {
  return mutateTripDocument(document, actor, operation, (draft) => {
    draft.tombstones[`tombstone:${entityType}:${entityId}`] = {
      id: `tombstone:${entityType}:${entityId}`,
      entityType,
      entityId,
      deletedBy: actor.userId,
      deletedAt,
    }
    return [{ entityType, entityId }]
  })
}

function tombstoneTemplateEntity(
  document: TemplateDocumentV1,
  actor: DocumentMutationActor,
  operation: DocumentMutationOperation,
  entityType: TemplateTombstoneEntityType,
  entityId: EntityId,
  deletedAt: IsoDateTimeString,
): DocumentMutationResult<TemplateDocumentV1> {
  return mutateTemplateDocument(document, actor, operation, (draft) => {
    draft.tombstones[`tombstone:${entityType}:${entityId}`] = {
      id: `tombstone:${entityType}:${entityId}`,
      entityType,
      entityId,
      deletedBy: actor.userId,
      deletedAt,
    }
    return [{ entityType, entityId }]
  })
}

function assertCanWrite(actor: DocumentMutationActor): void {
  if (!canWriteDocument(actor)) {
    throw new Error('Document mutation requires an accepted owner/editor actor.')
  }
}

function replaceChecklistItemAssignees(
  document: TripDocumentV1,
  itemId: EntityId,
  assigneeIds: UserId[],
  createdAt: IsoDateTimeString,
): void {
  for (const [id, assignee] of Object.entries(document.checklistItemAssignees)) {
    if (assignee.itemId === itemId) delete document.checklistItemAssignees[id]
  }
  for (const userId of assigneeIds) {
    const id = `assignee:${itemId}:${userId}`
    document.checklistItemAssignees[id] = {
      id,
      itemId,
      userId,
      createdAt,
    }
  }
}

function replaceChecklistItemUserChecks(
  document: TripDocumentV1,
  itemId: EntityId,
  checkedUserIds: UserId[],
  createdAt: IsoDateTimeString,
): void {
  for (const [id, check] of Object.entries(document.checklistItemUserChecks)) {
    if (check.itemId === itemId) delete document.checklistItemUserChecks[id]
  }
  for (const userId of checkedUserIds) {
    const id = `check:${itemId}:${userId}`
    document.checklistItemUserChecks[id] = {
      id,
      itemId,
      userId,
      createdAt,
    }
  }
}

function getAcceptedMemberUserIds(document: TripDocumentV1): UserId[] {
  return Object.values(document.members)
    .filter((member) => member.status === 'accepted' && member.userId)
    .map((member) => member.userId as UserId)
}

function getChecklistItemAssigneeIds(
  document: TripDocumentV1,
  itemId: EntityId,
  legacyAssignedUserId: UserId | null,
): UserId[] {
  const ids = Object.values(document.checklistItemAssignees)
    .filter((assignee) => assignee.itemId === itemId)
    .map((assignee) => assignee.userId)
  return ids.length > 0 ? ids : legacyAssignedUserId ? [legacyAssignedUserId] : []
}

function activeTemplateItems(template: TemplateDocumentV1): TemplateItemNode[] {
  const tombstoned = new Set(
    Object.values(template.tombstones)
      .filter((tombstone) => tombstone.entityType === 'templateItem')
      .map((tombstone) => tombstone.entityId),
  )
  return Object.values(template.items)
    .filter((item) => !tombstoned.has(item.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

function appendUnique(values: EntityId[], nextValue: EntityId): EntityId[] {
  return values.includes(nextValue) ? values : [...values, nextValue]
}
