import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  BackupDocumentType,
  BackupSnapshotRecord,
  BackupUpdateRecord,
  PendingBackupUpdate,
  RestorePlan,
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

export interface SupabaseBackupRepository {
  upsertSnapshot(input: UpsertBackupDocumentInput): Promise<void>
  uploadUpdate(update: PendingBackupUpdate): Promise<void>
  getLatestSnapshot(documentId: string): Promise<BackupSnapshotRecord | null>
  listUpdates(input: ListBackupUpdatesInput): Promise<BackupUpdateRecord[]>
  restore(documentId: string): Promise<RestorePlan>
}

export function createSupabaseBackupRepository(sb: SupabaseClient): SupabaseBackupRepository {
  return {
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

function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (typeof value === 'string') return decodeByteString(value)
  throw new Error('Unsupported bytea payload returned from Supabase.')
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
