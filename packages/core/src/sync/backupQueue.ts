import type {
  PendingBackupUpdate,
  RestoreErrorCode,
} from './backupTypes'
import {
  encryptBackupPayload,
  type BackupCryptoProvider,
  type DocumentEncryptionKey,
} from './encryption'
import { serializeEncryptedBackupPayload } from './backupPayloadCodec'

export interface EncryptPendingBackupUpdateInput {
  provider: BackupCryptoProvider
  update: PendingBackupUpdate
  key: DocumentEncryptionKey
  keyVersion: number
}

export async function encryptPendingBackupUpdate(
  input: EncryptPendingBackupUpdateInput,
): Promise<PendingBackupUpdate> {
  const encryptedPayload = await encryptBackupPayload(input.provider, {
    plaintext: input.update.updateBlob,
    key: input.key,
    keyVersion: input.keyVersion,
  })

  return {
    ...input.update,
    updateBlob: serializeEncryptedBackupPayload(encryptedPayload),
  }
}

export function toSafeBackupFailureReason(error: unknown): RestoreErrorCode | 'upload_failed' | 'key_unavailable' {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (
      code === 'backup_decrypt_failed'
      || code === 'backup_encrypt_failed'
      || code === 'backup_hash_mismatch'
      || code === 'key_wrap_failed'
      || code === 'key_unwrap_failed'
      || code === 'restore_snapshot_missing'
      || code === 'unsupported_encryption_algorithm'
      || code === 'unsupported_key_wrapping_algorithm'
    ) {
      return code
    }
  }
  if (error instanceof Error && error.message === 'key_unavailable') return 'key_unavailable'
  return 'upload_failed'
}
