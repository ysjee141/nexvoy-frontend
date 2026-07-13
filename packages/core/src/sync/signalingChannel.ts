export type SignalingMessageType = 'offer' | 'answer' | 'ice-candidate'

export interface SignalingOfferMessage {
  type: 'offer'
  senderId: string
  sdp: string
}

export interface SignalingAnswerMessage {
  type: 'answer'
  senderId: string
  sdp: string
}

export interface SignalingIceCandidateMessage {
  type: 'ice-candidate'
  senderId: string
  candidate: string
  sdpMid: string | null
  sdpMLineIndex: number | null
}

export type SignalingMessage =
  | SignalingOfferMessage
  | SignalingAnswerMessage
  | SignalingIceCandidateMessage

/** Supabase Realtime broadcast event name carrying signaling payloads (ADR-012). */
export const SIGNALING_BROADCAST_EVENT = 'signal'

const SIGNALING_TOPIC_PREFIX = 'signaling:'
const SIGNALING_TOPIC_HASH_PATTERN = /^[0-9a-f]{64}$/

/**
 * Matches public.document_registry_hash() in
 * supabase/migrations/20260712000001_task021_signaling_realtime_authorization.sql:
 * hex(sha256(utf8(documentId))). The Realtime Authorization RLS policy recomputes
 * this same hash server-side per document_members row, so the client and server
 * must derive identically.
 */
export type SignalingRoomDigestProvider = Pick<SubtleCrypto, 'digest'>

/**
 * Legacy deterministic topic used by TASK-021~TASK-027. Kept for tests and
 * rollback compatibility; TASK-028 adapters should use server-issued topics.
 */
export async function deriveSignalingRoomTopic(
  documentId: string,
  provider: SignalingRoomDigestProvider,
): Promise<string> {
  const encoded = new TextEncoder().encode(documentId)
  const hashBuffer = await provider.digest('SHA-256', encoded)
  return `${SIGNALING_TOPIC_PREFIX}${bufferToHex(hashBuffer)}`
}

export async function deriveRotatingSignalingRoomTopic(
  input: {
    documentId: string
    roomSecret: string
  },
  provider: SignalingRoomDigestProvider,
): Promise<string> {
  const encoded = new TextEncoder().encode(`${input.documentId}:${input.roomSecret}`)
  const hashBuffer = await provider.digest('SHA-256', encoded)
  return `${SIGNALING_TOPIC_PREFIX}${bufferToHex(hashBuffer)}`
}

export function isSignalingRoomTopic(input: unknown): input is string {
  return typeof input === 'string'
    && input.startsWith(SIGNALING_TOPIC_PREFIX)
    && SIGNALING_TOPIC_HASH_PATTERN.test(input.slice(SIGNALING_TOPIC_PREFIX.length))
}

export function serializeSignalingMessage(message: SignalingMessage): string {
  return JSON.stringify(message)
}

export function parseSignalingMessage(input: unknown): SignalingMessage | null {
  if (!isRecord(input)) return null

  switch (input.type) {
    case 'offer':
    case 'answer':
      return typeof input.senderId === 'string' && typeof input.sdp === 'string'
        ? { type: input.type, senderId: input.senderId, sdp: input.sdp }
        : null
    case 'ice-candidate':
      return typeof input.senderId === 'string' && typeof input.candidate === 'string'
        ? {
          type: 'ice-candidate',
          senderId: input.senderId,
          candidate: input.candidate,
          sdpMid: typeof input.sdpMid === 'string' ? input.sdpMid : null,
          sdpMLineIndex: typeof input.sdpMLineIndex === 'number' ? input.sdpMLineIndex : null,
        }
        : null
    default:
      return null
  }
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}
