import { subtle } from 'react-native-quick-crypto'
import {
  SIGNALING_BROADCAST_EVENT,
  isSignalingRoomTopic,
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

interface SignalingRoomTopicRow {
  room_topic: string
  expires_at: string
}

type IssueSignalingRoomTopicRpc = (
  fn: 'issue_document_signaling_room_topic',
  args: { p_document_id: string },
) => Promise<{
  data: unknown
  error: { message?: string } | null
}>

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
  const preliminaryDecision = validateSignalingJoinPolicy({
    documentId: input.documentId,
    userId: input.userId,
    role: input.membership.role,
    status: input.membership.status,
    hasValidRoomSecretProof: true,
  })

  if (!preliminaryDecision.allowed) {
    return {
      decision: preliminaryDecision,
      send: () => {},
      leave: async () => {},
    }
  }

  const topic = await fetchIssuedSignalingRoomTopic(input.documentId)
  const decision = validateSignalingJoinPolicy({
    documentId: input.documentId,
    userId: input.userId,
    role: input.membership.role,
    status: input.membership.status,
    hasValidRoomSecretProof: isSignalingRoomTopic(topic),
  })

  if (!decision.allowed) {
    return {
      decision,
      send: () => {},
      leave: async () => {},
    }
  }

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

async function fetchIssuedSignalingRoomTopic(documentId: string): Promise<string> {
  const issueTopic = supabase.rpc as unknown as IssueSignalingRoomTopicRpc
  const { data, error } = await issueTopic('issue_document_signaling_room_topic', {
    p_document_id: documentId,
  })

  if (error) {
    throw new Error('signaling_topic_unavailable')
  }

  const topic = pickIssuedTopic(data)
  if (!topic) {
    throw new Error('invalid_signaling_topic')
  }

  return topic
}

function pickIssuedTopic(input: unknown): string | null {
  if (!Array.isArray(input) || input.length === 0) return null
  const [first] = input
  if (!isSignalingRoomTopicRow(first)) return null
  return isSignalingRoomTopic(first.room_topic) ? first.room_topic : null
}

function isSignalingRoomTopicRow(input: unknown): input is SignalingRoomTopicRow {
  return typeof input === 'object'
    && input !== null
    && typeof (input as { room_topic?: unknown }).room_topic === 'string'
    && typeof (input as { expires_at?: unknown }).expires_at === 'string'
}

function toArrayBuffer(input: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (input instanceof ArrayBuffer) return input
  return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer
}
