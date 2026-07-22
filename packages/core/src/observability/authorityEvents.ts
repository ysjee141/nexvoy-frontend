import type {
  AuthorityRealtimeMetric,
  AuthoritySyncMetric,
} from '../authority/serverAuthorityTypes'
import {
  createObservabilityEvent,
  type ObservabilityEvent,
  type ObservabilityPlatform,
} from './events'

export function authoritySyncMetricToObservabilityEvent(
  metric: AuthoritySyncMetric,
  platform: ObservabilityPlatform,
): ObservabilityEvent {
  switch (metric.name) {
    case 'authority_flush_started':
      return createObservabilityEvent(metric.name, {
        platform,
        status: 'started',
        count: metric.commandCount,
        queue_age_ms: metric.queueOldestAgeMs,
        payload_bytes: metric.estimatedBytes,
      })
    case 'authority_batch_applied':
      return createObservabilityEvent(metric.name, {
        platform,
        document_type: metric.resourceType,
        status: 'completed',
        count: metric.commandCount,
        duration_ms: metric.durationMs,
      })
    case 'authority_batch_conflict':
    case 'authority_batch_retryable':
    case 'authority_batch_rejected':
      return createObservabilityEvent(metric.name, {
        platform,
        document_type: metric.resourceType,
        status: metric.name === 'authority_batch_retryable' ? 'pending' : 'failed',
        count: metric.commandCount,
        reason_code: metric.errorCode,
        duration_ms: metric.durationMs,
      })
    case 'authority_sending_recovered':
      return createObservabilityEvent(metric.name, {
        platform,
        status: 'completed',
        count: metric.commandCount,
      })
    case 'authority_membership_revoked':
      return createObservabilityEvent(metric.name, {
        platform,
        document_type: metric.resourceType,
        status: 'completed',
        reason_code: 'membership_revoked',
      })
    case 'authority_full_refresh':
      return createObservabilityEvent(metric.name, {
        platform,
        document_type: metric.resourceType,
        status: 'completed',
        reason_code: metric.reasonCode,
        duration_ms: metric.durationMs,
        count: 1,
      })
  }
}

export function authorityRealtimeMetricToObservabilityEvent(
  metric: AuthorityRealtimeMetric,
  platform: ObservabilityPlatform,
): ObservabilityEvent {
  if (metric.name === 'authority_invalidation_gap' || metric.name === 'authority_reconnect_refresh') {
    return createObservabilityEvent(metric.name, {
      platform,
      document_type: metric.resourceType,
      status: 'completed',
      revision_gap: Math.max(0, metric.remoteRevision - metric.localRevision),
    })
  }
  return createObservabilityEvent(metric.name, {
    platform,
    document_type: metric.resourceType,
    status: metric.name === 'authority_invalidation_ignored' ? 'skipped' : 'completed',
    count: 1,
  })
}
