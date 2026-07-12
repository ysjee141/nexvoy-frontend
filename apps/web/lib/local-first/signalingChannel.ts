import {
  SIGNALING_BROADCAST_EVENT,
  deriveSignalingRoomTopic,
  parseSignalingMessage,
  type SignalingMessage,
} from '@nexvoy/core/sync/signalingChannel'
import {
  validateSignalingJoinPolicy,
  type SignalingJoinDecision,
} from '@nexvoy/core/sync/signalingPermissions'
import type { DocumentMemberStatus, DocumentRole } from '@nexvoy/core/local-first/permissions'
import { createClient } from '@/lib/supabase/client'
import { logP2PEvent } from './iceServers'

export interface WebSignalingChannelMembership {
  role: DocumentRole | null | undefined
  status: DocumentMemberStatus | null | undefined
}

export interface JoinWebSignalingChannelInput {
  documentId: string
  userId: string
  membership: WebSignalingChannelMembership
  onMessage: (message: SignalingMessage) => void
}

export interface WebSignalingChannel {
  readonly decision: SignalingJoinDecision
  send(message: SignalingMessage): void
  leave(): Promise<void>
}

/**
 * Joins the per-document Supabase Realtime Broadcast private channel used for
 * P2P signaling (ADR-012). The client-side validateSignalingJoinPolicy() check
 * is a fail-fast UX guard only — the real access boundary is the Realtime
 * Authorization RLS policy in
 * supabase/migrations/20260712000001_task021_signaling_realtime_authorization.sql,
 * which the server enforces independently of this client-reported membership.
 */
export async function joinWebSignalingChannel(
  input: JoinWebSignalingChannelInput,
): Promise<WebSignalingChannel> {
  const decision = validateSignalingJoinPolicy({
    documentId: input.documentId,
    userId: input.userId,
    role: input.membership.role,
    status: input.membership.status,
    // Rotating room secret issuance is deferred to a follow-up hardening task
    // (ADR-012); the room topic + Realtime Authorization RLS are the actual
    // access boundary for this phase, so this guard does not gate on it yet.
    hasValidRoomSecretProof: true,
  })

  if (!decision.allowed) {
    logP2PEvent({
      name: 'p2p_unavailable',
      platform: 'web',
      reason: decision.reason ?? 'signaling_join_denied',
    })
    return {
      decision,
      send: () => {},
      leave: async () => {},
    }
  }

  const supabase = createClient()
  const topic = await deriveSignalingRoomTopic(input.documentId, globalThis.crypto.subtle)
  const channel = supabase.channel(topic, { config: { private: true } })

  channel.on(
    'broadcast',
    { event: SIGNALING_BROADCAST_EVENT },
    ({ payload }: { payload: unknown }) => {
      const message = parseSignalingMessage(payload)
      if (message && message.senderId !== input.userId) {
        input.onMessage(message)
      }
    },
  )

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        resolve()
        return
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        reject(new Error(`signaling_channel_${status.toLowerCase()}`))
      }
    })
  })

  logP2PEvent({ name: 'p2p_signaling_joined', platform: 'web' })

  return {
    decision,
    send(message) {
      if (!decision.canWrite) return
      // supabase-js JSON-encodes the payload over the websocket itself; the
      // receiving end gets it back as a parsed object, which is why the
      // listener above calls parseSignalingMessage() on `payload` directly
      // rather than JSON.parse(). serializeSignalingMessage() exists for
      // transports that need an explicit string (e.g. tests), not this one.
      void channel.send({
        type: 'broadcast',
        event: SIGNALING_BROADCAST_EVENT,
        payload: message,
      })
    },
    async leave() {
      await supabase.removeChannel(channel)
    },
  }
}
