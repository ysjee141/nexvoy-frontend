export type BackupEncryptionAlgorithm = 'AES-GCM-256'

export type DocumentKeyWrappingAlgorithm = 'AES-KW-256'

export type RestoreErrorCode =
  | 'backup_decrypt_failed'
  | 'backup_encrypt_failed'
  | 'key_unwrap_failed'
  | 'unsupported_encryption_algorithm'
  | 'unsupported_key_wrapping_algorithm'

export interface EncryptedBackupPayload {
  algorithm: BackupEncryptionAlgorithm
  keyVersion: number
  iv: Uint8Array
  ciphertext: Uint8Array
}

export interface WrappedDocumentKey {
  algorithm: DocumentKeyWrappingAlgorithm
  keyVersion: number
  wrappedDek: Uint8Array
}

export interface DocumentKeyMetadata {
  documentId: string
  userId: string
  keyVersion: number
  wrappingAlg: DocumentKeyWrappingAlgorithm
  revokedAt: string | null
}

export class BackupCryptoError extends Error {
  constructor(
    public readonly code: RestoreErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'BackupCryptoError'
  }
}
