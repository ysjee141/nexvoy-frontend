const DATABASE_NAME = 'onvoy-local-first-spike'
const DATABASE_VERSION = 1
const TRIP_DOCUMENT_STORE = 'tripDocuments'
const BROADCAST_CHANNEL_NAME = 'onvoy-local-first-checklist-spike'

export interface StoredTripDocumentUpdate {
  id: string
  update: ArrayBuffer
  updatedAt: string
}

export async function loadTripDocumentUpdate(documentId: string): Promise<Uint8Array | null> {
  if (!canUseIndexedDb()) return null
  const db = await openDatabase()
  const row = await runTransaction<StoredTripDocumentUpdate | undefined>(
    db,
    TRIP_DOCUMENT_STORE,
    'readonly',
    (store) => store.get(documentId),
  )
  db.close()

  return row ? new Uint8Array(row.update) : null
}

export async function saveTripDocumentUpdate(
  documentId: string,
  update: Uint8Array,
): Promise<void> {
  if (!canUseIndexedDb()) return
  const db = await openDatabase()
  await runTransaction(
    db,
    TRIP_DOCUMENT_STORE,
    'readwrite',
    (store) => store.put({
      id: documentId,
      update: toStandaloneArrayBuffer(update),
      updatedAt: new Date().toISOString(),
    } satisfies StoredTripDocumentUpdate),
  )
  db.close()
  notifyTripDocumentUpdated(documentId)
}

export function subscribeToTripDocumentUpdates(
  documentId: string,
  onUpdate: () => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined

  const handleWindowEvent = (event: Event) => {
    const customEvent = event as CustomEvent<{ documentId: string }>
    if (customEvent.detail?.documentId === documentId) onUpdate()
  }
  window.addEventListener(BROADCAST_CHANNEL_NAME, handleWindowEvent)

  const channel = typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel(BROADCAST_CHANNEL_NAME)
  channel?.addEventListener('message', (event: MessageEvent<{ documentId: string }>) => {
    if (event.data?.documentId === documentId) onUpdate()
  })

  return () => {
    window.removeEventListener(BROADCAST_CHANNEL_NAME, handleWindowEvent)
    channel?.close()
  }
}

function notifyTripDocumentUpdated(documentId: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BROADCAST_CHANNEL_NAME, { detail: { documentId } }))
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    channel.postMessage({ documentId })
    channel.close()
  }
}

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(TRIP_DOCUMENT_STORE)) {
        db.createObjectStore(TRIP_DOCUMENT_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function runTransaction<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const request = operation(transaction.objectStore(storeName))

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.onerror = () => reject(transaction.error)
  })
}

function toStandaloneArrayBuffer(update: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(update.byteLength)
  new Uint8Array(buffer).set(update)
  return buffer
}
