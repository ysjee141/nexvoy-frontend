export type ObservabilityEventName =
  | 'notification_permission_prompt_shown'
  | 'notification_permission_granted'
  | 'notification_permission_denied'
  | 'local_notification_scheduled'
  | 'local_notification_cancelled'
  | 'local_notification_schedule_failed'
  | 'collaboration_push_enqueued'
  | 'collaboration_push_delivered'
  | 'collaboration_push_deduped'
  | 'push_token_registered'
  | 'push_token_revoked'
  | 'document_permission_denied'

export type ObservabilityPlatform = 'web' | 'ios' | 'android' | 'unknown'

export type ObservabilityParams = Partial<{
  platform: ObservabilityPlatform
  document_type: 'trip' | 'template'
  operation: 'created' | 'updated' | 'deleted' | 'restored' | 'summary'
  entity_type: 'document' | 'plan' | 'checklist' | 'member'
  role: 'owner' | 'editor' | 'viewer'
  status: 'started' | 'completed' | 'failed' | 'skipped' | 'pending'
  reason: string
  reason_code: string
  count: number
  pending_count: number
  queued_count: number
  batch_window_ms: number
  provider: 'fcm' | 'expo' | 'firebase' | 'ga4' | 'local'
  ttl_seconds: number
}>

export interface ObservabilityEvent {
  name: ObservabilityEventName
  params: ObservabilityParams
}

export interface SanitizedObservabilityEvent {
  event: ObservabilityEvent
  rejectedKeys: string[]
}

const ALLOWED_EVENT_PARAM_KEYS = new Set<keyof ObservabilityParams>([
  'platform',
  'document_type',
  'operation',
  'entity_type',
  'role',
  'status',
  'reason',
  'reason_code',
  'count',
  'pending_count',
  'queued_count',
  'batch_window_ms',
  'provider',
  'ttl_seconds',
])

const FORBIDDEN_OBSERVABILITY_KEY_PATTERN =
  /(document[_-]?id|trip[_-]?id|title|body|memo|location|address|item[_-]?name|content|blob|crdt|yjs|snapshot|token|fcm|key|secret|password|email|name|phone)/i

export function sanitizeObservabilityEvent(
  name: ObservabilityEventName,
  params: unknown,
): SanitizedObservabilityEvent {
  const rejectedKeys = isRecord(params) ? collectRejectedKeys(params) : []
  const safeParams: ObservabilityParams = {}

  if (isRecord(params)) {
    safeParams.platform = readEnum(params.platform, ['web', 'ios', 'android', 'unknown'])
    safeParams.document_type = readEnum(params.document_type, ['trip', 'template'])
    safeParams.operation = readEnum(params.operation, ['created', 'updated', 'deleted', 'restored', 'summary'])
    safeParams.entity_type = readEnum(params.entity_type, ['document', 'plan', 'checklist', 'member'])
    safeParams.role = readEnum(params.role, ['owner', 'editor', 'viewer'])
    safeParams.status = readEnum(params.status, ['started', 'completed', 'failed', 'skipped', 'pending'])
    safeParams.provider = readEnum(params.provider, ['fcm', 'expo', 'firebase', 'ga4', 'local'])
    safeParams.reason = sanitizeShortString(params.reason)
    safeParams.reason_code = sanitizeShortString(params.reason_code)
    safeParams.count = sanitizeNonNegativeInteger(params.count)
    safeParams.pending_count = sanitizeNonNegativeInteger(params.pending_count)
    safeParams.queued_count = sanitizeNonNegativeInteger(params.queued_count)
    safeParams.batch_window_ms = sanitizeNonNegativeInteger(params.batch_window_ms)
    safeParams.ttl_seconds = sanitizeNonNegativeInteger(params.ttl_seconds)
  }

  return {
    event: {
      name,
      params: removeUndefined(safeParams),
    },
    rejectedKeys,
  }
}

export function createObservabilityEvent(
  name: ObservabilityEventName,
  params: unknown,
): ObservabilityEvent {
  const sanitized = sanitizeObservabilityEvent(name, params)
  if (sanitized.rejectedKeys.length > 0) {
    throw new Error(`Unsafe observability event params: ${sanitized.rejectedKeys.join(', ')}`)
  }
  return sanitized.event
}

function collectRejectedKeys(input: Record<string, unknown>, path = ''): string[] {
  const rejected: string[] = []

  for (const [key, value] of Object.entries(input)) {
    const fullPath = path ? `${path}.${key}` : key
    if (!ALLOWED_EVENT_PARAM_KEYS.has(key as keyof ObservabilityParams) || FORBIDDEN_OBSERVABILITY_KEY_PATTERN.test(key)) {
      rejected.push(fullPath)
      continue
    }

    if (isRecord(value)) {
      rejected.push(...collectRejectedKeys(value, fullPath))
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (isRecord(entry)) {
          rejected.push(...collectRejectedKeys(entry, `${fullPath}[${index}]`))
        }
      })
    }
  }

  return rejected
}

function sanitizeShortString(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined
  const trimmed = input.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 80)
}

function sanitizeNonNegativeInteger(input: unknown): number | undefined {
  const value = typeof input === 'number' ? input : Number(input)
  if (!Number.isFinite(value)) return undefined
  return Math.max(0, Math.floor(value))
}

function readEnum<T extends string>(input: unknown, allowed: readonly T[]): T | undefined {
  return typeof input === 'string' && allowed.includes(input as T) ? (input as T) : undefined
}

function removeUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as T
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}
