import type { SupabaseClient } from '@supabase/supabase-js'
import {
  encryptBackupPayload,
  generateDocumentEncryptionKey,
  unwrapDocumentEncryptionKeyWithRsaOaep,
  wrapDocumentEncryptionKeyWithRsaOaep,
  type DocumentEncryptionKey,
  type RsaOaepWrappingProvider,
} from '@nexvoy/core/sync/encryption'
import { serializeEncryptedBackupPayload } from '@nexvoy/core/sync/backupPayloadCodec'
import { BackupCryptoError } from '@nexvoy/core/sync/backupTypes'
import {
  type DocumentKeyProvisioningRequest,
  type SafeKeyProvisioningErrorCode,
} from '@nexvoy/core/sync/keyProvisioning'
import { createInvitationRepository } from '@nexvoy/core/supabase/invitationRepository'
import { createSupabaseBackupRepository } from '@nexvoy/core/supabase/backupRepository'
import { TRIP_DOCUMENT_SCHEMA_VERSION, type TripDocumentV1 } from '@nexvoy/core/local-first/documentModel'
import { createYjsTripDocument, encodeTripDocumentUpdate } from '@nexvoy/core/local-first/yjsTripDocument'
import type { BackupDocumentType } from '@nexvoy/core/sync/backupTypes'
import { analytics } from '@/services/AnalyticsService'
import { deleteWebDeviceKeyMaterial, loadWebDeviceKeyMaterial, saveWebDeviceKeyMaterial } from './indexedDbStore'
import {
  createWebRsaOaepWrappingProvider,
  generateWebRsaOaepKeyMaterial,
  getWebBackupCryptoProvider,
} from './webCryptoProvider'

export interface RunWebKeyProvisioningInput {
  supabase: SupabaseClient
  documentId?: string | null
  documentKey?: DocumentEncryptionKey
  limit?: number
  provider?: RsaOaepWrappingProvider
}

export interface WebKeyProvisioningResult {
  processed: number
  completed: number
  failed: number
  skipped: number
  errorCode?: SafeKeyProvisioningErrorCode
}

export interface BootstrapWebDeviceDocumentKeyInput {
  supabase: SupabaseClient
  documentId: string
  documentKey: DocumentEncryptionKey
  provider?: RsaOaepWrappingProvider
}

export interface EnsureWebOwnerDocumentKeyInput {
  supabase: SupabaseClient
  document: TripDocumentV1
  ownerId: string
}

export interface EnsureWebOwnerDocumentKeyForSnapshotInput {
  supabase: SupabaseClient
  documentId: string
  ownerId: string
  documentType: BackupDocumentType
  schemaVersion: number
  snapshotPayload: Uint8Array
}

export interface EnsureWebDocumentKeyReadinessInput {
  supabase: SupabaseClient
  documentId: string
  role: 'owner' | 'editor' | 'viewer' | null
}

const WEB_DEVICE_ID_STORAGE_KEY = 'onvoy.localFirst.webDeviceId'
const KEY_MATERIAL_VERSION = 1

export function getOrCreateWebDeviceId(): string {
  if (typeof window === 'undefined') return 'web-server'
  const existing = window.localStorage.getItem(WEB_DEVICE_ID_STORAGE_KEY)
  if (existing) return existing

  const deviceId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `web:${crypto.randomUUID()}`
    : `web:${Date.now()}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(WEB_DEVICE_ID_STORAGE_KEY, deviceId)
  return deviceId
}

export async function ensureWebDeviceKeyMaterial(
  supabase: SupabaseClient,
): Promise<{ deviceId: string; materialVersion: number }> {
  const deviceId = getOrCreateWebDeviceId()
  const existing = await loadWebDeviceKeyMaterial(deviceId)
  const material = existing ?? {
    deviceId,
    materialVersion: KEY_MATERIAL_VERSION,
    ...(await generateWebRsaOaepKeyMaterial()),
  }

  if (!existing) {
    await saveWebDeviceKeyMaterial(material)
  }

  const registration = await createInvitationRepository(supabase).registerUserKeyMaterial({
    deviceId,
    publicKeyJwk: material.publicKeyJwk,
    materialVersion: material.materialVersion,
  })

  return {
    deviceId,
    materialVersion: registration.materialVersion,
  }
}

export async function getCurrentWebDocumentKey(input: {
  supabase: SupabaseClient
  documentId: string
  deviceId?: string
  provider?: RsaOaepWrappingProvider
}): Promise<DocumentEncryptionKey | null> {
  const deviceId = input.deviceId ?? getOrCreateWebDeviceId()
  const [material, activeKey] = await Promise.all([
    loadWebDeviceKeyMaterial(deviceId),
    createSupabaseBackupRepository(input.supabase).getMyActiveDocumentKey({
      documentId: input.documentId,
      deviceId,
      keyVersion: KEY_MATERIAL_VERSION,
    }),
  ])

  if (!material || !activeKey || activeKey.wrappingAlg !== 'RSA-OAEP-256') return null

  return unwrapDocumentEncryptionKeyWithRsaOaep(input.provider ?? createWebRsaOaepWrappingProvider(), {
    wrappedKey: {
      algorithm: activeKey.wrappingAlg,
      keyVersion: activeKey.keyVersion,
      wrappedDek: activeKey.wrappedDek,
    },
    privateKeyJwk: material.privateKeyJwk,
  })
}

export async function bootstrapWebDeviceDocumentKey(
  input: BootstrapWebDeviceDocumentKeyInput,
): Promise<void> {
  const provider = input.provider ?? createWebRsaOaepWrappingProvider()
  const { deviceId } = await ensureWebDeviceKeyMaterial(input.supabase)
  const material = await loadWebDeviceKeyMaterial(deviceId)
  if (!material) throw new Error('web_device_material_unavailable')

  const wrappedKey = await wrapDocumentEncryptionKeyWithRsaOaep(provider, {
    dek: input.documentKey,
    publicKeyJwk: material.publicKeyJwk,
    keyVersion: material.materialVersion,
  })

  await createSupabaseBackupRepository(input.supabase).upsertDocumentKey({
    documentId: input.documentId,
    userId: '',
    deviceId,
    materialVersion: material.materialVersion,
    wrappedKey,
  })
}

export async function ensureWebOwnerDocumentKey(
  input: EnsureWebOwnerDocumentKeyInput,
): Promise<void> {
  const snapshotPayload = encodeTripDocumentUpdate(createYjsTripDocument(input.document))
  return ensureWebOwnerDocumentKeyForSnapshot({
    supabase: input.supabase,
    documentId: input.document.trip.id,
    ownerId: input.ownerId,
    documentType: 'trip',
    schemaVersion: TRIP_DOCUMENT_SCHEMA_VERSION,
    snapshotPayload,
  })
}

export async function ensureWebOwnerDocumentKeyForSnapshot(
  input: EnsureWebOwnerDocumentKeyForSnapshotInput,
): Promise<void> {
  const repository = createSupabaseBackupRepository(input.supabase)
  const { deviceId } = await ensureWebDeviceKeyMaterial(input.supabase)
  const activeKey = await repository.getMyActiveDocumentKey({
    documentId: input.documentId,
    deviceId,
    keyVersion: KEY_MATERIAL_VERSION,
  })
  if (activeKey?.wrappingAlg === 'RSA-OAEP-256') return

  const hasRemoteBackupPayload = await documentHasRemoteBackupPayload(input.supabase, input.documentId)
  if (hasRemoteBackupPayload && await documentHasAnyActiveKey(input.supabase, input.documentId)) {
    throw new Error('owner_device_key_unavailable')
  }

  const provider = getWebBackupCryptoProvider()
  const documentKey = await generateDocumentEncryptionKey(provider)
  const encryptedPayload = await encryptBackupPayload(provider, {
    plaintext: input.snapshotPayload,
    key: documentKey,
    keyVersion: KEY_MATERIAL_VERSION,
  })

  await repository.upsertSnapshot({
    documentId: input.documentId,
    ownerId: input.ownerId,
    type: input.documentType,
    schemaVersion: input.schemaVersion,
    snapshot: serializeEncryptedBackupPayload(encryptedPayload),
    snapshotHash: await sha256Hex(input.snapshotPayload),
    encrypted: true,
  })
  await repository.upsertOwnerMember({
    documentId: input.documentId,
    userId: input.ownerId,
  })
  await bootstrapWebDeviceDocumentKey({
    supabase: input.supabase,
    documentId: input.documentId,
    documentKey,
  })
}

export async function ensureWebDocumentKeyReadiness(
  input: EnsureWebDocumentKeyReadinessInput,
): Promise<WebKeyProvisioningResult | null> {
  if (!input.role) return null
  const { deviceId } = await ensureWebDeviceKeyMaterial(input.supabase)
  const documentKey = await getCurrentWebDocumentKeyOrRecoverStaleDeviceKey({
    supabase: input.supabase,
    documentId: input.documentId,
    deviceId,
  })
  if (documentKey) return null

  if (input.role === 'owner') {
    return runWebForegroundKeyProvisioning({
      supabase: input.supabase,
      documentId: input.documentId,
      limit: 25,
    })
  }

  const repository = createInvitationRepository(input.supabase)
  const status = await repository.getMyDocumentKeyProvisioningStatus({
    documentId: input.documentId,
    deviceId,
    keyVersion: KEY_MATERIAL_VERSION,
  })
  if (status.status === 'completed' || !status.retryable) return null

  await repository.requestDocumentKeyProvisioning({
    documentId: input.documentId,
    deviceId,
    keyVersion: KEY_MATERIAL_VERSION,
  })
  emitProvisioningEvent('document_key_provisioning_pending', {
    status: 'pending',
    reason_code: 'member_device_key_requested',
    pending_count: 1,
  })

  return null
}

export async function getCurrentWebDocumentKeyOrRecoverStaleDeviceKey(input: {
  supabase: SupabaseClient
  documentId: string
  deviceId: string
  provider?: RsaOaepWrappingProvider
}): Promise<DocumentEncryptionKey | null> {
  try {
    return await getCurrentWebDocumentKey(input)
  } catch (error) {
    if (!isKeyUnwrapFailure(error)) throw error
    await resetStaleWebDeviceKey(input.supabase, input.deviceId)
    return null
  }
}

async function resetStaleWebDeviceKey(
  supabase: SupabaseClient,
  deviceId: string,
): Promise<void> {
  const repository = createInvitationRepository(supabase)
  await repository.revokeUserKeyMaterial({
    deviceId,
    materialVersion: KEY_MATERIAL_VERSION,
  })
  await deleteWebDeviceKeyMaterial(deviceId)
  await ensureWebDeviceKeyMaterial(supabase)
  emitProvisioningEvent('document_key_provisioning_pending', {
    status: 'pending',
    reason_code: 'stale_device_key_reset',
    pending_count: 1,
  })
}

function isKeyUnwrapFailure(error: unknown): boolean {
  return error instanceof BackupCryptoError && error.code === 'key_unwrap_failed'
}

export async function runWebForegroundKeyProvisioning(
  input: RunWebKeyProvisioningInput,
): Promise<WebKeyProvisioningResult> {
  const repository = createInvitationRepository(input.supabase)
  const provider = input.provider ?? createWebRsaOaepWrappingProvider()
  const requests = await repository.listPendingDocumentKeyProvisioningRequests({
    documentId: input.documentId ?? null,
    limit: input.limit ?? 25,
  })

  const result: WebKeyProvisioningResult = {
    processed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  }
  const documentKey = input.documentKey ?? (input.documentId
    ? await getCurrentWebDocumentKeyOrRecoverStaleDeviceKey({
      supabase: input.supabase,
      documentId: input.documentId,
      deviceId: getOrCreateWebDeviceId(),
      provider,
    })
    : null)

  if (!documentKey) {
    emitProvisioningEvent('document_key_provisioning_pending', {
      status: 'skipped',
      reason_code: 'owner_device_key_unavailable',
      pending_count: requests.length,
    })
    return {
      ...result,
      skipped: requests.length,
      errorCode: 'owner_device_key_unavailable',
    }
  }

  for (const request of requests) {
    result.processed += 1
    try {
      const begun = await repository.beginDocumentKeyProvisioning(request.id)
      if (begun.status !== 'processing' || !('publicKeyJwk' in begun)) {
        result.skipped += 1
        continue
      }

      const wrappedKey = await wrapDocumentEncryptionKeyWithRsaOaep(provider, {
        dek: documentKey,
        publicKeyJwk: begun.publicKeyJwk,
        keyVersion: begun.keyVersion,
      })

      await repository.completeDocumentKeyProvisioning({
        requestId: request.id,
        wrappedDek: wrappedKey.wrappedDek,
        wrappingAlg: 'RSA-OAEP-256',
        keyVersion: wrappedKey.keyVersion,
      })
      result.completed += 1
    } catch {
      await markProvisioningFailed(repository, request, 'wrap_failed')
      result.failed += 1
    }
  }

  emitProvisioningEvent(
    result.failed > 0 ? 'document_key_provisioning_failed' : 'document_key_provisioning_completed',
    {
      status: result.failed > 0 ? 'failed' : 'completed',
      reason_code: result.failed > 0 ? 'wrap_failed' : 'foreground_completed',
      count: result.completed,
      pending_count: Math.max(0, requests.length - result.completed),
    },
  )

  return result
}

async function markProvisioningFailed(
  repository: ReturnType<typeof createInvitationRepository>,
  request: DocumentKeyProvisioningRequest,
  errorCode: SafeKeyProvisioningErrorCode,
): Promise<void> {
  try {
    await repository.markDocumentKeyProvisioningFailed({
      requestId: request.id,
      errorCode,
    })
  } catch {
    // Failure details may contain platform/provider internals; callers can use
    // the aggregate result without leaking crypto material or document content.
  }
}

function emitProvisioningEvent(
  name: 'document_key_provisioning_pending' | 'document_key_provisioning_completed' | 'document_key_provisioning_failed',
  params: {
    status: 'pending' | 'completed' | 'failed' | 'skipped'
    reason_code: string
    count?: number
    pending_count?: number
  },
): void {
  analytics.logLocalFirstEvent(name, {
    document_type: 'trip',
    entity_type: 'member',
    operation: 'updated',
    ...params,
  })
}

async function documentHasAnyActiveKey(
  supabase: SupabaseClient,
  documentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('document_keys')
    .select('id')
    .eq('document_id', documentId)
    .is('revoked_at', null)
    .limit(1)

  if (error) throw error
  return Boolean(data?.length)
}

async function documentHasRemoteBackupPayload(
  supabase: SupabaseClient,
  documentId: string,
): Promise<boolean> {
  const repository = createSupabaseBackupRepository(supabase)
  const [snapshot, updates] = await Promise.all([
    repository.getLatestSnapshot(documentId),
    repository.listUpdates({ documentId }),
  ])

  return Boolean(snapshot || updates.length > 0)
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
