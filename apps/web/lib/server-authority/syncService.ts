import {
  ServerAuthoritySyncCoordinator,
  createServerAuthorityRepository,
  type AuthorityFlushResult,
  type AuthorityResourceType,
  type AuthoritySyncMetricSink,
} from '@nexvoy/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { WebAuthorityIndexedDbStore } from './indexedDbStore'
import {
  subscribeWebAuthorityInvalidation,
  type WebAuthorityInvalidationSubscription,
  type WebAuthorityRealtimeMetric,
} from './realtimeInvalidation'

export interface WebAuthoritySyncRuntimeOptions {
  supabase: SupabaseClient
  metricSink?: AuthoritySyncMetricSink
  onError?: (error: unknown) => void
  onRealtimeMetric?: (metric: WebAuthorityRealtimeMetric) => void
}

export interface WebAuthoritySyncSession {
  start(accountId: string): Promise<void>
  stop(): Promise<void>
  flush(): Promise<AuthorityFlushResult | null>
  enteredResource(resourceType: AuthorityResourceType, resourceId: string): Promise<void>
  mutationCommitted(): Promise<AuthorityFlushResult | null>
  watchResource(
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<WebAuthorityInvalidationSubscription | null>
}

export function createWebAuthoritySyncSession(
  options: WebAuthoritySyncRuntimeOptions,
): WebAuthoritySyncSession {
  const store = new WebAuthorityIndexedDbStore()
  const coordinator = new ServerAuthoritySyncCoordinator({
    repository: createServerAuthorityRepository(options.supabase),
    store,
    metricSink: options.metricSink,
  })
  let accountId: string | null = null
  let started = false
  const activeSubscriptions = new Set<WebAuthorityInvalidationSubscription>()

  const closeSubscriptions = async (): Promise<void> => {
    const subscriptions = [...activeSubscriptions]
    activeSubscriptions.clear()
    await Promise.allSettled(subscriptions.map((subscription) => subscription.unsubscribe()))
  }

  const flush = async (): Promise<AuthorityFlushResult | null> => {
    if (!accountId || (typeof navigator !== 'undefined' && !navigator.onLine)) return null
    try {
      return await coordinator.flush(accountId)
    } catch (error) {
      options.onError?.(error)
      return null
    }
  }

  const handleOnline = (): void => {
    void flush()
  }
  const handleVisibility = (): void => {
    if (document.visibilityState === 'visible') void flush()
  }

  return {
    async start(nextAccountId) {
      if (accountId && accountId !== nextAccountId) await closeSubscriptions()
      accountId = nextAccountId
      if (!started && typeof window !== 'undefined') {
        window.addEventListener('online', handleOnline)
        document.addEventListener('visibilitychange', handleVisibility)
        started = true
      }
      await flush()
    },

    async stop() {
      if (started && typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
        document.removeEventListener('visibilitychange', handleVisibility)
      }
      started = false
      accountId = null
      await closeSubscriptions()
      store.close()
    },

    flush,

    async enteredResource(resourceType, resourceId) {
      if (!accountId) return
      await coordinator.refreshResource(accountId, resourceType, resourceId)
      await flush()
    },

    mutationCommitted: flush,

    async watchResource(resourceType, resourceId) {
      if (!accountId) return null
      await coordinator.refreshResource(accountId, resourceType, resourceId)
      const subscription = await subscribeWebAuthorityInvalidation({
        supabase: options.supabase,
        accountId,
        resourceType,
        resourceId,
        store,
        coordinator,
        onMetric: options.onRealtimeMetric,
        onError: options.onError,
      })
      const trackedSubscription: WebAuthorityInvalidationSubscription = {
        topic: subscription.topic,
        async unsubscribe() {
          activeSubscriptions.delete(trackedSubscription)
          await subscription.unsubscribe()
        },
      }
      activeSubscriptions.add(trackedSubscription)
      return trackedSubscription
    },
  }
}
