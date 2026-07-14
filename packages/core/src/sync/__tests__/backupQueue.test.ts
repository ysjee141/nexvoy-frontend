import { BackupCryptoError } from '../backupTypes'
import { encryptPendingBackupUpdate, toSafeBackupFailureReason } from '../backupQueue'
import { deserializeEncryptedBackupPayload } from '../backupPayloadCodec'
import {
  decryptBackupPayload,
  generateDocumentEncryptionKey,
  type BackupCryptoProvider,
} from '../encryption'

const provider = globalThis.crypto as BackupCryptoProvider

if (!provider?.subtle) {
  throw new Error('Web Crypto provider is required for backup queue tests.')
}

run().catch((error) => {
  throw error
})

async function run(): Promise<void> {
  const key = await generateDocumentEncryptionKey(provider)
  const plaintext = new TextEncoder().encode('pending backup update')

  const encrypted = await encryptPendingBackupUpdate({
    provider,
    key,
    keyVersion: 3,
    update: {
      documentId: 'trip-1',
      clientId: 'client-1',
      seq: 7,
      updateBlob: plaintext,
      updateHash: 'hash-1',
      createdAt: '2026-07-14T00:00:00.000Z',
      attempts: 0,
      lastError: null,
    },
  })

  if (new TextDecoder().decode(encrypted.updateBlob) === 'pending backup update') {
    throw new Error('Encrypted pending backup update must not keep plaintext in updateBlob.')
  }

  const payload = deserializeEncryptedBackupPayload(encrypted.updateBlob)
  if (payload.keyVersion !== 3) {
    throw new Error('Encrypted pending backup update should preserve key version.')
  }

  const decrypted = await decryptBackupPayload(provider, payload, key)
  if (new TextDecoder().decode(decrypted) !== 'pending backup update') {
    throw new Error('Encrypted pending backup update should decrypt to the original update.')
  }

  if (toSafeBackupFailureReason(new BackupCryptoError('backup_hash_mismatch', 'raw mismatch')) !== 'backup_hash_mismatch') {
    throw new Error('Known backup crypto failures should preserve safe reason code.')
  }

  if (toSafeBackupFailureReason(new Error('key_unavailable')) !== 'key_unavailable') {
    throw new Error('Missing document key should map to key_unavailable.')
  }

  if (toSafeBackupFailureReason(new Error('connection refused: secret payload')) !== 'upload_failed') {
    throw new Error('Unexpected errors should be collapsed to upload_failed.')
  }
}
