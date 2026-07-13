import type {
  ChecklistReadModel,
  PlanTimelineItemReadModel,
  TripDetailReadModel,
  TripSummaryReadModel,
} from '../local-first/materialize'
import {
  materializeChecklists as materializeChecklistsFromDocument,
  materializePlanTimeline as materializePlanTimelineFromDocument,
  materializeTripDetail as materializeTripDetailFromDocument,
  materializeTripSummary as materializeTripSummaryFromDocument,
} from '../local-first/materialize'
import type {
  ApplyTemplateToChecklistMutationInput,
  CreateChecklistItemMutationInput,
  CreateChecklistMutationInput,
  CreatePlanMutationInput,
  DocumentMutationActor,
  DocumentMutationPublisher,
  DocumentMutationResult,
  ToggleChecklistItemMutationInput,
  UpdateChecklistItemMutationInput,
  UpdatePlanMutationInput,
  UpsertMemberMutationInput,
  UpsertPlanUrlMutationInput,
} from '../local-first/documentMutationWriter'
import {
  applyTemplateToChecklistInTripDocument,
  createChecklistInTripDocument,
  createChecklistItemInTripDocument,
  createPlanInTripDocument,
  deleteChecklistItemInTripDocument,
  deletePlanInTripDocument,
  deletePlanUrlInTripDocument,
  deleteTemplateDocument,
  deleteTripDocument,
  removeTemplateShareInDocument,
  replaceTemplateItemsInDocument,
  revokeMemberInTripDocument,
  toggleChecklistItemInTripDocument,
  updateChecklistItemInTripDocument,
  updatePlanInTripDocument,
  updateTemplateDocument,
  updateTripDocument,
  upsertMemberInTripDocument,
  upsertPlanUrlInTripDocument,
  upsertTemplateShareInDocument,
} from '../local-first/documentMutationWriter'
import type {
  EntityId,
  TripDocumentV1,
} from '../local-first/documentModel'
import type {
  ReplaceTemplateItemsMutationInput,
  UpsertTemplateShareMutationInput,
} from '../local-first/documentMutationWriter'
import type {
  TemplateDocumentV1,
  TemplateItemNode,
} from '../local-first/templateDocument'

export interface LocalDocumentStore<TDocument> {
  listDocumentIds?(): Promise<EntityId[]>
  getDocument(documentId: EntityId): Promise<TDocument | null>
  putDocument(documentId: EntityId, document: TDocument, update?: Uint8Array): Promise<void>
}

export interface LocalFirstRepositoryRuntime {
  actor: DocumentMutationActor
  publisher?: DocumentMutationPublisher
}

export interface CreateDocumentPrimaryRepositoryBundleOptions {
  tripStore: LocalDocumentStore<TripDocumentV1>
  templateStore: LocalDocumentStore<TemplateDocumentV1>
  runtime: LocalFirstRepositoryRuntime
}

export interface DocumentPrimaryRepositoryBundle {
  trips: DocumentPrimaryTripRepository
  plans: DocumentPrimaryPlanRepository
  checklists: DocumentPrimaryChecklistRepository
  templates: DocumentPrimaryTemplateRepository
  members: DocumentPrimaryMemberRepository
}

export interface DocumentPrimaryTripRepository {
  listTrips(userId: string): Promise<TripSummaryReadModel[]>
  getTrip(tripId: EntityId): Promise<TripDetailReadModel | null>
  getTripDocument(tripId: EntityId): Promise<TripDocumentV1 | null>
  updateTrip(
    tripId: EntityId,
    patch: Partial<Omit<TripDocumentV1['trip'], 'id' | 'ownerId' | 'createdAt'>>,
  ): Promise<DocumentMutationResult<TripDocumentV1>>
  deleteTrip(tripId: EntityId): Promise<DocumentMutationResult<TripDocumentV1>>
}

export interface DocumentPrimaryPlanRepository {
  listPlans(tripId: EntityId): Promise<PlanTimelineItemReadModel[]>
  createPlan(
    tripId: EntityId,
    input: CreatePlanMutationInput,
  ): Promise<DocumentMutationResult<TripDocumentV1>>
  updatePlan(
    tripId: EntityId,
    input: UpdatePlanMutationInput,
  ): Promise<DocumentMutationResult<TripDocumentV1>>
  deletePlan(tripId: EntityId, planId: EntityId): Promise<DocumentMutationResult<TripDocumentV1>>
  upsertPlanUrl(
    tripId: EntityId,
    input: UpsertPlanUrlMutationInput,
  ): Promise<DocumentMutationResult<TripDocumentV1>>
  deletePlanUrl(
    tripId: EntityId,
    planUrlId: EntityId,
  ): Promise<DocumentMutationResult<TripDocumentV1>>
}

export interface DocumentPrimaryChecklistRepository {
  getChecklist(tripId: EntityId): Promise<ChecklistReadModel[]>
  createChecklist(
    tripId: EntityId,
    input: CreateChecklistMutationInput,
  ): Promise<DocumentMutationResult<TripDocumentV1>>
  createItem(
    tripId: EntityId,
    input: CreateChecklistItemMutationInput,
  ): Promise<DocumentMutationResult<TripDocumentV1>>
  updateItem(
    tripId: EntityId,
    input: UpdateChecklistItemMutationInput,
  ): Promise<DocumentMutationResult<TripDocumentV1>>
  deleteItem(tripId: EntityId, itemId: EntityId): Promise<DocumentMutationResult<TripDocumentV1>>
  toggleItem(
    tripId: EntityId,
    input: ToggleChecklistItemMutationInput,
  ): Promise<DocumentMutationResult<TripDocumentV1>>
  applyTemplate(
    tripId: EntityId,
    checklistId: EntityId,
    templateId: EntityId,
    itemIds: EntityId[],
  ): Promise<DocumentMutationResult<TripDocumentV1>>
}

export interface DocumentPrimaryTemplateRepository {
  listTemplates(userId: string): Promise<TemplateSummaryReadModel[]>
  getTemplate(templateId: EntityId): Promise<TemplateDetailReadModel | null>
  getTemplateDocument(templateId: EntityId): Promise<TemplateDocumentV1 | null>
  updateTemplate(
    templateId: EntityId,
    patch: Partial<Omit<TemplateDocumentV1['template'], 'id' | 'ownerId' | 'createdAt'>>,
  ): Promise<DocumentMutationResult<TemplateDocumentV1>>
  deleteTemplate(templateId: EntityId): Promise<DocumentMutationResult<TemplateDocumentV1>>
  replaceItems(
    templateId: EntityId,
    input: ReplaceTemplateItemsMutationInput,
  ): Promise<DocumentMutationResult<TemplateDocumentV1>>
  upsertShare(
    templateId: EntityId,
    input: UpsertTemplateShareMutationInput,
  ): Promise<DocumentMutationResult<TemplateDocumentV1>>
  removeShare(
    templateId: EntityId,
    shareId: EntityId,
  ): Promise<DocumentMutationResult<TemplateDocumentV1>>
}

export interface DocumentPrimaryMemberRepository {
  listMembers(tripId: EntityId): Promise<TripDetailReadModel['members']>
  upsertMember(
    tripId: EntityId,
    input: UpsertMemberMutationInput,
  ): Promise<DocumentMutationResult<TripDocumentV1>>
  revokeMember(tripId: EntityId, memberId: EntityId): Promise<DocumentMutationResult<TripDocumentV1>>
}

export interface TemplateSummaryReadModel {
  id: EntityId
  ownerId: string | null
  title: string
  visibility: TemplateDocumentV1['template']['visibility']
  itemCount: number
  previewItems: string[]
  updatedAt: string
}

export interface TemplateDetailReadModel extends TemplateSummaryReadModel {
  items: TemplateItemNode[]
  shares: TemplateDocumentV1['shares'][string][]
}

export function createDocumentPrimaryRepositoryBundle(
  options: CreateDocumentPrimaryRepositoryBundleOptions,
): DocumentPrimaryRepositoryBundle {
  return {
    trips: createDocumentPrimaryTripRepository(options),
    plans: createDocumentPrimaryPlanRepository(options),
    checklists: createDocumentPrimaryChecklistRepository(options),
    templates: createDocumentPrimaryTemplateRepository(options),
    members: createDocumentPrimaryMemberRepository(options),
  }
}

function createDocumentPrimaryTripRepository(
  options: CreateDocumentPrimaryRepositoryBundleOptions,
): DocumentPrimaryTripRepository {
  return {
    listTrips: async () => {
      const documents = await listDocuments(options.tripStore)
      return documents.map((document) => materializeTripSummaryFromDocument(document))
    },
    getTrip: async (tripId) => {
      const document = await options.tripStore.getDocument(tripId)
      return document ? materializeTripDetailFromDocument(document, { currentUserId: options.runtime.actor.userId }) : null
    },
    getTripDocument: (tripId) => options.tripStore.getDocument(tripId),
    updateTrip: async (tripId, patch) => {
      const result = updateTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
        patch,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
    deleteTrip: async (tripId) => {
      const result = deleteTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
  }
}

function createDocumentPrimaryPlanRepository(
  options: CreateDocumentPrimaryRepositoryBundleOptions,
): DocumentPrimaryPlanRepository {
  return {
    listPlans: async (tripId) => {
      const document = await requireDocument(options.tripStore, tripId, 'Trip document was not found.')
      return materializePlanTimelineFromDocument(document)
    },
    createPlan: async (tripId, input) => {
      const result = createPlanInTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
        input,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
    updatePlan: async (tripId, input) => {
      const result = updatePlanInTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
        input,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
    deletePlan: async (tripId, planId) => {
      const result = deletePlanInTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
        planId,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
    upsertPlanUrl: async (tripId, input) => {
      const result = upsertPlanUrlInTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
        input,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
    deletePlanUrl: async (tripId, planUrlId) => {
      const result = deletePlanUrlInTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
        planUrlId,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
  }
}

function createDocumentPrimaryChecklistRepository(
  options: CreateDocumentPrimaryRepositoryBundleOptions,
): DocumentPrimaryChecklistRepository {
  return {
    getChecklist: async (tripId) => {
      const document = await requireDocument(options.tripStore, tripId, 'Trip document was not found.')
      return materializeChecklistsFromDocument(document, { currentUserId: options.runtime.actor.userId })
    },
    createChecklist: async (tripId, input) => {
      const result = createChecklistInTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
        input,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
    createItem: async (tripId, input) => {
      const result = createChecklistItemInTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
        input,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
    updateItem: async (tripId, input) => {
      const result = updateChecklistItemInTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
        input,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
    deleteItem: async (tripId, itemId) => {
      const result = deleteChecklistItemInTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
        itemId,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
    toggleItem: async (tripId, input) => {
      const result = toggleChecklistItemInTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
        input,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
    applyTemplate: async (tripId, checklistId, templateId, itemIds) => {
      const [tripDocument, templateDocument] = await Promise.all([
        requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        requireDocument(options.templateStore, templateId, 'Template document was not found.'),
      ])
      const input: ApplyTemplateToChecklistMutationInput = {
        checklistId,
        template: templateDocument,
        itemIds,
      }
      const result = applyTemplateToChecklistInTripDocument(tripDocument, options.runtime.actor, input)
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
  }
}

function createDocumentPrimaryTemplateRepository(
  options: CreateDocumentPrimaryRepositoryBundleOptions,
): DocumentPrimaryTemplateRepository {
  return {
    listTemplates: async () => {
      const documents = await listDocuments(options.templateStore)
      return documents.map(materializeTemplateSummary)
    },
    getTemplate: async (templateId) => {
      const document = await options.templateStore.getDocument(templateId)
      return document ? materializeTemplateDetail(document) : null
    },
    getTemplateDocument: (templateId) => options.templateStore.getDocument(templateId),
    updateTemplate: async (templateId, patch) => {
      const result = updateTemplateDocument(
        await requireDocument(options.templateStore, templateId, 'Template document was not found.'),
        options.runtime.actor,
        patch,
      )
      return persistAndPublish(options.templateStore, options.runtime, result)
    },
    deleteTemplate: async (templateId) => {
      const result = deleteTemplateDocument(
        await requireDocument(options.templateStore, templateId, 'Template document was not found.'),
        options.runtime.actor,
      )
      return persistAndPublish(options.templateStore, options.runtime, result)
    },
    replaceItems: async (templateId, input) => {
      const result = replaceTemplateItemsInDocument(
        await requireDocument(options.templateStore, templateId, 'Template document was not found.'),
        options.runtime.actor,
        input,
      )
      return persistAndPublish(options.templateStore, options.runtime, result)
    },
    upsertShare: async (templateId, input) => {
      const result = upsertTemplateShareInDocument(
        await requireDocument(options.templateStore, templateId, 'Template document was not found.'),
        options.runtime.actor,
        input,
      )
      return persistAndPublish(options.templateStore, options.runtime, result)
    },
    removeShare: async (templateId, shareId) => {
      const result = removeTemplateShareInDocument(
        await requireDocument(options.templateStore, templateId, 'Template document was not found.'),
        options.runtime.actor,
        shareId,
      )
      return persistAndPublish(options.templateStore, options.runtime, result)
    },
  }
}

function createDocumentPrimaryMemberRepository(
  options: CreateDocumentPrimaryRepositoryBundleOptions,
): DocumentPrimaryMemberRepository {
  return {
    listMembers: async (tripId) => {
      const document = await requireDocument(options.tripStore, tripId, 'Trip document was not found.')
      return materializeTripDetailFromDocument(document, { currentUserId: options.runtime.actor.userId }).members
    },
    upsertMember: async (tripId, input) => {
      const result = upsertMemberInTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
        input,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
    revokeMember: async (tripId, memberId) => {
      const result = revokeMemberInTripDocument(
        await requireDocument(options.tripStore, tripId, 'Trip document was not found.'),
        options.runtime.actor,
        memberId,
      )
      return persistAndPublish(options.tripStore, options.runtime, result)
    },
  }
}

async function requireDocument<TDocument>(
  store: LocalDocumentStore<TDocument>,
  documentId: EntityId,
  message: string,
): Promise<TDocument> {
  const document = await store.getDocument(documentId)
  if (!document) throw new Error(message)
  return document
}

async function listDocuments<TDocument>(
  store: LocalDocumentStore<TDocument>,
): Promise<TDocument[]> {
  const ids = await store.listDocumentIds?.()
  if (!ids) return []
  const documents = await Promise.all(ids.map((id) => store.getDocument(id)))
  return documents.filter(isPresent)
}

async function persistAndPublish<TDocument extends TripDocumentV1 | TemplateDocumentV1>(
  store: LocalDocumentStore<TDocument>,
  runtime: LocalFirstRepositoryRuntime,
  result: DocumentMutationResult<TDocument>,
): Promise<DocumentMutationResult<TDocument>> {
  await store.putDocument(result.documentId, result.document, result.update)
  await runtime.publisher?.publishMutation(result)
  return result
}

function materializeTemplateSummary(document: TemplateDocumentV1): TemplateSummaryReadModel {
  const items = activeTemplateItems(document)
  return {
    id: document.template.id,
    ownerId: document.template.ownerId,
    title: document.template.title,
    visibility: document.template.visibility,
    itemCount: items.length,
    previewItems: items.slice(0, 3).map((item) => item.name),
    updatedAt: document.template.updatedAt,
  }
}

function materializeTemplateDetail(document: TemplateDocumentV1): TemplateDetailReadModel {
  return {
    ...materializeTemplateSummary(document),
    items: activeTemplateItems(document),
    shares: activeTemplateShares(document),
  }
}

function activeTemplateItems(document: TemplateDocumentV1): TemplateItemNode[] {
  const tombstoned = new Set(
    Object.values(document.tombstones)
      .filter((tombstone) => tombstone.entityType === 'templateItem')
      .map((tombstone) => tombstone.entityId),
  )
  return Object.values(document.items)
    .filter((item) => !tombstoned.has(item.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

function activeTemplateShares(document: TemplateDocumentV1): TemplateDocumentV1['shares'][string][] {
  const tombstoned = new Set(
    Object.values(document.tombstones)
      .filter((tombstone) => tombstone.entityType === 'templateShare')
      .map((tombstone) => tombstone.entityId),
  )
  return Object.values(document.shares)
    .filter((share) => !tombstoned.has(share.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}
