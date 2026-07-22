import type {
  EntityId,
  TemplateItem,
  TemplateProductState,
  TemplateShare,
  TripProductState,
} from './models'
import type {
  CreateChecklistItemMutationInput,
  CreateChecklistMutationInput,
  CreatePlanMutationInput,
  ProductMutationResult,
  ReplaceTemplateItemsMutationInput,
  ToggleChecklistItemMutationInput,
  UpdateChecklistItemMutationInput,
  UpdatePlanMutationInput,
  UpsertPlanUrlMutationInput,
  UpsertTemplateShareMutationInput,
} from './mutations'
import type {
  ChecklistReadModel,
  PlanTimelineItemReadModel,
  TripDetailReadModel,
  TripSummaryReadModel,
} from './readModels'

export interface ProductRepositoryBundle {
  trips: ProductTripRepository
  plans: ProductPlanRepository
  checklists: ProductChecklistRepository
  templates: ProductTemplateRepository
  members: ProductMemberRepository
}

export interface ProductTripRepository {
  listTrips(userId: string): Promise<TripSummaryReadModel[]>
  getTrip(tripId: EntityId): Promise<TripDetailReadModel | null>
  updateTrip(
    tripId: EntityId,
    patch: Partial<Omit<TripProductState['trip'], 'id' | 'ownerId' | 'createdAt'>>,
  ): Promise<ProductMutationResult<TripProductState>>
  deleteTrip(tripId: EntityId): Promise<ProductMutationResult<TripProductState>>
}

export interface ProductPlanRepository {
  listPlans(tripId: EntityId): Promise<PlanTimelineItemReadModel[]>
  createPlan(
    tripId: EntityId,
    input: CreatePlanMutationInput,
  ): Promise<ProductMutationResult<TripProductState>>
  updatePlan(
    tripId: EntityId,
    input: UpdatePlanMutationInput,
  ): Promise<ProductMutationResult<TripProductState>>
  deletePlan(tripId: EntityId, planId: EntityId): Promise<ProductMutationResult<TripProductState>>
  upsertPlanUrl(
    tripId: EntityId,
    input: UpsertPlanUrlMutationInput,
  ): Promise<ProductMutationResult<TripProductState>>
  deletePlanUrl(
    tripId: EntityId,
    planUrlId: EntityId,
  ): Promise<ProductMutationResult<TripProductState>>
}

export interface ProductChecklistRepository {
  getChecklist(tripId: EntityId): Promise<ChecklistReadModel[]>
  createChecklist(
    tripId: EntityId,
    input: CreateChecklistMutationInput,
  ): Promise<ProductMutationResult<TripProductState>>
  createItem(
    tripId: EntityId,
    input: CreateChecklistItemMutationInput,
  ): Promise<ProductMutationResult<TripProductState>>
  updateItem(
    tripId: EntityId,
    input: UpdateChecklistItemMutationInput,
  ): Promise<ProductMutationResult<TripProductState>>
  deleteItem(tripId: EntityId, itemId: EntityId): Promise<ProductMutationResult<TripProductState>>
  toggleItem(
    tripId: EntityId,
    input: ToggleChecklistItemMutationInput,
  ): Promise<ProductMutationResult<TripProductState>>
  applyTemplate(
    tripId: EntityId,
    checklistId: EntityId,
    templateId: EntityId,
    itemIds: EntityId[],
  ): Promise<ProductMutationResult<TripProductState>>
}

export interface ProductTemplateRepository {
  listTemplates(userId: string): Promise<TemplateSummaryReadModel[]>
  getTemplate(templateId: EntityId): Promise<TemplateDetailReadModel | null>
  updateTemplate(
    templateId: EntityId,
    patch: Partial<Omit<TemplateProductState['template'], 'id' | 'ownerId' | 'createdAt'>>,
  ): Promise<ProductMutationResult<TemplateProductState>>
  deleteTemplate(templateId: EntityId): Promise<ProductMutationResult<TemplateProductState>>
  replaceItems(
    templateId: EntityId,
    input: ReplaceTemplateItemsMutationInput,
  ): Promise<ProductMutationResult<TemplateProductState>>
  upsertShare(
    templateId: EntityId,
    input: UpsertTemplateShareMutationInput,
  ): Promise<ProductMutationResult<TemplateProductState>>
  removeShare(
    templateId: EntityId,
    shareId: EntityId,
  ): Promise<ProductMutationResult<TemplateProductState>>
}

export interface ProductMemberRepository {
  listMembers(tripId: EntityId): Promise<TripDetailReadModel['members']>
}

export interface TemplateSummaryReadModel {
  id: EntityId
  ownerId: string | null
  title: string
  visibility: TemplateProductState['template']['visibility']
  itemCount: number
  previewItems: string[]
  updatedAt: string
}

export interface TemplateDetailReadModel extends TemplateSummaryReadModel {
  items: TemplateItem[]
  shares: TemplateShare[]
}
