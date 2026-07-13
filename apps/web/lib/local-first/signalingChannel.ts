import {
  SIGNALING_BROADCAST_EVENT,
  isSignalingRoomTopic,
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
  const preliminaryDecision = validateSignalingJoinPolicy({
    documentId: input.documentId,
    userId: input.userId,
    role: input.membership.role,
    status: input.membership.status,
    hasValidRoomSecretProof: true,
  })

  if (!preliminaryDecision.allowed) {
    logP2PEvent({
      name: 'p2p_unavailable',
      platform: 'web',
      reason: preliminaryDecision.reason ?? 'signaling_join_denied',
    })
    return {
      decision: preliminaryDecision,
      send: () => {},
      leave: async () => {},
    }
  }

  const supabase = createClient()
  const topic = await fetchIssuedSignalingRoomTopic(supabase, input.documentId)
  const decision = validateSignalingJoinPolicy({
    documentId: input.documentId,
    userId: input.userId,
    role: input.membership.role,
    status: input.membership.status,
    hasValidRoomSecretProof: isSignalingRoomTopic(topic),
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

async function fetchIssuedSignalingRoomTopic(
  supabase: ReturnType<typeof createClient>,
  documentId: string,
): Promise<string> {
  const issueTopic = supabase.rpc as unknown as IssueSignalingRoomTopicRpc
  const { data, error } = await issueTopic('issue_document_signaling_room_topic', {
    p_document_id: documentId,
  })

  if (error) {
    logP2PEvent({ name: 'p2p_unavailable', platform: 'web', reason: 'signaling_topic_unavailable' })
    throw new Error('signaling_topic_unavailable')
  }

  const topic = pickIssuedTopic(data)
  if (!topic) {
    logP2PEvent({ name: 'p2p_unavailable', platform: 'web', reason: 'invalid_signaling_topic' })
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
