import type { SupabaseClient } from '@supabase/supabase-js'
import {
  unwrapDocumentEncryptionKeyWithRsaOaep,
  wrapDocumentEncryptionKeyWithRsaOaep,
  type DocumentEncryptionKey,
  type RsaOaepWrappingProvider,
} from '@nexvoy/core/sync/encryption'
import {
  type DocumentKeyProvisioningRequest,
  type DocumentKeyProvisioningStatusRecord,
  type SafeKeyProvisioningErrorCode,
} from '@nexvoy/core/sync/keyProvisioning'
import { createInvitationRepository } from '@nexvoy/core/supabase/invitationRepository'
import { createSupabaseBackupRepository } from '@nexvoy/core/supabase/backupRepository'
import { logLocalFirstEvent } from '@/lib/observability'
import { clearMobileDeviceId, getMobileDeviceId, getOrCreateMobileDeviceId } from './mobileDeviceIdentity'
import {
  MOBILE_LEGACY_SECURESTORE_MATERIAL_VERSION,
  MOBILE_NATIVE_MATERIAL_VERSION,
  clearAllMobileDeviceKeyMaterial,
  clearLegacyMobileDeviceKeyMaterial,
  loadLegacyMobileDeviceKeyMaterial,
  loadMobileDeviceKeyMaterial,
  saveLegacyMobileDeviceKeyMaterial,
  saveMobileDeviceKeyMaterial,
  type StoredNativeMobileDeviceKeyMaterial,
} from './mobileKeyMaterialStore'
import {
  createMobileRsaOaepWrappingProvider,
  generateMobileRsaOaepKeyMaterial,
} from './mobileCryptoProvider'
import {
  deleteMobileNativeRsaKey,
  ensureMobileNativeRsaKeyMaterial,
  MobileNativeKeyProviderError,
  unwrapMobileDocumentKeyWithNativeRsa,
} from './mobileNativeKeyProvider'
import {
  isMobileBackgroundWorkPaused,
  runExclusiveMobileBackgroundWork,
} from '@/lib/backgroundTaskCoordinator'

const MOBILE_KEY_PROVISIONING_WORKER_NAME = 'mobile-key-provisioning'
const MOBILE_BACKGROUND_KEY_PROVISIONING_LIMIT = 5
const DOCUMENT_KEY_VERSION = 1
const ENABLE_LEGACY_SECURESTORE_KEY_MATERIAL_FALLBACK =
  process.env.EXPO_PUBLIC_ONVOY_ENABLE_LEGACY_SECURESTORE_KEY_MATERIAL_FALLBACK === 'true'

type MobileKeyProvisioningRunSource = 'foreground' | 'background'

export interface MobileKeyProvisioningResult {
  processed: number
  completed: number
  failed: number
  skipped: number
  errorCode?: SafeKeyProvisioningErrorCode
}

interface MobileKeyProvisioningRunInput {
  supabase: SupabaseClient
  documentId?: string | null
  documentKey?: DocumentEncryptionKey
  limit?: number
  provider?: RsaOaepWrappingProvider
  source: MobileKeyProvisioningRunSource
  markWrapFailures: boolean
}

export async function ensureMobileDeviceKeyMaterial(
  supabase: SupabaseClient,
): Promise<{ deviceId: string; materialVersion: number }> {
  const deviceId = await getOrCreateMobileDeviceId()

  const repository = createInvitationRepository(supabase)
  let registration: Awaited<ReturnType<typeof repository.registerUserKeyMaterial>> | null = null

  const existing = await loadMobileDeviceKeyMaterial(deviceId)
  let material: Omit<StoredNativeMobileDeviceKeyMaterial, 'updatedAt'> | StoredNativeMobileDeviceKeyMaterial | null = null
  try {
    material = existing ?? await createAndStoreNativeKeyMaterial(deviceId)
  } catch (error) {
    if (
      !ENABLE_LEGACY_SECURESTORE_KEY_MATERIAL_FALLBACK
      || !(error instanceof MobileNativeKeyProviderError)
      || error.code !== 'provider_unavailable'
    ) {
      throw error
    }
    const legacyMaterial = await createAndStoreLegacyKeyMaterialFallback(deviceId)
    registration = await repository.registerUserKeyMaterial({
      deviceId,
      publicKeyJwk: legacyMaterial.publicKeyJwk,
      materialVersion: MOBILE_LEGACY_SECURESTORE_MATERIAL_VERSION,
      materialType: 'securestore_jwk',
      platform: 'unknown',
      hardwareBacked: null,
      attestationStatus: 'not_verified',
    })
  }

  if (!registration && material) {
    registration = await repository.registerUserKeyMaterial({
      deviceId,
      publicKeyJwk: material.publicKeyJwk,
      materialVersion: MOBILE_NATIVE_MATERIAL_VERSION,
      materialType: 'native_rsa',
      platform: material.platform,
      hardwareBacked: material.hardwareBacked,
      attestationStatus: material.attestationStatus,
    })
  }

  if (!registration) throw new Error('mobile_key_material_unavailable')

  return {
    deviceId,
    materialVersion: registration.materialVersion,
  }
}

export async function revokeAndClearCurrentMobileKeyMaterial(supabase: SupabaseClient): Promise<void> {
  const deviceId = await getMobileDeviceId()
  if (!deviceId) return
  try {
    const repository = createInvitationRepository(supabase)
    await Promise.allSettled([
      repository.revokeUserKeyMaterial({
        deviceId,
        materialVersion: MOBILE_NATIVE_MATERIAL_VERSION,
      }),
      repository.revokeUserKeyMaterial({
        deviceId,
        materialVersion: MOBILE_LEGACY_SECURESTORE_MATERIAL_VERSION,
      }),
    ])
  } finally {
    await Promise.all([
      clearAllMobileDeviceKeyMaterial(deviceId),
      deleteMobileNativeRsaKey(deviceId),
      clearMobileDeviceId(),
    ])
  }
}

async function createAndStoreNativeKeyMaterial(deviceId: string) {
  const nativeMaterial = await ensureMobileNativeRsaKeyMaterial(deviceId)
  const material: Omit<StoredNativeMobileDeviceKeyMaterial, 'updatedAt'> = {
    deviceId,
    materialVersion: MOBILE_NATIVE_MATERIAL_VERSION,
    materialType: 'native_rsa' as const,
    platform: nativeMaterial.platform,
    hardwareBacked: nativeMaterial.hardwareBacked,
    attestationStatus: nativeMaterial.attestationStatus,
    publicKeyJwk: nativeMaterial.publicKeyJwk,
  }
  await saveMobileDeviceKeyMaterial(material)
  return material
}

async function createAndStoreLegacyKeyMaterialFallback(deviceId: string) {
  const existing = await loadLegacyMobileDeviceKeyMaterial(deviceId)
  const material = existing ?? {
    deviceId,
    materialVersion: MOBILE_LEGACY_SECURESTORE_MATERIAL_VERSION,
    ...(await generateMobileRsaOaepKeyMaterial()),
  }
  if (!existing) await saveLegacyMobileDeviceKeyMaterial(material)
  return material
}

async function revokeAndClearLegacyMobileKeyMaterial(supabase: SupabaseClient, deviceId: string): Promise<void> {
  const legacyMaterial = await loadLegacyMobileDeviceKeyMaterial(deviceId)
  if (!legacyMaterial) return
  try {
    await createInvitationRepository(supabase).revokeUserKeyMaterial({
      deviceId,
      materialVersion: MOBILE_LEGACY_SECURESTORE_MATERIAL_VERSION,
    })
  } catch {
    // Upgrade cleanup is best effort; local private JWK removal must still happen.
  } finally {
    await clearLegacyMobileDeviceKeyMaterial(deviceId)
  }
}

export async function loadOrRequestMobileProvisioningStatus(input: {
  supabase: SupabaseClient
  documentId: string
  deviceId?: string
  requestIfNeeded?: boolean
}): Promise<DocumentKeyProvisioningStatusRecord> {
  const deviceId = input.deviceId ?? (await getOrCreateMobileDeviceId())
  const repository = createInvitationRepository(input.supabase)
  try {
    const status = await repository.getMyDocumentKeyProvisioningStatus({
      documentId: input.documentId,
      deviceId,
      keyVersion: DOCUMENT_KEY_VERSION,
    })
    if ((status.status === 'none' || status.status === 'failed') && input.requestIfNeeded !== false) {
      return repository.requestDocumentKeyProvisioning({
        documentId: input.documentId,
        deviceId,
        keyVersion: DOCUMENT_KEY_VERSION,
      })
    }
    return status
  } catch {
    if (input.requestIfNeeded === false) throw new Error('status_failed')
    return repository.requestDocumentKeyProvisioning({
      documentId: input.documentId,
      deviceId,
      keyVersion: DOCUMENT_KEY_VERSION,
    })
  }
}

export async function getCurrentMobileDocumentKey(input: {
  supabase: SupabaseClient
  documentId: string
  deviceId?: string
  provider?: RsaOaepWrappingProvider
  cleanupLegacyAfterNativeUnwrap?: boolean
}): Promise<DocumentEncryptionKey | null> {
  const deviceId = input.deviceId ?? (await getOrCreateMobileDeviceId())
  const [material, activeKey] = await Promise.all([
    loadMobileDeviceKeyMaterial(deviceId),
    createSupabaseBackupRepository(input.supabase).getMyActiveDocumentKey({
      documentId: input.documentId,
      deviceId,
      keyVersion: DOCUMENT_KEY_VERSION,
    }),
  ])

  if (!activeKey || activeKey.wrappingAlg !== 'RSA-OAEP-256') return null

  if (material) {
    try {
    const documentKey = await unwrapMobileDocumentKeyWithNativeRsa({
        deviceId,
        wrappedDek: activeKey.wrappedDek,
      })
    if (input.cleanupLegacyAfterNativeUnwrap === true) {
      await revokeAndClearLegacyMobileKeyMaterial(input.supabase, deviceId)
    }
    return documentKey
    } catch {
      return null
    }
  }

  if (!ENABLE_LEGACY_SECURESTORE_KEY_MATERIAL_FALLBACK) return null
  const legacyMaterial = await loadLegacyMobileDeviceKeyMaterial(deviceId)
  if (!legacyMaterial) return null

  try {
    return await unwrapDocumentEncryptionKeyWithRsaOaep(input.provider ?? createMobileRsaOaepWrappingProvider(), {
      wrappedKey: {
        algorithm: activeKey.wrappingAlg,
        keyVersion: activeKey.keyVersion,
        wrappedDek: activeKey.wrappedDek,
      },
      privateKeyJwk: legacyMaterial.privateKeyJwk,
    })
  } catch {
    return null
  }
}

export async function runMobileForegroundKeyProvisioning(input: {
  supabase: SupabaseClient
  documentId?: string | null
  documentKey?: DocumentEncryptionKey
  limit?: number
  provider?: RsaOaepWrappingProvider
}): Promise<MobileKeyProvisioningResult> {
  return runExclusiveMobileBackgroundWork(
    MOBILE_KEY_PROVISIONING_WORKER_NAME,
    () => runMobileKeyProvisioning({
      ...input,
      limit: input.limit ?? 25,
      source: 'foreground',
      markWrapFailures: true,
    }),
    () => createSkippedProvisioningResult('retry_later', 1),
  )
}

export async function runMobileBackgroundKeyProvisioning(input: {
  supabase: SupabaseClient
  limit?: number
  provider?: RsaOaepWrappingProvider
}): Promise<MobileKeyProvisioningResult> {
  if (isMobileBackgroundWorkPaused()) {
    return createSkippedProvisioningResult('retry_later')
  }

  try {
    const { data } = await input.supabase.auth.getSession()
    if (!data.session) {
      await emitProvisioningEvent('document_key_provisioning_pending', {
        status: 'skipped',
        reason_code: 'background_session_unavailable',
      })
      return createSkippedProvisioningResult('retry_later')
    }
  } catch {
    await emitProvisioningEvent('document_key_provisioning_pending', {
      status: 'skipped',
      reason_code: 'background_session_unavailable',
    })
    return createSkippedProvisioningResult('retry_later')
  }

  try {
    return await runExclusiveMobileBackgroundWork(
      MOBILE_KEY_PROVISIONING_WORKER_NAME,
      () => runMobileKeyProvisioning({
        ...input,
        limit: input.limit ?? MOBILE_BACKGROUND_KEY_PROVISIONING_LIMIT,
        source: 'background',
        markWrapFailures: false,
      }),
      () => createSkippedProvisioningResult('retry_later', 1),
    )
  } catch {
    await emitProvisioningEvent('document_key_provisioning_pending', {
      status: 'skipped',
      reason_code: 'background_interrupted',
    })
    return createSkippedProvisioningResult('retry_later')
  }
}

async function runMobileKeyProvisioning(input: MobileKeyProvisioningRunInput): Promise<MobileKeyProvisioningResult> {
  if (isMobileBackgroundWorkPaused()) {
    return createSkippedProvisioningResult('retry_later')
  }

  const repository = createInvitationRepository(input.supabase)
  const provider = input.provider ?? createMobileRsaOaepWrappingProvider()
  const backgroundDeviceId = input.source === 'background' ? await getMobileDeviceId() : undefined

  if (input.source === 'background' && !backgroundDeviceId) {
    await emitProvisioningEvent('document_key_provisioning_pending', {
      status: 'skipped',
      reason_code: 'material_unavailable',
    })
    return createSkippedProvisioningResult('retry_later')
  }

  if (input.documentId && input.source === 'foreground') {
    try {
      const { deviceId } = await ensureMobileDeviceKeyMaterial(input.supabase)
      await loadOrRequestMobileProvisioningStatus({
        supabase: input.supabase,
        documentId: input.documentId,
        deviceId,
      })
    } catch {
      await emitProvisioningEvent('document_key_provisioning_pending', {
        status: 'skipped',
        reason_code: 'material_unavailable',
      })
    }
  }
  const requests = await repository.listPendingDocumentKeyProvisioningRequests({
    documentId: input.documentId ?? null,
    limit: input.limit,
  })
  const result: MobileKeyProvisioningResult = {
    processed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  }
  const documentKeys = new Map<string, DocumentEncryptionKey | null>()

  const resolveDocumentKey = async (documentId: string): Promise<DocumentEncryptionKey | null> => {
    if (input.documentKey && input.documentId === documentId) return input.documentKey
    if (documentKeys.has(documentId)) return documentKeys.get(documentId) ?? null
    const documentKey = await getCurrentMobileDocumentKey({
      supabase: input.supabase,
      documentId,
      deviceId: backgroundDeviceId ?? undefined,
      provider,
      cleanupLegacyAfterNativeUnwrap: input.source === 'foreground',
    })
    documentKeys.set(documentId, documentKey)
    return documentKey
  }

  if (input.documentId && requests.length > 0) {
    const documentKey = await resolveDocumentKey(input.documentId)
    if (!documentKey) {
      await emitProvisioningEvent('document_key_provisioning_pending', {
        status: 'skipped',
        reason_code: 'owner_device_key_unavailable',
        pending_count: requests.length,
      })
      return createSkippedProvisioningResult(
        input.source === 'background' ? 'retry_later' : 'owner_device_key_unavailable',
        requests.length,
      )
    }
  }

  for (const request of requests) {
    result.processed += 1
    if (isMobileBackgroundWorkPaused()) {
      result.skipped += 1
      result.errorCode = 'retry_later'
      continue
    }

    const documentKey = await resolveDocumentKey(request.documentId)
    if (!documentKey) {
      result.skipped += 1
      result.errorCode = input.source === 'background' ? 'retry_later' : 'owner_device_key_unavailable'
      continue
    }

    let begun: Awaited<ReturnType<typeof repository.beginDocumentKeyProvisioning>>
    try {
      begun = await repository.beginDocumentKeyProvisioning(request.id)
    } catch {
      result.skipped += 1
      continue
    }
    if (begun.status !== 'processing' || !('publicKeyJwk' in begun)) {
      result.skipped += 1
      continue
    }

    if (isMobileBackgroundWorkPaused()) {
      result.skipped += 1
      result.errorCode = 'retry_later'
      continue
    }

    let wrappedKey: Awaited<ReturnType<typeof wrapDocumentEncryptionKeyWithRsaOaep>>
    try {
      wrappedKey = await wrapDocumentEncryptionKeyWithRsaOaep(provider, {
        dek: documentKey,
        publicKeyJwk: begun.publicKeyJwk,
        keyVersion: begun.keyVersion,
      })
    } catch {
      if (input.markWrapFailures) {
        await markProvisioningFailed(repository, request, 'wrap_failed')
        result.failed += 1
      } else {
        result.skipped += 1
      }
      continue
    }

    try {
      if (isMobileBackgroundWorkPaused()) {
        result.skipped += 1
        result.errorCode = 'retry_later'
        continue
      }
      await repository.completeDocumentKeyProvisioning({
        requestId: request.id,
        wrappedDek: wrappedKey.wrappedDek,
        wrappingAlg: 'RSA-OAEP-256',
        keyVersion: wrappedKey.keyVersion,
      })
      result.completed += 1
    } catch {
      result.skipped += 1
    }
  }

  if (result.failed > 0) {
    await emitProvisioningEvent('document_key_provisioning_failed', {
      status: 'failed',
      reason_code: 'wrap_failed',
      count: result.completed,
      pending_count: Math.max(0, requests.length - result.completed),
    })
  } else if (result.completed > 0 || requests.length === 0) {
    await emitProvisioningEvent('document_key_provisioning_completed', {
      status: 'completed',
      reason_code: `${input.source}_completed`,
      count: result.completed,
      pending_count: Math.max(0, requests.length - result.completed),
    })
  } else {
    await emitProvisioningEvent('document_key_provisioning_pending', {
      status: 'skipped',
      reason_code: result.errorCode ?? `${input.source}_skipped`,
      pending_count: requests.length,
    })
  }

  return result
}

function createSkippedProvisioningResult(
  errorCode: SafeKeyProvisioningErrorCode,
  skipped = 0,
): MobileKeyProvisioningResult {
  return {
    processed: 0,
    completed: 0,
    failed: 0,
    skipped,
    errorCode,
  }
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
    // Native/provider internals are intentionally not logged or shown to users.
  }
}

async function emitProvisioningEvent(
  name: 'document_key_provisioning_pending' | 'document_key_provisioning_completed' | 'document_key_provisioning_failed',
  params: {
    status: 'pending' | 'completed' | 'failed' | 'skipped'
    reason_code: string
    count?: number
    pending_count?: number
  },
): Promise<void> {
  await logLocalFirstEvent(name, {
    document_type: 'trip',
    entity_type: 'member',
    operation: 'updated',
    ...params,
  })
}
