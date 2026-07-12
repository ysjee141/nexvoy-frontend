import {
  SIGNALING_BROADCAST_EVENT,
  deriveSignalingRoomTopic,
  parseSignalingMessage,
  serializeSignalingMessage,
  type SignalingMessage,
} from '../signalingChannel'

if (SIGNALING_BROADCAST_EVENT !== 'signal') {
  throw new Error('Signaling broadcast event name changed unexpectedly.')
}

const offer: SignalingMessage = { type: 'offer', senderId: 'peer-a', sdp: 'v=0...' }
const roundTrippedOffer = parseSignalingMessage(JSON.parse(serializeSignalingMessage(offer)))
if (JSON.stringify(roundTrippedOffer) !== JSON.stringify(offer)) {
  throw new Error('Offer message should round-trip through serialize/parse unchanged.')
}

const candidate: SignalingMessage = {
  type: 'ice-candidate',
  senderId: 'peer-b',
  candidate: 'candidate:1 1 UDP 2130706431 10.0.0.1 5000 typ host',
  sdpMid: '0',
  sdpMLineIndex: 0,
}
const roundTrippedCandidate = parseSignalingMessage(JSON.parse(serializeSignalingMessage(candidate)))
if (JSON.stringify(roundTrippedCandidate) !== JSON.stringify(candidate)) {
  throw new Error('ICE candidate message should round-trip through serialize/parse unchanged.')
}

if (parseSignalingMessage({ type: 'answer', senderId: 'peer-a' }) !== null) {
  throw new Error('Answer message missing sdp should be rejected.')
}

if (parseSignalingMessage({ type: 'unknown-type' }) !== null) {
  throw new Error('Unknown message type should be rejected.')
}

if (parseSignalingMessage(null) !== null || parseSignalingMessage('not-an-object') !== null) {
  throw new Error('Non-object input should be rejected.')
}

run().catch((error) => {
  throw error
})

async function run(): Promise<void> {
  const documentId = 'doc-12345'
  const topic = await deriveSignalingRoomTopic(documentId, globalThis.crypto.subtle)

  // Precomputed via `printf '%s' 'doc-12345' | shasum -a 256` — must match
  // public.document_registry_hash('doc-12345') used by the Realtime Authorization RLS policy.
  const expectedHex = '6edaea69dd7200bbbe8da277330b053ecde5510c7e96bb016035aa82cff67341'
  if (topic !== `signaling:${expectedHex}`) {
    throw new Error(
      'Signaling room topic must equal signaling:<sha256-hex(documentId)> to match '
      + 'public.document_registry_hash() used by the Realtime Authorization RLS policy.',
    )
  }

  const topicAgain = await deriveSignalingRoomTopic(documentId, globalThis.crypto.subtle)
  if (topic !== topicAgain) {
    throw new Error('Signaling room topic derivation must be deterministic.')
  }

  const rnShapedTopic = await deriveSignalingRoomTopic(documentId, {
    digest: async (algorithm, data) => {
      // Mobile passes a SubtleCrypto-shaped provider from react-native-quick-crypto.
      // This checks that the shared derivation contract only relies on digest()
      // semantics and produces the exact same room topic as Web/server.
      return globalThis.crypto.subtle.digest(algorithm, data)
    },
  })

  if (rnShapedTopic !== topic) {
    throw new Error('React Native-shaped digest provider must derive the same signaling room topic.')
  }
}
