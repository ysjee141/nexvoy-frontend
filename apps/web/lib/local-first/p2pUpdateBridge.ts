import {
  applyTripDocumentUpdate,
  createYjsTripDocument,
  encodeTripDocumentUpdate,
  readTripDocumentFromYjs,
  writeTripDocumentToYjs,
} from '@nexvoy/core/local-first/yjsTripDocument'
import type { TripDocumentV1 } from '@nexvoy/core/local-first/documentModel'
import type { OwnerNamespace } from '@nexvoy/core/local-first/guestIdentity'
import {
  loadTripDocumentUpdate,
  saveTripDocumentUpdate,
} from './indexedDbStore'

export interface RegisterWebP2PUpdateSenderInput {
  documentId: string
  send: (update: Uint8Array) => boolean
}

export interface PublishLocalTripDocumentUpdateInput {
  documentId: string
  update: Uint8Array
}

export interface ApplyRemoteTripDocumentUpdateInput {
  namespace: OwnerNamespace
  documentId: string
  update: Uint8Array
}

const activeSenders = new Map<string, Set<(update: Uint8Array) => boolean>>()

export function registerWebP2PUpdateSender(
  input: RegisterWebP2PUpdateSenderInput,
): () => void {
  const senders = activeSenders.get(input.documentId) ?? new Set()
  senders.add(input.send)
  activeSenders.set(input.documentId, senders)

  return () => {
    senders.delete(input.send)
    if (senders.size === 0) {
      activeSenders.delete(input.documentId)
    }
  }
}

export function publishLocalTripDocumentUpdate(input: PublishLocalTripDocumentUpdateInput): void {
  const senders = activeSenders.get(input.documentId)
  if (!senders?.size) return

  for (const send of senders) {
    try {
      send(input.update)
    } catch {
      // P2P is an optional fast path; failed sends fall back to backup sync.
    }
  }
}

export async function applyRemoteTripDocumentUpdate(
  input: ApplyRemoteTripDocumentUpdateInput,
): Promise<void> {
  const ydoc = createYjsTripDocument()
  const remoteDoc = createYjsTripDocument()
  applyTripDocumentUpdate(remoteDoc, input.update)
  const remoteSnapshot = readTripDocumentFromYjs(remoteDoc)

  const existingUpdate = await loadTripDocumentUpdate({
    namespace: input.namespace,
    documentId: input.documentId,
  })
  let localSnapshot: TripDocumentV1 | null = null
  if (existingUpdate) {
    applyTripDocumentUpdate(ydoc, existingUpdate)
    localSnapshot = readTripDocumentFromYjs(ydoc)
  }

  applyTripDocumentUpdate(ydoc, input.update)
  const appliedSnapshot = readTripDocumentFromYjs(ydoc)
  const mergedSnapshot = mergeTripDocumentSnapshots(
    localSnapshot,
    appliedSnapshot,
    remoteSnapshot,
  )
  if (mergedSnapshot) {
    writeTripDocumentToYjs(ydoc, mergedSnapshot)
  }

  await saveTripDocumentUpdate(
    { namespace: input.namespace, documentId: input.documentId },
    encodeTripDocumentUpdate(ydoc),
  )
}

function mergeTripDocumentSnapshots(
  localSnapshot: TripDocumentV1 | null,
  appliedSnapshot: TripDocumentV1 | null,
  remoteSnapshot: TripDocumentV1 | null,
): TripDocumentV1 | null {
  const base = cloneTripDocument(appliedSnapshot ?? localSnapshot ?? remoteSnapshot)
  if (!base) return null

  for (const snapshot of [localSnapshot, remoteSnapshot]) {
    if (!snapshot) continue

    base.trip = pickNewerByTimestamp(base.trip, snapshot.trip, 'updatedAt')
    base.plans = mergeTimestampedRecords(base.plans, snapshot.plans, 'updatedAt')
    base.planUrls = mergeCreatedRecords(base.planUrls, snapshot.planUrls)
    base.checklists = mergeCreatedRecords(base.checklists, snapshot.checklists)
    base.checklistItems = mergeTimestampedRecords(
      base.checklistItems,
      snapshot.checklistItems,
      'updatedAt',
    )
    base.checklistCategories = mergeTimestampedRecords(
      base.checklistCategories,
      snapshot.checklistCategories,
      'updatedAt',
    )
    base.checklistItemAssignees = mergeCreatedRecords(
      base.checklistItemAssignees,
      snapshot.checklistItemAssignees,
    )
    base.checklistItemUserChecks = mergeCreatedRecords(
      base.checklistItemUserChecks,
      snapshot.checklistItemUserChecks,
    )
    base.members = mergeNullableTimestampedRecords(base.members, snapshot.members, 'updatedAt')
    base.shares = mergeCreatedRecords(base.shares, snapshot.shares)
    base.invitationLinks = mergeCreatedRecords(base.invitationLinks, snapshot.invitationLinks)
    base.assets = mergeCreatedRecords(base.assets, snapshot.assets)
    base.tombstones = mergeTimestampedRecords(base.tombstones, snapshot.tombstones, 'deletedAt')
    base.planOrder = mergeOrderedIds(base.planOrder, snapshot.planOrder)
    base.meta = { ...base.meta, ...snapshot.meta }
  }

  return base
}

function mergeTimestampedRecords<T extends object, K extends keyof T>(
  base: Record<string, T>,
  incoming: Record<string, T>,
  timestampKey: K,
): Record<string, T> {
  const next = { ...base }
  for (const [id, value] of Object.entries(incoming)) {
    next[id] = next[id]
      ? pickNewerByTimestamp(next[id], value, timestampKey)
      : cloneValue(value)
  }
  return next
}

function mergeNullableTimestampedRecords<T extends object, K extends keyof T>(
  base: Record<string, T>,
  incoming: Record<string, T>,
  timestampKey: K,
): Record<string, T> {
  const next = { ...base }
  for (const [id, value] of Object.entries(incoming)) {
    next[id] = next[id]
      ? pickNewerByNullableTimestamp(next[id], value, timestampKey)
      : cloneValue(value)
  }
  return next
}

function mergeCreatedRecords<T extends { createdAt: string }>(
  base: Record<string, T>,
  incoming: Record<string, T>,
): Record<string, T> {
  const next = { ...base }
  for (const [id, value] of Object.entries(incoming)) {
    if (!next[id]) next[id] = cloneValue(value)
  }
  return next
}

function pickNewerByTimestamp<T extends object, K extends keyof T>(
  base: T,
  incoming: T,
  timestampKey: K,
): T {
  return String(incoming[timestampKey]).localeCompare(String(base[timestampKey])) > 0
    ? cloneValue(incoming)
    : base
}

function pickNewerByNullableTimestamp<T extends object, K extends keyof T>(
  base: T,
  incoming: T,
  timestampKey: K,
): T {
  const baseTimestamp = base[timestampKey] == null ? '' : String(base[timestampKey])
  const incomingTimestamp = incoming[timestampKey] == null ? '' : String(incoming[timestampKey])
  return incomingTimestamp.localeCompare(baseTimestamp) > 0
    ? cloneValue(incoming)
    : base
}

function mergeOrderedIds(base: string[], incoming: string[]): string[] {
  return Array.from(new Set([...base, ...incoming]))
}

function cloneTripDocument(document: TripDocumentV1 | null | undefined): TripDocumentV1 | null {
  return document ? cloneValue(document) : null
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
