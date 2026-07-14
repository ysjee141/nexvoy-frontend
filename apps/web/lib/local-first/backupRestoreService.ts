import type { SupabaseClient } from '@supabase/supabase-js'
import type { TripDocumentV1 } from '@nexvoy/core/local-first/documentModel'
import { restoreTripDocumentFromBackup } from '@nexvoy/core/sync/restore'
import { BackupCryptoError } from '@nexvoy/core/sync/backupTypes'
import { createSupabaseBackupRepository } from '@nexvoy/core/supabase/backupRepository'
import { getCurrentWebDocumentKeyOrRecoverStaleDeviceKey, getOrCreateWebDeviceId } from './keyProvisioningService'
import { getWebBackupCryptoProvider } from './webCryptoProvider'

export type WebBackupRestoreStatus =
  | 'missing'
  | 'key_unavailable'
  | 'restored'
  | 'failed'

export interface WebBackupRestoreResult {
  status: WebBackupRestoreStatus
  document: TripDocumentV1 | null
  reason?: string
}

export async function restoreWebTripDocumentFromBackup(input: {
  supabase: SupabaseClient
  documentId: string
}): Promise<WebBackupRestoreResult> {
  if (!(await hasActiveSession(input.supabase))) {
    return { status: 'missing', document: null }
  }

  const repository = createSupabaseBackupRepository(input.supabase)
  const hasSnapshot = await repository.hasSnapshot(input.documentId)
  if (!hasSnapshot) {
    return { status: 'missing', document: null }
  }

  const documentKey = await getCurrentWebDocumentKeyOrRecoverStaleDeviceKey({
    supabase: input.supabase,
    documentId: input.documentId,
    deviceId: getOrCreateWebDeviceId(),
  })
  if (!documentKey) {
    return { status: 'key_unavailable', document: null }
  }

  try {
    const plan = await repository.restore(input.documentId)
    const document = await restoreTripDocumentFromBackup({
      provider: getWebBackupCryptoProvider(),
      plan,
      key: documentKey,
      hash: sha256Hex,
    })
    return document
      ? { status: 'restored', document }
      : { status: 'missing', document: null }
  } catch (error) {
    if (error instanceof BackupCryptoError && error.code === 'restore_snapshot_missing') {
      return { status: 'missing', document: null }
    }
    return {
      status: 'failed',
      document: null,
      reason: error instanceof Error ? error.message : 'restore_failed',
    }
  }
}

async function hasActiveSession(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession()
    return Boolean(data.session?.access_token)
  } catch {
    return false
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
