import {
  createLocalFirstObservabilityEvent,
  sanitizeLocalFirstObservabilityEvent,
} from '../events'

const event = createLocalFirstObservabilityEvent('p2p_connected', {
  platform: 'web',
  provider: 'cloudflare',
  connection_type: 'relay',
  setup_ms: 1200,
  has_turn: true,
})

if (
  event.name !== 'p2p_connected' ||
  event.params.platform !== 'web' ||
  event.params.connection_type !== 'relay' ||
  event.params.setup_ms !== 1200
) {
  throw new Error('Observability event should preserve allowlisted quality/cost params.')
}

const unsafe = sanitizeLocalFirstObservabilityEvent('collaboration_push_enqueued', {
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
  createLocalFirstObservabilityEvent('local_first_backup_failed', {
    reason_code: 'network_error',
    raw_key: 'secret',
  })
} catch {
  rejected = true
}

if (!rejected) {
  throw new Error('Observability event creator should reject secret-like params.')
}
