export type MobileWebRtcCandidate = 'react-native-webrtc'

export type MobileWebRtcAvailability =
  | 'disabled'
  | 'native-module-missing'
  | 'dev-client-required'
  | 'ready'

export interface MobileWebRtcIceServer {
  urls: string | string[]
  username?: string
  credential?: string
}

export interface MobileWebRtcProviderOptions {
  enabled?: boolean
  iceServers?: MobileWebRtcIceServer[]
}

export interface MobileWebRtcProviderDiagnostics {
  candidate: MobileWebRtcCandidate
  availability: MobileWebRtcAvailability
  platform: 'ios' | 'android' | 'web' | 'unknown'
  expoGoSupported: boolean
  requiresDevClient: boolean
  requiredPackages: readonly string[]
  fallbackReason: string | null
}

export interface MobileWebRtcProvider {
  readonly isAvailable: boolean
  getDiagnostics: () => MobileWebRtcProviderDiagnostics
  createPeerConnection: () => Promise<unknown>
  close: () => Promise<void>
}

export const REACT_NATIVE_WEBRTC_FEASIBILITY = {
  candidate: 'react-native-webrtc',
  expoSdk: '~54.0.35',
  requiredPackages: [
    'react-native-webrtc@124.0.6',
    '@config-plugins/react-native-webrtc@13.0.0',
    'expo-dev-client',
  ],
  expoGoSupported: false,
  requiresDevClient: true,
  androidMinSdk: 24,
} as const
