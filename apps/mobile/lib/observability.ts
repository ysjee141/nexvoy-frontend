import { Platform } from 'react-native'
import {
  createLocalFirstObservabilityEvent,
  sanitizeLocalFirstObservabilityEvent,
  type LocalFirstObservabilityEvent,
  type LocalFirstObservabilityEventName,
  type LocalFirstObservabilityParams,
  type LocalFirstObservabilityPlatform,
} from '@nexvoy/core'

function currentPlatform(): LocalFirstObservabilityPlatform {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS
  return 'unknown'
}

async function sendFirebaseEvent(event: LocalFirstObservabilityEvent) {
  try {
    const analyticsModule = await import('@react-native-firebase/analytics')
    const analyticsFactory = analyticsModule.default
    await analyticsFactory().logEvent(event.name, event.params)
  } catch {
    // Firebase native config can be absent in local/dev clients; observability must never break UX.
  }
}

export async function logLocalFirstEvent(
  name: LocalFirstObservabilityEventName,
  params: LocalFirstObservabilityParams = {},
) {
  try {
    const event = createLocalFirstObservabilityEvent(name, {
      platform: currentPlatform(),
      ...params,
    })
    await sendFirebaseEvent(event)
  } catch {
    const sanitized = sanitizeLocalFirstObservabilityEvent(name, {
      platform: currentPlatform(),
      ...params,
    })
    await sendFirebaseEvent(sanitized.event)
  }
}
