import type { SupabaseClient } from '@supabase/supabase-js'
import { subtle } from 'react-native-quick-crypto'
import {
  createEmptyTripDocumentV1,
  createDocumentPrimaryRepositoryBundle,
  createEmptyTemplateDocumentV1,
  shouldBootstrapDocumentRegistry,
  type DocumentMutationResult,
  type TemplateDocumentV1,
  type TripDocumentV1,
} from '@nexvoy/core'
import { createSupabaseBackupRepository } from '@nexvoy/core/supabase/backupRepository'
import { TRIP_DOCUMENT_SCHEMA_VERSION, type EntityId } from '@nexvoy/core/local-first/documentModel'
import { createYjsTripDocument, encodeTripDocumentUpdate } from '@nexvoy/core/local-first/yjsTripDocument'
import {
  applyTemplateDocumentUpdate,
  TEMPLATE_DOCUMENT_SCHEMA_VERSION,
  createYjsTemplateDocument,
  encodeTemplateDocumentUpdate,
  readTemplateDocumentFromYjs,
} from '@nexvoy/core/local-first/templateDocument'
import type { DocumentPrimaryRepositoryBundle } from '@nexvoy/core/repositories/documentPrimaryRepository'
import { decryptRestoreSnapshot } from '@nexvoy/core/sync/mobileRestore'
import { publishLocalMobileTripDocumentUpdate } from './p2pUpdateBridge'
import {
  createMobileTemplateDocumentStore,
  createMobileTripDocumentStore,
} from './mobileDocumentStores'
import { enqueueMobileBackupUpdate } from './mobileBackupSyncService'
import { ensureMobileOwnerDocumentKeyForSnapshot, getMobileBackupCryptoProvider } from './documentBootstrapService'
import { getOrCreateMobileDeviceId } from './mobileDeviceIdentity'
import { getCurrentMobileDocumentKey } from './keyProvisioningService'
import { restoreMobileEncryptedSnapshot } from './mobileSnapshotRestoreService'
import {
  applyMobileTripDocumentUpdateToDoc,
  createMobileYjsTripDocument,
  loadMobileTripDocumentUpdate,
  readTripDocumentFromMobileYjs,
} from './mobileYjsTripDocument'

export async function createMobileDocumentPrimaryRepositories(
  supabase: SupabaseClient,
  options: {
    actorRole?: 'owner' | 'editor' | 'viewer' | null
  } = {},
): Promise<DocumentPrimaryRepositoryBundle> {
  const { data } = await supabase.auth.getUser()
  const authUserId = data.user?.id ?? null
  const userId = authUserId ?? 'anonymous-mobile-user'
  const actor = {
    userId,
    role: options.actorRole ?? 'viewer',
    status: 'accepted' as const,
  }

  const tripStore = createMobileTripDocumentStore({
    hydrateDocument: async (tripId) => {
      return restoreMobileTripDocumentFromBackup(supabase, tripId)
    },
    refreshDocument: (tripId, localDocument) => refreshMobileTripDocumentIfRemoteNewer(supabase, tripId, localDocument),
    listRemoteDocumentIds: () => listRemoteDocumentIds(supabase, 'trip'),
  })
  const templateStore = createMobileTemplateDocumentStore({
    hydrateDocument: (templateId) => restoreMobileTemplateDocumentFromBackup(supabase, templateId),
    refreshDocument: (templateId, localDocument) => refreshMobileTemplateDocumentIfRemoteNewer(supabase, templateId, localDocument),
    listRemoteDocumentIds: () => listRemoteDocumentIds(supabase, 'template'),
  })

  return createDocumentPrimaryRepositoryBundle({
    tripStore,
    templateStore,
    runtime: {
      actor,
      publisher: {
        publishMutation: (result) => {
          if (result.documentType === 'trip') {
            publishLocalMobileTripDocumentUpdate({
              documentId: result.documentId,
              update: result.update,
            })
            if (actor.role === 'owner' || actor.role === 'editor') {
              void (async () => {
                await ensureMobileDocumentRegistryBootstrapped(supabase, authUserId, result.document as TripDocumentV1)
                await enqueueMobileBackupUpdate({
                  supabase,
                  documentId: result.documentId,
                  update: result.update,
                })
              })().catch(() => undefined)
            }
            return
          }

          if (result.documentType === 'template' && (actor.role === 'owner' || actor.role === 'editor')) {
            void enqueueMobileBackupUpdate({
              supabase,
              documentId: result.documentId,
              update: result.update,
            }).catch(() => undefined)
          }
        },
      },
    },
  })
}

const mobileDocumentRegistryBootstrapAttempted = new Set<string>()

async function ensureMobileDocumentRegistryBootstrapped(
  supabase: SupabaseClient,
  authUserId: string | null,
  document: TripDocumentV1,
): Promise<void> {
  if (!authUserId) return
  if (!shouldBootstrapDocumentRegistry({
    authUserId,
    tripOwnerId: document.trip.ownerId,
  })) {
    return
  }

  const key = `${authUserId}:${document.trip.id}`
  if (mobileDocumentRegistryBootstrapAttempted.has(key)) return
  mobileDocumentRegistryBootstrapAttempted.add(key)

  try {
    await createSupabaseBackupRepository(supabase).ensureDocumentBootstrapped({
      documentId: document.trip.id,
      ownerId: authUserId,
    })
  } catch {
    mobileDocumentRegistryBootstrapAttempted.delete(key)
  }
}

export async function createMobileTripDocument(input: {
  supabase: SupabaseClient
  destination: string
  startDate: string
  endDate: string
  adultsCount: number
  childrenCount: number
}): Promise<string> {
  const { data } = await input.supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('인증 정보가 없습니다.')

  const tripStore = createMobileTripDocumentStore()
  const now = new Date().toISOString()
  const tripId = createEntityId('trip')
  const document = createEmptyTripDocumentV1({
    id: tripId,
    ownerId: userId,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    adultsCount: input.adultsCount,
    childrenCount: input.childrenCount,
    createdAt: now,
  })
  const update = encodeTripDocumentUpdate(createYjsTripDocument(document))

  await tripStore.putDocument(tripId, document, update)
  await ensureMobileOwnerDocumentKeyForSnapshot({
    supabase: input.supabase,
    documentId: tripId,
    documentType: 'trip',
    schemaVersion: TRIP_DOCUMENT_SCHEMA_VERSION,
    snapshotPayload: update,
  })
  await upsertTripReadModel(input.supabase, {
    tripId,
    ownerId: userId,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    adultsCount: input.adultsCount,
    childrenCount: input.childrenCount,
  })

  return tripId
}

export async function createMobileTemplateDocument(input: {
  supabase: SupabaseClient
  title: string
  items: Array<{
    item_name: string
    category: string
    is_private?: boolean
  }>
}): Promise<string> {
  const { data } = await input.supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('인증 정보가 없습니다.')

  const templateStore = createMobileTemplateDocumentStore()
  const now = new Date().toISOString()
  const templateId = createEntityId('template')
  const document = createEmptyTemplateDocumentV1({
    id: templateId,
    ownerId: userId,
    title: input.title,
    visibility: 'private',
    createdAt: now,
  })

  input.items.forEach((item, index) => {
    const itemId = createEntityId('template-item')
    document.items[itemId] = {
      id: itemId,
      templateId,
      name: item.item_name,
      categoryName: item.category,
      isPrivate: item.is_private ?? false,
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    }
  })

  const update = encodeTemplateDocumentUpdate(createYjsTemplateDocument(document))
  await templateStore.putDocument(templateId, document, update)
  await ensureMobileOwnerDocumentKeyForSnapshot({
    supabase: input.supabase,
    documentId: templateId,
    documentType: 'template',
    schemaVersion: TEMPLATE_DOCUMENT_SCHEMA_VERSION,
    snapshotPayload: update,
  })

  return templateId
}

async function listRemoteDocumentIds(
  supabase: SupabaseClient,
  type: 'trip' | 'template',
): Promise<EntityId[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id')
    .eq('type', type)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => row.id)
}

async function refreshMobileTripDocumentIfRemoteNewer(
  supabase: SupabaseClient,
  documentId: EntityId,
  localDocument: TripDocumentV1,
): Promise<TripDocumentV1 | null> {
  if (!(await isRemoteDocumentNewer(supabase, documentId, localDocument.trip.updatedAt))) return null
  return restoreMobileTripDocumentFromBackup(supabase, documentId)
}

async function refreshMobileTemplateDocumentIfRemoteNewer(
  supabase: SupabaseClient,
  documentId: EntityId,
  localDocument: TemplateDocumentV1,
): Promise<TemplateDocumentV1 | null> {
  if (!(await isRemoteDocumentNewer(supabase, documentId, localDocument.template.updatedAt))) return null
  return restoreMobileTemplateDocumentFromBackup(supabase, documentId)
}

async function isRemoteDocumentNewer(
  supabase: SupabaseClient,
  documentId: EntityId,
  localUpdatedAt: string,
): Promise<boolean> {
  const freshness = await createSupabaseBackupRepository(supabase).getDocumentFreshness(documentId)
  if (!freshness) return false
  const remoteUpdatedAt = maxIsoDateTime(freshness.snapshotUpdatedAt, freshness.latestUpdateCreatedAt)
  if (!remoteUpdatedAt) return false
  return remoteUpdatedAt.localeCompare(localUpdatedAt) > 0
}

function maxIsoDateTime(...values: Array<string | null>): string | null {
  return values.reduce<string | null>((latest, value) => {
    if (!value) return latest
    if (!latest || value.localeCompare(latest) > 0) return value
    return latest
  }, null)
}

async function restoreMobileTripDocumentFromBackup(
  supabase: SupabaseClient,
  documentId: EntityId,
): Promise<TripDocumentV1 | null> {
  const outcome = await restoreMobileEncryptedSnapshot({ supabase, documentId })
  if (outcome.status !== 'restored') return null

  const update = await loadMobileTripDocumentUpdate({ documentId })
  if (!update) return null

  const doc = createMobileYjsTripDocument()
  applyMobileTripDocumentUpdateToDoc(doc, update)
  return readTripDocumentFromMobileYjs(doc)
}

async function restoreMobileTemplateDocumentFromBackup(
  supabase: SupabaseClient,
  templateId: EntityId,
): Promise<TemplateDocumentV1 | null> {
  const repository = createSupabaseBackupRepository(supabase)
  const snapshot = await repository.getLatestSnapshot(templateId)
  if (!snapshot) return null

  const documentKey = await getCurrentMobileDocumentKey({
    supabase,
    documentId: templateId,
    deviceId: await getOrCreateMobileDeviceId(),
  })
  if (!documentKey) return null

  const result = await decryptRestoreSnapshot({
    provider: getMobileBackupCryptoProvider(),
    snapshot,
    key: documentKey,
    hash: sha256Hex,
  })
  if (result.kind !== 'opaque') return null

  const doc = createYjsTemplateDocument()
  applyTemplateDocumentUpdate(doc, result.plaintext)
  return readTemplateDocumentFromYjs(doc)
}

export type MobileDocumentPrimaryMutationResult =
  DocumentMutationResult<TripDocumentV1 | TemplateDocumentV1>

function createEntityId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function upsertTripReadModel(
  supabase: SupabaseClient,
  input: {
    tripId: string
    ownerId: string
    destination: string
    startDate: string
    endDate: string
    adultsCount: number
    childrenCount: number
  },
): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .upsert({
      id: input.tripId,
      user_id: input.ownerId,
      destination: input.destination,
      start_date: input.startDate,
      end_date: input.endDate,
      adults_count: input.adultsCount,
      children_count: input.childrenCount,
    })
  if (error) throw error
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const digest = await (subtle as unknown as Pick<SubtleCrypto, 'digest'>).digest(
    'SHA-256',
    buffer,
  )
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
