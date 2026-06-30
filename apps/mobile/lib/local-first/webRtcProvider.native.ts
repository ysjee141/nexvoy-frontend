import { AppState, Platform } from 'react-native'
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
  const availability: MobileWebRtcProviderDiagnostics['availability'] =
    options.enabled === false ? 'disabled' : 'native-module-missing'
  const fallbackReason =
    availability === 'disabled'
      ? 'Mobile WebRTC fast path is disabled by configuration.'
      : 'react-native-webrtc is not installed yet; use Supabase backup sync fallback.'
  const diagnostics = createDiagnostics(availability, fallbackReason)

  return {
    isAvailable: false,
    getDiagnostics: () => ({
      ...diagnostics,
      fallbackReason: `${diagnostics.fallbackReason} appState=${AppState.currentState}`,
    }),
    async createPeerConnection() {
      throw new Error(fallbackReason)
    },
    async close() {
      return undefined
    },
  }
}
