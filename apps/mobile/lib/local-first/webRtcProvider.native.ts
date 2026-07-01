import { AppState, Platform } from 'react-native'
import { RTCPeerConnection } from 'react-native-webrtc'
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
        throw new Error(fallbackReason ?? 'Mobile WebRTC fast path is unavailable.')
      }

      const peerConnection = new RTCPeerConnection({
        iceServers: options.iceServers,
      })
      peerConnections.add(peerConnection)

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
