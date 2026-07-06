import type { NotificationEntityType, NotificationEventType } from './metadata'

export const DEFAULT_NOTIFICATION_BATCH_WINDOW_MS = 5 * 60 * 1000
export const DEFAULT_NOTIFICATION_DISPATCH_DELAY_MS = 30 * 1000
export const MAX_NOTIFICATION_BATCH_CHANGE_COUNT = 999

export interface NotificationDedupeInput {
  documentId: string
  actorId: string
  eventType: NotificationEventType
  entityType?: NotificationEntityType
  clientBatchId?: string
  occurredAt?: Date
}

export interface NotificationBatchPolicy {
  batchWindowMs: number
  dispatchDelayMs: number
  maxChangesPerBatch: number
}

export interface NotificationBatchCandidate {
  documentId: string
  actorId: string
  eventType: NotificationEventType
  entityType?: NotificationEntityType
  createdAt: Date
  changeCount?: number
}

export const DEFAULT_NOTIFICATION_BATCH_POLICY: NotificationBatchPolicy = {
  batchWindowMs: DEFAULT_NOTIFICATION_BATCH_WINDOW_MS,
  dispatchDelayMs: DEFAULT_NOTIFICATION_DISPATCH_DELAY_MS,
  maxChangesPerBatch: MAX_NOTIFICATION_BATCH_CHANGE_COUNT,
}

export function buildNotificationDedupeKey(input: NotificationDedupeInput): string {
  const windowBucket = Math.floor(
    (input.occurredAt ?? new Date()).getTime() / DEFAULT_NOTIFICATION_BATCH_WINDOW_MS,
  )
  const baseParts = [
    sanitizeKeyPart(input.documentId),
    sanitizeKeyPart(input.actorId),
    sanitizeKeyPart(input.eventType),
    sanitizeKeyPart(input.entityType ?? 'document'),
  ]

  if (input.clientBatchId) {
    baseParts.push(sanitizeKeyPart(input.clientBatchId))
  } else {
    baseParts.push(String(windowBucket))
  }

  return baseParts.join(':')
}

export function buildNotificationBatchKey(input: Pick<NotificationDedupeInput, 'documentId' | 'actorId' | 'eventType'>): string {
  return [
    sanitizeKeyPart(input.documentId),
    sanitizeKeyPart(input.actorId),
    sanitizeKeyPart(input.eventType),
  ].join(':')
}

export function shouldMergeNotificationEvents(
  existing: NotificationBatchCandidate,
  incoming: NotificationBatchCandidate,
  policy: NotificationBatchPolicy = DEFAULT_NOTIFICATION_BATCH_POLICY,
): boolean {
  if (existing.documentId !== incoming.documentId) return false
  if (existing.actorId !== incoming.actorId) return false
  if (existing.eventType !== incoming.eventType) return false
  if ((existing.entityType ?? 'document') !== (incoming.entityType ?? 'document')) return false

  const elapsedMs = Math.abs(incoming.createdAt.getTime() - existing.createdAt.getTime())
  return elapsedMs <= policy.batchWindowMs
}

export function mergeNotificationChangeCount(
  existingCount: number | undefined,
  incomingCount: number | undefined,
  policy: NotificationBatchPolicy = DEFAULT_NOTIFICATION_BATCH_POLICY,
): number {
  const existing = normalizeCount(existingCount)
  const incoming = normalizeCount(incomingCount)
  return Math.min(policy.maxChangesPerBatch, existing + incoming)
}

export function getNotificationDispatchAfter(
  now = new Date(),
  policy: NotificationBatchPolicy = DEFAULT_NOTIFICATION_BATCH_POLICY,
): Date {
  return new Date(now.getTime() + policy.dispatchDelayMs)
}

function normalizeCount(input: number | undefined): number {
  if (!Number.isFinite(input)) return 1
  return Math.max(1, Math.floor(input as number))
}

function sanitizeKeyPart(input: string): string {
  const sanitized = input.trim().replace(/[^a-zA-Z0-9:_-]/g, '_')
  return sanitized.length > 0 ? sanitized.slice(0, 120) : 'unknown'
}
