import { AppState, Platform } from 'react-native'
import * as Network from 'expo-network'
import {
  ServerAuthoritySyncCoordinator,
  createServerAuthorityRepository,
  type AuthorityFlushResult,
  type AuthorityResourceType,
} from '@nexvoy/core'
import { supabase } from '@/lib/supabase'
import {
  deleteMobileAuthorityDatabase,
  openMobileAuthorityDatabase,
} from './sqliteDatabase'
import { MobileAuthoritySqliteStore } from './sqliteStore'
import {
  subscribeMobileAuthorityInvalidation,
  type MobileAuthorityInvalidationSubscription,
} from './realtimeInvalidation'

export interface MobileAuthorityRuntime {
  store: MobileAuthoritySqliteStore
  coordinator: ServerAuthoritySyncCoordinator
}

let runtimePromise: Promise<MobileAuthorityRuntime> | null = null
let activeAccountId: string | null = null
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null
let networkSubscription: ReturnType<typeof Network.addNetworkStateListener> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
const activeRealtimeSubscriptions = new Set<MobileAuthorityInvalidationSubscription>()

export async function getMobileAuthorityStore(): Promise<MobileAuthoritySqliteStore> {
  return (await getRuntime()).store
}

export function getMobileAuthorityRuntime(): Promise<MobileAuthorityRuntime> {
  return getRuntime()
}

export async function startMobileAuthoritySync(accountId: string): Promise<void> {
  if (!isSupportedNativePlatform()) return
  if (activeAccountId && activeAccountId !== accountId) {
    await closeRealtimeSubscriptions()
    clearRetryTimer()
  }
  activeAccountId = accountId
  ensureLifecycleListeners()
  await flushMobileAuthorityOutbox()
}

export async function stopMobileAuthoritySync(): Promise<void> {
  activeAccountId = null
  clearRetryTimer()
  appStateSubscription?.remove()
  appStateSubscription = null
  networkSubscription?.remove()
  networkSubscription = null
  await closeRealtimeSubscriptions()
}

export async function flushMobileAuthorityOutbox(): Promise<AuthorityFlushResult | null> {
  const accountId = activeAccountId
  if (!accountId) return null
  if (!await isNetworkOnline()) return null
  const result = await performFlush(accountId)
  if (result && activeAccountId === accountId) {
    try {
      await scheduleNextRetry(accountId)
    } catch (error) {
      reportAuthoritySyncError(error)
    }
  }
  return result
}

export async function flushMobileAuthorityAccount(
  accountId: string,
): Promise<AuthorityFlushResult | null> {
  return flushAccount(accountId)
}

export async function notifyMobileAuthorityMutationCommitted(): Promise<AuthorityFlushResult | null> {
  return flushMobileAuthorityOutbox()
}

export async function enterMobileAuthorityResource(
  resourceType: AuthorityResourceType,
  resourceId: string,
): Promise<void> {
  const accountId = activeAccountId
  if (!accountId) return
  const runtime = await getRuntime()
  await runtime.coordinator.refreshResource(accountId, resourceType, resourceId)
  await flushMobileAuthorityOutbox()
}

export async function watchMobileAuthorityResource(
  resourceType: AuthorityResourceType,
  resourceId: string,
): Promise<MobileAuthorityInvalidationSubscription | null> {
  const accountId = activeAccountId
  if (!accountId) return null
  const runtime = await getRuntime()
  await runtime.coordinator.refreshResource(accountId, resourceType, resourceId)
  const subscription = await subscribeMobileAuthorityInvalidation({
    supabase,
    accountId,
    resourceType,
    resourceId,
    store: runtime.store,
    coordinator: runtime.coordinator,
    onError: reportAuthoritySyncError,
  })
  const tracked: MobileAuthorityInvalidationSubscription = {
    topic: subscription.topic,
    async unsubscribe() {
      activeRealtimeSubscriptions.delete(tracked)
      await subscription.unsubscribe()
    },
  }
  activeRealtimeSubscriptions.add(tracked)
  return tracked
}

export async function promoteMobileAuthorityGuestAccount(
  guestAccountId: string,
  accountId: string,
): Promise<AuthorityFlushResult> {
  return (await getRuntime()).coordinator.promoteGuestAccount(guestAccountId, accountId)
}

export async function purgeMobileAuthorityResource(
  accountId: string,
  resourceType: AuthorityResourceType,
  resourceId: string,
): Promise<void> {
  if (activeAccountId === accountId) {
    const topic = `${resourceType}:${resourceId}`
    const matchingSubscriptions = [...activeRealtimeSubscriptions]
      .filter((subscription) => subscription.topic === topic)
    await Promise.allSettled(
      matchingSubscriptions.map((subscription) => subscription.unsubscribe()),
    )
  }
  await (await getRuntime()).store.deleteResource(accountId, resourceType, resourceId)
}

export async function purgeMobileAuthorityAccount(accountId: string): Promise<void> {
  if (!isSupportedNativePlatform()) return
  if (activeAccountId === accountId) {
    activeAccountId = null
    clearRetryTimer()
    await closeRealtimeSubscriptions()
  }
  const runtime = await getRuntime()
  try {
    await runtime.store.purgeAccount(accountId)
  } catch {
    // Withdrawal must not leave readable product data behind if row-level purge fails.
    await runtime.store.close()
    runtimePromise = null
    await deleteMobileAuthorityDatabase()
  }
}

async function getRuntime(): Promise<MobileAuthorityRuntime> {
  if (!runtimePromise) {
    runtimePromise = openMobileAuthorityDatabase().then((database) => {
      const store = new MobileAuthoritySqliteStore(database)
      return {
        store,
        coordinator: new ServerAuthoritySyncCoordinator({
          repository: createServerAuthorityRepository(supabase),
          store,
        }),
      }
    })
    runtimePromise.catch(() => {
      runtimePromise = null
    })
  }
  return runtimePromise
}

function ensureLifecycleListeners(): void {
  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushMobileAuthorityOutbox().catch(reportAuthoritySyncError)
    })
  }
  if (!networkSubscription) {
    networkSubscription = Network.addNetworkStateListener((state) => {
      if (isOnline(state)) void flushMobileAuthorityOutbox().catch(reportAuthoritySyncError)
    })
  }
}

async function flushAccount(accountId: string): Promise<AuthorityFlushResult | null> {
  if (!await isNetworkOnline()) return null
  return performFlush(accountId)
}

async function performFlush(accountId: string): Promise<AuthorityFlushResult | null> {
  try {
    return await (await getRuntime()).coordinator.flush(accountId)
  } catch (error) {
    reportAuthoritySyncError(error)
    return null
  }
}

async function scheduleNextRetry(accountId: string): Promise<void> {
  clearRetryTimer()
  const retryAt = await (await getRuntime()).store.getNextRetryAt(accountId)
  if (!retryAt || activeAccountId !== accountId) return
  const retryTimestamp = Date.parse(retryAt)
  if (!Number.isFinite(retryTimestamp)) return
  const delay = Math.max(0, retryTimestamp - Date.now())
  retryTimer = setTimeout(() => {
    retryTimer = null
    void flushMobileAuthorityOutbox().catch(reportAuthoritySyncError)
  }, Math.min(delay, 2_147_483_647))
}

function clearRetryTimer(): void {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
}

async function closeRealtimeSubscriptions(): Promise<void> {
  const subscriptions = [...activeRealtimeSubscriptions]
  activeRealtimeSubscriptions.clear()
  await Promise.allSettled(subscriptions.map((subscription) => subscription.unsubscribe()))
}

function isOnline(state: Network.NetworkState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false
}

function isSupportedNativePlatform(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios'
}

async function isNetworkOnline(): Promise<boolean> {
  try {
    return isOnline(await Network.getNetworkStateAsync())
  } catch (error) {
    reportAuthoritySyncError(error)
    return false
  }
}

function reportAuthoritySyncError(error: unknown): void {
  console.warn('[mobile authority sync failed]', error)
}
