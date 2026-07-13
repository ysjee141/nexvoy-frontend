import { applyAndPersistMobileTripDocumentUpdate } from './mobileYjsTripDocument'

export interface RegisterMobileP2PUpdateSenderInput {
  documentId: string
  send: (update: Uint8Array) => boolean
}

export interface PublishLocalMobileTripDocumentUpdateInput {
  documentId: string
  update: Uint8Array
}

export interface ApplyRemoteMobileTripDocumentUpdateInput {
  documentId: string
  update: Uint8Array
}

const activeSenders = new Map<string, Set<(update: Uint8Array) => boolean>>()

export function registerMobileP2PUpdateSender(
  input: RegisterMobileP2PUpdateSenderInput,
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

export function publishLocalMobileTripDocumentUpdate(
  input: PublishLocalMobileTripDocumentUpdateInput,
): void {
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

export async function applyRemoteMobileTripDocumentUpdate(
  input: ApplyRemoteMobileTripDocumentUpdateInput,
): Promise<void> {
  await applyAndPersistMobileTripDocumentUpdate({
    documentId: input.documentId,
    update: input.update,
  })
}
