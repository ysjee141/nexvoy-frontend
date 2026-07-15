import type { SupabaseClient } from '@supabase/supabase-js'
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
  TEMPLATE_DOCUMENT_SCHEMA_VERSION,
  createYjsTemplateDocument,
  encodeTemplateDocumentUpdate,
} from '@nexvoy/core/local-first/templateDocument'
import type { DocumentPrimaryRepositoryBundle } from '@nexvoy/core/repositories/documentPrimaryRepository'
import { publishLocalTripDocumentUpdate } from './p2pUpdateBridge'
import { resolveWebOwnerContext } from './ownerNamespace'
import {
  createWebTemplateDocumentStore,
  createWebTripDocumentStore,
} from './webDocumentStores'
import { enqueueWebBackupUpdate } from './backupSyncService'
import { restoreWebTemplateDocumentFromBackup, restoreWebTripDocumentFromBackup } from './backupRestoreService'
import { ensureWebOwnerDocumentKey, ensureWebOwnerDocumentKeyForSnapshot } from './keyProvisioningService'

export async function createWebDocumentPrimaryRepositories(
  supabase: SupabaseClient,
  options: {
    actorRole?: 'owner' | 'editor' | 'viewer' | null
  } = {},
): Promise<DocumentPrimaryRepositoryBundle> {
  const ownerContext = await resolveWebOwnerContext(supabase)
  const actor = {
    userId: ownerContext.ownerId,
    role: options.actorRole ?? 'viewer',
    status: 'accepted' as const,
  }

  const tripStore = createWebTripDocumentStore(ownerContext, {
    hydrateDocument: async (tripId) => {
      const restored = await restoreWebTripDocumentFromBackup({ supabase, documentId: tripId })
      return restored.document
    },
    refreshDocument: (tripId, localDocument) => refreshWebTripDocumentIfRemoteNewer(supabase, tripId, localDocument),
    listRemoteDocumentIds: () => listRemoteDocumentIds(supabase, 'trip'),
  })
  const templateStore = createWebTemplateDocumentStore(ownerContext, {
    hydrateDocument: async (templateId) => {
      const restored = await restoreWebTemplateDocumentFromBackup({ supabase, documentId: templateId })
      return restored.document
    },
    refreshDocument: (templateId, localDocument) => refreshWebTemplateDocumentIfRemoteNewer(supabase, templateId, localDocument),
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
            publishLocalTripDocumentUpdate({
              documentId: result.documentId,
              update: result.update,
            })
            if (actor.role === 'owner' || actor.role === 'editor') {
              void (async () => {
                await ensureWebDocumentRegistryBootstrapped(supabase, ownerContext, result.document as TripDocumentV1)
                await ensureWebDocumentKeyForMutation(supabase, ownerContext, result.document as TripDocumentV1)
                await enqueueWebBackupUpdate({
                  supabase,
                  documentId: result.documentId,
                  update: result.update,
                })
              })().catch((error) => {
                console.warn('[document-primary backup publish failed]', getSafeBackupPublishFailureReason(error))
              })
            }
            return
          }

          if (result.documentType === 'template' && (actor.role === 'owner' || actor.role === 'editor')) {
            void enqueueWebBackupUpdate({
              supabase,
              documentId: result.documentId,
              update: result.update,
            }).catch((error) => {
              console.warn('[document-primary backup publish failed]', getSafeBackupPublishFailureReason(error))
            })
          }
        },
      },
    },
  })
}

const webDocumentRegistryBootstrapAttempted = new Set<string>()

async function ensureWebDocumentRegistryBootstrapped(
  supabase: SupabaseClient,
  ownerContext: Awaited<ReturnType<typeof resolveWebOwnerContext>>,
  document: TripDocumentV1,
): Promise<void> {
  if (!ownerContext.authUserId) return
  if (!shouldBootstrapDocumentRegistry({
    authUserId: ownerContext.authUserId,
    tripOwnerId: document.trip.ownerId,
  })) {
    return
  }

  const key = `${ownerContext.authUserId}:${document.trip.id}`
  if (webDocumentRegistryBootstrapAttempted.has(key)) return
  webDocumentRegistryBootstrapAttempted.add(key)

  try {
    await createSupabaseBackupRepository(supabase).ensureDocumentBootstrapped({
      documentId: document.trip.id,
      ownerId: ownerContext.authUserId,
    })
  } catch {
    webDocumentRegistryBootstrapAttempted.delete(key)
  }
}

async function ensureWebDocumentKeyForMutation(
  supabase: SupabaseClient,
  ownerContext: Awaited<ReturnType<typeof resolveWebOwnerContext>>,
  document: TripDocumentV1,
): Promise<void> {
  if (!ownerContext.authUserId) return
  if (!shouldBootstrapDocumentRegistry({
    authUserId: ownerContext.authUserId,
    tripOwnerId: document.trip.ownerId,
  })) {
    return
  }

  await ensureWebOwnerDocumentKey({
    supabase,
    document,
    ownerId: ownerContext.authUserId,
  })
}

function getSafeBackupPublishFailureReason(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'unknown'
}

export async function createWebTripDocument(input: {
  supabase: SupabaseClient
  destination: string
  startDate: string
  endDate: string
  adultsCount: number
  childrenCount: number
}): Promise<string> {
  const ownerContext = await resolveWebOwnerContext(input.supabase)
  if (!ownerContext.authUserId) throw new Error('인증 정보가 없습니다.')

  const tripStore = createWebTripDocumentStore(ownerContext)
  const now = new Date().toISOString()
  const tripId = createEntityId('trip')
  const document = createEmptyTripDocumentV1({
    id: tripId,
    ownerId: ownerContext.authUserId,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    adultsCount: input.adultsCount,
    childrenCount: input.childrenCount,
    createdAt: now,
  })
  const ownerMemberId = `member:${ownerContext.authUserId}`
  document.members[ownerMemberId] = {
    id: ownerMemberId,
    userId: ownerContext.authUserId,
    invitedEmail: null,
    role: 'owner',
    status: 'accepted',
    nickname: null,
    email: null,
    createdAt: now,
    updatedAt: now,
  }
  const update = encodeTripDocumentUpdate(createYjsTripDocument(document))

  await tripStore.putDocument(tripId, document, update)
  await ensureWebOwnerDocumentKeyForSnapshot({
    supabase: input.supabase,
    documentId: tripId,
    ownerId: ownerContext.authUserId,
    documentType: 'trip',
    schemaVersion: TRIP_DOCUMENT_SCHEMA_VERSION,
    snapshotPayload: update,
  })
  await upsertTripReadModel(input.supabase, {
    tripId,
    ownerId: ownerContext.authUserId,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    adultsCount: input.adultsCount,
    childrenCount: input.childrenCount,
  })

  return tripId
}

export async function createWebTemplateDocument(input: {
  supabase: SupabaseClient
  title: string
  items: Array<{
    item_name: string
    category: string
    is_private?: boolean
  }>
}): Promise<string> {
  const ownerContext = await resolveWebOwnerContext(input.supabase)
  if (!ownerContext.authUserId) throw new Error('인증 정보가 없습니다.')

  const templateStore = createWebTemplateDocumentStore(ownerContext)
  const now = new Date().toISOString()
  const templateId = createEntityId('template')
  const document = createEmptyTemplateDocumentV1({
    id: templateId,
    ownerId: ownerContext.authUserId,
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
  await ensureWebOwnerDocumentKeyForSnapshot({
    supabase: input.supabase,
    documentId: templateId,
    ownerId: ownerContext.authUserId,
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

async function refreshWebTripDocumentIfRemoteNewer(
  supabase: SupabaseClient,
  documentId: EntityId,
  localDocument: TripDocumentV1,
): Promise<TripDocumentV1 | null> {
  if (!(await isRemoteDocumentNewer(supabase, documentId, localDocument.trip.updatedAt))) return null
  const restored = await restoreWebTripDocumentFromBackup({ supabase, documentId })
  return restored.document
}

async function refreshWebTemplateDocumentIfRemoteNewer(
  supabase: SupabaseClient,
  documentId: EntityId,
  localDocument: TemplateDocumentV1,
): Promise<TemplateDocumentV1 | null> {
  if (!(await isRemoteDocumentNewer(supabase, documentId, localDocument.template.updatedAt))) return null
  const restored = await restoreWebTemplateDocumentFromBackup({ supabase, documentId })
  return restored.document
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

export type WebDocumentPrimaryMutationResult =
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
