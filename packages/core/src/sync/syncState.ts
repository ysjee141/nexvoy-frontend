import {
  BackupCryptoError,
  type BackupQueueState,
  type BackupSnapshotPolicy,
  type BackupSnapshotRecord,
  type BackupUpdateRecord,
  type PendingBackupUpdate,
  type RestorePlan,
} from './backupTypes'

export interface CreateBackupQueueInput {
  documentId: string
  clientId: string
  now?: string
}

export interface EnqueueBackupUpdateInput {
  updateBlob: Uint8Array
  updateHash: string
  now?: string
}

export function createBackupQueueState(input: CreateBackupQueueInput): BackupQueueState {
  const now = input.now ?? new Date().toISOString()
  return {
    documentId: input.documentId,
    clientId: input.clientId,
    status: 'idle',
    pending: [],
    nextSeq: 1,
    lastUploadedSeq: 0,
    lastSnapshotAt: null,
    lastError: null,
    updatedAt: now,
  }
}

export function enqueueBackupUpdate(
  state: BackupQueueState,
  input: EnqueueBackupUpdateInput,
): BackupQueueState {
  const now = input.now ?? new Date().toISOString()
  const update: PendingBackupUpdate = {
    documentId: state.documentId,
    clientId: state.clientId,
    seq: state.nextSeq,
    updateBlob: input.updateBlob,
    updateHash: input.updateHash,
    createdAt: now,
    attempts: 0,
    lastError: null,
  }

  return {
    ...state,
    status: 'pending',
    pending: [...state.pending, update],
    nextSeq: state.nextSeq + 1,
    lastError: null,
    updatedAt: now,
  }
}

export function markBackupUploadStarted(state: BackupQueueState, now = new Date().toISOString()): BackupQueueState {
  if (state.pending.length === 0) {
    return { ...state, status: 'idle', updatedAt: now }
  }

  return {
    ...state,
    status: 'uploading',
    pending: state.pending.map((update) => ({
      ...update,
      attempts: update.attempts + 1,
    })),
    updatedAt: now,
  }
}

export function markBackupUploadSucceeded(
  state: BackupQueueState,
  uploadedThroughSeq: number,
  now = new Date().toISOString(),
): BackupQueueState {
  const pending = state.pending.filter((update) => update.seq > uploadedThroughSeq)

  return {
    ...state,
    status: pending.length > 0 ? 'pending' : 'synced',
    pending,
    lastUploadedSeq: Math.max(state.lastUploadedSeq, uploadedThroughSeq),
    lastError: null,
    updatedAt: now,
  }
}

export function markBackupUploadFailed(
  state: BackupQueueState,
  errorMessage: string,
  now = new Date().toISOString(),
): BackupQueueState {
  return {
    ...state,
    status: 'failed',
    pending: state.pending.map((update) => ({
      ...update,
      lastError: errorMessage,
    })),
    lastError: errorMessage,
    updatedAt: now,
  }
}

export function markSnapshotCreated(
  state: BackupQueueState,
  snapshotAt = new Date().toISOString(),
): BackupQueueState {
  return {
    ...state,
    lastSnapshotAt: snapshotAt,
    updatedAt: snapshotAt,
  }
}

export function shouldCreateBackupSnapshot(
  state: BackupQueueState,
  policy: BackupSnapshotPolicy,
): boolean {
  if (state.pending.length >= policy.maxPendingUpdates) return true
  if (state.nextSeq - state.lastUploadedSeq - 1 >= policy.maxUpdatesSinceSnapshot) return true

  const pendingBytes = state.pending.reduce((sum, update) => sum + update.updateBlob.byteLength, 0)
  return pendingBytes >= policy.maxPendingBytes
}

export function createRestorePlan(
  snapshot: BackupSnapshotRecord | null,
  updates: BackupUpdateRecord[],
): RestorePlan {
  if (!snapshot) {
    throw new BackupCryptoError('restore_snapshot_missing', 'Backup snapshot is required for restore.')
  }

  return {
    documentId: snapshot.documentId,
    snapshot,
    updates: [...updates].sort(compareUpdatesForRestore),
  }
}

export async function verifyBackupHash(
  bytes: Uint8Array,
  expectedHash: string,
  hash: (bytes: Uint8Array) => Promise<string> | string,
): Promise<void> {
  const actualHash = await hash(bytes)
  if (actualHash !== expectedHash) {
    throw new BackupCryptoError(
      'backup_hash_mismatch',
      `Backup hash mismatch. expected=${expectedHash} actual=${actualHash}`,
    )
  }
}

function compareUpdatesForRestore(left: BackupUpdateRecord, right: BackupUpdateRecord): number {
  const createdAtOrder = left.createdAt.localeCompare(right.createdAt)
  if (createdAtOrder !== 0) return createdAtOrder

  const clientOrder = left.clientId.localeCompare(right.clientId)
  if (clientOrder !== 0) return clientOrder

  return left.seq - right.seq
}
