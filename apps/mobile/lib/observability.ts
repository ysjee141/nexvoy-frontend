import { Platform } from 'react-native'
import {
  createObservabilityEvent,
  authorityRealtimeMetricToObservabilityEvent,
  authoritySyncMetricToObservabilityEvent,
  sanitizeObservabilityEvent,
  type AuthorityRealtimeMetric,
  type AuthoritySyncMetric,
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

export function logAuthoritySyncMetric(metric: AuthoritySyncMetric): void {
  void sendFirebaseEvent(authoritySyncMetricToObservabilityEvent(metric, currentPlatform()))
}

export function logAuthorityRealtimeMetric(metric: AuthorityRealtimeMetric): void {
  void sendFirebaseEvent(authorityRealtimeMetricToObservabilityEvent(metric, currentPlatform()))
}
