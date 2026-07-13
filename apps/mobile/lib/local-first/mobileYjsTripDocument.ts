import AsyncStorage from '@react-native-async-storage/async-storage'
import type { TripDocumentV1 } from '@nexvoy/core/local-first/documentModel'
import {
  applyTripDocumentUpdate,
  createYjsTripDocument,
  encodeTripDocumentUpdate,
  mutateTripDocumentInYjs,
  readTripDocumentFromYjs,
  writeTripDocumentToYjs,
} from '@nexvoy/core/local-first/yjsTripDocument'

type YjsTripDocument = ReturnType<typeof createYjsTripDocument>

export interface MobileTripDocumentKey {
  documentId: string
}

export interface ApplyMobileTripDocumentUpdateInput extends MobileTripDocumentKey {
  update: Uint8Array
}

const STORAGE_KEY_PREFIX = 'onvoy:local-first:yjs-update:'
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function createMobileYjsTripDocument(initialDocument?: TripDocumentV1): YjsTripDocument {
  return createYjsTripDocument(initialDocument)
}

export function readTripDocumentFromMobileYjs(doc: YjsTripDocument): TripDocumentV1 | null {
  return readTripDocumentFromYjs(doc)
}

export function writeTripDocumentToMobileYjs(
  doc: YjsTripDocument,
  tripDocument: TripDocumentV1,
): void {
  writeTripDocumentToYjs(doc, tripDocument)
}

export function mutateTripDocumentInMobileYjs(
  doc: YjsTripDocument,
  mutate: (tripDocument: TripDocumentV1) => void,
): TripDocumentV1 {
  return mutateTripDocumentInYjs(doc, mutate)
}

export function encodeMobileTripDocumentUpdate(doc: YjsTripDocument): Uint8Array {
  return encodeTripDocumentUpdate(doc)
}

export function applyMobileTripDocumentUpdateToDoc(
  doc: YjsTripDocument,
  update: Uint8Array,
): void {
  applyTripDocumentUpdate(doc, update)
}

export async function loadMobileTripDocumentUpdate(
  key: MobileTripDocumentKey,
): Promise<Uint8Array | null> {
  const encoded = await AsyncStorage.getItem(getStorageKey(key.documentId))
  if (!encoded) return null
  return base64ToBytes(encoded)
}

export async function saveMobileTripDocumentUpdate(
  key: MobileTripDocumentKey,
  update: Uint8Array,
): Promise<void> {
  await AsyncStorage.setItem(getStorageKey(key.documentId), bytesToBase64(update))
}

export async function loadMobileYjsTripDocument(
  key: MobileTripDocumentKey,
): Promise<YjsTripDocument> {
  const doc = createMobileYjsTripDocument()
  const update = await loadMobileTripDocumentUpdate(key)
  if (update) applyMobileTripDocumentUpdateToDoc(doc, update)
  return doc
}

export async function saveMobileYjsTripDocument(
  key: MobileTripDocumentKey,
  doc: YjsTripDocument,
): Promise<void> {
  await saveMobileTripDocumentUpdate(key, encodeMobileTripDocumentUpdate(doc))
}

export async function applyAndPersistMobileTripDocumentUpdate(
  input: ApplyMobileTripDocumentUpdateInput,
): Promise<TripDocumentV1 | null> {
  const doc = await loadMobileYjsTripDocument({ documentId: input.documentId })
  applyMobileTripDocumentUpdateToDoc(doc, input.update)
  await saveMobileYjsTripDocument({ documentId: input.documentId }, doc)
  return readTripDocumentFromMobileYjs(doc)
}

export async function replaceMobileTripDocument(
  key: MobileTripDocumentKey,
  tripDocument: TripDocumentV1,
): Promise<Uint8Array> {
  const doc = createMobileYjsTripDocument(tripDocument)
  const update = encodeMobileTripDocumentUpdate(doc)
  await saveMobileTripDocumentUpdate(key, update)
  return update
}

function getStorageKey(documentId: string): string {
  return `${STORAGE_KEY_PREFIX}${documentId}`
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
