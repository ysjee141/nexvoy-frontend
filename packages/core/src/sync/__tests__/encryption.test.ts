import { BackupCryptoError } from '../backupTypes'
import {
  decryptBackupPayload,
  encryptBackupPayload,
  generateDocumentEncryptionKey,
  generateKeyEncryptionKey,
  unwrapDocumentEncryptionKey,
  wrapDocumentEncryptionKey,
  type BackupCryptoProvider,
} from '../encryption'

const provider = globalThis.crypto as BackupCryptoProvider

if (!provider?.subtle) {
  throw new Error('Web Crypto provider is required for encryption PoC tests.')
}

run().catch((error) => {
  throw error
})

async function run(): Promise<void> {
  const plaintext = new TextEncoder().encode('local-first backup payload')
  const dek = await generateDocumentEncryptionKey(provider)
  const encrypted = await encryptBackupPayload(provider, {
    plaintext,
    key: dek,
    keyVersion: 1,
  })

  if (encrypted.algorithm !== 'AES-GCM-256') {
    throw new Error('Encrypted payload should record AES-GCM-256 algorithm.')
  }

  if (encrypted.keyVersion !== 1) {
    throw new Error('Encrypted payload should preserve key version.')
  }

  if (encrypted.iv.byteLength !== 12) {
    throw new Error('AES-GCM payload should use a 96-bit IV.')
  }

  if (new TextDecoder().decode(encrypted.ciphertext) === new TextDecoder().decode(plaintext)) {
    throw new Error('Ciphertext should not equal plaintext.')
  }

  const decrypted = await decryptBackupPayload(provider, encrypted, dek)
  if (new TextDecoder().decode(decrypted) !== 'local-first backup payload') {
    throw new Error('Decrypting with the same DEK should restore plaintext.')
  }

  const otherDek = await generateDocumentEncryptionKey(provider)
  try {
    await decryptBackupPayload(provider, encrypted, otherDek)
    throw new Error('Decrypting with a different DEK should fail.')
  } catch (error) {
    if (!(error instanceof BackupCryptoError) || error.code !== 'backup_decrypt_failed') {
      throw error
    }
  }

  const kek = await generateKeyEncryptionKey(provider)
  const wrappedDek = await wrapDocumentEncryptionKey(provider, dek, kek, 1)
  const unwrappedDek = await unwrapDocumentEncryptionKey(provider, wrappedDek, kek)
  const decryptedWithUnwrappedKey = await decryptBackupPayload(provider, encrypted, unwrappedDek)

  if (new TextDecoder().decode(decryptedWithUnwrappedKey) !== 'local-first backup payload') {
    throw new Error('Unwrapped DEK should decrypt the original payload.')
  }

  const otherKek = await generateKeyEncryptionKey(provider)
  try {
    await unwrapDocumentEncryptionKey(provider, wrappedDek, otherKek)
    throw new Error('Unwrapping with a different KEK should fail.')
  } catch (error) {
    if (!(error instanceof BackupCryptoError) || error.code !== 'key_unwrap_failed') {
      throw error
    }
  }
}
