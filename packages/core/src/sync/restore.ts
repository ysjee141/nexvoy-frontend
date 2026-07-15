import {
  applyTripDocumentUpdate,
  createYjsTripDocument,
  readTripDocumentFromYjs,
} from '../local-first/yjsTripDocument'
import type { TripDocumentV1 } from '../local-first/documentModel'
import {
  applyTemplateDocumentUpdate,
  createYjsTemplateDocument,
  readTemplateDocumentFromYjs,
  type TemplateDocumentV1,
} from '../local-first/templateDocument'
import type { DocumentEncryptionKey, BackupCryptoProvider } from './encryption'
import { decryptBackupPayload } from './encryption'
import type { RestorePlan } from './backupTypes'
import { verifyBackupHash } from './syncState'
import { deserializeEncryptedBackupPayload, serializeEncryptedBackupPayload } from './backupPayloadCodec'

export { serializeEncryptedBackupPayload }

export interface RestoreTripDocumentInput {
  provider: BackupCryptoProvider
  plan: RestorePlan
  key: DocumentEncryptionKey
  hash: (bytes: Uint8Array) => Promise<string> | string
}

export interface RestoreTemplateDocumentInput {
  provider: BackupCryptoProvider
  plan: RestorePlan
  key: DocumentEncryptionKey
  hash: (bytes: Uint8Array) => Promise<string> | string
}

export async function restoreTripDocumentFromBackup(
  input: RestoreTripDocumentInput,
): Promise<TripDocumentV1 | null> {
  const ydoc = createYjsTripDocument()
  const snapshotUpdate = await decryptBackupRecord(input.provider, input.plan.snapshot.snapshot, input.key)

  await verifyBackupHash(snapshotUpdate, input.plan.snapshot.snapshotHash, input.hash)
  applyTripDocumentUpdate(ydoc, snapshotUpdate)

  for (const update of input.plan.updates) {
    const decryptedUpdate = await decryptBackupRecord(input.provider, update.updateBlob, input.key)
    await verifyBackupHash(decryptedUpdate, update.updateHash, input.hash)
    applyTripDocumentUpdate(ydoc, decryptedUpdate)
  }

  return readTripDocumentFromYjs(ydoc)
}

export async function restoreTemplateDocumentFromBackup(
  input: RestoreTemplateDocumentInput,
): Promise<TemplateDocumentV1 | null> {
  const ydoc = createYjsTemplateDocument()
  const snapshotUpdate = await decryptBackupRecord(input.provider, input.plan.snapshot.snapshot, input.key)

  await verifyBackupHash(snapshotUpdate, input.plan.snapshot.snapshotHash, input.hash)
  applyTemplateDocumentUpdate(ydoc, snapshotUpdate)

  for (const update of input.plan.updates) {
    const decryptedUpdate = await decryptBackupRecord(input.provider, update.updateBlob, input.key)
    await verifyBackupHash(decryptedUpdate, update.updateHash, input.hash)
    applyTemplateDocumentUpdate(ydoc, decryptedUpdate)
  }

  return readTemplateDocumentFromYjs(ydoc)
}

async function decryptBackupRecord(
  provider: BackupCryptoProvider,
  ciphertext: Uint8Array,
  key: DocumentEncryptionKey,
): Promise<Uint8Array> {
  const payload = deserializeEncryptedBackupPayload(ciphertext)

  return decryptBackupPayload(provider, payload, key)
}
