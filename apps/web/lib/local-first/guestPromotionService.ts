import type { SupabaseClient } from '@supabase/supabase-js'
import {
  generateDocumentEncryptionKey,
  generateKeyEncryptionKey,
  encryptBackupPayload,
  wrapDocumentEncryptionKey,
} from '@nexvoy/core/sync/encryption'
import { serializeEncryptedBackupPayload } from '@nexvoy/core/sync/restore'
import { createSupabaseBackupRepository } from '@nexvoy/core/supabase/backupRepository'
import {
  getGuestPromotionDecision,
  markGuestPromotionBackupUploaded,
  promoteTripDocumentOwner,
  type TripDocumentV1,
} from '@nexvoy/core'
import {
  applyTripDocumentUpdate,
  createYjsTripDocument,
  encodeTripDocumentUpdate,
  readTripDocumentFromYjs,
  writeTripDocumentToYjs,
} from '@nexvoy/core/local-first/yjsTripDocument'
import {
  deleteTripDocumentUpdate,
  loadAllTripDocumentUpdates,
  saveTripDocumentUpdate,
} from './indexedDbStore'
import { bootstrapWebDeviceDocumentKey } from './keyProvisioningService'
import {
  getGuestOwnerNamespace,
  removeGuestPromotionMarker,
  saveGuestPromotionMarker,
} from './ownerNamespace'

export interface GuestPromotionResult {
  promoted: number
  conflicts: number
  failed: number
}

let promotionInFlight: Promise<GuestPromotionResult> | null = null

export async function promotePendingGuestDocuments(
  supabase: SupabaseClient,
): Promise<GuestPromotionResult> {
  if (promotionInFlight) return promotionInFlight
  promotionInFlight = promotePendingGuestDocumentsOnce(supabase).finally(() => {
    promotionInFlight = null
  })
  return promotionInFlight
}

async function promotePendingGuestDocumentsOnce(
  supabase: SupabaseClient,
): Promise<GuestPromotionResult> {
  const { data } = await supabase.auth.getUser()
  const authUserId = data.user?.id
  if (!authUserId) return { promoted: 0, conflicts: 0, failed: 0 }

  const guestNamespace = getGuestOwnerNamespace()
  const authNamespace = `user:${authUserId}`
  const rows = await loadAllTripDocumentUpdates(guestNamespace)
  const backupRepository = createSupabaseBackupRepository(supabase)
  const result: GuestPromotionResult = { promoted: 0, conflicts: 0, failed: 0 }

  for (const row of rows) {
    const documentId = row.documentId ?? row.id
    const document = readDocumentFromStoredUpdate(row.update)
    if (!document) continue

    try {
      const decision = getGuestPromotionDecision({
        document,
        authUserId,
        authDocumentExists: await hasCompletedRemoteBackup(backupRepository, documentId, authUserId),
      })

      if (decision.action === 'user_choice_required') {
        saveGuestPromotionMarker({
          documentId,
          status: 'conflict',
          updatedAt: new Date().toISOString(),
          errorCode: decision.reason,
        })
        result.conflicts += 1
        continue
      }

      const promotedDocument = decision.action === 'already_promoted'
        ? document
        : promoteTripDocumentOwner({ document, authUserId })
      await uploadInitialBackupSnapshot(supabase, promotedDocument, authUserId)
      const completedDocument = markGuestPromotionBackupUploaded(promotedDocument)
      await savePromotedDocument(authNamespace, completedDocument)
      await deleteTripDocumentUpdate({ namespace: guestNamespace, documentId })
      removeGuestPromotionMarker(documentId)
      result.promoted += 1
    } catch {
      saveGuestPromotionMarker({
        documentId,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        errorCode: 'promotion_failed',
      })
      result.failed += 1
    }
  }

  return result
}

async function hasCompletedRemoteBackup(
  repository: ReturnType<typeof createSupabaseBackupRepository>,
  documentId: string,
  authUserId: string,
): Promise<boolean> {
  const [hasSnapshot, hasKey] = await Promise.all([
    repository.hasSnapshot(documentId),
    repository.hasDocumentKey({ documentId, userId: authUserId, keyVersion: 1 }),
  ])
  return hasSnapshot && hasKey
}

function readDocumentFromStoredUpdate(update: ArrayBuffer): TripDocumentV1 | null {
  const ydoc = createYjsTripDocument()
  applyTripDocumentUpdate(ydoc, new Uint8Array(update))
  return readTripDocumentFromYjs(ydoc)
}

async function savePromotedDocument(namespace: string, document: TripDocumentV1): Promise<void> {
  const ydoc = createYjsTripDocument(document)
  await saveTripDocumentUpdate(
    { namespace, documentId: document.trip.id },
    encodeTripDocumentUpdate(ydoc),
  )
}

async function uploadInitialBackupSnapshot(
  supabase: SupabaseClient,
  document: TripDocumentV1,
  authUserId: string,
): Promise<void> {
  const provider = getWebCryptoProvider()
  const ydoc = createYjsTripDocument(document)
  const snapshotUpdate = encodeTripDocumentUpdate(ydoc)
  const dek = await generateDocumentEncryptionKey(provider)
  const kek = await generateKeyEncryptionKey(provider)
  const encryptedPayload = await encryptBackupPayload(provider, {
    plaintext: snapshotUpdate,
    key: dek,
    keyVersion: 1,
  })
  const encryptedSnapshot = serializeEncryptedBackupPayload(encryptedPayload)
  const wrappedKey = await wrapDocumentEncryptionKey(provider, dek, kek, 1)
  const repository = createSupabaseBackupRepository(supabase)

  await repository.upsertSnapshot({
    documentId: document.trip.id,
    ownerId: authUserId,
    type: 'trip',
    schemaVersion: document.schemaVersion,
    snapshot: encryptedSnapshot,
    snapshotHash: await sha256Hex(snapshotUpdate),
    encrypted: true,
  })
  await repository.upsertOwnerMember({ documentId: document.trip.id, userId: authUserId })
  await repository.upsertDocumentKey({
    documentId: document.trip.id,
    userId: authUserId,
    wrappedKey,
  })
  await bootstrapWebDeviceDocumentKey({
    supabase,
    documentId: document.trip.id,
    documentKey: dek,
  })
}

function getWebCryptoProvider() {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto is unavailable.')
  }
  return crypto
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}
