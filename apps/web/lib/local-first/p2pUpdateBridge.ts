import {
  applyTripDocumentUpdate,
  createYjsTripDocument,
  encodeTripDocumentUpdate,
} from '@nexvoy/core/local-first/yjsTripDocument'
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
  const existingUpdate = await loadTripDocumentUpdate({
    namespace: input.namespace,
    documentId: input.documentId,
  })
  if (existingUpdate) {
    applyTripDocumentUpdate(ydoc, existingUpdate)
  }

  applyTripDocumentUpdate(ydoc, input.update)
  await saveTripDocumentUpdate(
    { namespace: input.namespace, documentId: input.documentId },
    encodeTripDocumentUpdate(ydoc),
  )
}
