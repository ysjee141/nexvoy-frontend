import { SAMPLE_TRIP_DOCUMENT_V1 } from '../../local-first/tripDocument'
import {
  createYjsTripDocument,
  encodeTripDocumentUpdate,
  mutateTripDocumentInYjs,
} from '../../local-first/yjsTripDocument'
import { BackupCryptoError, type RestorePlan } from '../backupTypes'
import {
  encryptBackupPayload,
  generateDocumentEncryptionKey,
  type BackupCryptoProvider,
} from '../encryption'
import {
  restoreTripDocumentFromBackup,
  serializeEncryptedBackupPayload,
} from '../restore'

const provider = globalThis.crypto as BackupCryptoProvider

if (!provider?.subtle) {
  throw new Error('Web Crypto provider is required for restore tests.')
}

run().catch((error) => {
  throw error
})

async function run(): Promise<void> {
  const key = await generateDocumentEncryptionKey(provider)
  const snapshotDoc = createYjsTripDocument(SAMPLE_TRIP_DOCUMENT_V1)
  const snapshotUpdate = encodeTripDocumentUpdate(snapshotDoc)

  mutateTripDocumentInYjs(snapshotDoc, (tripDocument) => {
    tripDocument.checklists['checklist-restore'] = {
      id: 'checklist-restore',
      title: 'Restored checklist',
      createdAt: '2026-06-30T00:00:00.000Z',
    }
  })
  const incrementalUpdate = encodeTripDocumentUpdate(snapshotDoc)

  const plan: RestorePlan = {
    documentId: SAMPLE_TRIP_DOCUMENT_V1.trip.id,
    snapshot: {
      documentId: SAMPLE_TRIP_DOCUMENT_V1.trip.id,
      schemaVersion: 1,
      snapshot: serializeEncryptedBackupPayload(await encryptBackupPayload(provider, {
        plaintext: snapshotUpdate,
        key,
        keyVersion: 1,
      })),
      snapshotHash: await hash(snapshotUpdate),
      encrypted: true,
      updatedAt: '2026-06-30T00:00:00.000Z',
    },
    updates: [
      {
        id: 'update-1',
        documentId: SAMPLE_TRIP_DOCUMENT_V1.trip.id,
        clientId: 'client-1',
        seq: 1,
        updateBlob: serializeEncryptedBackupPayload(await encryptBackupPayload(provider, {
          plaintext: incrementalUpdate,
          key,
          keyVersion: 1,
        })),
        updateHash: await hash(incrementalUpdate),
        createdAt: '2026-06-30T00:00:01.000Z',
      },
    ],
  }

  const restored = await restoreTripDocumentFromBackup({ provider, plan, key, hash })
  if (restored?.checklists['checklist-restore']?.title !== 'Restored checklist') {
    throw new Error('Restore should replay snapshot and encrypted updates.')
  }

  const corruptedPlan: RestorePlan = {
    ...plan,
    updates: [{ ...plan.updates[0], updateHash: 'wrong-hash' }],
  }

  try {
    await restoreTripDocumentFromBackup({ provider, plan: corruptedPlan, key, hash })
    throw new Error('Hash mismatch should fail restore.')
  } catch (error) {
    if (!(error instanceof BackupCryptoError) || error.code !== 'backup_hash_mismatch') {
      throw error
    }
  }
}

async function hash(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', toArrayBuffer(bytes))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
