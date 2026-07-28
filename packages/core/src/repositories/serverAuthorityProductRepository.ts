import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@nexvoy/types'
import {
  materializeChecklists,
  materializePlanTimeline,
  materializeTripDetail,
  materializeTripSummary,
} from '../product/readModels'
import type {
  CreateChecklistItemMutationInput,
  CreateChecklistMutationInput,
  CreatePlanMutationInput,
  ProductChangedEntity,
  ProductMutationOperation,
  ProductMutationResult,
  ReplaceTemplateItemsMutationInput,
  ToggleChecklistItemMutationInput,
  UpdateChecklistItemMutationInput,
  UpdatePlanMutationInput,
  UpsertPlanUrlMutationInput,
  UpsertTemplateShareMutationInput,
} from '../product/mutations'
import type { TemplateProductState, TripProductState } from '../product/models'
import type { ProductRepositoryBundle } from '../product/repositories'
import type {
  AuthorityCommand,
  AuthorityConflictResolution,
  AuthorityProductSyncSnapshot,
  AuthorityResourceType,
  CanonicalResourceBundle,
} from '../authority/serverAuthorityTypes'
import { createInvitationRepository, type DocumentCollaborator } from '../supabase/invitationRepository'
import { createUuid as createId } from '../utils/id'

type Tables = Database['public']['Tables']
type TableRow<TName extends keyof Tables> = Tables[TName]['Row']
type TripRow = TableRow<'trips'>
type PlanRow = TableRow<'plans'>
type PlanUrlRow = TableRow<'plan_urls'>
type ChecklistRow = TableRow<'checklists'>
type ChecklistItemRow = TableRow<'checklist_items'>
type ChecklistItemAssigneeRow = TableRow<'checklist_item_assignees'>
type ChecklistItemUserCheckRow = TableRow<'checklist_item_user_checks'>
type TemplateRow = TableRow<'checklist_templates'>
type TemplateItemRow = TableRow<'checklist_template_items'>
type TemplateShareRow = TableRow<'checklist_template_shares'>

export type ServerAuthorityActorRole = 'owner' | 'editor' | 'viewer' | null

export interface ServerAuthorityProductRuntime {
  accountId(): Promise<string>
  isOnline(): Promise<boolean>
  listLocal(resourceType: AuthorityResourceType): Promise<CanonicalResourceBundle[]>
  getBundle(resourceType: AuthorityResourceType, resourceId: string): Promise<CanonicalResourceBundle | null>
  commit(bundle: CanonicalResourceBundle, commands: AuthorityCommand[]): Promise<CanonicalResourceBundle>
  cacheRole(accountId: string, bundle: CanonicalResourceBundle, role: ServerAuthorityActorRole): Promise<CanonicalResourceBundle>
  syncSnapshot(resourceType: AuthorityResourceType, resourceId: string): Promise<AuthorityProductSyncSnapshot>
  resolveConflict(
    resourceType: AuthorityResourceType,
    resourceId: string,
    resolution: AuthorityConflictResolution,
  ): Promise<void>
}

export async function createServerAuthorityProductRepositories(
  supabase: SupabaseClient,
  runtime: ServerAuthorityProductRuntime,
  options: { actorRole?: ServerAuthorityActorRole } = {},
): Promise<ProductRepositoryBundle> {
  const actorRole = options.actorRole ?? 'viewer'

  const repositories: ProductRepositoryBundle = {
    trips: {
      async listTrips() {
        const local = await runtime.listLocal('trip')
        return local.flatMap((bundle) => {
          const document = tripStateFromBundle(bundle, [])
          return document && !asObject(bundle.data.trip).deleted_at
            ? [materializeTripSummary(document)]
            : []
        })
      },
      async getTrip(tripId) {
        const [bundle, collaborators, accountId] = await Promise.all([
          runtime.getBundle('trip', tripId),
          listTripCollaborators(supabase, runtime, tripId),
          runtime.accountId(),
        ])
        const cachedBundle = bundle
          ? await runtime.cacheRole(
              accountId,
              bundle,
              resolveTripActorRole(bundle, collaborators, accountId),
            )
          : null
        const members = cachedBundle
          ? withCachedActorMember(cachedBundle, collaborators, accountId)
          : collaborators
        const document = cachedBundle ? tripStateFromBundle(cachedBundle, members) : null
        return document
          ? materializeTripDetail(document, { currentUserId: accountId })
          : null
      },
      async updateTrip(tripId, patch) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'trip', tripId)
        const command = commandFor('trip', tripId, tripId, 'upsert', tripPatchPayload(patch))
        const optimistic = await runtime.commit(bundle, [command])
        return tripMutationResult('trip.update', optimistic, [{ entityType: 'trip', entityId: tripId }])
      },
      async deleteTrip(tripId) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'trip', tripId)
        const command = commandFor('trip', tripId, tripId, 'delete', {})
        const optimistic = await runtime.commit(bundle, [command])
        return tripMutationResult('trip.delete', optimistic, [{ entityType: 'trip', entityId: tripId }])
      },
    },
    plans: {
      async listPlans(tripId) {
        const bundle = await requireBundle(runtime, 'trip', tripId)
        return planReadModels(bundle)
      },
      async createPlan(tripId, input) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'trip', tripId)
        const command = commandFor('plan', tripId, input.id, 'upsert', planCreatePayload(input))
        const optimistic = await runtime.commit(bundle, [command])
        return tripMutationResult('plan.create', optimistic, [{ entityType: 'plan', entityId: input.id }])
      },
      async updatePlan(tripId, input) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'trip', tripId)
        const command = commandFor('plan', tripId, input.planId, 'upsert', planPatchPayload(input))
        const optimistic = await runtime.commit(bundle, [command])
        return tripMutationResult('plan.update', optimistic, [{ entityType: 'plan', entityId: input.planId }])
      },
      async deletePlan(tripId, planId) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'trip', tripId)
        const command = commandFor('plan', tripId, planId, 'delete', {})
        const optimistic = await runtime.commit(bundle, [command])
        return tripMutationResult('plan.delete', optimistic, [{ entityType: 'plan', entityId: planId }])
      },
      async upsertPlanUrl(tripId, input) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'trip', tripId)
        const command = commandFor('plan_url', tripId, input.id, 'upsert', {
          plan_id: input.planId,
          url: input.url,
        })
        const optimistic = await runtime.commit(bundle, [command])
        return tripMutationResult('planUrl.upsert', optimistic, [{ entityType: 'planUrl', entityId: input.id }])
      },
      async deletePlanUrl(tripId, planUrlId) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'trip', tripId)
        const command = commandFor('plan_url', tripId, planUrlId, 'delete', {})
        const optimistic = await runtime.commit(bundle, [command])
        return tripMutationResult('planUrl.delete', optimistic, [{ entityType: 'planUrl', entityId: planUrlId }])
      },
    },
    checklists: {
      async getChecklist(tripId) {
        const bundle = await requireBundle(runtime, 'trip', tripId)
        return checklistReadModels(bundle)
      },
      async createChecklist(tripId, input) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'trip', tripId)
        const command = commandFor('checklist', tripId, input.id, 'upsert', { title: input.title })
        const optimistic = await runtime.commit(bundle, [command])
        return tripMutationResult('checklist.create', optimistic, [{ entityType: 'checklist', entityId: input.id }])
      },
      async createItem(tripId, input) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'trip', tripId)
        const commands = checklistItemCommands(tripId, input.id, input, input.assigneeIds)
        const optimistic = await runtime.commit(bundle, commands)
        return tripMutationResult('checklistItem.create', optimistic, changedEntities(commands))
      },
      async updateItem(tripId, input) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'trip', tripId)
        const commands = checklistItemCommands(tripId, input.itemId, input.patch, input.assigneeIds)
        const optimistic = await runtime.commit(bundle, commands)
        return tripMutationResult('checklistItem.update', optimistic, changedEntities(commands))
      },
      async deleteItem(tripId, itemId) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'trip', tripId)
        const command = commandFor('checklist_item', tripId, itemId, 'delete', {})
        const optimistic = await runtime.commit(bundle, [command])
        return tripMutationResult('checklistItem.delete', optimistic, [{ entityType: 'checklistItem', entityId: itemId }])
      },
      async toggleItem(tripId, input) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'trip', tripId)
        const command = input.currentUserId
          ? commandFor('checklist_item_user_check', tripId, input.itemId, 'set', {
              user_id: input.currentUserId,
              checked: input.nextChecked,
            })
          : commandFor('checklist_item', tripId, input.itemId, 'upsert', {
              is_checked: input.nextChecked,
            })
        const optimistic = await runtime.commit(bundle, [command])
        return tripMutationResult('checklistItem.toggle', optimistic, changedEntities([command]))
      },
      async applyTemplate(tripId, checklistId, templateId, itemIds) {
        assertWritable(actorRole)
        const [bundle, templateBundle] = await Promise.all([
          requireBundle(runtime, 'trip', tripId),
          requireBundle(runtime, 'template', templateId),
        ])
        const existingNames = new Set(rows<ChecklistItemRow>(bundle, 'checklist_items').map((item) => item.item_name.trim()))
        const templateItems = rows<TemplateItemRow>(templateBundle, 'items')
          .filter((item) => !existingNames.has(item.item_name.trim()))
        const commands = templateItems.map((item, index) => commandFor(
          'checklist_item',
          tripId,
          itemIds[index] ?? createId(),
          'upsert',
          {
            checklist_id: checklistId,
            item_name: item.item_name,
            category: item.category,
            is_private: item.is_private,
            assignment_type: 'anyone',
            assigned_user_id: null,
            source_template_name: asObject(templateBundle.data.template).title ?? null,
            sort_key: item.sort_key,
          },
        ))
        if (commands.length === 0) {
          return tripMutationResult('checklistItem.applyTemplate', bundle, [])
        }
        const optimistic = await runtime.commit(bundle, commands)
        return tripMutationResult('checklistItem.applyTemplate', optimistic, changedEntities(commands))
      },
    },
    templates: {
      async listTemplates() {
        const local = await runtime.listLocal('template')
        return local.flatMap((bundle) => {
          const document = templateStateFromBundle(bundle)
          if (!document || asObject(bundle.data.template).deleted_at) return []
          return [templateSummary(document)]
        })
      },
      async getTemplate(templateId) {
        const [bundle, accountId] = await Promise.all([
          runtime.getBundle('template', templateId),
          runtime.accountId(),
        ])
        const document = bundle ? templateStateFromBundle(bundle, accountId) : null
        return document ? templateDetail(document) : null
      },
      async updateTemplate(templateId, patch) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'template', templateId)
        const command = commandFor('template', templateId, templateId, 'upsert', {
          ...(patch.title === undefined ? {} : { title: patch.title }),
        })
        const optimistic = await runtime.commit(bundle, [command])
        return templateMutationResult('template.update', optimistic, [{ entityType: 'template', entityId: templateId }])
      },
      async deleteTemplate(templateId) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'template', templateId)
        const command = commandFor('template', templateId, templateId, 'delete', {})
        const optimistic = await runtime.commit(bundle, [command])
        return templateMutationResult('template.delete', optimistic, [{ entityType: 'template', entityId: templateId }])
      },
      async replaceItems(templateId, input) {
        assertWritable(actorRole)
        const bundle = await requireBundle(runtime, 'template', templateId)
        const nextIds = new Set(input.items.map((item) => item.id))
        const commands: AuthorityCommand[] = rows<TemplateItemRow>(bundle, 'items')
          .filter((item) => !nextIds.has(item.id))
          .map((item) => commandFor('template_item', templateId, item.id, 'delete', {}))
        input.items.forEach((item, index) => {
          commands.push(commandFor('template_item', templateId, item.id, 'upsert', {
            item_name: item.name,
            category: item.categoryName,
            is_private: item.isPrivate,
            sort_key: String(index).padStart(8, '0'),
          }))
        })
        if (commands.length === 0) return templateMutationResult('templateItem.replaceAll', bundle, [])
        const optimistic = await runtime.commit(bundle, commands)
        return templateMutationResult('templateItem.replaceAll', optimistic, changedEntities(commands))
      },
      async upsertShare(templateId, input) {
        assertOwner(actorRole)
        const bundle = await requireBundle(runtime, 'template', templateId)
        const command = commandFor('template_share', templateId, input.share.id, 'upsert', {
          shared_with_user_id: input.share.sharedWithUserId,
          role: input.share.role,
        })
        const optimistic = await runtime.commit(bundle, [command])
        return templateMutationResult('templateShare.upsert', optimistic, [{ entityType: 'templateShare', entityId: input.share.id }])
      },
      async removeShare(templateId, shareId) {
        assertOwner(actorRole)
        const bundle = await requireBundle(runtime, 'template', templateId)
        const command = commandFor('template_share', templateId, shareId, 'delete', {})
        const optimistic = await runtime.commit(bundle, [command])
        return templateMutationResult('templateShare.remove', optimistic, [{ entityType: 'templateShare', entityId: shareId }])
      },
    },
    members: {
      async listMembers(tripId) {
        const bundle = await requireBundle(runtime, 'trip', tripId)
        const [collaborators, accountId] = await Promise.all([
          listTripCollaborators(supabase, runtime, tripId),
          runtime.accountId(),
        ])
        return materializeTripDetail(tripStateFromBundle(
          bundle,
          withCachedActorMember(bundle, collaborators, accountId),
        ), {
          currentUserId: accountId,
        }).members
      },
    },
  }

  return repositories
}

export async function createServerAuthorityTrip(input: {
  runtime: ServerAuthorityProductRuntime
  destination: string
  startDate: string
  endDate: string
  adultsCount: number
  childrenCount: number
}): Promise<string> {
  const runtime = input.runtime
  const accountId = await runtime.accountId()
  const tripId = createId()
  const checklistId = createId()
  const now = new Date().toISOString()
  const bundle: CanonicalResourceBundle = {
    resourceType: 'trip',
    resourceId: tripId,
    revision: 0,
    serverUpdatedAt: now,
    data: {
      trip: null,
      plans: [],
      plan_urls: [],
      checklists: [],
      checklist_items: [],
      checklist_item_assignees: [],
      checklist_item_user_checks: [],
      _role: 'owner',
    },
  }
  await runtime.commit(bundle, [
    commandFor('trip', tripId, tripId, 'upsert', {
      user_id: accountId,
      destination: input.destination,
      start_date: input.startDate,
      end_date: input.endDate,
      adults_count: input.adultsCount,
      children_count: input.childrenCount,
    }, now),
    commandFor('checklist', tripId, checklistId, 'upsert', { title: '준비물' }, addMilliseconds(now, 1)),
  ])
  return tripId
}

export async function createServerAuthorityTemplate(input: {
  runtime: ServerAuthorityProductRuntime
  title: string
  items: Array<{ item_name: string; category: string; is_private?: boolean }>
}): Promise<string> {
  const runtime = input.runtime
  const accountId = await runtime.accountId()
  const templateId = createId()
  const now = new Date().toISOString()
  const bundle: CanonicalResourceBundle = {
    resourceType: 'template',
    resourceId: templateId,
    revision: 0,
    serverUpdatedAt: now,
    data: { template: null, items: [], shares: [], _role: 'owner' },
  }
  const commands: AuthorityCommand[] = [commandFor('template', templateId, templateId, 'upsert', {
    user_id: accountId,
    title: input.title,
  }, now)]
  input.items.forEach((item, index) => commands.push(commandFor(
    'template_item',
    templateId,
    createId(),
    'upsert',
    {
      template_id: templateId,
      item_name: item.item_name,
      category: item.category,
      is_private: item.is_private ?? false,
      sort_key: String(index).padStart(8, '0'),
    },
    addMilliseconds(now, index + 1),
  )))
  await runtime.commit(bundle, commands)
  return templateId
}

function commandFor(
  entityType: AuthorityCommand['entityType'],
  resourceId: string,
  entityId: string,
  action: AuthorityCommand['action'],
  payload: Record<string, Json | undefined>,
  createdAt = new Date().toISOString(),
): AuthorityCommand {
  if (
    (entityType === 'trip' || entityType === 'template') &&
    entityId !== resourceId
  ) {
    throw new Error('Authority root command must target its resource id.')
  }
  return {
    operationId: createId(),
    resourceId,
    entityType,
    entityId,
    action,
    payload,
    createdAt,
  } as AuthorityCommand
}

async function requireBundle(
  runtime: ServerAuthorityProductRuntime,
  resourceType: AuthorityResourceType,
  resourceId: string,
): Promise<CanonicalResourceBundle> {
  const bundle = await runtime.getBundle(resourceType, resourceId)
  if (!bundle) throw new Error(`${resourceType === 'trip' ? 'Trip' : 'Template'} was not found.`)
  return bundle
}

function tripMutationResult(
  operation: ProductMutationOperation,
  bundle: CanonicalResourceBundle,
  entities: ProductChangedEntity[],
): ProductMutationResult<TripProductState> {
  return {
    resourceType: 'trip',
    resourceId: bundle.resourceId,
    operation,
    state: tripStateFromBundle(bundle, []),
    changedEntities: entities,
  }
}

function templateMutationResult(
  operation: ProductMutationOperation,
  bundle: CanonicalResourceBundle,
  entities: ProductChangedEntity[],
): ProductMutationResult<TemplateProductState> {
  return {
    resourceType: 'template',
    resourceId: bundle.resourceId,
    operation,
    state: templateStateFromBundle(bundle),
    changedEntities: entities,
  }
}

function changedEntities(commands: AuthorityCommand[]): ProductChangedEntity[] {
  return commands.map((command) => ({
    entityType: authorityEntityToDocumentEntity(command.entityType),
    entityId: command.entityId,
  }))
}

function authorityEntityToDocumentEntity(entityType: AuthorityCommand['entityType']): string {
  return ({
    trip: 'trip',
    plan: 'plan',
    plan_url: 'planUrl',
    checklist: 'checklist',
    checklist_item: 'checklistItem',
    checklist_item_assignees: 'checklistItemAssignee',
    checklist_item_user_check: 'checklistItemUserCheck',
    template: 'template',
    template_item: 'templateItem',
    template_share: 'templateShare',
  } as const)[entityType]
}

function tripStateFromBundle(
  bundle: CanonicalResourceBundle,
  collaborators: DocumentCollaborator[],
): TripProductState {
  const trip = asRow<TripRow>(bundle.data.trip, 'trip')
  const planRows = rows<PlanRow>(bundle, 'plans')
  const urlRows = rows<PlanUrlRow>(bundle, 'plan_urls')
  const checklistRows = rows<ChecklistRow>(bundle, 'checklists')
  const itemRows = rows<ChecklistItemRow>(bundle, 'checklist_items')
  const assigneeRows = rows<ChecklistItemAssigneeRow>(bundle, 'checklist_item_assignees')
  const checkRows = rows<ChecklistItemUserCheckRow>(bundle, 'checklist_item_user_checks')
  return {
    trip: {
      id: trip.id,
      ownerId: trip.user_id,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      adultsCount: trip.adults_count ?? 1,
      childrenCount: trip.children_count ?? 0,
      coverImageRef: trip.cover_image_ref,
      bgColor: trip.bg_color,
      createdAt: trip.created_at,
      updatedAt: trip.updated_at,
    },
    plans: Object.fromEntries(planRows.map((plan) => [plan.id, {
      id: plan.id,
      title: plan.title,
      location: plan.location,
      address: plan.address,
      coordinates: plan.location_lat === null || plan.location_lng === null
        ? null
        : { lat: plan.location_lat, lng: plan.location_lng },
      googlePlaceId: plan.google_place_id,
      imageUrl: plan.image_url,
      photoReference: plan.photo_reference,
      startDateTimeLocal: plan.start_datetime_local,
      endDateTimeLocal: plan.end_datetime_local,
      timezone: plan.timezone_string,
      alarmMinutesBefore: plan.alarm_minutes_before,
      alarmSentAt: plan.alarm_sent_at,
      cost: plan.cost ?? 0,
      memo: plan.memo,
      isCompleted: false,
      isVisited: plan.is_visited,
      createdAt: plan.created_at,
      updatedAt: plan.updated_at,
    }])),
    planOrder: planRows.map((plan) => plan.id),
    planUrls: Object.fromEntries(urlRows.map((url) => [url.id, {
      id: url.id,
      planId: url.plan_id,
      url: url.url,
      createdAt: url.created_at,
    }])),
    checklists: Object.fromEntries(checklistRows.map((checklist) => [checklist.id, {
      id: checklist.id,
      title: checklist.title,
      createdAt: checklist.created_at,
    }])),
    checklistItems: Object.fromEntries(itemRows.map((item) => [item.id, {
      id: item.id,
      checklistId: item.checklist_id,
      name: item.item_name,
      categoryName: item.category,
      legacyIsChecked: item.is_checked,
      isPrivate: item.is_private,
      assignmentType: normalizeAssignmentType(item.assignment_type),
      assignedUserId: item.assigned_user_id,
      sourceTemplateName: item.source_template_name,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }])),
    checklistItemAssignees: Object.fromEntries(assigneeRows.map((row) => [row.id, {
      id: row.id,
      itemId: row.item_id,
      userId: row.user_id,
      createdAt: row.created_at,
    }])),
    checklistItemUserChecks: Object.fromEntries(checkRows.map((row) => [row.id, {
      id: row.id,
      itemId: row.item_id,
      userId: row.user_id,
      createdAt: row.created_at,
    }])),
    members: Object.fromEntries(collaborators.map((member) => [member.memberId, {
      id: member.memberId,
      userId: member.userId,
      invitedEmail: member.invitedEmail,
      role: member.role,
      status: member.status,
      nickname: member.nickname,
      email: member.email,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    }])),
    assets: {},
  }
}

function templateStateFromBundle(
  bundle: CanonicalResourceBundle,
  currentUserId?: string,
): TemplateProductState {
  const template = asRow<TemplateRow>(bundle.data.template, 'template')
  const itemRows = rows<TemplateItemRow>(bundle, 'items')
  const shareRows = rows<TemplateShareRow>(bundle, 'shares')
  const role = typeof bundle.data._role === 'string' ? bundle.data._role : null
  const shares = Object.fromEntries(shareRows.map((share) => [share.id, {
    id: share.id,
    templateId: share.template_id,
    sharedWithUserId: share.shared_with_user_id,
    role: share.role === 'editor' ? 'editor' as const : 'viewer' as const,
    createdBy: share.created_by,
    createdAt: share.created_at,
    updatedAt: share.updated_at,
  }]))
  if (
    currentUserId &&
    template.user_id !== currentUserId &&
    (role === 'editor' || role === 'viewer') &&
    !Object.values(shares).some((share) => share.sharedWithUserId === currentUserId)
  ) {
    shares[`cached:${currentUserId}`] = {
      id: `cached:${currentUserId}`,
      templateId: template.id,
      sharedWithUserId: currentUserId,
      role,
      createdBy: template.user_id,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
    }
  }
  return {
    template: {
      id: template.id,
      ownerId: template.user_id,
      title: template.title,
      visibility: template.user_id === null ? 'public' : role === 'owner' ? 'private' : 'shared',
      createdAt: template.created_at,
      updatedAt: template.updated_at,
    },
    items: Object.fromEntries(itemRows.map((item, index) => [item.id, {
      id: item.id,
      templateId: item.template_id,
      name: item.item_name,
      categoryName: item.category,
      isPrivate: item.is_private,
      sortOrder: parseSortOrder(item.sort_key, index),
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }])),
    shares,
  }
}

function planReadModels(bundle: CanonicalResourceBundle) {
  return materializePlanTimeline(tripStateFromBundle(bundle, []))
}

function checklistReadModels(bundle: CanonicalResourceBundle) {
  return materializeChecklists(tripStateFromBundle(bundle, []))
}

function templateSummary(document: TemplateProductState) {
  const items = Object.values(document.items).sort((left, right) => left.sortOrder - right.sortOrder)
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

function templateDetail(document: TemplateProductState) {
  return {
    ...templateSummary(document),
    items: Object.values(document.items).sort((left, right) => left.sortOrder - right.sortOrder),
    shares: Object.values(document.shares),
  }
}

function planCreatePayload(input: CreatePlanMutationInput): Record<string, Json | undefined> {
  return {
    title: input.title,
    location: input.location,
    address: input.address,
    location_lat: input.coordinates?.lat ?? null,
    location_lng: input.coordinates?.lng ?? null,
    google_place_id: input.googlePlaceId,
    image_url: input.imageUrl,
    photo_reference: input.photoReference,
    start_datetime_local: input.startDateTimeLocal,
    end_datetime_local: input.endDateTimeLocal,
    timezone_string: input.timezone,
    alarm_minutes_before: input.alarmMinutesBefore,
    alarm_sent_at: input.alarmSentAt,
    cost: input.cost,
    memo: input.memo,
    is_visited: input.isVisited,
  }
}

function planPatchPayload(input: UpdatePlanMutationInput): Record<string, Json | undefined> {
  const patch = input.patch
  const payload: Record<string, Json | undefined> = {}
  assign(payload, 'title', patch.title)
  assign(payload, 'location', patch.location)
  assign(payload, 'address', patch.address)
  if (patch.coordinates !== undefined) {
    payload.location_lat = patch.coordinates?.lat ?? null
    payload.location_lng = patch.coordinates?.lng ?? null
  }
  assign(payload, 'google_place_id', patch.googlePlaceId)
  assign(payload, 'image_url', patch.imageUrl)
  assign(payload, 'photo_reference', patch.photoReference)
  assign(payload, 'start_datetime_local', patch.startDateTimeLocal)
  assign(payload, 'end_datetime_local', patch.endDateTimeLocal)
  assign(payload, 'timezone_string', patch.timezone)
  assign(payload, 'alarm_minutes_before', patch.alarmMinutesBefore)
  assign(payload, 'alarm_sent_at', patch.alarmSentAt)
  assign(payload, 'cost', patch.cost)
  assign(payload, 'memo', patch.memo)
  assign(payload, 'is_visited', patch.isVisited)
  return payload
}

function tripPatchPayload(patch: Partial<TripProductState['trip']>): Record<string, Json | undefined> {
  const payload: Record<string, Json | undefined> = {}
  assign(payload, 'destination', patch.destination)
  assign(payload, 'start_date', patch.startDate)
  assign(payload, 'end_date', patch.endDate)
  assign(payload, 'adults_count', patch.adultsCount)
  assign(payload, 'children_count', patch.childrenCount)
  assign(payload, 'cover_image_ref', patch.coverImageRef)
  assign(payload, 'bg_color', patch.bgColor)
  return payload
}

function checklistItemCommands(
  tripId: string,
  itemId: string,
  input: Partial<CreateChecklistItemMutationInput> | UpdateChecklistItemMutationInput['patch'],
  assigneeIds?: string[],
): AuthorityCommand[] {
  const now = new Date().toISOString()
  const payload: Record<string, Json | undefined> = {}
  assign(payload, 'checklist_id', 'checklistId' in input ? input.checklistId : undefined)
  assign(payload, 'item_name', 'name' in input ? input.name : undefined)
  assign(payload, 'category', 'categoryName' in input ? input.categoryName : undefined)
  assign(payload, 'is_checked', 'legacyIsChecked' in input ? input.legacyIsChecked : undefined)
  assign(payload, 'is_private', 'isPrivate' in input ? input.isPrivate : undefined)
  assign(payload, 'assignment_type', 'assignmentType' in input ? input.assignmentType : undefined)
  assign(payload, 'assigned_user_id', 'assignedUserId' in input ? input.assignedUserId : undefined)
  assign(payload, 'source_template_name', 'sourceTemplateName' in input ? input.sourceTemplateName : undefined)
  const commands: AuthorityCommand[] = [commandFor('checklist_item', tripId, itemId, 'upsert', payload, now)]
  if (assigneeIds) {
    commands.push(commandFor('checklist_item_assignees', tripId, itemId, 'set', {
      user_ids: assigneeIds,
    }, addMilliseconds(now, 1)))
  }
  return commands
}

async function listTripCollaborators(
  supabase: SupabaseClient,
  runtime: ServerAuthorityProductRuntime,
  tripId: string,
): Promise<DocumentCollaborator[]> {
  if (!await runtime.isOnline()) return []
  try {
    return await createInvitationRepository(supabase).listDocumentCollaborators(tripId)
  } catch {
    return []
  }
}

function withCachedActorMember(
  bundle: CanonicalResourceBundle,
  collaborators: DocumentCollaborator[],
  accountId: string,
): DocumentCollaborator[] {
  if (collaborators.some((member) => member.userId === accountId)) return collaborators
  const trip = asRow<TripRow>(bundle.data.trip, 'trip')
  const cachedRole = typeof bundle.data._role === 'string' ? bundle.data._role : null
  const role = trip.user_id === accountId
    ? 'owner'
    : cachedRole === 'editor' || cachedRole === 'viewer'
      ? cachedRole
      : null
  if (!role) return collaborators
  return [...collaborators, {
    memberId: `cached:${accountId}`,
    userId: accountId,
    invitedEmail: null,
    nickname: null,
    email: null,
    role,
    status: 'accepted',
    createdAt: trip.created_at,
    updatedAt: trip.updated_at,
  }]
}

function resolveTripActorRole(
  bundle: CanonicalResourceBundle,
  collaborators: DocumentCollaborator[],
  accountId: string,
): ServerAuthorityActorRole {
  const trip = asRow<TripRow>(bundle.data.trip, 'trip')
  if (trip.user_id === accountId) return 'owner'
  const collaborator = collaborators.find((member) =>
    member.userId === accountId && member.status === 'accepted',
  )
  if (collaborator?.role === 'editor' || collaborator?.role === 'viewer') {
    return collaborator.role
  }
  const cachedRole = bundle.data._role
  return cachedRole === 'owner' || cachedRole === 'editor' || cachedRole === 'viewer'
    ? cachedRole
    : null
}

function rows<TRow>(bundle: CanonicalResourceBundle, key: string): TRow[] {
  const value = bundle.data[key]
  return Array.isArray(value) ? value as TRow[] : []
}

function asRow<TRow>(value: Json | undefined, label: string): TRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Authority ${label} row is unavailable.`)
  }
  return value as TRow
}

function asObject(value: Json | undefined): Record<string, Json | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, Json | undefined>
}

function assign(
  target: Record<string, Json | undefined>,
  key: string,
  value: Json | undefined,
): void {
  if (value !== undefined) target[key] = value
}

function normalizeAssignmentType(value: string): 'anyone' | 'specific' | 'everyone' {
  return value === 'specific' || value === 'everyone' ? value : 'anyone'
}

function parseSortOrder(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function addMilliseconds(value: string, milliseconds: number): string {
  return new Date(Date.parse(value) + milliseconds).toISOString()
}

function assertWritable(role: ServerAuthorityActorRole): void {
  if (role !== 'owner' && role !== 'editor') throw new Error('수정 권한이 없습니다.')
}

function assertOwner(role: ServerAuthorityActorRole): void {
  if (role !== 'owner') throw new Error('소유자 권한이 필요합니다.')
}
