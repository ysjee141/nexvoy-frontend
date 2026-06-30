export type BackupEncryptionAlgorithm = 'AES-GCM-256'

export type DocumentKeyWrappingAlgorithm = 'AES-KW-256'

export type RestoreErrorCode =
  | 'backup_decrypt_failed'
  | 'backup_encrypt_failed'
  | 'backup_hash_mismatch'
  | 'key_unwrap_failed'
  | 'restore_snapshot_missing'
  | 'unsupported_encryption_algorithm'
  | 'unsupported_key_wrapping_algorithm'

export type BackupDocumentType = 'template' | 'trip'

export type BackupQueueStatus = 'idle' | 'pending' | 'uploading' | 'synced' | 'failed'

export type RestoreStatus = 'idle' | 'downloading' | 'replaying' | 'completed' | 'failed'

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

export interface PendingBackupUpdate {
  documentId: string
  clientId: string
  seq: number
  updateBlob: Uint8Array
  updateHash: string
  createdAt: string
  attempts: number
  lastError: string | null
}

export interface BackupQueueState {
  documentId: string
  clientId: string
  status: BackupQueueStatus
  pending: PendingBackupUpdate[]
  nextSeq: number
  lastUploadedSeq: number
  lastSnapshotAt: string | null
  lastError: string | null
  updatedAt: string
}

export interface BackupSnapshotRecord {
  documentId: string
  schemaVersion: number
  snapshot: Uint8Array
  snapshotHash: string
  encrypted: boolean
  updatedAt: string
}

export interface BackupUpdateRecord {
  id: string
  documentId: string
  clientId: string
  seq: number
  updateBlob: Uint8Array
  updateHash: string
  createdAt: string
}

export interface BackupSnapshotPolicy {
  maxPendingUpdates: number
  maxPendingBytes: number
  maxUpdatesSinceSnapshot: number
}

export interface RestorePlan {
  documentId: string
  snapshot: BackupSnapshotRecord
  updates: BackupUpdateRecord[]
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
