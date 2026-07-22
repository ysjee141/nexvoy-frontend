import { Platform } from 'react-native'
import {
  createObservabilityEvent,
  sanitizeObservabilityEvent,
  type ObservabilityEvent,
  type ObservabilityEventName,
  type ObservabilityParams,
  type ObservabilityPlatform,
} from '@nexvoy/core'

function currentPlatform(): ObservabilityPlatform {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS
  return 'unknown'
}

async function sendFirebaseEvent(event: ObservabilityEvent) {
  try {
    const analyticsModule = await import('@react-native-firebase/analytics')
    const analyticsFactory = analyticsModule.default
    await analyticsFactory().logEvent(event.name, event.params)
  } catch {
    // Firebase native config can be absent in local/dev clients; observability must never break UX.
  }
}

export async function logProductEvent(
  name: ObservabilityEventName,
  params: ObservabilityParams = {},
) {
  try {
    const event = createObservabilityEvent(name, {
      platform: currentPlatform(),
      ...params,
    })
    await sendFirebaseEvent(event)
  } catch {
    const sanitized = sanitizeObservabilityEvent(name, {
      platform: currentPlatform(),
      ...params,
    })
    await sendFirebaseEvent(sanitized.event)
  }
}
