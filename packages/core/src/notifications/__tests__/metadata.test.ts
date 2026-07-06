import {
  assertSafeNotificationMetadata,
  buildNotificationBodyKey,
  buildNotificationTitleKey,
  createCollaborationNotificationMetadata,
  sanitizeNotificationMetadata,
} from '../metadata'

const metadata = createCollaborationNotificationMetadata({
  documentType: 'trip',
  operation: 'updated',
  entityType: 'plan',
  actorRole: 'editor',
  platform: 'android',
  clientBatchId: 'client-batch-1',
  changeCount: 3,
})

if (
  metadata.document_type !== 'trip' ||
  metadata.entity_type !== 'plan' ||
  metadata.change_count !== 3 ||
  metadata.platform !== 'android'
) {
  throw new Error('Collaboration metadata should keep allowlisted summary fields.')
}

const unsafe = sanitizeNotificationMetadata({
  document_type: 'trip',
  entity_type: 'plan',
  plan_title: 'Secret itinerary title',
  memo: 'Private memo',
  crdt_blob: 'opaque-update',
  fcm_token: 'raw-token',
  token: 'raw-token',
})

if (unsafe.metadata.document_type !== 'trip' || unsafe.metadata.entity_type !== 'plan') {
  throw new Error('Metadata sanitizer should preserve safe keys.')
}

for (const key of ['plan_title', 'memo', 'crdt_blob', 'fcm_token', 'token']) {
  if (!unsafe.rejectedKeys.includes(key)) {
    throw new Error(`Metadata sanitizer should reject unsafe key: ${key}`)
  }
}

const unsafeValues = sanitizeNotificationMetadata({
  client_batch_id: 'user@example.com',
  reason_code: '550e8400-e29b-41d4-a716-446655440000',
})

if (unsafeValues.metadata.client_batch_id || unsafeValues.metadata.reason_code) {
  throw new Error('Metadata sanitizer should remove email and UUID values from allowlisted keys.')
}

for (const key of ['client_batch_id', 'reason_code']) {
  if (!unsafeValues.rejectedKeys.includes(key)) {
    throw new Error(`Metadata sanitizer should reject unsafe value for key: ${key}`)
  }
}

const tokenLikeValue = sanitizeNotificationMetadata({
  client_batch_id: 'abcdefghijklmnopqrstuvwxyzABCDEF',
})

if (tokenLikeValue.metadata.client_batch_id || !tokenLikeValue.rejectedKeys.includes('client_batch_id')) {
  throw new Error('Metadata sanitizer should reject token-like string values.')
}

let rejected = false
try {
  assertSafeNotificationMetadata({
    document_type: 'trip',
    item_name: 'Passport',
  })
} catch {
  rejected = true
}

if (!rejected) {
  throw new Error('Safe metadata assertion should reject checklist item names.')
}

if (buildNotificationTitleKey('plan_changed') !== 'notification.collaboration.plan_changed.title') {
  throw new Error('Title key builder should use key-based notification copy.')
}

if (buildNotificationBodyKey('checklist_changed') !== 'notification.collaboration.checklist_changed.body') {
  throw new Error('Body key builder should use key-based notification copy.')
}
