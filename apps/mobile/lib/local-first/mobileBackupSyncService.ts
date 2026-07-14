import type { SupabaseClient } from '@supabase/supabase-js'
import { subtle } from 'react-native-quick-crypto'
import {
  createBackupQueueState,
  enqueueBackupUpdate,
  encryptPendingBackupUpdate,
  markBackupUploadFailed,
  markBackupUploadStarted,
  markBackupUploadSucceeded,
  toSafeBackupFailureReason,
  type BackupQueueState,
} from '@nexvoy/core'
import { createSupabaseBackupRepository } from '@nexvoy/core/supabase/backupRepository'
import { logLocalFirstEvent } from '@/lib/observability'
import { getOrCreateMobileDeviceId } from './mobileDeviceIdentity'
import { getCurrentMobileDocumentKey } from './keyProvisioningService'
import { getMobileBackupCryptoProvider } from './documentBootstrapService'
import {
  loadMobileBackupQueueState,
  saveMobileBackupQueueState,
} from './mobileBackupQueueStore'

const DOCUMENT_KEY_VERSION = 1

export async function enqueueMobileBackupUpdate(input: {
  supabase: SupabaseClient
  documentId: string
  update: Uint8Array
}): Promise<void> {
  const clientId = await getOrCreateMobileDeviceId()
  const queue = await loadMobileQueue(input.documentId, clientId)
  const next = enqueueBackupUpdate(queue, {
    updateBlob: input.update,
    updateHash: await sha256Hex(input.update),
  })
  await saveMobileQueue(next)
  void flushMobileBackupQueue({
    supabase: input.supabase,
    documentId: input.documentId,
  })
}

export async function flushMobileBackupQueue(input: {
  supabase: SupabaseClient
  documentId: string
}): Promise<void> {
  const clientId = await getOrCreateMobileDeviceId()
  const queue = await loadMobileQueue(input.documentId, clientId)
  if (queue.pending.length === 0) return

  const documentKey = await getCurrentMobileDocumentKey({
    supabase: input.supabase,
    documentId: input.documentId,
    deviceId: clientId,
  })
  if (!documentKey) {
    const failed = markBackupUploadFailed(queue, 'key_unavailable')
    await saveMobileQueue(failed)
    await emitBackupFailure('key_unavailable', failed.pending.length)
    return
  }

  let uploading = markBackupUploadStarted(queue)
  await saveMobileQueue(uploading)

  try {
    const repository = createSupabaseBackupRepository(input.supabase)
    let uploadedThroughSeq = uploading.lastUploadedSeq
    for (const update of uploading.pending) {
      const encrypted = await encryptPendingBackupUpdate({
        provider: getMobileBackupCryptoProvider(),
        update,
        key: documentKey,
        keyVersion: DOCUMENT_KEY_VERSION,
      })
      await repository.uploadUpdate(encrypted)
      uploadedThroughSeq = Math.max(uploadedThroughSeq, update.seq)
    }
    uploading = markBackupUploadSucceeded(uploading, uploadedThroughSeq)
    await saveMobileQueue(uploading)
  } catch (error) {
    const reason = toSafeBackupFailureReason(error)
    const failed = markBackupUploadFailed(uploading, reason)
    await saveMobileQueue(failed)
    await emitBackupFailure(reason, failed.pending.length)
  }
}

async function loadMobileQueue(documentId: string, clientId: string): Promise<BackupQueueState> {
  return await loadMobileBackupQueueState(getQueueId(documentId, clientId))
    ?? createBackupQueueState({ documentId, clientId })
}

async function saveMobileQueue(state: BackupQueueState): Promise<void> {
  await saveMobileBackupQueueState(getQueueId(state.documentId, state.clientId), state)
}

function getQueueId(documentId: string, clientId: string): string {
  return `${clientId}:${documentId}`
}

async function emitBackupFailure(reasonCode: string, pendingCount: number): Promise<void> {
  await logLocalFirstEvent('local_first_backup_failed', {
    document_type: 'trip',
    entity_type: 'document',
    operation: 'updated',
    reason_code: reasonCode,
    pending_count: pendingCount,
  })
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const digest = await (subtle as unknown as Pick<SubtleCrypto, 'digest'>).digest(
    'SHA-256',
    buffer,
  )
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
