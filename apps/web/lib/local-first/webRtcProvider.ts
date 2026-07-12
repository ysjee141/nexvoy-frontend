import type {
  IceServerConfig,
  P2PObservabilityEvent,
} from '@nexvoy/core/sync/iceServers'
import {
  createP2PUpdateMessages,
  parseP2PUpdateProtocolMessage,
  type P2PUpdateProtocolMessage,
} from '@nexvoy/core/sync/p2pUpdateProtocol'
import { logP2PEvent } from './iceServers'

export type WebRtcAvailability = 'disabled' | 'browser-api-missing' | 'ready'

export interface WebRtcProviderOptions {
  enabled?: boolean
  iceServers?: IceServerConfig[]
  onEvent?: (event: P2PObservabilityEvent) => void
}

export interface WebRtcProviderDiagnostics {
  availability: WebRtcAvailability
  platform: 'web'
  fallbackReason: string | null
  hasIceServers: boolean
}

export interface WebRtcProvider {
  readonly isAvailable: boolean
  getDiagnostics: () => WebRtcProviderDiagnostics
  createPeerConnection: () => Promise<RTCPeerConnection>
  close: () => Promise<void>
}

export interface WebRtcDataChannelHandshakeResult {
  rttMs: number
}

export interface WireHandshakeDataChannelOptions {
  onEvent?: (event: P2PObservabilityEvent) => void
  onHandshakeComplete?: (result: WebRtcDataChannelHandshakeResult) => void
  onUpdateMessage?: (message: P2PUpdateProtocolMessage) => void
}

/** The initiator side creates this channel; the answerer receives it via the peer connection's `datachannel` event. */
export function createHandshakeDataChannel(
  peerConnection: RTCPeerConnection,
  label = 'signaling-handshake',
): RTCDataChannel {
  return peerConnection.createDataChannel(label)
}

/**
 * Wires a minimal ping/pong round trip used to prove the data channel is
 * actually open end-to-end (TASK-021). Payload is a fixed { type, ts }
 * schema only — never document content or CRDT data.
 */
export function wireHandshakeDataChannel(
  dataChannel: RTCDataChannel,
  options: WireHandshakeDataChannelOptions = {},
): void {
  dataChannel.addEventListener('open', () => {
    emitEvent(options, { name: 'p2p_data_channel_open', platform: 'web' })
    dataChannel.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
  })

  dataChannel.addEventListener('message', (event: MessageEvent) => {
    const parsed = parseHandshakePayload(event.data)
    if (!parsed) {
      const updateMessage = parseDataChannelUpdateMessage(event.data)
      if (updateMessage) options.onUpdateMessage?.(updateMessage)
      return
    }

    if (parsed.type === 'ping') {
      dataChannel.send(JSON.stringify({ type: 'pong', ts: parsed.ts }))
      return
    }

    options.onHandshakeComplete?.({ rttMs: Date.now() - parsed.ts })
  })
}

export function sendP2PUpdateOverDataChannel(input: {
  dataChannel: RTCDataChannel
  documentId: string
  update: Uint8Array
}): boolean {
  if (input.dataChannel.readyState !== 'open') return false

  try {
    const messages = createP2PUpdateMessages({
      documentId: input.documentId,
      update: input.update,
    })
    for (const message of messages) {
      input.dataChannel.send(JSON.stringify(message))
    }
    return true
  } catch {
    return false
  }
}

function parseHandshakePayload(raw: unknown): { type: 'ping' | 'pong'; ts: number } | null {
  if (typeof raw !== 'string') return null

  try {
    const data: unknown = JSON.parse(raw)
    if (
      isRecord(data)
      && (data.type === 'ping' || data.type === 'pong')
      && typeof data.ts === 'number'
    ) {
      return { type: data.type, ts: data.ts }
    }
  } catch {
    return null
  }
  return null
}

function parseDataChannelUpdateMessage(raw: unknown): P2PUpdateProtocolMessage | null {
  if (typeof raw !== 'string') return null
  try {
    return parseP2PUpdateProtocolMessage(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function createWebRtcProvider(options: WebRtcProviderOptions = {}): WebRtcProvider {
  const peerConnections = new Set<RTCPeerConnection>()
  const availability = resolveAvailability(options)
  const fallbackReason = resolveFallbackReason(availability)

  return {
    isAvailable: availability === 'ready',
    getDiagnostics: () => ({
      availability,
      platform: 'web',
      fallbackReason,
      hasIceServers: Boolean(options.iceServers?.length),
    }),
    async createPeerConnection() {
      if (availability !== 'ready') {
        emitEvent(options, {
          name: 'p2p_unavailable',
          platform: 'web',
          reason: fallbackReason ?? 'web_rtc_unavailable',
        })
        throw new Error(fallbackReason ?? 'WebRTC fast path is unavailable.')
      }

      const startedAt = Date.now()
      const peerConnection = new RTCPeerConnection({
        iceServers: options.iceServers,
      })
      peerConnections.add(peerConnection)

      peerConnection.addEventListener('connectionstatechange', () => {
        if (peerConnection.connectionState === 'connected') {
          void emitConnectionEstablished(peerConnection, options, startedAt)
        }
        if (peerConnection.connectionState === 'failed') {
          emitEvent(options, {
            name: 'p2p_connection_failed',
            platform: 'web',
            reason: peerConnection.connectionState,
          })
        }
      })

      return peerConnection
    },
    async close() {
      for (const peerConnection of peerConnections) {
        peerConnection.close()
      }
      peerConnections.clear()
    },
  }
}

function resolveAvailability(options: WebRtcProviderOptions): WebRtcAvailability {
  if (options.enabled === false) return 'disabled'
  if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
    return 'browser-api-missing'
  }
  return 'ready'
}

function resolveFallbackReason(availability: WebRtcAvailability): string | null {
  switch (availability) {
    case 'disabled':
      return 'WebRTC fast path is disabled by configuration.'
    case 'browser-api-missing':
      return 'WebRTC requires a browser runtime with RTCPeerConnection.'
    case 'ready':
      return null
  }
}

function emitEvent(options: WebRtcProviderOptions, event: P2PObservabilityEvent): void {
  options.onEvent?.(event)
  if (!options.onEvent) {
    logP2PEvent(event)
  }
}

async function emitConnectionEstablished(
  peerConnection: RTCPeerConnection,
  options: WebRtcProviderOptions,
  startedAt: number,
): Promise<void> {
  const selectedCandidate = await getSelectedCandidateType(peerConnection)
  emitEvent(options, {
    name: 'p2p_connected',
    platform: 'web',
    connectionType: selectedCandidate === 'relay' ? 'relay' : selectedCandidate === 'direct' ? 'direct' : 'unknown',
    setupMs: Date.now() - startedAt,
  })

  if (selectedCandidate === 'relay') {
    emitEvent(options, {
      name: 'p2p_relay_selected',
      platform: 'web',
      connectionType: 'relay',
    })
  }
}

async function getSelectedCandidateType(
  peerConnection: RTCPeerConnection,
): Promise<'direct' | 'relay' | 'unknown'> {
  try {
    const stats = await peerConnection.getStats()
    const entries = Array.from(stats.values()) as Array<Record<string, unknown>>
    const selectedPairId = entries.find((entry) =>
      entry.type === 'transport' && typeof entry.selectedCandidatePairId === 'string'
    )?.selectedCandidatePairId
    const selectedPairFromTransport = typeof selectedPairId === 'string'
      ? stats.get(selectedPairId)
      : undefined
    const selectedPair = isRecord(selectedPairFromTransport)
      ? selectedPairFromTransport
      : entries.find((entry) =>
        entry.type === 'candidate-pair'
        && (entry.selected === true || (entry.nominated === true && entry.state === 'succeeded'))
      )
    const localCandidateId = typeof selectedPair?.localCandidateId === 'string'
      ? selectedPair.localCandidateId
      : null
    const remoteCandidateId = typeof selectedPair?.remoteCandidateId === 'string'
      ? selectedPair.remoteCandidateId
      : null
    const localCandidate = localCandidateId ? stats.get(localCandidateId) as Record<string, unknown> | undefined : undefined
    const remoteCandidate = remoteCandidateId ? stats.get(remoteCandidateId) as Record<string, unknown> | undefined : undefined
    const candidateTypes = [localCandidate?.candidateType, remoteCandidate?.candidateType]

    if (candidateTypes.includes('relay')) return 'relay'
    if (candidateTypes.some((type) => type === 'host' || type === 'srflx' || type === 'prflx')) return 'direct'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}
