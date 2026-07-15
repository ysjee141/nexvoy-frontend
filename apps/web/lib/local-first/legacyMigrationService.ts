import type { SupabaseClient } from '@supabase/supabase-js'
import {
  TRIP_DOCUMENT_SCHEMA_VERSION,
  convertLegacyTemplateRowsToDocument,
  convertLegacyTripRowsToDocument,
  type LegacyTemplateRowBundle,
  type MigrationValidationMessage,
} from '@nexvoy/core'
import { getLegacyTripRowBundle } from '@nexvoy/core/supabase/legacyRepository'
import { createSupabaseBackupRepository } from '@nexvoy/core/supabase/backupRepository'
import { createYjsTripDocument, encodeTripDocumentUpdate } from '@nexvoy/core/local-first/yjsTripDocument'
import {
  TEMPLATE_DOCUMENT_SCHEMA_VERSION,
  createYjsTemplateDocument,
  encodeTemplateDocumentUpdate,
} from '@nexvoy/core/local-first/templateDocument'
import { ensureWebOwnerDocumentKeyForSnapshot } from './keyProvisioningService'
import { resolveWebOwnerContext } from './ownerNamespace'
import { restoreWebTemplateDocumentFromBackup, restoreWebTripDocumentFromBackup } from './backupRestoreService'
import { createWebTemplateDocumentStore, createWebTripDocumentStore } from './webDocumentStores'

export type LegacyMigrationKind = 'trip' | 'template'

export interface LegacyMigrationCandidate {
  kind: LegacyMigrationKind
  id: string
  title: string
  updatedAt: string
  existingDocument: boolean
  details: {
    plans?: number
    checklistItems?: number
    templateItems?: number
    shares?: number
  }
}

export interface LegacyMigrationDryRunReport {
  kind: LegacyMigrationKind
  id: string
  title: string
  entityCounts: Record<string, number>
  validationMessages: MigrationValidationMessage[]
  blocked: boolean
}

export interface LegacyMigrationResult extends LegacyMigrationDryRunReport {
  status: 'migrated' | 'skipped'
  restoreStatus: 'restored' | 'missing' | 'key_unavailable' | 'failed'
}

export async function scanLegacyMigrationCandidates(
  supabase: SupabaseClient,
): Promise<LegacyMigrationCandidate[]> {
  const userId = await requireCurrentUserId(supabase)
  const [documentsRes, tripsRes, templatesRes] = await Promise.all([
    supabase.from('documents').select('id,type'),
    supabase
      .from('trips')
      .select('id,destination,start_date,end_date,created_at,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('checklist_templates')
      .select('id,title,user_id,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  if (documentsRes.error) throw documentsRes.error
  if (tripsRes.error) throw tripsRes.error
  if (templatesRes.error) throw templatesRes.error

  const existingDocuments = new Set((documentsRes.data ?? []).map((row) => row.id))
  const tripRows = tripsRes.data ?? []
  const templateRows = templatesRes.data ?? []
  const [tripCounts, templateCounts] = await Promise.all([
    getLegacyTripCounts(supabase, tripRows.map((row) => row.id)),
    getLegacyTemplateCounts(supabase, templateRows.map((row) => row.id)),
  ])

  return [
    ...tripRows.map((trip) => ({
      kind: 'trip' as const,
      id: trip.id,
      title: `${trip.destination} (${trip.start_date} - ${trip.end_date})`,
      updatedAt: trip.updated_at ?? trip.created_at,
      existingDocument: existingDocuments.has(trip.id),
      details: tripCounts.get(trip.id) ?? {},
    })),
    ...templateRows.map((template) => ({
      kind: 'template' as const,
      id: template.id,
      title: template.title,
      updatedAt: template.created_at,
      existingDocument: existingDocuments.has(template.id),
      details: templateCounts.get(template.id) ?? {},
    })),
  ].sort((a, b) => Number(a.existingDocument) - Number(b.existingDocument) || b.updatedAt.localeCompare(a.updatedAt))
}

export async function dryRunLegacyMigration(
  supabase: SupabaseClient,
  input: { kind: LegacyMigrationKind; id: string },
): Promise<LegacyMigrationDryRunReport> {
  const userId = await requireCurrentUserId(supabase)
  if (input.kind === 'trip') {
    const bundle = await getLegacyTripRowBundle(supabase, input.id, userId)
    if (!bundle) throw new Error('legacy_trip_not_found')
    if (bundle.trip.user_id !== userId) throw new Error('legacy_trip_not_owned_by_current_user')
    const result = convertLegacyTripRowsToDocument(bundle)
    return {
      kind: 'trip',
      id: bundle.trip.id,
      title: bundle.trip.destination,
      entityCounts: {
        plans: Object.keys(result.document.plans).length,
        planUrls: Object.keys(result.document.planUrls).length,
        checklists: Object.keys(result.document.checklists).length,
        checklistItems: Object.keys(result.document.checklistItems).length,
        members: Object.keys(result.document.members).length,
        shares: Object.keys(result.document.shares).length,
      },
      validationMessages: result.validationMessages,
      blocked: result.validationMessages.some((message) => message.severity === 'error'),
    }
  }

  const bundle = await getLegacyTemplateRowBundle(supabase, input.id, userId)
  const result = convertLegacyTemplateRowsToDocument(bundle)
  return {
    kind: 'template',
    id: bundle.template.id,
    title: bundle.template.title,
    entityCounts: {
      items: Object.keys(result.document.items).length,
      shares: Object.keys(result.document.shares).length,
    },
    validationMessages: result.validationMessages,
    blocked: result.validationMessages.some((message) => message.severity === 'error'),
  }
}

export async function migrateLegacyDocument(
  supabase: SupabaseClient,
  input: { kind: LegacyMigrationKind; id: string },
): Promise<LegacyMigrationResult> {
  const userId = await requireCurrentUserId(supabase)
  if (await createSupabaseBackupRepository(supabase).hasSnapshot(input.id)) {
    return {
      ...(await dryRunLegacyMigration(supabase, input)),
      status: 'skipped',
      restoreStatus: 'missing',
    }
  }

  const ownerContext = await resolveWebOwnerContext(supabase)
  if (!ownerContext.authUserId) throw new Error('auth_user_missing')

  if (input.kind === 'trip') {
    const bundle = await getLegacyTripRowBundle(supabase, input.id, userId)
    if (!bundle) throw new Error('legacy_trip_not_found')
    if (bundle.trip.user_id !== userId) throw new Error('legacy_trip_not_owned_by_current_user')
    const result = convertLegacyTripRowsToDocument(bundle)
    if (result.validationMessages.some((message) => message.severity === 'error')) {
      throw new Error('legacy_trip_validation_failed')
    }

    const update = encodeTripDocumentUpdate(createYjsTripDocument(result.document))
    await createWebTripDocumentStore(ownerContext).putDocument(input.id, result.document, update)
    await ensureWebOwnerDocumentKeyForSnapshot({
      supabase,
      documentId: input.id,
      documentType: 'trip',
      schemaVersion: TRIP_DOCUMENT_SCHEMA_VERSION,
      snapshotPayload: update,
    })
    const restore = await restoreWebTripDocumentFromBackup({ supabase, documentId: input.id })
    return {
      kind: 'trip',
      id: bundle.trip.id,
      title: bundle.trip.destination,
      entityCounts: {
        plans: Object.keys(result.document.plans).length,
        planUrls: Object.keys(result.document.planUrls).length,
        checklists: Object.keys(result.document.checklists).length,
        checklistItems: Object.keys(result.document.checklistItems).length,
        members: Object.keys(result.document.members).length,
        shares: Object.keys(result.document.shares).length,
      },
      validationMessages: result.validationMessages,
      blocked: false,
      status: 'migrated',
      restoreStatus: restore.status,
    }
  }

  const bundle = await getLegacyTemplateRowBundle(supabase, input.id, userId)
  const result = convertLegacyTemplateRowsToDocument(bundle)
  if (result.validationMessages.some((message) => message.severity === 'error')) {
    throw new Error('legacy_template_validation_failed')
  }

  const update = encodeTemplateDocumentUpdate(createYjsTemplateDocument(result.document))
  await createWebTemplateDocumentStore(ownerContext).putDocument(input.id, result.document, update)
  await ensureWebOwnerDocumentKeyForSnapshot({
    supabase,
    documentId: input.id,
    documentType: 'template',
    schemaVersion: TEMPLATE_DOCUMENT_SCHEMA_VERSION,
    snapshotPayload: update,
  })
  const restore = await restoreWebTemplateDocumentFromBackup({ supabase, documentId: input.id })
  return {
    kind: 'template',
    id: bundle.template.id,
    title: bundle.template.title,
    entityCounts: {
      items: Object.keys(result.document.items).length,
      shares: Object.keys(result.document.shares).length,
    },
    validationMessages: result.validationMessages,
    blocked: false,
    status: 'migrated',
    restoreStatus: restore.status,
  }
}

async function getLegacyTemplateRowBundle(
  supabase: SupabaseClient,
  templateId: string,
  userId: string,
): Promise<LegacyTemplateRowBundle> {
  const [templateRes, itemsRes, sharesRes] = await Promise.all([
    supabase
      .from('checklist_templates')
      .select('*')
      .eq('id', templateId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('checklist_template_items')
      .select('*')
      .eq('template_id', templateId)
      .order('category', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('checklist_template_shares')
      .select('*')
      .eq('template_id', templateId),
  ])

  if (templateRes.error) throw templateRes.error
  if (itemsRes.error) throw itemsRes.error
  if (sharesRes.error) throw sharesRes.error
  if (!templateRes.data) throw new Error('legacy_template_not_found')

  return {
    exportedAt: new Date().toISOString(),
    template: templateRes.data,
    items: itemsRes.data ?? [],
    shares: sharesRes.data ?? [],
  }
}

async function getLegacyTripCounts(
  supabase: SupabaseClient,
  tripIds: string[],
): Promise<Map<string, LegacyMigrationCandidate['details']>> {
  if (tripIds.length === 0) return new Map()
  const [plansRes, checklistsRes] = await Promise.all([
    supabase.from('plans').select('trip_id').in('trip_id', tripIds),
    supabase.from('checklists').select('id,trip_id').in('trip_id', tripIds),
  ])
  if (plansRes.error) throw plansRes.error
  if (checklistsRes.error) throw checklistsRes.error

  const counts = new Map<string, LegacyMigrationCandidate['details']>()
  for (const tripId of tripIds) counts.set(tripId, { plans: 0, checklistItems: 0 })
  for (const plan of plansRes.data ?? []) {
    const details = counts.get(plan.trip_id) ?? {}
    details.plans = (details.plans ?? 0) + 1
    counts.set(plan.trip_id, details)
  }

  const checklistIds = (checklistsRes.data ?? []).map((row) => row.id)
  if (checklistIds.length === 0) return counts
  const itemsRes = await supabase
    .from('checklist_items')
    .select('checklist_id')
    .in('checklist_id', checklistIds)
  if (itemsRes.error) throw itemsRes.error

  const tripIdByChecklistId = new Map((checklistsRes.data ?? []).map((row) => [row.id, row.trip_id]))
  for (const item of itemsRes.data ?? []) {
    const tripId = tripIdByChecklistId.get(item.checklist_id)
    if (!tripId) continue
    const details = counts.get(tripId) ?? {}
    details.checklistItems = (details.checklistItems ?? 0) + 1
    counts.set(tripId, details)
  }
  return counts
}

async function getLegacyTemplateCounts(
  supabase: SupabaseClient,
  templateIds: string[],
): Promise<Map<string, LegacyMigrationCandidate['details']>> {
  if (templateIds.length === 0) return new Map()
  const [itemsRes, sharesRes] = await Promise.all([
    supabase.from('checklist_template_items').select('template_id').in('template_id', templateIds),
    supabase.from('checklist_template_shares').select('template_id').in('template_id', templateIds),
  ])
  if (itemsRes.error) throw itemsRes.error
  if (sharesRes.error) throw sharesRes.error

  const counts = new Map<string, LegacyMigrationCandidate['details']>()
  for (const templateId of templateIds) counts.set(templateId, { templateItems: 0, shares: 0 })
  for (const item of itemsRes.data ?? []) {
    const details = counts.get(item.template_id) ?? {}
    details.templateItems = (details.templateItems ?? 0) + 1
    counts.set(item.template_id, details)
  }
  for (const share of sharesRes.data ?? []) {
    const details = counts.get(share.template_id) ?? {}
    details.shares = (details.shares ?? 0) + 1
    counts.set(share.template_id, details)
  }
  return counts
}

async function requireCurrentUserId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('auth_user_missing')
  return data.user.id
}
