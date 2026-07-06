export type NotificationEventType =
  | 'document_changed'
  | 'plan_changed'
  | 'checklist_changed'
  | 'member_joined'
  | 'member_removed'

export type NotificationDocumentType = 'trip' | 'template'
export type NotificationOperation = 'created' | 'updated' | 'deleted' | 'restored' | 'summary'
export type NotificationEntityType = 'document' | 'plan' | 'checklist' | 'member'
export type NotificationActorRole = 'owner' | 'editor' | 'viewer'
export type NotificationPlatform = 'web' | 'ios' | 'android' | 'unknown'
export type KeyProvisioningNotificationReasonCode =
  | 'key_provisioning_waiting_for_material'
  | 'key_provisioning_pending'
  | 'key_provisioning_completed'
  | 'key_provisioning_failed'

export interface NotificationMetadata {
  document_type?: NotificationDocumentType
  operation?: NotificationOperation
  entity_type?: NotificationEntityType
  change_count?: number
  actor_role?: NotificationActorRole
  platform?: NotificationPlatform
  client_batch_id?: string
  reason_code?: string
}

export interface CollaborationNotificationInput {
  documentType: NotificationDocumentType
  operation: NotificationOperation
  entityType: NotificationEntityType
  actorRole?: NotificationActorRole
  platform?: NotificationPlatform
  clientBatchId?: string
  changeCount?: number
  reasonCode?: string
}

export interface KeyProvisioningNotificationInput {
  documentType: NotificationDocumentType
  actorRole?: NotificationActorRole
  platform?: NotificationPlatform
  reasonCode: KeyProvisioningNotificationReasonCode
}

export interface SanitizedNotificationMetadata {
  metadata: NotificationMetadata
  rejectedKeys: string[]
}

const ALLOWED_METADATA_KEYS = new Set<keyof NotificationMetadata>([
  'document_type',
  'operation',
  'entity_type',
  'change_count',
  'actor_role',
  'platform',
  'client_batch_id',
  'reason_code',
])

const FORBIDDEN_KEY_PATTERN =
  /(title|body|memo|location|place|address|item[_-]?name|category|content|blob|crdt|yjs|snapshot|token|fcm|key|secret|password|invite[_-]?code|share[_-]?token)/i

const FORBIDDEN_STRING_VALUE_PATTERNS = [
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^[a-zA-Z0-9:_-]{32,}$/,
]

const SAFE_STRING_VALUE_PATTERN = /^[a-zA-Z0-9:_-]+$/
const MAX_STRING_VALUE_LENGTH = 80

export function createCollaborationNotificationMetadata(
  input: CollaborationNotificationInput,
): NotificationMetadata {
  const sanitized = sanitizeNotificationMetadata({
    document_type: input.documentType,
    operation: input.operation,
    entity_type: input.entityType,
    actor_role: input.actorRole,
    platform: input.platform,
    client_batch_id: input.clientBatchId,
    change_count: input.changeCount ?? 1,
    reason_code: input.reasonCode,
  })

  if (sanitized.rejectedKeys.length > 0) {
    throw new Error(`Unsafe notification metadata keys: ${sanitized.rejectedKeys.join(', ')}`)
  }

  return sanitized.metadata
}

export function createKeyProvisioningNotificationMetadata(
  input: KeyProvisioningNotificationInput,
): NotificationMetadata {
  return createCollaborationNotificationMetadata({
    documentType: input.documentType,
    operation: 'updated',
    entityType: 'member',
    actorRole: input.actorRole,
    platform: input.platform,
    changeCount: 1,
    reasonCode: input.reasonCode,
  })
}

export function sanitizeNotificationMetadata(input: unknown): SanitizedNotificationMetadata {
  if (!isRecord(input)) {
    return { metadata: {}, rejectedKeys: [] }
  }

  const rejectedKeys = collectRejectedMetadataKeys(input)
  const metadata: NotificationMetadata = {}

  metadata.document_type = readEnum(input.document_type, ['trip', 'template'])
  metadata.operation = readEnum(input.operation, ['created', 'updated', 'deleted', 'restored', 'summary'])
  metadata.entity_type = readEnum(input.entity_type, ['document', 'plan', 'checklist', 'member'])
  metadata.actor_role = readEnum(input.actor_role, ['owner', 'editor', 'viewer'])
  metadata.platform = readEnum(input.platform, ['web', 'ios', 'android', 'unknown'])
  metadata.client_batch_id = sanitizeString(input.client_batch_id)
  metadata.reason_code = sanitizeString(input.reason_code)
  metadata.change_count = sanitizeChangeCount(input.change_count)

  return {
    metadata: removeUndefined(metadata),
    rejectedKeys,
  }
}

export function assertSafeNotificationMetadata(input: unknown): NotificationMetadata {
  const sanitized = sanitizeNotificationMetadata(input)
  if (sanitized.rejectedKeys.length > 0) {
    throw new Error(`Unsafe notification metadata keys: ${sanitized.rejectedKeys.join(', ')}`)
  }
  return sanitized.metadata
}

export function buildNotificationTitleKey(eventType: NotificationEventType): string {
  return `notification.collaboration.${eventType}.title`
}

export function buildNotificationBodyKey(eventType: NotificationEventType): string {
  return `notification.collaboration.${eventType}.body`
}

function collectRejectedMetadataKeys(input: Record<string, unknown>, path = ''): string[] {
  const rejected: string[] = []

  for (const [key, value] of Object.entries(input)) {
    const fullPath = path ? `${path}.${key}` : key
    if (!ALLOWED_METADATA_KEYS.has(key as keyof NotificationMetadata) || FORBIDDEN_KEY_PATTERN.test(key)) {
      rejected.push(fullPath)
      continue
    }

    if (typeof value === 'string' && isForbiddenStringValue(value)) {
      rejected.push(fullPath)
      continue
    }

    if (isRecord(value)) {
      rejected.push(...collectRejectedMetadataKeys(value, fullPath))
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (isRecord(entry)) {
          rejected.push(...collectRejectedMetadataKeys(entry, `${fullPath}[${index}]`))
        }
      })
    }
  }

  return rejected
}

function sanitizeString(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined

  const trimmed = input.trim()
  if (!trimmed) return undefined
  if (isForbiddenStringValue(trimmed) || !SAFE_STRING_VALUE_PATTERN.test(trimmed)) return undefined

  return trimmed.slice(0, MAX_STRING_VALUE_LENGTH)
}

function sanitizeChangeCount(input: unknown): number | undefined {
  const value = typeof input === 'number' ? input : Number(input)
  if (!Number.isFinite(value)) return undefined

  return Math.min(999, Math.max(1, Math.floor(value)))
}

function readEnum<T extends string>(input: unknown, allowed: readonly T[]): T | undefined {
  return typeof input === 'string' && allowed.includes(input as T) ? (input as T) : undefined
}

function isForbiddenStringValue(value: string): boolean {
  const trimmed = value.trim()
  return FORBIDDEN_STRING_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed))
}

function removeUndefined<T extends object>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as T
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}
