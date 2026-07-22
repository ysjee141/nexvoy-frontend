import type {
  Checklist,
  ChecklistItem,
  EntityId,
  IsoDateTimeString,
  Plan,
  PlanUrl,
  TemplateItem,
  TemplateShare,
  UserId,
} from './models'

export type ProductResourceType = 'trip' | 'template'

export type ProductMutationOperation =
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
  | 'template.update'
  | 'template.delete'
  | 'templateItem.replaceAll'
  | 'templateShare.upsert'
  | 'templateShare.remove'

export interface ProductChangedEntity {
  entityType: string
  entityId: EntityId
}

export interface ProductMutationResult<TState> {
  resourceType: ProductResourceType
  resourceId: EntityId
  operation: ProductMutationOperation
  state: TState
  changedEntities: ProductChangedEntity[]
}

export interface CreatePlanMutationInput extends Omit<Plan, 'createdAt' | 'updatedAt'> {
  createdAt?: IsoDateTimeString
  updatedAt?: IsoDateTimeString
}

export interface UpdatePlanMutationInput {
  planId: EntityId
  patch: Partial<Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>>
  updatedAt?: IsoDateTimeString
}

export interface UpsertPlanUrlMutationInput extends Omit<PlanUrl, 'createdAt'> {
  createdAt?: IsoDateTimeString
}

export interface CreateChecklistMutationInput extends Omit<Checklist, 'createdAt'> {
  createdAt?: IsoDateTimeString
}

export interface CreateChecklistItemMutationInput extends Omit<ChecklistItem, 'createdAt' | 'updatedAt'> {
  assigneeIds?: UserId[]
  checkedUserIds?: UserId[]
  createdAt?: IsoDateTimeString
  updatedAt?: IsoDateTimeString
}

export interface UpdateChecklistItemMutationInput {
  itemId: EntityId
  patch: Partial<Omit<ChecklistItem, 'id' | 'checklistId' | 'createdAt' | 'updatedAt'>>
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

export interface ReplaceTemplateItemsMutationInput {
  items: Array<Omit<TemplateItem, 'templateId' | 'createdAt' | 'updatedAt'> & {
    createdAt?: IsoDateTimeString
    updatedAt?: IsoDateTimeString
  }>
  now?: IsoDateTimeString
}

export interface UpsertTemplateShareMutationInput {
  share: TemplateShare
}
