import AsyncStorage from '@react-native-async-storage/async-storage'
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

const TRIP_UPDATE_PREFIX = 'onvoy:local-first:yjs-update:'
const TEMPLATE_UPDATE_PREFIX = 'onvoy:local-first:template-yjs-update:'
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function createMobileTripDocumentStore(options: {
  hydrateDocument?: (documentId: EntityId) => Promise<TripDocumentV1 | null>
} = {}): LocalDocumentStore<TripDocumentV1> {
  return {
    listDocumentIds: async () => listDocumentIds(TRIP_UPDATE_PREFIX),
    getDocument: async (documentId) => {
      const update = await loadDocumentUpdate(TRIP_UPDATE_PREFIX, documentId)
      if (!update) {
        const hydrated = await options.hydrateDocument?.(documentId)
        if (!hydrated) return null
        await putTripDocument(documentId, hydrated)
        return hydrated
      }

      const doc = createYjsTripDocument()
      applyTripDocumentUpdate(doc, update)
      return readTripDocumentFromYjs(doc)
    },
    putDocument: async (documentId, document, update) => {
      if (update) {
        await saveDocumentUpdate(TRIP_UPDATE_PREFIX, documentId, update)
        return
      }
      await putTripDocument(documentId, document)
    },
  }
}

export function createMobileTemplateDocumentStore(options: {
  hydrateDocument?: (documentId: EntityId) => Promise<TemplateDocumentV1 | null>
  listLegacyDocumentIds?: () => Promise<EntityId[]>
} = {}): LocalDocumentStore<TemplateDocumentV1> {
  return {
    listDocumentIds: async () => {
      const localIds = await listDocumentIds(TEMPLATE_UPDATE_PREFIX)
      const legacyIds = await options.listLegacyDocumentIds?.() ?? []
      return Array.from(new Set([...localIds, ...legacyIds]))
    },
    getDocument: async (documentId) => {
      const update = await loadDocumentUpdate(TEMPLATE_UPDATE_PREFIX, documentId)
      if (!update) {
        const hydrated = await options.hydrateDocument?.(documentId)
        if (!hydrated) return null
        await putTemplateDocument(documentId, hydrated)
        return hydrated
      }

      const doc = createYjsTemplateDocument()
      applyTemplateDocumentUpdate(doc, update)
      return readTemplateDocumentFromYjs(doc)
    },
    putDocument: async (documentId, document, update) => {
      if (update) {
        await saveDocumentUpdate(TEMPLATE_UPDATE_PREFIX, documentId, update)
        return
      }
      await putTemplateDocument(documentId, document)
    },
  }
}

async function putTripDocument(
  documentId: EntityId,
  document: TripDocumentV1,
): Promise<void> {
  const doc = createYjsTripDocument(document)
  await saveDocumentUpdate(TRIP_UPDATE_PREFIX, documentId, encodeTripDocumentUpdate(doc))
}

async function putTemplateDocument(
  documentId: EntityId,
  document: TemplateDocumentV1,
): Promise<void> {
  const doc = createYjsTemplateDocument(document)
  await saveDocumentUpdate(TEMPLATE_UPDATE_PREFIX, documentId, encodeTemplateDocumentUpdate(doc))
}

async function listDocumentIds(prefix: string): Promise<EntityId[]> {
  const keys = await AsyncStorage.getAllKeys()
  return keys
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
    .filter(Boolean)
}

async function loadDocumentUpdate(prefix: string, documentId: EntityId): Promise<Uint8Array | null> {
  const encoded = await AsyncStorage.getItem(`${prefix}${documentId}`)
  return encoded ? base64ToBytes(encoded) : null
}

async function saveDocumentUpdate(
  prefix: string,
  documentId: EntityId,
  update: Uint8Array,
): Promise<void> {
  await AsyncStorage.setItem(`${prefix}${documentId}`, bytesToBase64(update))
}

function bytesToBase64(bytes: Uint8Array): string {
  let output = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    const combined = (first << 16) | ((second ?? 0) << 8) | (third ?? 0)

    output += BASE64_ALPHABET[(combined >> 18) & 63]
    output += BASE64_ALPHABET[(combined >> 12) & 63]
    output += index + 1 < bytes.length ? BASE64_ALPHABET[(combined >> 6) & 63] : '='
    output += index + 2 < bytes.length ? BASE64_ALPHABET[combined & 63] : '='
  }
  return output
}

function base64ToBytes(base64: string): Uint8Array | null {
  const normalized = base64.replace(/\s/g, '')
  if (normalized.length % 4 !== 0) return null

  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  const bytes = new Uint8Array((normalized.length / 4) * 3 - padding)
  let byteIndex = 0

  for (let index = 0; index < normalized.length; index += 4) {
    const first = decodeBase64Char(normalized[index])
    const second = decodeBase64Char(normalized[index + 1])
    const third = normalized[index + 2] === '=' ? 0 : decodeBase64Char(normalized[index + 2])
    const fourth = normalized[index + 3] === '=' ? 0 : decodeBase64Char(normalized[index + 3])

    if (first < 0 || second < 0 || third < 0 || fourth < 0) return null
    const combined = (first << 18) | (second << 12) | (third << 6) | fourth

    if (byteIndex < bytes.length) bytes[byteIndex] = (combined >> 16) & 255
    byteIndex += 1
    if (byteIndex < bytes.length) bytes[byteIndex] = (combined >> 8) & 255
    byteIndex += 1
    if (byteIndex < bytes.length) bytes[byteIndex] = combined & 255
    byteIndex += 1
  }

  return bytes
}

function decodeBase64Char(char: string): number {
  return BASE64_ALPHABET.indexOf(char)
}
