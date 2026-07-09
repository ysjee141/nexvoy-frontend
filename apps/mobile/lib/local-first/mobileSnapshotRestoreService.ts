import type { SupabaseClient } from '@supabase/supabase-js'
import { subtle } from 'react-native-quick-crypto'
import { BackupCryptoError } from '@nexvoy/core/sync/backupTypes'
import type { DocumentEncryptionKey } from '@nexvoy/core/sync/encryption'
import { decryptRestoreSnapshot, type MobileRestoreSnapshotKind } from '@nexvoy/core/sync/mobileRestore'
import { createSupabaseBackupRepository, type SupabaseBackupRepository } from '@nexvoy/core/supabase/backupRepository'
import { logLocalFirstEvent } from '@/lib/observability'
import { getOrCreateMobileDeviceId } from './mobileDeviceIdentity'
import { getMobileBackupCryptoProvider } from './documentBootstrapService'
import { bootstrapMobileDeviceDocumentKey, getCurrentMobileDocumentKey } from './keyProvisioningService'

// Document key version must match the value in keyProvisioningService.ts /
// documentBootstrapService.ts.
const DOCUMENT_KEY_VERSION = 1

export type MobileRestoreOutcome =
  | { status: 'restored'; snapshotKind: MobileRestoreSnapshotKind }
  | { status: 'skipped'; reason: 'no_snapshot' | 'key_unavailable' }
  | { status: 'failed'; reason: 'hash_mismatch' | 'decrypt_failed' | 'unknown' }

/**
 * Mobile-only restore orchestration: decrypts and hash-verifies the latest
 * encrypted snapshot for `documentId` using this device's DEK, then ensures
 * this device has its own RSA-wrapped key row.
 *
 * This is a Yjs-free, read/verify-only operation — it never applies content
 * to a Yjs document and never mutates
 * `document_key_provisioning_requests` status. Restore failures are always
 * safe to retry (no server-side "failed" row is written) and never affect
 * the caller's provisioning outcome.
 *
 * Security: DEK/plaintext/raw error messages must never reach logs, UX, or
 * observability. Only generic reason codes are emitted.
 */
export async function restoreMobileEncryptedSnapshot({
  supabase,
  documentId,
}: {
  supabase: SupabaseClient
  documentId: string
}): Promise<MobileRestoreOutcome> {
  const outcome = await computeRestoreOutcome({ supabase, documentId })
  await emitRestoreEvent(outcome)
  return outcome
}

async function computeRestoreOutcome({
  supabase,
  documentId,
}: {
  supabase: SupabaseClient
  documentId: string
}): Promise<MobileRestoreOutcome> {
  try {
    const backupRepository = createSupabaseBackupRepository(supabase)

    const hasSnapshot = await backupRepository.hasSnapshot(documentId)
    if (!hasSnapshot) return { status: 'skipped', reason: 'no_snapshot' }

    const deviceId = await getOrCreateMobileDeviceId()

    let documentKey: DocumentEncryptionKey | null
    try {
      documentKey = await getCurrentMobileDocumentKey({ supabase, documentId, deviceId })
    } catch {
      // Key retrieval must never surface a raw error — treat as unavailable
      // so the caller's normal provisioning retry loop can pick it up later.
      documentKey = null
    }
    if (!documentKey) return { status: 'skipped', reason: 'key_unavailable' }

    const snapshot = await backupRepository.getLatestSnapshot(documentId)
    if (!snapshot) return { status: 'skipped', reason: 'no_snapshot' }

    let outcome: MobileRestoreOutcome
    try {
      const result = await decryptRestoreSnapshot({
        provider: getMobileBackupCryptoProvider(),
        snapshot,
        key: documentKey,
        hash: sha256Hex,
      })
      outcome = { status: 'restored', snapshotKind: result.kind }
    } catch (error) {
      outcome = { status: 'failed', reason: mapRestoreErrorReason(error) }
    }

    if (outcome.status === 'restored') {
      await ensureOwnDeviceKeyRow({ supabase, backupRepository, documentId, deviceId, documentKey })
    }

    return outcome
  } catch {
    // Any unexpected failure (network, RPC, etc.) must resolve to a safe
    // outcome rather than throwing — the caller chains this after
    // provisioning and must never crash the trip screen.
    return { status: 'failed', reason: 'unknown' }
  }
}

function mapRestoreErrorReason(error: unknown): 'hash_mismatch' | 'decrypt_failed' | 'unknown' {
  if (error instanceof BackupCryptoError) {
    if (error.code === 'backup_hash_mismatch') return 'hash_mismatch'
    if (error.code === 'backup_decrypt_failed') return 'decrypt_failed'
  }
  return 'unknown'
}

/**
 * Defensive re-check: `getCurrentMobileDocumentKey` succeeding usually
 * implies this device already has its own device-scoped RSA key row, but
 * the legacy SecureStore fallback path can unwrap a *user-scoped* legacy key
 * without this device ever having registered its own row. Bootstrapping is
 * a no-op-safe upsert, so it is safe to call defensively here.
 */
async function ensureOwnDeviceKeyRow({
  supabase,
  backupRepository,
  documentId,
  deviceId,
  documentKey,
}: {
  supabase: SupabaseClient
  backupRepository: SupabaseBackupRepository
  documentId: string
  deviceId: string
  documentKey: DocumentEncryptionKey
}): Promise<void> {
  try {
    const ownKey = await backupRepository.getMyActiveDocumentKey({
      documentId,
      deviceId,
      keyVersion: DOCUMENT_KEY_VERSION,
    })
    if (ownKey?.wrappingAlg === 'RSA-OAEP-256') return

    await bootstrapMobileDeviceDocumentKey({ supabase, documentId, documentKey })
  } catch {
    // Best-effort: restore itself already succeeded, so a failure here must
    // not be surfaced as a restore failure.
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy bytes into a fresh ArrayBuffer to avoid shared-buffer issues on RN.
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const digest = await (subtle as unknown as Pick<SubtleCrypto, 'digest'>).digest(
    'SHA-256',
    buffer,
  )
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Emits a generic, PII-free observability event for the restore outcome.
 * `skipped` outcomes (no_snapshot/key_unavailable) are intentionally not
 * logged — no_snapshot is the common case for freshly created documents and
 * key_unavailable is already covered by the provisioning event stream, so
 * logging every restore attempt for these would be noisy without adding
 * signal (see 01b_ux_design.md §0).
 */
async function emitRestoreEvent(outcome: MobileRestoreOutcome): Promise<void> {
  if (outcome.status === 'restored') {
    await logLocalFirstEvent('local_first_restore_completed', {
      document_type: 'trip',
      entity_type: 'document',
      operation: 'restored',
      status: 'completed',
      reason_code: outcome.snapshotKind,
    })
    return
  }

  if (outcome.status === 'failed') {
    await logLocalFirstEvent('local_first_backup_failed', {
      document_type: 'trip',
      entity_type: 'document',
      operation: 'restored',
      status: 'failed',
      reason_code: outcome.reason,
    })
  }
}
