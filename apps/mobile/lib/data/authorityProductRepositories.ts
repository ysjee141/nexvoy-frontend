import { AppState } from 'react-native'
import * as Network from 'expo-network'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyOptimisticAuthorityCommandsToBundle,
  createServerAuthorityProductRepositories,
  createServerAuthorityRepository,
  createServerAuthorityTemplate,
  createServerAuthorityTrip,
  type AuthorityCommand,
  type AuthorityProductSyncSnapshot,
  type AuthorityResourceType,
  type CanonicalResourceBundle,
  type ServerAuthorityActorRole,
  type ServerAuthorityProductRuntime,
} from '@nexvoy/core'
import type { DocumentPrimaryRepositoryBundle } from '@nexvoy/core/repositories/documentPrimaryRepository'
import {
  flushMobileAuthorityOutbox,
  getMobileAuthorityRuntime,
  watchMobileAuthorityResource,
} from './server-authority/syncService'

const AUTHORITY_FLUSH_DEBOUNCE_MS = 1_000

class MobileAuthorityProductRuntime implements ServerAuthorityProductRuntime {
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private readonly listRefreshes = new Map<AuthorityResourceType, Promise<CanonicalResourceBundle[]>>()

  constructor(private readonly supabase: SupabaseClient) {}

  async accountId(): Promise<string> {
    const { data } = await this.supabase.auth.getSession()
    const accountId = data.session?.user.id
    if (!accountId) throw new Error('인증 정보가 없습니다.')
    return accountId
  }

  isOnline(): Promise<boolean> {
    return isNetworkOnline()
  }

  async listLocal(resourceType: AuthorityResourceType): Promise<CanonicalResourceBundle[]> {
    const [accountId, runtime] = await Promise.all([
      this.accountId(),
      getMobileAuthorityRuntime(),
    ])
    this.kickFlush()
    return runtime.store.listResources(accountId, resourceType)
  }

  async refreshList(resourceType: AuthorityResourceType): Promise<CanonicalResourceBundle[]> {
    const active = this.listRefreshes.get(resourceType)
    if (active) return active
    const refresh = this.refreshListNow(resourceType).finally(() => {
      if (this.listRefreshes.get(resourceType) === refresh) {
        this.listRefreshes.delete(resourceType)
      }
    })
    this.listRefreshes.set(resourceType, refresh)
    return refresh
  }

  private async refreshListNow(resourceType: AuthorityResourceType): Promise<CanonicalResourceBundle[]> {
    const [accountId, runtime] = await Promise.all([
      this.accountId(),
      getMobileAuthorityRuntime(),
    ])
    if (!await this.isOnline()) return runtime.store.listResources(accountId, resourceType)

    await flushMobileAuthorityOutbox()
    const remote = createServerAuthorityRepository(this.supabase)
    const summaries = await remote.listMySummaries(resourceType)
    const remoteIds = new Set(summaries.map((summary) => summary.resourceId))
    for (const summary of summaries) {
      const bundle = await runtime.coordinator.refreshResource(
        accountId,
        resourceType,
        summary.resourceId,
        summary.revision,
      )
      if (bundle) await this.cacheRole(accountId, bundle, normalizeRole(summary.role))
    }

    const local = await runtime.store.listResources(accountId, resourceType)
    for (const bundle of local) {
      if (remoteIds.has(bundle.resourceId)) continue
      const snapshot = await runtime.store.getSyncSnapshot(
        accountId,
        resourceType,
        bundle.resourceId,
        true,
      )
      if (snapshot.status === 'synced') {
        await runtime.store.deleteResource(accountId, resourceType, bundle.resourceId)
      }
    }
    return runtime.store.listResources(accountId, resourceType)
  }

  async getBundle(
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<CanonicalResourceBundle | null> {
    const [accountId, runtime] = await Promise.all([
      this.accountId(),
      getMobileAuthorityRuntime(),
    ])
    const local = await runtime.store.getResource(accountId, resourceType, resourceId)
    if (!await this.isOnline()) return local
    this.kickFlush()
    if (!local) {
      return runtime.coordinator.refreshResource(
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
    const [accountId, runtime] = await Promise.all([
      this.accountId(),
      getMobileAuthorityRuntime(),
    ])
    if (!await this.isOnline()) {
      return runtime.store.getResource(accountId, resourceType, resourceId)
    }
    const revision = await createServerAuthorityRepository(this.supabase)
      .getRevision(resourceType, resourceId)
    return runtime.coordinator.refreshResource(accountId, resourceType, resourceId, revision)
  }

  async commit(
    bundle: CanonicalResourceBundle,
    commands: AuthorityCommand[],
  ): Promise<CanonicalResourceBundle> {
    const [accountId, runtime] = await Promise.all([
      this.accountId(),
      getMobileAuthorityRuntime(),
    ])
    const now = new Date().toISOString()
    const optimistic = applyOptimisticAuthorityCommandsToBundle(bundle, commands, now)
    await runtime.store.commitOptimisticMutations({
      accountId,
      baseBundle: bundle,
      bundle: optimistic,
      commands,
      now,
    })
    this.kickFlush()
    return optimistic
  }

  async cacheRole(
    accountId: string,
    bundle: CanonicalResourceBundle,
    role: ServerAuthorityActorRole,
  ): Promise<CanonicalResourceBundle> {
    if (!role || bundle.data._role === role) return bundle
    return await (await getMobileAuthorityRuntime()).store.setResourceRole(
      accountId,
      bundle.resourceType,
      bundle.resourceId,
      role,
    ) ?? { ...bundle, data: { ...bundle.data, _role: role } }
  }

  async syncSnapshot(
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<AuthorityProductSyncSnapshot> {
    const [accountId, runtime, online] = await Promise.all([
      this.accountId(),
      getMobileAuthorityRuntime(),
      this.isOnline(),
    ])
    return runtime.store.getSyncSnapshot(accountId, resourceType, resourceId, online)
  }

  private kickFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void flushMobileAuthorityOutbox()
    }, AUTHORITY_FLUSH_DEBOUNCE_MS)
  }
}

const runtimeByClient = new WeakMap<SupabaseClient, MobileAuthorityProductRuntime>()

function getRuntime(supabase: SupabaseClient): MobileAuthorityProductRuntime {
  const existing = runtimeByClient.get(supabase)
  if (existing) return existing
  const runtime = new MobileAuthorityProductRuntime(supabase)
  runtimeByClient.set(supabase, runtime)
  return runtime
}

export function createMobileAuthorityDocumentRepositories(
  supabase: SupabaseClient,
  options: { actorRole?: ServerAuthorityActorRole } = {},
): Promise<DocumentPrimaryRepositoryBundle> {
  return createServerAuthorityProductRepositories(supabase, getRuntime(supabase), options)
}

export function createMobileAuthorityTrip(input: {
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

export function createMobileAuthorityTemplate(input: {
  supabase: SupabaseClient
  title: string
  items: Array<{ item_name: string; category: string; is_private?: boolean }>
}): Promise<string> {
  const { supabase, ...template } = input
  return createServerAuthorityTemplate({ runtime: getRuntime(supabase), ...template })
}

export async function subscribeMobileAuthorityResource(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
  listener: () => void,
): Promise<() => Promise<void>> {
  const runtime = getRuntime(supabase)
  const accountId = await runtime.accountId()
  const store = (await getMobileAuthorityRuntime()).store
  let disposed = false
  let realtime: Awaited<ReturnType<typeof watchMobileAuthorityResource>> = null
  let watchInFlight: Promise<void> | null = null
  const ensureRealtime = () => {
    if (disposed || realtime || watchInFlight) return
    watchInFlight = watchMobileAuthorityResource(resourceType, resourceId)
      .then(async (next) => {
        if (disposed) await next?.unsubscribe()
        else realtime = next
      })
      .catch(() => undefined)
      .finally(() => {
        watchInFlight = null
      })
  }
  const unsubscribeStore = store.subscribe((change) => {
    if (
      change.accountId === accountId &&
      (!change.resourceType || change.resourceType === resourceType) &&
      (!change.resourceId || change.resourceId === resourceId)
    ) {
      listener()
      ensureRealtime()
    }
  })
  ensureRealtime()
  return async () => {
    disposed = true
    unsubscribeStore()
    await watchInFlight
    await realtime?.unsubscribe()
  }
}

export async function subscribeMobileAuthorityAccount(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  listener: () => void,
): Promise<() => void> {
  const runtime = getRuntime(supabase)
  const accountId = await runtime.accountId()
  const store = (await getMobileAuthorityRuntime()).store
  const unsubscribeStore = store.subscribe((change) => {
    if (
      change.accountId === accountId &&
      (!change.resourceType || change.resourceType === resourceType)
    ) listener()
  })
  const refresh = () => {
    void runtime.refreshList(resourceType).catch(() => undefined)
  }
  const appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') refresh()
  })
  const networkSubscription = Network.addNetworkStateListener((state) => {
    if (state.isConnected !== false && state.isInternetReachable !== false) refresh()
  })
  return () => {
    unsubscribeStore()
    appStateSubscription.remove()
    networkSubscription.remove()
  }
}

export function getMobileAuthoritySyncSnapshot(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
): Promise<AuthorityProductSyncSnapshot> {
  return getRuntime(supabase).syncSnapshot(resourceType, resourceId)
}

export function refreshMobileAuthorityList(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
): Promise<CanonicalResourceBundle[]> {
  return getRuntime(supabase).refreshList(resourceType)
}

function normalizeRole(role: string): ServerAuthorityActorRole {
  return role === 'owner' || role === 'editor' || role === 'viewer' ? role : null
}

async function isNetworkOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync()
    return state.isConnected !== false && state.isInternetReachable !== false
  } catch {
    return false
  }
}
