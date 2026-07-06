import { AppState, Platform } from 'react-native'
import { RTCPeerConnection } from 'react-native-webrtc'
import type { P2PObservabilityEvent } from '@nexvoy/core/sync/iceServers'
import {
  REACT_NATIVE_WEBRTC_FEASIBILITY,
  type MobileWebRtcProvider,
  type MobileWebRtcProviderDiagnostics,
  type MobileWebRtcProviderOptions,
} from './webRtcProvider.types'

function createDiagnostics(
  availability: MobileWebRtcProviderDiagnostics['availability'],
  fallbackReason: string | null
): MobileWebRtcProviderDiagnostics {
  return {
    candidate: REACT_NATIVE_WEBRTC_FEASIBILITY.candidate,
    availability,
    platform:
      Platform.OS === 'ios' || Platform.OS === 'android'
        ? Platform.OS
        : 'unknown',
    expoGoSupported: REACT_NATIVE_WEBRTC_FEASIBILITY.expoGoSupported,
    requiresDevClient: REACT_NATIVE_WEBRTC_FEASIBILITY.requiresDevClient,
    requiredPackages: REACT_NATIVE_WEBRTC_FEASIBILITY.requiredPackages,
    fallbackReason,
  }
}

export function createMobileWebRtcProvider(
  options: MobileWebRtcProviderOptions = {}
): MobileWebRtcProvider {
  const peerConnections = new Set<RTCPeerConnection>()
  const availability: MobileWebRtcProviderDiagnostics['availability'] =
    options.enabled === false ? 'disabled' : 'ready'
  const fallbackReason =
    availability === 'disabled'
      ? 'Mobile WebRTC fast path is disabled by configuration.'
      : null
  const diagnostics = createDiagnostics(availability, fallbackReason)

  return {
    isAvailable: availability === 'ready',
    getDiagnostics: () => ({
      ...diagnostics,
      fallbackReason: diagnostics.fallbackReason
        ? `${diagnostics.fallbackReason} appState=${AppState.currentState}`
        : null,
    }),
    async createPeerConnection() {
      if (availability !== 'ready') {
        emitEvent(options, {
          name: 'p2p_unavailable',
          platform: getDiagnosticsPlatform(),
          reason: fallbackReason ?? 'mobile_web_rtc_unavailable',
        })
        throw new Error(fallbackReason ?? 'Mobile WebRTC fast path is unavailable.')
      }

      const startedAt = Date.now()
      const peerConnection = new RTCPeerConnection({
        iceServers: options.iceServers,
      })
      peerConnections.add(peerConnection)
      registerConnectionStateObservers(peerConnection, options, startedAt)

      return peerConnection
    },
    async close() {
      for (const peerConnection of peerConnections) {
        peerConnection.close()
      }
      peerConnections.clear()
      return undefined
    },
  }
}

function getDiagnosticsPlatform(): P2PObservabilityEvent['platform'] {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return Platform.OS
  }
  return 'unknown'
}

function registerConnectionStateObservers(
  peerConnection: RTCPeerConnection,
  options: MobileWebRtcProviderOptions,
  startedAt: number,
): void {
  const eventTarget = peerConnection as unknown as {
    addEventListener?: (eventName: string, listener: () => void) => void
    connectionState?: string
    iceConnectionState?: string
  }

  eventTarget.addEventListener?.('connectionstatechange', () => {
    if (eventTarget.connectionState === 'connected') {
      void emitConnectionEstablished(peerConnection, options, startedAt)
    }
    if (eventTarget.connectionState === 'failed') {
      emitEvent(options, {
        name: 'p2p_connection_failed',
        platform: getDiagnosticsPlatform(),
        reason: eventTarget.connectionState,
      })
    }
  })

  eventTarget.addEventListener?.('iceconnectionstatechange', () => {
    if (eventTarget.iceConnectionState === 'failed') {
      emitEvent(options, {
        name: 'p2p_connection_failed',
        platform: getDiagnosticsPlatform(),
        reason: eventTarget.iceConnectionState,
      })
    }
  })
}

function emitEvent(options: MobileWebRtcProviderOptions, event: P2PObservabilityEvent): void {
  options.onEvent?.(event)
}

async function emitConnectionEstablished(
  peerConnection: RTCPeerConnection,
  options: MobileWebRtcProviderOptions,
  startedAt: number,
): Promise<void> {
  const selectedCandidate = await getSelectedCandidateType(peerConnection)
  emitEvent(options, {
    name: 'p2p_connected',
    platform: getDiagnosticsPlatform(),
    connectionType: selectedCandidate === 'relay' ? 'relay' : selectedCandidate === 'direct' ? 'direct' : 'unknown',
    setupMs: Date.now() - startedAt,
  })

  if (selectedCandidate === 'relay') {
    emitEvent(options, {
      name: 'p2p_relay_selected',
      platform: getDiagnosticsPlatform(),
      connectionType: 'relay',
    })
  }
}

async function getSelectedCandidateType(
  peerConnection: RTCPeerConnection,
): Promise<'direct' | 'relay' | 'unknown'> {
  const statsTarget = peerConnection as unknown as {
    getStats?: () => Promise<unknown>
  }

  if (!statsTarget.getStats) return 'unknown'

  try {
    const stats = await statsTarget.getStats()
    const entries = normalizeStatsEntries(stats)
    const selectedPairId = entries.find((entry) =>
      entry.type === 'transport' && typeof entry.selectedCandidatePairId === 'string'
    )?.selectedCandidatePairId
    const selectedPair = typeof selectedPairId === 'string'
      ? entries.find((entry) => entry.id === selectedPairId)
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
    const localCandidate = localCandidateId ? entries.find((entry) => entry.id === localCandidateId) : undefined
    const remoteCandidate = remoteCandidateId ? entries.find((entry) => entry.id === remoteCandidateId) : undefined
    const candidateTypes = [localCandidate?.candidateType, remoteCandidate?.candidateType]

    if (candidateTypes.includes('relay')) return 'relay'
    if (candidateTypes.some((type) => type === 'host' || type === 'srflx' || type === 'prflx')) return 'direct'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

function normalizeStatsEntries(stats: unknown): Array<Record<string, unknown>> {
  if (stats instanceof Map) {
    return Array.from(stats.values()).filter(isRecord)
  }

  if (isRecord(stats) && typeof stats.forEach === 'function') {
    const entries: Array<Record<string, unknown>> = []
    stats.forEach((entry: unknown) => {
      if (isRecord(entry)) entries.push(entry)
    })
    return entries
  }

  if (isRecord(stats)) {
    return Object.values(stats).filter(isRecord)
  }

  return []
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}
