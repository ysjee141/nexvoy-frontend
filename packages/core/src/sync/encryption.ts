import {
  BackupCryptoError,
  type EncryptedBackupPayload,
  type WrappedDocumentKey,
} from './backupTypes'

const AES_GCM_ALGORITHM = 'AES-GCM'
const AES_KW_ALGORITHM = 'AES-KW'
const AES_KEY_LENGTH = 256
const AES_GCM_IV_BYTES = 12

export interface BackupCryptoProvider {
  readonly subtle: Pick<
    SubtleCrypto,
    'decrypt' | 'encrypt' | 'exportKey' | 'generateKey' | 'importKey' | 'unwrapKey' | 'wrapKey'
  >
  getRandomValues<T extends Uint8Array>(array: T): T
}

export type DocumentEncryptionKey = CryptoKey
export type KeyEncryptionKey = CryptoKey

export interface EncryptBackupPayloadInput {
  plaintext: Uint8Array
  key: DocumentEncryptionKey
  keyVersion: number
}

export async function generateDocumentEncryptionKey(
  provider: BackupCryptoProvider,
): Promise<DocumentEncryptionKey> {
  return provider.subtle.generateKey(
    { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
    true,
    ['decrypt', 'encrypt'],
  )
}

export async function generateKeyEncryptionKey(
  provider: BackupCryptoProvider,
): Promise<KeyEncryptionKey> {
  return provider.subtle.generateKey(
    { name: AES_KW_ALGORITHM, length: AES_KEY_LENGTH },
    true,
    ['unwrapKey', 'wrapKey'],
  )
}

export async function encryptBackupPayload(
  provider: BackupCryptoProvider,
  input: EncryptBackupPayloadInput,
): Promise<EncryptedBackupPayload> {
  const iv = provider.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES))

  try {
    const ciphertext = await provider.subtle.encrypt(
      { name: AES_GCM_ALGORITHM, iv: toArrayBuffer(iv) },
      input.key,
      toArrayBuffer(input.plaintext),
    )

    return {
      algorithm: 'AES-GCM-256',
      keyVersion: input.keyVersion,
      iv,
      ciphertext: new Uint8Array(ciphertext),
    }
  } catch (error) {
    throw new BackupCryptoError('backup_encrypt_failed', getErrorMessage(error))
  }
}

export async function decryptBackupPayload(
  provider: BackupCryptoProvider,
  payload: EncryptedBackupPayload,
  key: DocumentEncryptionKey,
): Promise<Uint8Array> {
  if (payload.algorithm !== 'AES-GCM-256') {
    throw new BackupCryptoError(
      'unsupported_encryption_algorithm',
      `Unsupported backup encryption algorithm: ${payload.algorithm}`,
    )
  }

  try {
    const plaintext = await provider.subtle.decrypt(
      { name: AES_GCM_ALGORITHM, iv: toArrayBuffer(payload.iv) },
      key,
      toArrayBuffer(payload.ciphertext),
    )

    return new Uint8Array(plaintext)
  } catch {
    throw new BackupCryptoError('backup_decrypt_failed', 'Failed to decrypt backup payload.')
  }
}

export async function wrapDocumentEncryptionKey(
  provider: BackupCryptoProvider,
  dek: DocumentEncryptionKey,
  kek: KeyEncryptionKey,
  keyVersion: number,
): Promise<WrappedDocumentKey> {
  const wrappedKey = await provider.subtle.wrapKey('raw', dek, kek, AES_KW_ALGORITHM)

  return {
    algorithm: 'AES-KW-256',
    keyVersion,
    wrappedDek: new Uint8Array(wrappedKey),
  }
}

export async function unwrapDocumentEncryptionKey(
  provider: BackupCryptoProvider,
  wrappedKey: WrappedDocumentKey,
  kek: KeyEncryptionKey,
): Promise<DocumentEncryptionKey> {
  if (wrappedKey.algorithm !== 'AES-KW-256') {
    throw new BackupCryptoError(
      'unsupported_key_wrapping_algorithm',
      `Unsupported key wrapping algorithm: ${wrappedKey.algorithm}`,
    )
  }

  try {
    return await provider.subtle.unwrapKey(
      'raw',
      toArrayBuffer(wrappedKey.wrappedDek),
      kek,
      AES_KW_ALGORITHM,
      { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
      true,
      ['decrypt', 'encrypt'],
    )
  } catch {
    throw new BackupCryptoError('key_unwrap_failed', 'Failed to unwrap document key.')
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Backup crypto operation failed.'
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
