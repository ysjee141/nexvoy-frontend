import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ServerAuthoritySyncCoordinator,
  applyOptimisticAuthorityCommandsToBundle,
  createServerAuthorityRepository,
  versionAuthorityCommandsForBundle,
  type AuthorityCommand,
  type AuthorityConflictResolution,
  type AuthorityProductSyncSnapshot,
  type AuthorityResourceType,
  type CanonicalResourceBundle,
} from '@nexvoy/core'
import type { ProductRepositoryBundle } from '@nexvoy/core/product/repositories'
import {
  createServerAuthorityProductRepositories,
  createServerAuthorityTemplate,
  createServerAuthorityTrip,
  type ServerAuthorityActorRole,
  type ServerAuthorityProductRuntime,
} from '@nexvoy/core/repositories/serverAuthorityProductRepository'
import { WebAuthorityIndexedDbStore, type WebAuthorityStoreChange } from '@/lib/server-authority/indexedDbStore'
import {
  subscribeWebAuthorityInvalidation,
  type WebAuthorityInvalidationSubscription,
} from '@/lib/server-authority/realtimeInvalidation'
import { analytics } from '@/services/AnalyticsService'

type ActorRole = ServerAuthorityActorRole
const AUTHORITY_FLUSH_DEBOUNCE_MS = 1_000

interface AuthorityRuntimeSubscription {
  count: number
  subscription: Promise<WebAuthorityInvalidationSubscription>
}

class WebAuthorityProductRuntime implements ServerAuthorityProductRuntime {
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
      metricSink: (metric) => analytics.logAuthoritySyncMetric(metric),
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

  async isOnline(): Promise<boolean> {
    return isBrowserOnline()
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
    const versionedCommands = versionAuthorityCommandsForBundle(bundle, commands)
    const optimistic = applyOptimisticAuthorityCommandsToBundle(bundle, versionedCommands, now)
    await this.store.commitOptimisticMutations({
      accountId,
      baseBundle: bundle,
      bundle: optimistic,
      commands: versionedCommands,
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

  async resolveConflict(
    resourceType: AuthorityResourceType,
    resourceId: string,
    resolution: AuthorityConflictResolution,
  ): Promise<void> {
    const accountId = await this.accountId()
    await this.store.resolveConflict(
      accountId,
      resourceType,
      resourceId,
      resolution,
      new Date().toISOString(),
    )
    if (resolution === 'retry_local') await this.flushAccount(accountId)
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
      onMetric: (metric) => analytics.logAuthorityRealtimeMetric(metric),
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

export function createWebAuthorityDocumentRepositories(
  supabase: SupabaseClient,
  options: { actorRole?: ActorRole } = {},
): Promise<ProductRepositoryBundle> {
  return createServerAuthorityProductRepositories(supabase, getRuntime(supabase), options)
}

export function createWebAuthorityTrip(input: {
  supabase: SupabaseClient
  destination: string
  startDate: string
  endDate: string
  adultsCount: number
  childrenCount: number
}): Promise<string> {
  const { supabase, ...trip } = input
  return createServerAuthorityTrip({ runtime: getRuntime(supabase), ...trip })
}

export function createWebAuthorityTemplate(input: {
  supabase: SupabaseClient
  title: string
  items: Array<{ item_name: string; category: string; is_private?: boolean }>
}): Promise<string> {
  const { supabase, ...template } = input
  return createServerAuthorityTemplate({ runtime: getRuntime(supabase), ...template })
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
    if (
      change.accountId === accountId &&
      (!change.resourceType || change.resourceType === resourceType)
    ) listener()
  })
}

export function getWebAuthoritySyncSnapshot(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
): Promise<AuthorityProductSyncSnapshot> {
  return getRuntime(supabase).syncSnapshot(resourceType, resourceId)
}

export function resolveWebAuthorityConflict(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
  resolution: AuthorityConflictResolution,
): Promise<void> {
  return getRuntime(supabase).resolveConflict(resourceType, resourceId, resolution)
}

export function refreshWebAuthorityList(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
): Promise<CanonicalResourceBundle[]> {
  return getRuntime(supabase).refreshList(resourceType)
}

function normalizeActorRole(role: string): ActorRole {
  return role === 'owner' || role === 'editor' || role === 'viewer' ? role : null
}

function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}
