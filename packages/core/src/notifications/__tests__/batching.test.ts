import {
  DEFAULT_NOTIFICATION_BATCH_POLICY,
  buildNotificationBatchKey,
  buildNotificationDedupeKey,
  getNotificationDispatchAfter,
  mergeNotificationChangeCount,
  shouldMergeNotificationEvents,
} from '../batching'

const now = new Date('2026-07-06T00:00:00.000Z')
const soon = new Date('2026-07-06T00:04:59.000Z')
const later = new Date('2026-07-06T00:06:00.000Z')

const dedupeKey = buildNotificationDedupeKey({
  documentId: 'doc-1',
  actorId: 'actor-1',
  eventType: 'plan_changed',
  entityType: 'plan',
  occurredAt: now,
})

if (!dedupeKey.startsWith('doc-1:actor-1:plan_changed:plan:')) {
  throw new Error('Dedupe key should include document, actor, event, and entity.')
}

const clientKey = buildNotificationDedupeKey({
  documentId: 'doc 1',
  actorId: 'actor 1',
  eventType: 'checklist_changed',
  entityType: 'checklist',
  clientBatchId: 'batch with spaces',
  occurredAt: now,
})

if (clientKey.includes(' ')) {
  throw new Error('Dedupe key should sanitize client batch identifiers.')
}

if (buildNotificationBatchKey({ documentId: 'doc-1', actorId: 'actor-1', eventType: 'document_changed' }) !== 'doc-1:actor-1:document_changed') {
  throw new Error('Batch key should group by document, actor, and event type.')
}

if (!shouldMergeNotificationEvents(
  { documentId: 'doc-1', actorId: 'actor-1', eventType: 'plan_changed', entityType: 'plan', createdAt: now },
  { documentId: 'doc-1', actorId: 'actor-1', eventType: 'plan_changed', entityType: 'plan', createdAt: soon },
)) {
  throw new Error('Events inside the batch window should merge.')
}

if (shouldMergeNotificationEvents(
  { documentId: 'doc-1', actorId: 'actor-1', eventType: 'plan_changed', entityType: 'plan', createdAt: now },
  { documentId: 'doc-1', actorId: 'actor-1', eventType: 'plan_changed', entityType: 'plan', createdAt: later },
)) {
  throw new Error('Events outside the batch window should not merge.')
}

if (mergeNotificationChangeCount(998, 10) !== DEFAULT_NOTIFICATION_BATCH_POLICY.maxChangesPerBatch) {
  throw new Error('Merged change count should be capped.')
}

if (getNotificationDispatchAfter(now).toISOString() !== '2026-07-06T00:00:30.000Z') {
  throw new Error('Dispatch delay should follow the default policy.')
}
