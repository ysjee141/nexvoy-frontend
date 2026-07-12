import { subtle } from 'react-native-quick-crypto'
import {
  SIGNALING_BROADCAST_EVENT,
  deriveSignalingRoomTopic,
  parseSignalingMessage,
  type SignalingMessage,
  type SignalingRoomDigestProvider,
} from '@nexvoy/core/sync/signalingChannel'
import {
  validateSignalingJoinPolicy,
  type SignalingJoinDecision,
} from '@nexvoy/core/sync/signalingPermissions'
import type { DocumentMemberStatus, DocumentRole } from '@nexvoy/core/local-first/permissions'
import { supabase } from '@/lib/supabase'

export interface MobileSignalingChannelMembership {
  role: DocumentRole | null | undefined
  status: DocumentMemberStatus | null | undefined
}

export interface JoinMobileSignalingChannelInput {
  documentId: string
  userId: string
  membership: MobileSignalingChannelMembership
  onMessage: (message: SignalingMessage) => void
}

export interface MobileSignalingChannel {
  readonly decision: SignalingJoinDecision
  send(message: SignalingMessage): void
  leave(): Promise<void>
}

export const mobileSignalingDigestProvider: SignalingRoomDigestProvider = {
  async digest(algorithm, data) {
    const digest = await subtle.digest(algorithm as never, data as never)
    return toArrayBuffer(digest)
  },
}

/**
 * Joins the per-document Supabase Realtime Broadcast private channel used for
 * mobile P2P signaling. validateSignalingJoinPolicy() is a client-side
 * fail-fast guard only; Realtime Authorization RLS remains the server boundary.
 */
export async function joinMobileSignalingChannel(
  input: JoinMobileSignalingChannelInput,
): Promise<MobileSignalingChannel> {
  const decision = validateSignalingJoinPolicy({
    documentId: input.documentId,
    userId: input.userId,
    role: input.membership.role,
    status: input.membership.status,
    // Rotating room secret issuance is deferred by ADR-012; this mirrors the
    // Web adapter while server-side Realtime Authorization enforces access.
    hasValidRoomSecretProof: true,
  })

  if (!decision.allowed) {
    return {
      decision,
      send: () => {},
      leave: async () => {},
    }
  }

  const topic = await deriveSignalingRoomTopic(input.documentId, mobileSignalingDigestProvider)
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

  return {
    decision,
    send(message) {
      if (!decision.canWrite) return
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

function toArrayBuffer(input: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (input instanceof ArrayBuffer) return input
  return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer
}
