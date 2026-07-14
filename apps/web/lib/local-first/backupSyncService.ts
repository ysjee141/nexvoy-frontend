import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createBackupQueueState,
  enqueueBackupUpdate,
  encryptPendingBackupUpdate,
  markBackupUploadFailed,
  markBackupUploadStarted,
  markBackupUploadSucceeded,
  toSafeBackupFailureReason,
  type BackupQueueState,
  type PendingBackupUpdate,
} from '@nexvoy/core'
import { createSupabaseBackupRepository } from '@nexvoy/core/supabase/backupRepository'
import { analytics } from '@/services/AnalyticsService'
import { loadBackupQueueState, saveBackupQueueState } from './indexedDbStore'
import { getCurrentWebDocumentKey, getOrCreateWebDeviceId } from './keyProvisioningService'
import { getWebBackupCryptoProvider } from './webCryptoProvider'

const DOCUMENT_KEY_VERSION = 1

export async function enqueueWebBackupUpdate(input: {
  supabase: SupabaseClient
  documentId: string
  update: Uint8Array
}): Promise<void> {
  const clientId = getOrCreateWebDeviceId()
  const queue = await loadWebQueue(input.documentId, clientId)
  const next = enqueueBackupUpdate(queue, {
    updateBlob: input.update,
    updateHash: await sha256Hex(input.update),
  })
  await saveWebQueue(next)
  void flushWebBackupQueue({
    supabase: input.supabase,
    documentId: input.documentId,
  })
}

export async function flushWebBackupQueue(input: {
  supabase: SupabaseClient
  documentId: string
}): Promise<void> {
  const clientId = getOrCreateWebDeviceId()
  const queue = await loadWebQueue(input.documentId, clientId)
  if (queue.pending.length === 0) return

  const documentKey = await getCurrentWebDocumentKey({
    supabase: input.supabase,
    documentId: input.documentId,
    deviceId: clientId,
  })
  if (!documentKey) {
    const failed = markBackupUploadFailed(queue, 'key_unavailable')
    await saveWebQueue(failed)
    emitBackupFailure('key_unavailable', failed.pending.length)
    return
  }

  let uploading = markBackupUploadStarted(queue)
  await saveWebQueue(uploading)

  try {
    const repository = createSupabaseBackupRepository(input.supabase)
    let uploadedThroughSeq = uploading.lastUploadedSeq
    for (const update of uploading.pending) {
      const encrypted = await encryptPendingBackupUpdate({
        provider: getWebBackupCryptoProvider(),
        update,
        key: documentKey,
        keyVersion: DOCUMENT_KEY_VERSION,
      })
      await repository.uploadUpdate(encrypted)
      uploadedThroughSeq = Math.max(uploadedThroughSeq, update.seq)
    }
    uploading = markBackupUploadSucceeded(uploading, uploadedThroughSeq)
    await saveWebQueue(uploading)
  } catch (error) {
    const reason = toSafeBackupFailureReason(error)
    const failed = markBackupUploadFailed(uploading, reason)
    await saveWebQueue(failed)
    emitBackupFailure(reason, failed.pending.length)
  }
}

async function loadWebQueue(documentId: string, clientId: string): Promise<BackupQueueState> {
  const raw = await loadBackupQueueState(getQueueId(documentId, clientId))
  const parsed = parseBackupQueueState(raw)
  return parsed ?? createBackupQueueState({ documentId, clientId })
}

async function saveWebQueue(state: BackupQueueState): Promise<void> {
  await saveBackupQueueState(getQueueId(state.documentId, state.clientId), serializeBackupQueueState(state))
}

function getQueueId(documentId: string, clientId: string): string {
  return `${clientId}:${documentId}`
}

function serializeBackupQueueState(state: BackupQueueState): unknown {
  return {
    ...state,
    pending: state.pending.map((update) => ({
      ...update,
      updateBlob: encodeBase64(update.updateBlob),
    })),
  }
}

function parseBackupQueueState(input: unknown): BackupQueueState | null {
  if (!input || typeof input !== 'object') return null
  const state = input as BackupQueueState & { pending?: Array<PendingBackupUpdate & { updateBlob: string }> }
  if (!Array.isArray(state.pending)) return null
  return {
    ...state,
    pending: state.pending.map((update) => ({
      ...update,
      updateBlob: decodeBase64(String(update.updateBlob)),
    })),
  }
}

function emitBackupFailure(reasonCode: string, pendingCount: number): void {
  analytics.logLocalFirstEvent('local_first_backup_failed', {
    document_type: 'trip',
    entity_type: 'document',
    operation: 'updated',
    reason_code: reasonCode,
    pending_count: pendingCount,
  })
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function encodeBase64(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary)
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}
