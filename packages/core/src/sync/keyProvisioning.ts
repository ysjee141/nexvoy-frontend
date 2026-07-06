export type DocumentKeyProvisioningStatus =
  | 'none'
  | 'waiting_for_material'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'superseded'

export type SafeKeyProvisioningErrorCode =
  | 'unknown'
  | 'material_unavailable'
  | 'owner_device_key_unavailable'
  | 'provider_unavailable'
  | 'wrap_failed'
  | 'request_cancelled'
  | 'permission_denied'
  | 'network_failed'
  | 'retry_later'

export interface UserKeyMaterialRegistration {
  id: string
  userId: string
  deviceId: string
  wrappingAlg: 'RSA-OAEP-256'
  materialVersion: number
  status: 'active' | 'revoked'
  queuedRequestCount: number
  createdAt: string
  updatedAt: string
}

export interface DocumentKeyProvisioningRequest {
  id: string
  documentId: string
  userId: string
  deviceId: string
  materialId: string
  wrappingAlg: 'RSA-OAEP-256'
  publicKeyJwk: Record<string, unknown>
  materialVersion: number
  memberRole: 'owner' | 'editor' | 'viewer'
  status: Extract<DocumentKeyProvisioningStatus, 'pending' | 'failed' | 'processing'>
  keyVersion: number
  errorCode: SafeKeyProvisioningErrorCode | null
  attemptCount: number
  requestedAt: string
  updatedAt: string
}

export interface BegunDocumentKeyProvisioningRequest extends DocumentKeyProvisioningRequest {
  status: 'processing'
}

export interface DocumentKeyProvisioningStatusRecord {
  id?: string
  documentId: string
  userId?: string
  deviceId: string | null
  keyVersion: number
  status: DocumentKeyProvisioningStatus
  errorCode: SafeKeyProvisioningErrorCode | null
  attemptCount: number
  hasActiveKey: boolean
  retryable: boolean
  requestedAt?: string | null
  updatedAt?: string | null
}

export interface KeyProvisioningRetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
}

export const DEFAULT_KEY_PROVISIONING_RETRY_POLICY: KeyProvisioningRetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 10_000,
  maxDelayMs: 5 * 60_000,
}

const STATUS_PRIORITY: Record<DocumentKeyProvisioningStatus, number> = {
  processing: 0,
  pending: 1,
  failed: 2,
  waiting_for_material: 3,
  none: 4,
  completed: 5,
  cancelled: 6,
  superseded: 7,
}

const SAFE_ERROR_CODES = new Set<SafeKeyProvisioningErrorCode>([
  'unknown',
  'material_unavailable',
  'owner_device_key_unavailable',
  'provider_unavailable',
  'wrap_failed',
  'request_cancelled',
  'permission_denied',
  'network_failed',
  'retry_later',
])

export function sanitizeKeyProvisioningErrorCode(input: unknown): SafeKeyProvisioningErrorCode {
  if (typeof input !== 'string') return 'unknown'
  const normalized = input.trim().replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 80)
  if (SAFE_ERROR_CODES.has(normalized as SafeKeyProvisioningErrorCode)) {
    return normalized as SafeKeyProvisioningErrorCode
  }
  return 'unknown'
}

export function normalizeKeyProvisioningStatus(input: unknown): DocumentKeyProvisioningStatus {
  if (
    input === 'none'
    || input === 'waiting_for_material'
    || input === 'pending'
    || input === 'processing'
    || input === 'completed'
    || input === 'failed'
    || input === 'cancelled'
    || input === 'superseded'
  ) {
    return input
  }
  return 'none'
}

export function isKeyProvisioningTerminalStatus(status: DocumentKeyProvisioningStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'superseded'
}

export function isKeyProvisioningRetryable(
  status: DocumentKeyProvisioningStatus,
  attemptCount: number,
  policy: KeyProvisioningRetryPolicy = DEFAULT_KEY_PROVISIONING_RETRY_POLICY,
): boolean {
  if (status === 'waiting_for_material' || status === 'failed' || status === 'none') {
    return attemptCount < policy.maxAttempts
  }
  return false
}

export function getKeyProvisioningRetryDelayMs(
  attemptCount: number,
  policy: KeyProvisioningRetryPolicy = DEFAULT_KEY_PROVISIONING_RETRY_POLICY,
): number {
  const safeAttempt = Math.max(0, Math.floor(attemptCount))
  return Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** safeAttempt)
}

export function sortKeyProvisioningRequests<T extends {
  status: DocumentKeyProvisioningStatus
  updatedAt?: string | null
  requestedAt?: string | null
  attemptCount?: number
}>(requests: readonly T[]): T[] {
  return [...requests].sort((left, right) => {
    const priorityDelta = STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status]
    if (priorityDelta !== 0) return priorityDelta

    const leftTime = Date.parse(left.updatedAt ?? left.requestedAt ?? '') || 0
    const rightTime = Date.parse(right.updatedAt ?? right.requestedAt ?? '') || 0
    if (leftTime !== rightTime) return leftTime - rightTime

    return (left.attemptCount ?? 0) - (right.attemptCount ?? 0)
  })
}

export function createKeyProvisioningStatusRecord(input: {
  id?: string
  documentId: string
  userId?: string
  deviceId?: string | null
  keyVersion?: number
  status?: unknown
  errorCode?: unknown
  attemptCount?: number
  hasActiveKey?: boolean
  requestedAt?: string | null
  updatedAt?: string | null
}): DocumentKeyProvisioningStatusRecord {
  const status = normalizeKeyProvisioningStatus(input.status)
  const attemptCount = Math.max(0, Math.floor(input.attemptCount ?? 0))
  const hasActiveKey = input.hasActiveKey ?? status === 'completed'

  return {
    id: input.id,
    documentId: input.documentId,
    userId: input.userId,
    deviceId: input.deviceId ?? null,
    keyVersion: input.keyVersion ?? 1,
    status,
    errorCode: input.errorCode == null ? null : sanitizeKeyProvisioningErrorCode(input.errorCode),
    attemptCount,
    hasActiveKey,
    retryable: isKeyProvisioningRetryable(status, attemptCount),
    requestedAt: input.requestedAt,
    updatedAt: input.updatedAt,
  }
}
