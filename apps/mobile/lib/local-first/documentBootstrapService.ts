import type { SupabaseClient } from '@supabase/supabase-js'
import { subtle, randomFillSync } from 'react-native-quick-crypto'
import {
  generateDocumentEncryptionKey,
  encryptBackupPayload,
  type BackupCryptoProvider,
} from '@nexvoy/core/sync/encryption'
import type { EncryptedBackupPayload } from '@nexvoy/core/sync/backupTypes'
import { createSupabaseBackupRepository } from '@nexvoy/core/supabase/backupRepository'
import { TRIP_DOCUMENT_SCHEMA_VERSION } from '@nexvoy/core/local-first/documentModel'
import { bootstrapMobileDeviceDocumentKey } from './keyProvisioningService'

// Document key version must match the value in keyProvisioningService.ts
const DOCUMENT_KEY_VERSION = 1

function getMobileBackupCryptoProvider(): BackupCryptoProvider {
  return {
    subtle: subtle as unknown as BackupCryptoProvider['subtle'],
    getRandomValues: <T extends Uint8Array>(array: T): T => randomFillSync(array) as T,
  }
}

/**
 * Creates a minimal initial snapshot payload for mobile bootstrap.
 *
 * Mobile does not use the Yjs document pipeline (Yjs/lib0 requires
 * isomorphic-webcrypto which is not available in the React Native bundle).
 * Instead, we produce a minimal JSON marker that can later be superseded by
 * a proper Yjs-encoded snapshot when the mobile app adopts full backup sync.
 */
function createInitialMobileSnapshotPayload(documentId: string): Uint8Array {
  const marker = JSON.stringify({
    schemaVersion: TRIP_DOCUMENT_SCHEMA_VERSION,
    documentId,
    source: 'mobile_bootstrap',
  })
  return new TextEncoder().encode(marker)
}

/**
 * Ensures the mobile owner device has a document-scoped RSA key row.
 *
 * Handles three scenarios:
 * 1. No snapshot exists (first creation): generates DEK, creates encrypted
 *    snapshot, registers owner member, bootstraps device-scoped RSA key.
 * 2. Snapshot exists, caller owns it, and no document_keys row exists for
 *    anyone yet: a previous bootstrap attempt was interrupted after the
 *    snapshot was written but before the device key was persisted. Safe to
 *    regenerate, since the mobile snapshot payload is a disposable
 *    placeholder marker (see `createInitialMobileSnapshotPayload`), not real
 *    document content.
 * 3. Snapshot exists and either the caller doesn't own it or a document_keys
 *    row already exists elsewhere: another device or web must provision;
 *    throws 'owner_device_key_unavailable' so the caller can surface
 *    appropriate UX.
 *
 * Is a no-op if a valid RSA-OAEP-256 key already exists for this device.
 *
 * Security: DEK/snapshot plaintext must never appear in logs or analytics.
 * Only generic reason codes are emitted to observability.
 */
export async function ensureMobileOwnerDocumentKey({
  supabase,
  documentId,
}: {
  supabase: SupabaseClient
  documentId: string
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return // Unauthenticated — skip silently

  const backupRepository = createSupabaseBackupRepository(supabase)

  // Check if this device already has a device-scoped RSA key — no-op if so.
  const activeKey = await backupRepository.getMyActiveDocumentKey({
    documentId,
    keyVersion: DOCUMENT_KEY_VERSION,
  })
  if (activeKey?.wrappingAlg === 'RSA-OAEP-256') return

  // Check whether an encrypted snapshot exists for this document.
  const hasSnapshot = await backupRepository.hasSnapshot(documentId)

  if (hasSnapshot) {
    const isOwner = await isCurrentUserDocumentOwner(supabase, documentId)
    const anyKeyExists = isOwner && (await documentHasAnyKey(supabase, documentId))
    if (!isOwner || anyKeyExists) {
      // Either this caller isn't the owner, or a working wrapped key already
      // exists elsewhere. The DEK can only be unwrapped by a device/web
      // session that already has it — throw a safe reason code so the caller
      // can surface appropriate UX rather than minting a second, divergent DEK.
      throw new Error('owner_device_key_unavailable')
    }
    // Owner's own document with a stranded snapshot and no key anywhere —
    // fall through to (re)bootstrap from scratch.
  }

  await bootstrapOwnerDocument({ supabase, backupRepository, documentId, userId: user.id })
}

async function isCurrentUserDocumentOwner(
  supabase: SupabaseClient,
  documentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('documents')
    .select('owner_id')
    .eq('id', documentId)
    .maybeSingle()
  if (error) throw error
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return Boolean(data?.owner_id && user && data.owner_id === user.id)
}

async function documentHasAnyKey(supabase: SupabaseClient, documentId: string): Promise<boolean> {
  // RLS grants the document owner full SELECT visibility over document_keys
  // rows for a document they own, regardless of which user/device wrote them.
  const { data, error } = await supabase
    .from('document_keys')
    .select('id')
    .eq('document_id', documentId)
    .is('revoked_at', null)
    .limit(1)
  if (error) throw error
  return Boolean(data?.length)
}

async function bootstrapOwnerDocument({
  supabase,
  backupRepository,
  documentId,
  userId,
}: {
  supabase: SupabaseClient
  backupRepository: ReturnType<typeof createSupabaseBackupRepository>
  documentId: string
  userId: string
}): Promise<void> {
  const cryptoProvider = getMobileBackupCryptoProvider()
  const snapshotPayload = createInitialMobileSnapshotPayload(documentId)

  const dek = await generateDocumentEncryptionKey(cryptoProvider)
  const encryptedPayload = await encryptBackupPayload(cryptoProvider, {
    plaintext: snapshotPayload,
    key: dek,
    keyVersion: DOCUMENT_KEY_VERSION,
  })
  const encryptedSnapshot = serializeMobileEncryptedBackupPayload(encryptedPayload)
  const snapshotHash = await sha256Hex(snapshotPayload)

  // upsertSnapshot MUST precede upsertOwnerMember: the "Insert documents as
  // owner" RLS policy only requires owner_id = auth.uid(), but the
  // "Insert document_members" policy requires check_is_document_owner(), which
  // in turn requires documents.owner_id to already be set. Writing the
  // documents row first establishes ownership for the member insert.
  await backupRepository.upsertSnapshot({
    documentId,
    ownerId: userId,
    type: 'trip',
    schemaVersion: TRIP_DOCUMENT_SCHEMA_VERSION,
    snapshot: encryptedSnapshot,
    snapshotHash,
    encrypted: true,
  })
  await backupRepository.upsertOwnerMember({ documentId, userId })

  // Store the DEK wrapped with this device's non-exportable RSA public key.
  await bootstrapMobileDeviceDocumentKey({ supabase, documentId, documentKey: dek })
}

/**
 * Serializes an encrypted backup payload to a Uint8Array using the same
 * JSON envelope format as `serializeEncryptedBackupPayload` in core/sync/restore.
 *
 * Inlined here to avoid importing from `@nexvoy/core/sync/restore`, which
 * transitively depends on Yjs/lib0 and is incompatible with the React Native bundle.
 */
function serializeMobileEncryptedBackupPayload(payload: EncryptedBackupPayload): Uint8Array {
  const encoded = JSON.stringify({
    algorithm: payload.algorithm,
    keyVersion: payload.keyVersion,
    iv: encodeBase64(payload.iv),
    ciphertext: encodeBase64(payload.ciphertext),
  })
  return new TextEncoder().encode(encoded)
}

function encodeBase64(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return globalThis.btoa(binary)
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
