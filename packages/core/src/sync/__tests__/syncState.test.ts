import { BackupCryptoError, type BackupUpdateRecord } from '../backupTypes'
import {
  createBackupQueueState,
  createRestorePlan,
  enqueueBackupUpdate,
  markBackupUploadFailed,
  markBackupUploadStarted,
  markBackupUploadSucceeded,
  shouldCreateBackupSnapshot,
  verifyBackupHash,
} from '../syncState'

const initial = createBackupQueueState({
  documentId: 'document-1',
  clientId: 'client-1',
  now: '2026-06-30T00:00:00.000Z',
})

const queued = enqueueBackupUpdate(initial, {
  updateBlob: new Uint8Array([1, 2, 3]),
  updateHash: 'hash-1',
  now: '2026-06-30T00:00:01.000Z',
})

if (queued.status !== 'pending') {
  throw new Error('Enqueue should mark queue as pending.')
}

if (queued.pending[0]?.seq !== 1 || queued.nextSeq !== 2) {
  throw new Error('Enqueue should assign monotonic client sequence numbers.')
}

const uploading = markBackupUploadStarted(queued, '2026-06-30T00:00:02.000Z')
if (uploading.status !== 'uploading' || uploading.pending[0]?.attempts !== 1) {
  throw new Error('Upload start should increment attempts.')
}

const failed = markBackupUploadFailed(uploading, 'network unavailable', '2026-06-30T00:00:03.000Z')
if (failed.status !== 'failed' || failed.pending[0]?.lastError !== 'network unavailable') {
  throw new Error('Upload failure should keep pending updates with error state.')
}

const retried = markBackupUploadStarted(failed, '2026-06-30T00:00:04.000Z')
if (retried.pending[0]?.attempts !== 2) {
  throw new Error('Retry should increment attempts without dropping pending updates.')
}

const synced = markBackupUploadSucceeded(retried, 1, '2026-06-30T00:00:05.000Z')
if (synced.status !== 'synced' || synced.pending.length !== 0 || synced.lastUploadedSeq !== 1) {
  throw new Error('Successful upload should clear uploaded updates.')
}

const snapshotQueue = enqueueBackupUpdate(
  enqueueBackupUpdate(initial, {
    updateBlob: new Uint8Array([1, 2, 3, 4]),
    updateHash: 'hash-1',
  }),
  {
    updateBlob: new Uint8Array([5, 6, 7, 8]),
    updateHash: 'hash-2',
  },
)

if (!shouldCreateBackupSnapshot(snapshotQueue, {
  maxPendingUpdates: 3,
  maxPendingBytes: 8,
  maxUpdatesSinceSnapshot: 10,
})) {
  throw new Error('Snapshot policy should trigger when pending bytes reach threshold.')
}

const updates: BackupUpdateRecord[] = [
  {
    id: 'update-2',
    documentId: 'document-1',
    clientId: 'client-b',
    seq: 1,
    updateBlob: new Uint8Array([2]),
    updateHash: 'hash-2',
    createdAt: '2026-06-30T00:00:02.000Z',
  },
  {
    id: 'update-1',
    documentId: 'document-1',
    clientId: 'client-a',
    seq: 1,
    updateBlob: new Uint8Array([1]),
    updateHash: 'hash-1',
    createdAt: '2026-06-30T00:00:01.000Z',
  },
]

const restorePlan = createRestorePlan({
  documentId: 'document-1',
  schemaVersion: 1,
  snapshot: new Uint8Array([0]),
  snapshotHash: 'snapshot-hash',
  encrypted: true,
  updatedAt: '2026-06-30T00:00:00.000Z',
}, updates)

if (restorePlan.updates.map((update) => update.id).join(',') !== 'update-1,update-2') {
  throw new Error('Restore plan should replay updates in deterministic order.')
}

try {
  createRestorePlan(null, updates)
  throw new Error('Restore without snapshot should fail.')
} catch (error) {
  if (!(error instanceof BackupCryptoError) || error.code !== 'restore_snapshot_missing') {
    throw error
  }
}

awaitHashCheck().catch((error) => {
  throw error
})

async function awaitHashCheck(): Promise<void> {
  await verifyBackupHash(new Uint8Array([1]), 'ok', () => 'ok')

  try {
    await verifyBackupHash(new Uint8Array([1]), 'expected', () => 'actual')
    throw new Error('Hash mismatch should fail.')
  } catch (error) {
    if (!(error instanceof BackupCryptoError) || error.code !== 'backup_hash_mismatch') {
      throw error
    }
  }
}
