import {
  REACT_NATIVE_WEBRTC_FEASIBILITY,
  type MobileWebRtcProvider,
  type MobileWebRtcProviderOptions,
} from './webRtcProvider.types'

export function createMobileWebRtcProvider(
  options: MobileWebRtcProviderOptions = {}
): MobileWebRtcProvider {
  const availability = options.enabled === false ? 'disabled' : 'dev-client-required'
  const fallbackReason =
    availability === 'disabled'
      ? 'Mobile WebRTC fast path is disabled by configuration.'
      : 'Mobile WebRTC requires an EAS dev client with react-native-webrtc.'

  return {
    isAvailable: false,
    getDiagnostics: () => ({
      candidate: REACT_NATIVE_WEBRTC_FEASIBILITY.candidate,
      availability,
      platform: 'web',
      expoGoSupported: REACT_NATIVE_WEBRTC_FEASIBILITY.expoGoSupported,
      requiresDevClient: REACT_NATIVE_WEBRTC_FEASIBILITY.requiresDevClient,
      requiredPackages: REACT_NATIVE_WEBRTC_FEASIBILITY.requiredPackages,
      fallbackReason,
    }),
    async createPeerConnection() {
      throw new Error(fallbackReason)
    },
    async close() {
      return undefined
    },
  }
}

export type {
  MobileWebRtcAvailability,
  MobileWebRtcIceServer,
  MobileWebRtcProvider,
  MobileWebRtcProviderDiagnostics,
  MobileWebRtcProviderOptions,
} from './webRtcProvider.types'
