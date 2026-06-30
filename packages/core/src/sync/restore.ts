import {
  applyTripDocumentUpdate,
  createYjsTripDocument,
  readTripDocumentFromYjs,
} from '../local-first/yjsTripDocument'
import type { TripDocumentV1 } from '../local-first/documentModel'
import type { DocumentEncryptionKey, BackupCryptoProvider } from './encryption'
import { decryptBackupPayload } from './encryption'
import type { EncryptedBackupPayload, RestorePlan } from './backupTypes'
import { verifyBackupHash } from './syncState'

export interface RestoreTripDocumentInput {
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

async function decryptBackupRecord(
  provider: BackupCryptoProvider,
  ciphertext: Uint8Array,
  key: DocumentEncryptionKey,
): Promise<Uint8Array> {
  const payload = JSON.parse(new TextDecoder().decode(ciphertext)) as SerializedEncryptedBackupPayload

  return decryptBackupPayload(provider, {
    algorithm: payload.algorithm,
    keyVersion: payload.keyVersion,
    iv: decodeBase64(payload.iv),
    ciphertext: decodeBase64(payload.ciphertext),
  }, key)
}

export function serializeEncryptedBackupPayload(payload: EncryptedBackupPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({
    algorithm: payload.algorithm,
    keyVersion: payload.keyVersion,
    iv: encodeBase64(payload.iv),
    ciphertext: encodeBase64(payload.ciphertext),
  } satisfies SerializedEncryptedBackupPayload))
}

interface SerializedEncryptedBackupPayload {
  algorithm: EncryptedBackupPayload['algorithm']
  keyVersion: number
  iv: string
  ciphertext: string
}

function encodeBase64(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return globalThis.btoa(binary)
}

function decodeBase64(value: string): Uint8Array {
  const binary = globalThis.atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}
