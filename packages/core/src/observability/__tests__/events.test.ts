import {
  createObservabilityEvent,
  sanitizeObservabilityEvent,
} from '../events'

const event = createObservabilityEvent('local_notification_scheduled', {
  platform: 'web',
  provider: 'local',
  status: 'completed',
  count: 1,
})

if (
  event.name !== 'local_notification_scheduled' ||
  event.params.platform !== 'web' ||
  event.params.provider !== 'local' ||
  event.params.count !== 1
) {
  throw new Error('Observability event should preserve allowlisted product params.')
}

const unsafe = sanitizeObservabilityEvent('collaboration_push_enqueued', {
  platform: 'android',
  queued_count: 2,
  document_id: 'raw-document-id',
  trip_id: 'raw-trip-id',
  title: 'Private trip title',
  fcm_token: 'raw-token',
  nested: {
    memo: 'private memo',
  },
})

if (unsafe.event.params.platform !== 'android' || unsafe.event.params.queued_count !== 2) {
  throw new Error('Observability sanitizer should preserve safe counters.')
}

for (const key of ['document_id', 'trip_id', 'title', 'fcm_token', 'nested']) {
  if (!unsafe.rejectedKeys.includes(key)) {
    throw new Error(`Observability sanitizer should reject unsafe param: ${key}`)
  }
}

let rejected = false
try {
  createObservabilityEvent('local_notification_schedule_failed', {
    reason_code: 'network_error',
    raw_key: 'secret',
  })
} catch {
  rejected = true
}

if (!rejected) {
  throw new Error('Observability event creator should reject secret-like params.')
}
