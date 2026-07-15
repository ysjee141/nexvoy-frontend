import type { SupabaseClient } from '@supabase/supabase-js'
import { subtle, randomFillSync } from 'react-native-quick-crypto'
import {
  generateDocumentEncryptionKey,
  encryptBackupPayload,
  type BackupCryptoProvider,
} from '@nexvoy/core/sync/encryption'
import { serializeEncryptedBackupPayload } from '@nexvoy/core/sync/backupPayloadCodec'
import { createSupabaseBackupRepository } from '@nexvoy/core/supabase/backupRepository'
import { TRIP_DOCUMENT_SCHEMA_VERSION } from '@nexvoy/core/local-first/documentModel'
import { createEmptyTripDocumentV1 } from '@nexvoy/core/local-first/tripDocument'
import type { BackupDocumentType } from '@nexvoy/core/sync/backupTypes'
import { bootstrapMobileDeviceDocumentKey } from './keyProvisioningService'
import {
  createMobileYjsTripDocument,
  encodeMobileTripDocumentUpdate,
  saveMobileTripDocumentUpdate,
} from './mobileYjsTripDocument'

// Document key version must match the value in keyProvisioningService.ts
const DOCUMENT_KEY_VERSION = 1

export interface EnsureMobileOwnerDocumentKeyForSnapshotInput {
  supabase: SupabaseClient
  documentId: string
  documentType: BackupDocumentType
  schemaVersion: number
  snapshotPayload: Uint8Array
}

export function getMobileBackupCryptoProvider(): BackupCryptoProvider {
  return {
    subtle: subtle as unknown as BackupCryptoProvider['subtle'],
    getRandomValues: <T extends Uint8Array>(array: T): T => randomFillSync(array) as T,
  }
}

/**
 * Creates a minimal initial Yjs snapshot payload for mobile bootstrap.
 * The values are intentionally sparse until the normal document hydration
 * path supplies full trip content, but the encoded format is already the same
 * canonical Yjs update used by Web.
 */
function createInitialMobileSnapshotPayload(documentId: string, userId: string): Uint8Array {
  const createdAt = new Date(0).toISOString()
  const document = createEmptyTripDocumentV1({
    id: documentId,
    ownerId: userId,
    destination: '',
    startDate: '',
    endDate: '',
    adultsCount: 1,
    childrenCount: 0,
    createdAt,
  })
  return encodeMobileTripDocumentUpdate(createMobileYjsTripDocument(document))
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
 *    regenerate because no wrapped key exists anywhere, so no other client
 *    can decrypt the stranded snapshot.
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
  await backupRepository.ensureDocumentBootstrapped({
    documentId,
    type: 'trip',
    schemaVersion: TRIP_DOCUMENT_SCHEMA_VERSION,
  })

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

  await bootstrapOwnerDocument({
    supabase,
    backupRepository,
    documentId,
    userId: user.id,
    documentType: 'trip',
    schemaVersion: TRIP_DOCUMENT_SCHEMA_VERSION,
    snapshotPayload: createInitialMobileSnapshotPayload(documentId, user.id),
  })
}

export async function ensureMobileOwnerDocumentKeyForSnapshot({
  supabase,
  documentId,
  documentType,
  schemaVersion,
  snapshotPayload,
}: EnsureMobileOwnerDocumentKeyForSnapshotInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('인증 정보가 없습니다.')

  const backupRepository = createSupabaseBackupRepository(supabase)
  await backupRepository.ensureDocumentBootstrapped({
    documentId,
    type: documentType,
    schemaVersion,
  })

  const activeKey = await backupRepository.getMyActiveDocumentKey({
    documentId,
    keyVersion: DOCUMENT_KEY_VERSION,
  })
  if (activeKey?.wrappingAlg === 'RSA-OAEP-256') return

  const hasSnapshot = await backupRepository.hasSnapshot(documentId)
  if (hasSnapshot) {
    const isOwner = await isCurrentUserDocumentOwner(supabase, documentId)
    const anyKeyExists = isOwner && (await documentHasAnyKey(supabase, documentId))
    if (!isOwner || anyKeyExists) {
      throw new Error('owner_device_key_unavailable')
    }
  }

  await bootstrapOwnerDocument({
    supabase,
    backupRepository,
    documentId,
    userId: user.id,
    documentType,
    schemaVersion,
    snapshotPayload,
  })
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
  documentType,
  schemaVersion,
  snapshotPayload,
}: {
  supabase: SupabaseClient
  backupRepository: ReturnType<typeof createSupabaseBackupRepository>
  documentId: string
  userId: string
  documentType: BackupDocumentType
  schemaVersion: number
  snapshotPayload: Uint8Array
}): Promise<void> {
  const cryptoProvider = getMobileBackupCryptoProvider()

  const dek = await generateDocumentEncryptionKey(cryptoProvider)
  const encryptedPayload = await encryptBackupPayload(cryptoProvider, {
    plaintext: snapshotPayload,
    key: dek,
    keyVersion: DOCUMENT_KEY_VERSION,
  })
  const encryptedSnapshot = serializeEncryptedBackupPayload(encryptedPayload)
  const snapshotHash = await sha256Hex(snapshotPayload)

  await backupRepository.ensureDocumentBootstrapped({
    documentId,
    type: documentType,
    schemaVersion,
  })
  await backupRepository.upsertSnapshot({
    documentId,
    schemaVersion,
    snapshot: encryptedSnapshot,
    snapshotHash,
    encrypted: true,
  })
  if (documentType === 'trip') {
    await saveMobileTripDocumentUpdate({ documentId }, snapshotPayload)
  }

  // Store the DEK wrapped with this device's non-exportable RSA public key.
  await bootstrapMobileDeviceDocumentKey({ supabase, documentId, documentKey: dek })
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
