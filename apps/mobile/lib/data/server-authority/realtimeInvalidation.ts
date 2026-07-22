import {
  AUTHORITY_INVALIDATION_EVENT,
  decideAuthorityInvalidation,
  parseAuthorityInvalidation,
  type AuthorityLocalStore,
  type AuthorityResourceType,
  type ServerAuthoritySyncCoordinator,
} from '@nexvoy/core'
import type { SupabaseClient } from '@supabase/supabase-js'

export type MobileAuthorityRealtimeMetric =
  | {
      name: 'authority_invalidation_received' | 'authority_invalidation_ignored'
      resourceType: AuthorityResourceType
      resourceId: string
      revision: number
    }
  | {
      name: 'authority_invalidation_gap' | 'authority_reconnect_refresh'
      resourceType: AuthorityResourceType
      resourceId: string
      localRevision: number
      remoteRevision: number
    }

export interface MobileAuthorityInvalidationSubscription {
  topic: string
  unsubscribe(): Promise<void>
}

interface SubscribeMobileAuthorityInvalidationInput {
  supabase: SupabaseClient
  accountId: string
  resourceType: AuthorityResourceType
  resourceId: string
  store: AuthorityLocalStore
  coordinator: ServerAuthoritySyncCoordinator
  onMetric?: (metric: MobileAuthorityRealtimeMetric) => void
  onError?: (error: unknown) => void
}

export async function subscribeMobileAuthorityInvalidation(
  input: SubscribeMobileAuthorityInvalidationInput,
): Promise<MobileAuthorityInvalidationSubscription> {
  const { data, error } = await input.supabase.auth.getSession()
  if (error) throw error
  if (!data.session?.access_token) throw new Error('authority_realtime_session_required')
  await input.supabase.realtime.setAuth(data.session.access_token)

  const topic = `${input.resourceType}:${input.resourceId}`
  const channel = input.supabase.channel(topic, {
    config: { private: true, broadcast: { self: false, ack: false } },
  })
  let reconciliation = Promise.resolve()
  let subscribedOnce = false

  const forceRefresh = async (isReconnect: boolean): Promise<void> => {
    const local = await input.store.getResource(
      input.accountId,
      input.resourceType,
      input.resourceId,
    )
    const remote = await input.coordinator.refreshResource(
      input.accountId,
      input.resourceType,
      input.resourceId,
      Number.MAX_SAFE_INTEGER,
    )
    if (isReconnect && remote) {
      input.onMetric?.({
        name: 'authority_reconnect_refresh',
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        localRevision: local?.revision ?? 0,
        remoteRevision: remote.revision,
      })
    }
  }

  channel.on(
    'broadcast',
    { event: AUTHORITY_INVALIDATION_EVENT },
    ({ payload }: { payload: unknown }) => {
      reconciliation = reconciliation
        .then(async () => {
          const invalidation = parseAuthorityInvalidation(payload)
          if (
            !invalidation ||
            invalidation.resourceType !== input.resourceType ||
            invalidation.resourceId !== input.resourceId
          ) {
            return
          }

          const local = await input.store.getResource(
            input.accountId,
            input.resourceType,
            input.resourceId,
          )
          const localRevision = local?.revision ?? 0
          const decision = decideAuthorityInvalidation(localRevision, invalidation.revision)
          if (decision.action === 'ignore') {
            input.onMetric?.({
              name: 'authority_invalidation_ignored',
              resourceType: input.resourceType,
              resourceId: input.resourceId,
              revision: invalidation.revision,
            })
            return
          }

          input.onMetric?.({
            name: 'authority_invalidation_received',
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            revision: invalidation.revision,
          })
          if (decision.revisionGap) {
            input.onMetric?.({
              name: 'authority_invalidation_gap',
              resourceType: input.resourceType,
              resourceId: input.resourceId,
              localRevision,
              remoteRevision: invalidation.revision,
            })
          }
          await input.coordinator.reconcileInvalidation(input.accountId, invalidation)
        })
        .catch((error: unknown) => input.onError?.(error))
    },
  )

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        const isReconnect = subscribedOnce
        subscribedOnce = true
        reconciliation = reconciliation.then(() => forceRefresh(isReconnect))
        if (isReconnect) {
          reconciliation = reconciliation.catch((error: unknown) => input.onError?.(error))
        } else {
          reconciliation.then(resolve).catch(reject)
        }
        return
      }
      if (
        !subscribedOnce &&
        (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
      ) {
        reject(new Error(`authority_channel_${status.toLowerCase()}`))
      }
    })
  })

  return {
    topic,
    async unsubscribe() {
      await input.supabase.removeChannel(channel)
    },
  }
}
