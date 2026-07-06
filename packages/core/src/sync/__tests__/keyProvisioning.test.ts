import {
  createKeyProvisioningStatusRecord,
  getKeyProvisioningRetryDelayMs,
  isKeyProvisioningRetryable,
  normalizeKeyProvisioningStatus,
  sanitizeKeyProvisioningErrorCode,
  sortKeyProvisioningRequests,
} from '../keyProvisioning'

run()

function run(): void {
  if (normalizeKeyProvisioningStatus('pending') !== 'pending') {
    throw new Error('Known provisioning status should be preserved.')
  }

  if (normalizeKeyProvisioningStatus('raw_dek_leaked') !== 'none') {
    throw new Error('Unknown provisioning status should normalize to none.')
  }

  if (sanitizeKeyProvisioningErrorCode('wrap_failed') !== 'wrap_failed') {
    throw new Error('Known safe error code should be preserved.')
  }

  if (sanitizeKeyProvisioningErrorCode('raw_dek:abc123') !== 'unknown') {
    throw new Error('Unsafe error code should normalize to unknown.')
  }

  if (!isKeyProvisioningRetryable('failed', 1)) {
    throw new Error('Failed provisioning should be retryable before max attempts.')
  }

  if (isKeyProvisioningRetryable('pending', 1)) {
    throw new Error('Pending provisioning should not be retried by the recipient.')
  }

  if (getKeyProvisioningRetryDelayMs(3) !== 80_000) {
    throw new Error('Retry delay should use bounded exponential backoff.')
  }

  const sorted = sortKeyProvisioningRequests([
    { status: 'waiting_for_material', updatedAt: '2026-07-06T00:00:00.000Z' },
    { status: 'pending', updatedAt: '2026-07-06T00:00:02.000Z' },
    { status: 'processing', updatedAt: '2026-07-06T00:00:03.000Z' },
    { status: 'pending', updatedAt: '2026-07-06T00:00:01.000Z' },
  ])

  if (sorted.map((entry) => entry.status).join(',') !== 'processing,pending,pending,waiting_for_material') {
    throw new Error('Provisioning requests should be sorted by process priority.')
  }

  const completed = createKeyProvisioningStatusRecord({
    documentId: 'document-1',
    deviceId: 'web-1',
    status: 'completed',
  })

  if (!completed.hasActiveKey || completed.retryable) {
    throw new Error('Completed status should imply active key and no retry.')
  }
}
