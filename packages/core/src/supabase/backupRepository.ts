import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  BackupDocumentType,
  BackupSnapshotRecord,
  BackupUpdateRecord,
  WrappedDocumentKey,
  PendingBackupUpdate,
  RestorePlan,
  DocumentKeyMetadata,
  DocumentFreshnessRecord,
} from '../sync/backupTypes'
import { createRestorePlan } from '../sync/syncState'

export interface UpsertBackupDocumentInput {
  documentId: string
  ownerId: string
  type: BackupDocumentType
  schemaVersion: number
  snapshot: Uint8Array
  snapshotHash: string
  encrypted?: boolean
}

export interface ListBackupUpdatesInput {
  documentId: string
  after?: {
    createdAt: string
    id: string
  }
}

export interface ActiveDocumentKeyRecord extends DocumentKeyMetadata {
  wrappedDek: Uint8Array
}

export interface SupabaseBackupRepository {
  hasSnapshot(documentId: string): Promise<boolean>
  hasDocumentKey(input: { documentId: string; userId: string; deviceId?: string | null; keyVersion?: number }): Promise<boolean>
  getMyActiveDocumentKey(input: { documentId: string; deviceId?: string | null; keyVersion?: number }): Promise<ActiveDocumentKeyRecord | null>
  upsertSnapshot(input: UpsertBackupDocumentInput): Promise<void>
  ensureDocumentBootstrapped(input: {
    documentId: string
    ownerId: string
    type?: BackupDocumentType
    schemaVersion?: number
  }): Promise<void>
  upsertOwnerMember(input: { documentId: string; userId: string }): Promise<void>
  upsertDocumentKey(input: {
    documentId: string
    userId: string
    deviceId?: string | null
    materialVersion?: number | null
    wrappedKey: WrappedDocumentKey
  }): Promise<void>
  uploadUpdate(update: PendingBackupUpdate): Promise<void>
  getLatestSnapshot(documentId: string): Promise<BackupSnapshotRecord | null>
  getDocumentFreshness(documentId: string): Promise<DocumentFreshnessRecord | null>
  listUpdates(input: ListBackupUpdatesInput): Promise<BackupUpdateRecord[]>
  restore(documentId: string): Promise<RestorePlan>
}

export function createSupabaseBackupRepository(sb: SupabaseClient): SupabaseBackupRepository {
  return {
    hasSnapshot: async (documentId) => {
      const { data, error } = await sb
        .from('documents')
        .select('id')
        .eq('id', documentId)
        .not('snapshot', 'is', null)
        .maybeSingle()
      if (error) throw error
      return Boolean(data)
    },
    hasDocumentKey: async (input) => {
      if (input.deviceId) {
        const key = await createSupabaseBackupRepository(sb).getMyActiveDocumentKey({
          documentId: input.documentId,
          deviceId: input.deviceId,
          keyVersion: input.keyVersion,
        })
        return Boolean(key)
      }

      let query = sb
        .from('document_keys')
        .select('id')
        .eq('document_id', input.documentId)
        .eq('user_id', input.userId)
        .is('revoked_at', null)
        .limit(1)
      if (input.keyVersion) query = query.eq('key_version', input.keyVersion)
      const { data, error } = await query
      if (error) throw error
      return Boolean(data?.length)
    },
    getMyActiveDocumentKey: async (input) => {
      const { data, error } = await sb.rpc('get_my_active_document_key', {
        p_document_id: input.documentId,
        p_device_id: input.deviceId ?? null,
        p_key_version: input.keyVersion ?? null,
      })
      if (error) throw error
      return data ? toActiveDocumentKeyRecord(data) : null
    },
    upsertSnapshot: async (input) => {
      const { error } = await sb
        .from('documents')
        .upsert({
          id: input.documentId,
          owner_id: input.ownerId,
          type: input.type,
          schema_version: input.schemaVersion,
          snapshot: input.snapshot,
          snapshot_hash: input.snapshotHash,
          encrypted: input.encrypted ?? true,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
    },
    ensureDocumentBootstrapped: async (input) => {
      const { error } = await sb
        .from('documents')
        .upsert({
          id: input.documentId,
          owner_id: input.ownerId,
          type: input.type ?? 'trip',
          schema_version: input.schemaVersion ?? 1,
        }, { onConflict: 'id', ignoreDuplicates: true })

      if (error) throw error

      await createSupabaseBackupRepository(sb).upsertOwnerMember({
        documentId: input.documentId,
        userId: input.ownerId,
      })
    },
    upsertOwnerMember: async (input) => {
      const { error } = await sb
        .from('document_members')
        .upsert({
          document_id: input.documentId,
          user_id: input.userId,
          role: 'owner',
          status: 'accepted',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'document_id,user_id' })

      if (error) throw error
    },
    upsertDocumentKey: async (input) => {
      const { error } = await sb.rpc('upsert_owner_document_key', {
        p_document_id: input.documentId,
        p_wrapped_dek: input.wrappedKey.wrappedDek,
        p_wrapping_alg: input.wrappedKey.algorithm,
        p_key_version: input.wrappedKey.keyVersion,
        p_device_id: input.deviceId ?? null,
        p_material_version: input.materialVersion ?? null,
      })

      if (error) throw error
    },
    uploadUpdate: async (update) => {
      const { error } = await sb
        .from('document_updates')
        .insert({
          document_id: update.documentId,
          client_id: update.clientId,
          seq: update.seq,
          update_blob: update.updateBlob,
          update_hash: update.updateHash,
          created_at: update.createdAt,
        })

      if (error) throw error
    },
    getLatestSnapshot: async (documentId) => {
      const { data, error } = await sb
        .from('documents')
        .select('id, schema_version, snapshot, snapshot_hash, encrypted, updated_at')
        .eq('id', documentId)
        .maybeSingle()

      if (error) throw error
      if (!data?.snapshot || !data.snapshot_hash) return null

      return {
        documentId: data.id,
        schemaVersion: data.schema_version,
        snapshot: toUint8Array(data.snapshot),
        snapshotHash: data.snapshot_hash,
        encrypted: data.encrypted,
        updatedAt: data.updated_at,
      }
    },
    getDocumentFreshness: async (documentId) => {
      const [documentResult, latestUpdateResult] = await Promise.all([
        sb
          .from('documents')
          .select('id, type, updated_at')
          .eq('id', documentId)
          .maybeSingle(),
        sb
          .from('document_updates')
          .select('created_at')
          .eq('document_id', documentId)
          .order('created_at', { ascending: false })
          .limit(1),
      ])

      if (documentResult.error) throw documentResult.error
      if (latestUpdateResult.error) throw latestUpdateResult.error
      if (!documentResult.data) return null

      const documentType = documentResult.data.type
      if (documentType !== 'trip' && documentType !== 'template') {
        throw new Error('Unsupported backup document type.')
      }

      return {
        documentId: documentResult.data.id,
        type: documentType,
        snapshotUpdatedAt: documentResult.data.updated_at,
        latestUpdateCreatedAt: latestUpdateResult.data?.[0]?.created_at ?? null,
      }
    },
    listUpdates: async (input) => {
      let query = sb
        .from('document_updates')
        .select('id, document_id, client_id, seq, update_blob, update_hash, created_at')
        .eq('document_id', input.documentId)
        .order('created_at', { ascending: true })
        .order('client_id', { ascending: true })
        .order('seq', { ascending: true })

      if (input.after) {
        query = query.or(
          `created_at.gt.${input.after.createdAt},and(created_at.eq.${input.after.createdAt},id.gt.${input.after.id})`,
        )
      }

      const { data, error } = await query
      if (error) throw error

      return (data ?? []).map((row) => ({
        id: row.id,
        documentId: row.document_id,
        clientId: row.client_id,
        seq: row.seq,
        updateBlob: toUint8Array(row.update_blob),
        updateHash: row.update_hash,
        createdAt: row.created_at,
      }))
    },
    restore: async (documentId) => {
      const repository = createSupabaseBackupRepository(sb)
      const [snapshot, updates] = await Promise.all([
        repository.getLatestSnapshot(documentId),
        repository.listUpdates({ documentId }),
      ])

      return createRestorePlan(snapshot, updates)
    },
  }
}

function toActiveDocumentKeyRecord(value: unknown): ActiveDocumentKeyRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Unexpected document key RPC response.')
  }
  const row = value as Record<string, unknown>
  return {
    documentId: expectString(row.document_id),
    userId: expectString(row.user_id),
    deviceId: nullableString(row.device_id),
    materialId: nullableString(row.material_id),
    recipientScope: expectRecipientScope(row.recipient_scope),
    keyVersion: expectNumber(row.key_version),
    wrappingAlg: expectWrappingAlg(row.wrapping_alg),
    wrappedDek: toUint8Array(row.wrapped_dek),
    revokedAt: nullableString(row.revoked_at),
  }
}

function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (typeof value === 'string') return decodeByteString(value)
  throw new Error('Unsupported bytea payload returned from Supabase.')
}

function expectString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Unexpected document key RPC response.')
  return value
}

function nullableString(value: unknown): string | null {
  if (value == null) return null
  return expectString(value)
}

function expectNumber(value: unknown): number {
  if (typeof value !== 'number') throw new Error('Unexpected document key RPC response.')
  return value
}

function expectWrappingAlg(value: unknown): ActiveDocumentKeyRecord['wrappingAlg'] {
  if (value === 'AES-KW-256' || value === 'RSA-OAEP-256') return value
  throw new Error('Unexpected document key wrapping algorithm.')
}

function expectRecipientScope(value: unknown): ActiveDocumentKeyRecord['recipientScope'] {
  if (value === 'device' || value === 'legacy_user') return value
  return undefined
}

function decodeByteString(value: string): Uint8Array {
  if (value.startsWith('\\x')) return decodeHex(value.slice(2))
  if (value.startsWith('0x')) return decodeHex(value.slice(2))

  const binary = globalThis.atob?.(value)
  if (!binary) return new TextEncoder().encode(value)

  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function decodeHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid bytea hex payload.')

  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
