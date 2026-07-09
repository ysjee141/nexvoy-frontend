import type { DocumentEncryptionKey, BackupCryptoProvider } from './encryption'
import { decryptBackupPayload } from './encryption'
import type { BackupSnapshotRecord } from './backupTypes'
import { deserializeEncryptedBackupPayload } from './backupPayloadCodec'
import { verifyBackupHash } from './syncState'

/**
 * Yjs-free restore primitive for Mobile.
 *
 * Unlike `restoreTripDocumentFromBackup` in `restore.ts`, this module never
 * imports `yjsTripDocument`/`yjs`/`lib0` and must remain safely importable
 * from the React Native bundle. It only decrypts and hash-verifies the
 * latest snapshot — it does not replay `document_updates` and does not
 * materialize a `TripDocumentV1`. Updates replay remains the responsibility
 * of `restore.ts` (Web-only for now).
 */
export type MobileRestoreSnapshotKind = 'mobile_marker' | 'opaque'

export interface DecryptRestoreSnapshotInput {
  provider: BackupCryptoProvider
  snapshot: BackupSnapshotRecord
  key: DocumentEncryptionKey
  hash: (bytes: Uint8Array) => Promise<string> | string
}

export interface DecryptRestoreSnapshotResult {
  plaintext: Uint8Array
  kind: MobileRestoreSnapshotKind
}

const MOBILE_BOOTSTRAP_SNAPSHOT_SOURCE = 'mobile_bootstrap'

/**
 * Decrypts a backup snapshot and verifies its hash, then classifies the
 * plaintext as either a mobile bootstrap marker (see
 * `createInitialMobileSnapshotPayload` in `documentBootstrapService.ts`) or
 * an opaque (Web/Yjs-encoded) snapshot that Mobile cannot materialize yet.
 *
 * Throws `BackupCryptoError('backup_decrypt_failed', ...)` or
 * `BackupCryptoError('backup_hash_mismatch', ...)` on failure — callers are
 * responsible for mapping these to safe, generic reason codes and must never
 * surface the raw error message to logs/UX.
 */
export async function decryptRestoreSnapshot(
  input: DecryptRestoreSnapshotInput,
): Promise<DecryptRestoreSnapshotResult> {
  const payload = deserializeEncryptedBackupPayload(input.snapshot.snapshot)
  const plaintext = await decryptBackupPayload(input.provider, payload, input.key)

  await verifyBackupHash(plaintext, input.snapshot.snapshotHash, input.hash)

  return { plaintext, kind: classifySnapshotKind(plaintext) }
}

/**
 * Attempts to JSON.parse the decrypted plaintext to distinguish a mobile
 * bootstrap marker from an opaque (Yjs-encoded) snapshot. Any parse failure
 * (SyntaxError) or shape mismatch is treated as 'opaque' — the exception is
 * intentionally swallowed so raw parse errors never leak to logs/UX.
 */
function classifySnapshotKind(plaintext: Uint8Array): MobileRestoreSnapshotKind {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext))
    if (
      parsed !== null
      && typeof parsed === 'object'
      && !Array.isArray(parsed)
      && (parsed as Record<string, unknown>).source === MOBILE_BOOTSTRAP_SNAPSHOT_SOURCE
    ) {
      return 'mobile_marker'
    }
    return 'opaque'
  } catch {
    return 'opaque'
  }
}
