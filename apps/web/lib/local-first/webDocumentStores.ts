import type {
  LocalDocumentStore,
} from '@nexvoy/core/repositories/documentPrimaryRepository'
import type {
  EntityId,
  TripDocumentV1,
} from '@nexvoy/core/local-first/documentModel'
import type {
  TemplateDocumentV1,
} from '@nexvoy/core/local-first/templateDocument'
import {
  applyTripDocumentUpdate,
  createYjsTripDocument,
  encodeTripDocumentUpdate,
  readTripDocumentFromYjs,
} from '@nexvoy/core/local-first/yjsTripDocument'
import {
  applyTemplateDocumentUpdate,
  createYjsTemplateDocument,
  encodeTemplateDocumentUpdate,
  readTemplateDocumentFromYjs,
} from '@nexvoy/core/local-first/templateDocument'
import {
  loadAllTripDocumentUpdates,
  loadTripDocumentUpdate,
  saveTripDocumentUpdate,
} from './indexedDbStore'
import type { WebOwnerContext } from './ownerNamespace'

const TEMPLATE_NAMESPACE_SUFFIX = ':templates'

export function createWebTripDocumentStore(
  ownerContext: WebOwnerContext,
  options: {
    hydrateDocument?: (documentId: EntityId) => Promise<TripDocumentV1 | null>
    listLegacyDocumentIds?: () => Promise<EntityId[]>
  } = {},
): LocalDocumentStore<TripDocumentV1> {
  return {
    listDocumentIds: async () => {
      const rows = await loadAllTripDocumentUpdates(ownerContext.namespace)
      const localIds = rows
        .map((row) => row.documentId)
        .filter((documentId): documentId is string => Boolean(documentId))
      const legacyIds = await options.listLegacyDocumentIds?.() ?? []
      return Array.from(new Set([...localIds, ...legacyIds]))
    },
    getDocument: async (documentId) => {
      const update = await loadTripDocumentUpdate({
        namespace: ownerContext.namespace,
        documentId,
      })
      if (!update) {
        const hydrated = await options.hydrateDocument?.(documentId)
        if (!hydrated) return null
        await putTripDocument(ownerContext.namespace, documentId, hydrated)
        return hydrated
      }

      const doc = createYjsTripDocument()
      applyTripDocumentUpdate(doc, update)
      return readTripDocumentFromYjs(doc)
    },
    putDocument: async (documentId, document, update) => {
      if (update) {
        await saveTripDocumentUpdate({ namespace: ownerContext.namespace, documentId }, update)
        return
      }
      await putTripDocument(ownerContext.namespace, documentId, document)
    },
  }
}

export function createWebTemplateDocumentStore(
  ownerContext: WebOwnerContext,
  options: {
    hydrateDocument?: (documentId: EntityId) => Promise<TemplateDocumentV1 | null>
    listLegacyDocumentIds?: () => Promise<EntityId[]>
  } = {},
): LocalDocumentStore<TemplateDocumentV1> {
  const namespace = getTemplateNamespace(ownerContext)
  return {
    listDocumentIds: async () => {
      const rows = await loadAllTripDocumentUpdates(namespace)
      const localIds = rows
        .map((row) => row.documentId)
        .filter((documentId): documentId is string => Boolean(documentId))
      const legacyIds = await options.listLegacyDocumentIds?.() ?? []
      return Array.from(new Set([...localIds, ...legacyIds]))
    },
    getDocument: async (documentId) => {
      const update = await loadTripDocumentUpdate({ namespace, documentId })
      if (!update) {
        const hydrated = await options.hydrateDocument?.(documentId)
        if (!hydrated) return null
        await putTemplateDocument(namespace, documentId, hydrated)
        return hydrated
      }

      const doc = createYjsTemplateDocument()
      applyTemplateDocumentUpdate(doc, update)
      return readTemplateDocumentFromYjs(doc)
    },
    putDocument: async (documentId, document, update) => {
      if (update) {
        await saveTripDocumentUpdate({ namespace, documentId }, update)
        return
      }
      await putTemplateDocument(namespace, documentId, document)
    },
  }
}

async function putTripDocument(
  namespace: string,
  documentId: EntityId,
  document: TripDocumentV1,
): Promise<void> {
  const doc = createYjsTripDocument(document)
  await saveTripDocumentUpdate({ namespace, documentId }, encodeTripDocumentUpdate(doc))
}

async function putTemplateDocument(
  namespace: string,
  documentId: EntityId,
  document: TemplateDocumentV1,
): Promise<void> {
  const doc = createYjsTemplateDocument(document)
  await saveTripDocumentUpdate({ namespace, documentId }, encodeTemplateDocumentUpdate(doc))
}

function getTemplateNamespace(ownerContext: WebOwnerContext): string {
  return `${ownerContext.namespace}${TEMPLATE_NAMESPACE_SUFFIX}`
}
