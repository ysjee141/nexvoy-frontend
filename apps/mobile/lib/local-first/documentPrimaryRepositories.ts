import type { SupabaseClient } from '@supabase/supabase-js'
import {
  convertLegacyTripRowsToDocument,
  createDocumentPrimaryRepositoryBundle,
  createEmptyTemplateDocumentV1,
  getLegacyTripRowBundle,
  type DocumentMutationResult,
  type TemplateDocumentV1,
  type TripDocumentV1,
} from '@nexvoy/core'
import type { EntityId } from '@nexvoy/core/local-first/documentModel'
import type { DocumentPrimaryRepositoryBundle } from '@nexvoy/core/repositories/documentPrimaryRepository'
import { publishLocalMobileTripDocumentUpdate } from './p2pUpdateBridge'
import {
  createMobileTemplateDocumentStore,
  createMobileTripDocumentStore,
} from './mobileDocumentStores'

export async function createMobileDocumentPrimaryRepositories(
  supabase: SupabaseClient,
  options: {
    actorRole?: 'owner' | 'editor' | 'viewer' | null
  } = {},
): Promise<DocumentPrimaryRepositoryBundle> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id ?? 'anonymous-mobile-user'
  const actor = {
    userId,
    role: options.actorRole ?? 'viewer',
    status: 'accepted' as const,
  }

  const tripStore = createMobileTripDocumentStore({
    hydrateDocument: async (tripId) => {
      const bundle = await getLegacyTripRowBundle(supabase, tripId, data.user?.id ?? null)
      return bundle ? convertLegacyTripRowsToDocument(bundle).document : null
    },
  })
  const templateStore = createMobileTemplateDocumentStore({
    hydrateDocument: (templateId) => hydrateTemplateDocument(supabase, templateId),
    listLegacyDocumentIds: () => listLegacyTemplateIds(supabase, data.user?.id ?? null),
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
          }
        },
      },
    },
  })
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
  const templateStore = createMobileTemplateDocumentStore()
  const now = new Date().toISOString()
  const templateId = createEntityId('template')
  const document = createEmptyTemplateDocumentV1({
    id: templateId,
    ownerId: data.user?.id ?? null,
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

  await templateStore.putDocument(templateId, document)
  return templateId
}

async function listLegacyTemplateIds(
  supabase: SupabaseClient,
  currentUserId: string | null,
): Promise<EntityId[]> {
  if (!currentUserId) return []
  const owned = supabase
    .from('checklist_templates')
    .select('id')
    .eq('user_id', currentUserId)
  const publicTemplates = supabase
    .from('checklist_templates')
    .select('id')
    .is('user_id', null)
  const shared = supabase
    .from('checklist_template_shares')
    .select('template_id')
    .eq('shared_with_user_id', currentUserId)

  const [ownedResult, publicResult, sharedResult] = await Promise.all([owned, publicTemplates, shared])
  if (ownedResult.error) throw ownedResult.error
  if (publicResult.error) throw publicResult.error
  if (sharedResult.error) throw sharedResult.error

  return Array.from(new Set([
    ...(ownedResult.data ?? []).map((row) => row.id),
    ...(publicResult.data ?? []).map((row) => row.id),
    ...(sharedResult.data ?? []).map((row) => row.template_id),
  ]))
}

async function hydrateTemplateDocument(
  supabase: SupabaseClient,
  templateId: EntityId,
): Promise<TemplateDocumentV1 | null> {
  const { data: template, error: templateError } = await supabase
    .from('checklist_templates')
    .select('id, user_id, title, created_at')
    .eq('id', templateId)
    .maybeSingle()
  if (templateError) throw templateError
  if (!template) return null

  const [itemsResult, sharesResult] = await Promise.all([
    supabase
      .from('checklist_template_items')
      .select('id, template_id, item_name, category, is_private, created_at')
      .eq('template_id', templateId),
    supabase
      .from('checklist_template_shares')
      .select('id, template_id, shared_with_user_id, role, created_by, created_at')
      .eq('template_id', templateId),
  ])
  if (itemsResult.error) throw itemsResult.error
  if (sharesResult.error) throw sharesResult.error

  const createdAt = template.created_at ?? new Date().toISOString()
  const document = createEmptyTemplateDocumentV1({
    id: template.id,
    ownerId: template.user_id,
    title: template.title,
    visibility: (sharesResult.data?.length ?? 0) > 0 ? 'shared' : 'private',
    createdAt,
    updatedAt: createdAt,
    createdFromLegacyAt: new Date().toISOString(),
  })

  ;(itemsResult.data ?? []).forEach((item, index) => {
    const itemCreatedAt = item.created_at ?? createdAt
    document.items[item.id] = {
      id: item.id,
      templateId,
      name: item.item_name,
      categoryName: item.category ?? '기타',
      isPrivate: item.is_private ?? false,
      sortOrder: index,
      createdAt: itemCreatedAt,
      updatedAt: itemCreatedAt,
    }
  })

  ;(sharesResult.data ?? []).forEach((share) => {
    const shareCreatedAt = share.created_at ?? createdAt
    document.shares[share.id] = {
      id: share.id,
      templateId,
      sharedWithUserId: share.shared_with_user_id,
      role: share.role === 'editor' ? 'editor' : 'viewer',
      createdBy: share.created_by,
      createdAt: shareCreatedAt,
      updatedAt: null,
    }
  })

  return document
}

export type MobileDocumentPrimaryMutationResult =
  DocumentMutationResult<TripDocumentV1 | TemplateDocumentV1>

function createEntityId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
