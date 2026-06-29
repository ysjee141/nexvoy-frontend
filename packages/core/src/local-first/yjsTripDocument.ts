import * as Y from 'yjs'
import type { TripDocumentV1 } from './documentModel'

const TRIP_DOCUMENT_MAP_NAME = 'tripDocumentV1'
const TRIP_DOCUMENT_VALUE_KEY = 'document'

export function createYjsTripDocument(initialDocument?: TripDocumentV1): Y.Doc {
  const doc = new Y.Doc()
  if (initialDocument) writeTripDocumentToYjs(doc, initialDocument)
  return doc
}

export function readTripDocumentFromYjs(doc: Y.Doc): TripDocumentV1 | null {
  const value = getTripDocumentMap(doc).get(TRIP_DOCUMENT_VALUE_KEY)
  if (!value) return null
  return cloneTripDocument(value as TripDocumentV1)
}

export function writeTripDocumentToYjs(doc: Y.Doc, tripDocument: TripDocumentV1): void {
  getTripDocumentMap(doc).set(TRIP_DOCUMENT_VALUE_KEY, cloneTripDocument(tripDocument))
}

export function mutateTripDocumentInYjs(
  doc: Y.Doc,
  mutate: (tripDocument: TripDocumentV1) => void,
): TripDocumentV1 {
  const tripDocument = readTripDocumentFromYjs(doc)
  if (!tripDocument) throw new Error('Trip document is not initialized.')

  mutate(tripDocument)
  writeTripDocumentToYjs(doc, tripDocument)
  return tripDocument
}

export function encodeTripDocumentUpdate(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc)
}

export function applyTripDocumentUpdate(doc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(doc, update)
}

function getTripDocumentMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(TRIP_DOCUMENT_MAP_NAME)
}

function cloneTripDocument(tripDocument: TripDocumentV1): TripDocumentV1 {
  return JSON.parse(JSON.stringify(tripDocument)) as TripDocumentV1
}
