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
  clearMobileDeviceKeyMaterial,
  getMobileKeyMaterialVersion,
  loadMobileDeviceKeyMaterial,
  saveMobileDeviceKeyMaterial,
} from './mobileKeyMaterialStore'
import {
  createMobileRsaOaepWrappingProvider,
  generateMobileRsaOaepKeyMaterial,
} from './mobileCryptoProvider'

export interface MobileKeyProvisioningResult {
  processed: number
  completed: number
  failed: number
  skipped: number
  errorCode?: SafeKeyProvisioningErrorCode
}

export async function ensureMobileDeviceKeyMaterial(
  supabase: SupabaseClient,
): Promise<{ deviceId: string; materialVersion: number }> {
  const deviceId = await getOrCreateMobileDeviceId()
  const existing = await loadMobileDeviceKeyMaterial(deviceId)
  const material = existing ?? {
    deviceId,
    materialVersion: getMobileKeyMaterialVersion(),
    ...(await generateMobileRsaOaepKeyMaterial()),
  }

  if (!existing) {
    await saveMobileDeviceKeyMaterial(material)
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

export async function revokeAndClearCurrentMobileKeyMaterial(supabase: SupabaseClient): Promise<void> {
  const deviceId = await getMobileDeviceId()
  if (!deviceId) return
  try {
    await createInvitationRepository(supabase).revokeUserKeyMaterial({
      deviceId,
      materialVersion: getMobileKeyMaterialVersion(),
    })
  } finally {
    await Promise.all([
      clearMobileDeviceKeyMaterial(deviceId),
      clearMobileDeviceId(),
    ])
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
      keyVersion: getMobileKeyMaterialVersion(),
    })
    if ((status.status === 'none' || status.status === 'failed') && input.requestIfNeeded !== false) {
      return repository.requestDocumentKeyProvisioning({
        documentId: input.documentId,
        deviceId,
        keyVersion: getMobileKeyMaterialVersion(),
      })
    }
    return status
  } catch {
    if (input.requestIfNeeded === false) throw new Error('status_failed')
    return repository.requestDocumentKeyProvisioning({
      documentId: input.documentId,
      deviceId,
      keyVersion: getMobileKeyMaterialVersion(),
    })
  }
}

export async function getCurrentMobileDocumentKey(input: {
  supabase: SupabaseClient
  documentId: string
  deviceId?: string
  provider?: RsaOaepWrappingProvider
}): Promise<DocumentEncryptionKey | null> {
  const deviceId = input.deviceId ?? (await getOrCreateMobileDeviceId())
  const [material, activeKey] = await Promise.all([
    loadMobileDeviceKeyMaterial(deviceId),
    createSupabaseBackupRepository(input.supabase).getMyActiveDocumentKey({
      documentId: input.documentId,
      deviceId,
      keyVersion: getMobileKeyMaterialVersion(),
    }),
  ])

  if (!material || !activeKey || activeKey.wrappingAlg !== 'RSA-OAEP-256') return null

  return unwrapDocumentEncryptionKeyWithRsaOaep(input.provider ?? createMobileRsaOaepWrappingProvider(), {
    wrappedKey: {
      algorithm: activeKey.wrappingAlg,
      keyVersion: activeKey.keyVersion,
      wrappedDek: activeKey.wrappedDek,
    },
    privateKeyJwk: material.privateKeyJwk,
  })
}

export async function runMobileForegroundKeyProvisioning(input: {
  supabase: SupabaseClient
  documentId?: string | null
  documentKey?: DocumentEncryptionKey
  limit?: number
  provider?: RsaOaepWrappingProvider
}): Promise<MobileKeyProvisioningResult> {
  const repository = createInvitationRepository(input.supabase)
  const provider = input.provider ?? createMobileRsaOaepWrappingProvider()
  if (input.documentId) {
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
    limit: input.limit ?? 25,
  })
  const result: MobileKeyProvisioningResult = {
    processed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  }
  const documentKey = input.documentKey ?? (input.documentId
    ? await getCurrentMobileDocumentKey({
      supabase: input.supabase,
      documentId: input.documentId,
      provider,
    })
    : null)

  if (!documentKey) {
    await emitProvisioningEvent('document_key_provisioning_pending', {
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

    let wrappedKey: Awaited<ReturnType<typeof wrapDocumentEncryptionKeyWithRsaOaep>>
    try {
      wrappedKey = await wrapDocumentEncryptionKeyWithRsaOaep(provider, {
        dek: documentKey,
        publicKeyJwk: begun.publicKeyJwk,
        keyVersion: begun.keyVersion,
      })
    } catch {
      await markProvisioningFailed(repository, request, 'wrap_failed')
      result.failed += 1
      continue
    }

    try {
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

  await emitProvisioningEvent(
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
