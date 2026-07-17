import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@nexvoy/types'
import {
  ServerAuthoritySyncCoordinator,
  applyOptimisticAuthorityCommandsToBundle,
  createServerAuthorityRepository,
  materializeChecklists,
  materializePlanTimeline,
  materializeTripDetail,
  materializeTripSummary,
  type AuthorityCommand,
  type AuthorityProductSyncSnapshot,
  type AuthorityResourceType,
  type CanonicalResourceBundle,
  type DocumentMutationChangedEntity,
  type DocumentMutationOperation,
  type DocumentMutationResult,
} from '@nexvoy/core'
import type {
  CreateChecklistItemMutationInput,
  CreateChecklistMutationInput,
  CreatePlanMutationInput,
  ReplaceTemplateItemsMutationInput,
  ToggleChecklistItemMutationInput,
  UpdateChecklistItemMutationInput,
  UpdatePlanMutationInput,
  UpsertMemberMutationInput,
  UpsertPlanUrlMutationInput,
  UpsertTemplateShareMutationInput,
} from '@nexvoy/core/local-first/documentMutationWriter'
import type { TripDocumentV1 } from '@nexvoy/core/local-first/documentModel'
import type { TemplateDocumentV1 } from '@nexvoy/core/local-first/templateDocument'
import type { DocumentPrimaryRepositoryBundle } from '@nexvoy/core/repositories/documentPrimaryRepository'
import {
  createInvitationRepository,
  type DocumentCollaborator,
} from '@nexvoy/core/supabase/invitationRepository'
import { WebAuthorityIndexedDbStore, type WebAuthorityStoreChange } from '@/lib/server-authority/indexedDbStore'
import {
  subscribeWebAuthorityInvalidation,
  type WebAuthorityInvalidationSubscription,
} from '@/lib/server-authority/realtimeInvalidation'

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

type ActorRole = 'owner' | 'editor' | 'viewer' | null
const AUTHORITY_FLUSH_DEBOUNCE_MS = 1_000

interface AuthorityRuntimeSubscription {
  count: number
  subscription: Promise<WebAuthorityInvalidationSubscription>
}

class WebAuthorityProductRuntime {
  readonly store = new WebAuthorityIndexedDbStore()
  readonly remote
  readonly coordinator
  private readonly watchedResources = new Map<string, AuthorityRuntimeSubscription>()
  private readonly flushTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly accountRepairPromises = new Map<string, Promise<void>>()

  constructor(private readonly supabase: SupabaseClient) {
    this.remote = createServerAuthorityRepository(supabase)
    this.coordinator = new ServerAuthoritySyncCoordinator({
      repository: this.remote,
      store: this.store,
    })
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { void this.flushCurrentAccount() })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void this.flushCurrentAccount()
      })
    }
  }

  async accountId(): Promise<string> {
    const { data: sessionData } = await this.supabase.auth.getSession()
    if (sessionData.session?.user) return this.prepareAccount(sessionData.session.user.id)
    if (isBrowserOnline()) {
      const { data, error } = await this.supabase.auth.getUser()
      if (error) throw error
      if (data.user) return this.prepareAccount(data.user.id)
    }
    throw new Error('인증 정보가 없습니다.')
  }

  private async prepareAccount(accountId: string): Promise<string> {
    let repair = this.accountRepairPromises.get(accountId)
    if (!repair) {
      repair = this.store
        .repairMislabeledPlanCommands(accountId, new Date().toISOString())
        .then(() => undefined)
        .catch((error: unknown) => {
          this.accountRepairPromises.delete(accountId)
          throw error
        })
      this.accountRepairPromises.set(accountId, repair)
    }
    await repair
    return accountId
  }

  async listLocal(resourceType: AuthorityResourceType): Promise<CanonicalResourceBundle[]> {
    const accountId = await this.accountId()
    this.kickFlush(accountId)
    return this.store.listResources(accountId, resourceType)
  }

  async refreshList(resourceType: AuthorityResourceType): Promise<CanonicalResourceBundle[]> {
    const accountId = await this.accountId()
    if (!isBrowserOnline()) return this.store.listResources(accountId, resourceType)

    await this.flushAccount(accountId)

    const summaries = await this.remote.listMySummaries(resourceType)
    const remoteIds = new Set(summaries.map((summary) => summary.resourceId))
    for (const summary of summaries) {
      const bundle = await this.coordinator.refreshResource(
        accountId,
        resourceType,
        summary.resourceId,
        summary.revision,
      )
      if (bundle) {
        await this.cacheRole(accountId, bundle, normalizeActorRole(summary.role))
      }
    }

    const local = await this.store.listResources(accountId, resourceType)
    for (const bundle of local) {
      if (remoteIds.has(bundle.resourceId)) continue
      const sync = await this.store.getSyncSnapshot(accountId, resourceType, bundle.resourceId, true)
      if (sync.status === 'synced') {
        await this.store.deleteResource(accountId, resourceType, bundle.resourceId)
      }
    }
    return this.store.listResources(accountId, resourceType)
  }

  async getBundle(
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<CanonicalResourceBundle | null> {
    const accountId = await this.accountId()
    const local = await this.store.getResource(accountId, resourceType, resourceId)
    if (!isBrowserOnline()) return local
    this.kickFlush(accountId)
    if (!local) {
      return this.coordinator.refreshResource(
        accountId,
        resourceType,
        resourceId,
        Number.MAX_SAFE_INTEGER,
      )
    }
    void this.refreshResource(resourceType, resourceId).catch(() => undefined)
    return local
  }

  async refreshResource(
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<CanonicalResourceBundle | null> {
    const accountId = await this.accountId()
    if (!isBrowserOnline()) return this.store.getResource(accountId, resourceType, resourceId)
    const revision = await this.remote.getRevision(resourceType, resourceId)
    return this.coordinator.refreshResource(accountId, resourceType, resourceId, revision)
  }

  async commit(
    bundle: CanonicalResourceBundle,
    commands: AuthorityCommand[],
  ): Promise<CanonicalResourceBundle> {
    const accountId = await this.accountId()
    const now = new Date().toISOString()
    const optimistic = applyOptimisticAuthorityCommandsToBundle(bundle, commands, now)
    await this.store.commitOptimisticMutations({
      accountId,
      baseBundle: bundle,
      bundle: optimistic,
      commands,
      now,
    })
    this.kickFlush(accountId)
    return optimistic
  }

  async syncSnapshot(
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<AuthorityProductSyncSnapshot> {
    return this.store.getSyncSnapshot(
      await this.accountId(),
      resourceType,
      resourceId,
      isBrowserOnline(),
    )
  }

  async cacheRole(
    accountId: string,
    bundle: CanonicalResourceBundle,
    role: ActorRole,
  ): Promise<CanonicalResourceBundle> {
    if (!role || bundle.data._role === role) return bundle
    const withRole = { ...bundle, data: { ...bundle.data, _role: role } }
    return await this.store.setResourceRole(
      accountId,
      bundle.resourceType,
      bundle.resourceId,
      role,
    ) ?? withRole
  }

  async watch(
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<() => Promise<void>> {
    if (!isBrowserOnline()) return async () => undefined
    const accountId = await this.accountId()
    const key = `${accountId}:${resourceType}:${resourceId}`
    const active = this.watchedResources.get(key)
    if (active) {
      active.count += 1
      return () => this.releaseWatch(key)
    }

    await this.flushAccount(accountId)
    await this.refreshResource(resourceType, resourceId).catch(() => undefined)
    const subscription = subscribeWebAuthorityInvalidation({
      supabase: this.supabase,
      accountId,
      resourceType,
      resourceId,
      store: this.store,
      coordinator: this.coordinator,
    })
    this.watchedResources.set(key, { count: 1, subscription })
    try {
      await subscription
    } catch {
      this.watchedResources.delete(key)
      return async () => undefined
    }
    return () => this.releaseWatch(key)
  }

  subscribe(listener: (change: WebAuthorityStoreChange) => void): () => void {
    return this.store.subscribe(listener)
  }

  private async releaseWatch(key: string): Promise<void> {
    const active = this.watchedResources.get(key)
    if (!active) return
    active.count -= 1
    if (active.count > 0) return
    this.watchedResources.delete(key)
    await (await active.subscription).unsubscribe()
  }

  private async flushCurrentAccount(): Promise<void> {
    if (!isBrowserOnline()) return
    try {
      await this.flushAccount(await this.accountId())
    } catch {
      // Outbox classification persists retry/rejection details for the sync status UI.
    }
  }

  private kickFlush(accountId: string): void {
    if (!isBrowserOnline()) return
    if (this.flushTimers.has(accountId)) return
    const timer = setTimeout(() => {
      this.flushTimers.delete(accountId)
      void this.flushAccount(accountId).catch(() => undefined)
    }, AUTHORITY_FLUSH_DEBOUNCE_MS)
    this.flushTimers.set(accountId, timer)
  }

  private async flushAccount(accountId: string): Promise<void> {
    if (!isBrowserOnline()) return
    const pendingTimer = this.flushTimers.get(accountId)
    if (pendingTimer) clearTimeout(pendingTimer)
    this.flushTimers.delete(accountId)
    const { data } = await this.supabase.auth.getSession()
    if (data.session?.user.id !== accountId) {
      const timer = this.retryTimers.get(accountId)
      if (timer) clearTimeout(timer)
      this.retryTimers.delete(accountId)
      return
    }
    await this.coordinator.flush(accountId)
    this.scheduleRetry(accountId, await this.store.getNextRetryAt(accountId))
  }

  private scheduleRetry(accountId: string, retryAt: string | null): void {
    const current = this.retryTimers.get(accountId)
    if (current) clearTimeout(current)
    this.retryTimers.delete(accountId)
    if (!retryAt || !isBrowserOnline()) return

    const delay = Math.max(0, Date.parse(retryAt) - Date.now())
    const timer = setTimeout(() => {
      this.retryTimers.delete(accountId)
      void this.flushAccount(accountId).catch(() => undefined)
    }, delay)
    this.retryTimers.set(accountId, timer)
  }
}

const runtimeByClient = new WeakMap<SupabaseClient, WebAuthorityProductRuntime>()

function getRuntime(supabase: SupabaseClient): WebAuthorityProductRuntime {
  const existing = runtimeByClient.get(supabase)
  if (existing) return existing
  const runtime = new WebAuthorityProductRuntime(supabase)
  runtimeByClient.set(supabase, runtime)
  return runtime
}

export async function createWebAuthorityDocumentRepositories(
  supabase: SupabaseClient,
  options: { actorRole?: ActorRole } = {},
): Promise<DocumentPrimaryRepositoryBundle> {
  const runtime = getRuntime(supabase)
  const actorRole = options.actorRole ?? 'viewer'

  const repositories: DocumentPrimaryRepositoryBundle = {
    trips: {
      async listTrips() {
        const local = await runtime.listLocal('trip')
        return local.flatMap((bundle) => {
          const document = tripDocumentFromBundle(bundle, [])
          return document && !asObject(bundle.data.trip).deleted_at
            ? [materializeTripSummary(document)]
            : []
        })
      },
      async getTrip(tripId) {
        const [bundle, collaborators, accountId] = await Promise.all([
          runtime.getBundle('trip', tripId),
          listTripCollaborators(supabase, tripId),
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
        const document = cachedBundle ? tripDocumentFromBundle(cachedBundle, members) : null
        return document
          ? materializeTripDetail(document, { currentUserId: accountId })
          : null
      },
      async getTripDocument(tripId) {
        const [bundle, collaborators, accountId] = await Promise.all([
          runtime.getBundle('trip', tripId),
          listTripCollaborators(supabase, tripId),
          runtime.accountId(),
        ])
        const cachedBundle = bundle
          ? await runtime.cacheRole(
              accountId,
              bundle,
              resolveTripActorRole(bundle, collaborators, accountId),
            )
          : null
        return cachedBundle
          ? tripDocumentFromBundle(
              cachedBundle,
              withCachedActorMember(cachedBundle, collaborators, accountId),
            )
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
          const document = templateDocumentFromBundle(bundle)
          if (!document || asObject(bundle.data.template).deleted_at) return []
          return [templateSummary(document)]
        })
      },
      async getTemplate(templateId) {
        const [bundle, accountId] = await Promise.all([
          runtime.getBundle('template', templateId),
          runtime.accountId(),
        ])
        const document = bundle ? templateDocumentFromBundle(bundle, accountId) : null
        return document ? templateDetail(document) : null
      },
      async getTemplateDocument(templateId) {
        const [bundle, accountId] = await Promise.all([
          runtime.getBundle('template', templateId),
          runtime.accountId(),
        ])
        return bundle ? templateDocumentFromBundle(bundle, accountId) : null
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
          listTripCollaborators(supabase, tripId),
          runtime.accountId(),
        ])
        return materializeTripDetail(tripDocumentFromBundle(
          bundle,
          withCachedActorMember(bundle, collaborators, accountId),
        ), {
          currentUserId: accountId,
        }).members
      },
      async upsertMember(tripId, input: UpsertMemberMutationInput) {
        throw new Error(`Membership mutation for ${tripId}:${input.member.id} is handled by invitation authority.`)
      },
      async revokeMember(tripId, memberId) {
        throw new Error(`Membership mutation for ${tripId}:${memberId} is handled by invitation authority.`)
      },
    },
  }

  return repositories
}

export async function createWebAuthorityTrip(input: {
  supabase: SupabaseClient
  destination: string
  startDate: string
  endDate: string
  adultsCount: number
  childrenCount: number
}): Promise<string> {
  const runtime = getRuntime(input.supabase)
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

export async function createWebAuthorityTemplate(input: {
  supabase: SupabaseClient
  title: string
  items: Array<{ item_name: string; category: string; is_private?: boolean }>
}): Promise<string> {
  const runtime = getRuntime(input.supabase)
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

export async function subscribeWebAuthorityResource(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
  listener: () => void,
): Promise<() => Promise<void>> {
  const runtime = getRuntime(supabase)
  const accountId = await runtime.accountId()
  const unsubscribeStore = runtime.subscribe((change) => {
    if (
      change.accountId === accountId &&
      (!change.resourceType || change.resourceType === resourceType) &&
      (!change.resourceId || change.resourceId === resourceId)
    ) listener()
  })
  const unwatch = await runtime.watch(resourceType, resourceId)
  return async () => {
    unsubscribeStore()
    await unwatch()
  }
}

export async function subscribeWebAuthorityAccount(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  listener: () => void,
): Promise<() => void> {
  const runtime = getRuntime(supabase)
  const accountId = await runtime.accountId()
  return runtime.subscribe((change) => {
    if (change.accountId === accountId && (!change.resourceType || change.resourceType === resourceType)) {
      listener()
    }
  })
}

export function getWebAuthoritySyncSnapshot(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
): Promise<AuthorityProductSyncSnapshot> {
  return getRuntime(supabase).syncSnapshot(resourceType, resourceId)
}

export function refreshWebAuthorityList(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
): Promise<CanonicalResourceBundle[]> {
  return getRuntime(supabase).refreshList(resourceType)
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
  runtime: WebAuthorityProductRuntime,
  resourceType: AuthorityResourceType,
  resourceId: string,
): Promise<CanonicalResourceBundle> {
  const bundle = await runtime.getBundle(resourceType, resourceId)
  if (!bundle) throw new Error(`${resourceType === 'trip' ? 'Trip' : 'Template'} was not found.`)
  return bundle
}

function tripMutationResult(
  operation: DocumentMutationOperation,
  bundle: CanonicalResourceBundle,
  entities: DocumentMutationChangedEntity[],
): DocumentMutationResult<TripDocumentV1> {
  return {
    documentType: 'trip',
    documentId: bundle.resourceId,
    operation,
    document: tripDocumentFromBundle(bundle, []),
    update: new Uint8Array(),
    changedEntities: entities,
  }
}

function templateMutationResult(
  operation: DocumentMutationOperation,
  bundle: CanonicalResourceBundle,
  entities: DocumentMutationChangedEntity[],
): DocumentMutationResult<TemplateDocumentV1> {
  return {
    documentType: 'template',
    documentId: bundle.resourceId,
    operation,
    document: templateDocumentFromBundle(bundle),
    update: new Uint8Array(),
    changedEntities: entities,
  }
}

function changedEntities(commands: AuthorityCommand[]): DocumentMutationChangedEntity[] {
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

function tripDocumentFromBundle(
  bundle: CanonicalResourceBundle,
  collaborators: DocumentCollaborator[],
): TripDocumentV1 {
  const trip = asRow<TripRow>(bundle.data.trip, 'trip')
  const planRows = rows<PlanRow>(bundle, 'plans')
  const urlRows = rows<PlanUrlRow>(bundle, 'plan_urls')
  const checklistRows = rows<ChecklistRow>(bundle, 'checklists')
  const itemRows = rows<ChecklistItemRow>(bundle, 'checklist_items')
  const assigneeRows = rows<ChecklistItemAssigneeRow>(bundle, 'checklist_item_assignees')
  const checkRows = rows<ChecklistItemUserCheckRow>(bundle, 'checklist_item_user_checks')
  return {
    schemaVersion: 1,
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
    checklistCategories: {},
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
    shares: {},
    invitationLinks: {},
    assets: {},
    tombstones: {},
    meta: {},
  }
}

function templateDocumentFromBundle(
  bundle: CanonicalResourceBundle,
  currentUserId?: string,
): TemplateDocumentV1 {
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
    schemaVersion: 1,
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
    tombstones: {},
    meta: {},
  }
}

function planReadModels(bundle: CanonicalResourceBundle) {
  return materializePlanTimeline(tripDocumentFromBundle(bundle, []))
}

function checklistReadModels(bundle: CanonicalResourceBundle) {
  return materializeChecklists(tripDocumentFromBundle(bundle, []))
}

function templateSummary(document: TemplateDocumentV1) {
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

function templateDetail(document: TemplateDocumentV1) {
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

function tripPatchPayload(patch: Partial<TripDocumentV1['trip']>): Record<string, Json | undefined> {
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
  tripId: string,
): Promise<DocumentCollaborator[]> {
  if (!isBrowserOnline()) return []
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
): ActorRole {
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

function assertWritable(role: ActorRole): void {
  if (role !== 'owner' && role !== 'editor') throw new Error('수정 권한이 없습니다.')
}

function normalizeActorRole(role: string): ActorRole {
  return role === 'owner' || role === 'editor' || role === 'viewer' ? role : null
}

function assertOwner(role: ActorRole): void {
  if (role !== 'owner') throw new Error('소유자 권한이 필요합니다.')
}

function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}
