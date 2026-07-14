const DATABASE_NAME = 'onvoy-local-first-spike'
const DATABASE_VERSION = 3
const TRIP_DOCUMENT_STORE = 'tripDocuments'
const KEY_MATERIAL_STORE = 'webDeviceKeyMaterials'
const BACKUP_QUEUE_STORE = 'backupQueues'
const BROADCAST_CHANNEL_NAME = 'onvoy-local-first-checklist-spike'

export interface StoredTripDocumentUpdate {
  id: string
  namespace?: string
  documentId?: string
  update: ArrayBuffer
  updatedAt: string
}

export interface TripDocumentStoreKey {
  namespace: string
  documentId: string
}

export interface StoredWebDeviceKeyMaterial {
  id: string
  deviceId: string
  materialVersion: number
  publicKeyJwk: Record<string, unknown>
  privateKeyJwk: Record<string, unknown>
  updatedAt: string
}

export interface StoredBackupQueueState {
  id: string
  state: unknown
  updatedAt: string
}

export async function loadTripDocumentUpdate(input: string | TripDocumentStoreKey): Promise<Uint8Array | null> {
  if (!canUseIndexedDb()) return null
  const key = normalizeStoreKey(input)
  const db = await openDatabase()
  const row = await runTransaction<StoredTripDocumentUpdate | undefined>(
    db,
    TRIP_DOCUMENT_STORE,
    'readonly',
    (store) => store.get(key.id),
  )
  db.close()

  return row ? new Uint8Array(row.update) : null
}

export async function loadAllTripDocumentUpdates(namespace?: string): Promise<StoredTripDocumentUpdate[]> {
  if (!canUseIndexedDb()) return []
  const db = await openDatabase()
  const rows = await runTransaction<StoredTripDocumentUpdate[]>(
    db,
    TRIP_DOCUMENT_STORE,
    'readonly',
    (store) => store.getAll(),
  )
  db.close()

  return namespace
    ? rows.filter((row) => row.namespace === namespace)
    : rows
}

export async function saveTripDocumentUpdate(
  input: string | TripDocumentStoreKey,
  update: Uint8Array,
): Promise<void> {
  if (!canUseIndexedDb()) return
  const key = normalizeStoreKey(input)
  const db = await openDatabase()
  await runTransaction(
    db,
    TRIP_DOCUMENT_STORE,
    'readwrite',
    (store) => store.put({
      id: key.id,
      namespace: key.namespace,
      documentId: key.documentId,
      update: toStandaloneArrayBuffer(update),
      updatedAt: new Date().toISOString(),
    } satisfies StoredTripDocumentUpdate),
  )
  db.close()
  notifyTripDocumentUpdated(key.documentId)
}

export async function deleteTripDocumentUpdate(input: string | TripDocumentStoreKey): Promise<void> {
  if (!canUseIndexedDb()) return
  const key = normalizeStoreKey(input)
  const db = await openDatabase()
  await runTransaction(
    db,
    TRIP_DOCUMENT_STORE,
    'readwrite',
    (store) => store.delete(key.id),
  )
  db.close()
  notifyTripDocumentUpdated(key.documentId)
}

export async function deleteTripDocumentNamespace(namespace: string): Promise<void> {
  if (!canUseIndexedDb()) return
  const rows = await loadAllTripDocumentUpdates(namespace)
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(TRIP_DOCUMENT_STORE, 'readwrite')
    const store = transaction.objectStore(TRIP_DOCUMENT_STORE)
    for (const row of rows) {
      store.delete(row.id)
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

export async function deleteAllTripDocumentNamespaces(): Promise<void> {
  if (!canUseIndexedDb()) return
  const db = await openDatabase()
  await runTransaction(
    db,
    TRIP_DOCUMENT_STORE,
    'readwrite',
    (store) => store.clear(),
  )
  db.close()
}

export async function loadWebDeviceKeyMaterial(deviceId: string): Promise<StoredWebDeviceKeyMaterial | null> {
  if (!canUseIndexedDb()) return null
  const db = await openDatabase()
  const row = await runTransaction<StoredWebDeviceKeyMaterial | undefined>(
    db,
    KEY_MATERIAL_STORE,
    'readonly',
    (store) => store.get(deviceId),
  )
  db.close()

  return row ?? null
}

export async function saveWebDeviceKeyMaterial(
  material: Omit<StoredWebDeviceKeyMaterial, 'id' | 'updatedAt'>,
): Promise<void> {
  if (!canUseIndexedDb()) return
  const db = await openDatabase()
  await runTransaction(
    db,
    KEY_MATERIAL_STORE,
    'readwrite',
    (store) => store.put({
      ...material,
      id: material.deviceId,
      updatedAt: new Date().toISOString(),
    } satisfies StoredWebDeviceKeyMaterial),
  )
  db.close()
}

export async function deleteWebDeviceKeyMaterial(deviceId: string): Promise<void> {
  if (!canUseIndexedDb()) return
  const db = await openDatabase()
  await runTransaction(
    db,
    KEY_MATERIAL_STORE,
    'readwrite',
    (store) => store.delete(deviceId),
  )
  db.close()
}

export async function loadBackupQueueState(queueId: string): Promise<unknown | null> {
  if (!canUseIndexedDb()) return null
  const db = await openDatabase()
  const row = await runTransaction<StoredBackupQueueState | undefined>(
    db,
    BACKUP_QUEUE_STORE,
    'readonly',
    (store) => store.get(queueId),
  )
  db.close()

  return row?.state ?? null
}

export async function saveBackupQueueState(queueId: string, state: unknown): Promise<void> {
  if (!canUseIndexedDb()) return
  const db = await openDatabase()
  await runTransaction(
    db,
    BACKUP_QUEUE_STORE,
    'readwrite',
    (store) => store.put({
      id: queueId,
      state,
      updatedAt: new Date().toISOString(),
    } satisfies StoredBackupQueueState),
  )
  db.close()
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

function normalizeStoreKey(input: string | TripDocumentStoreKey): {
  id: string
  namespace: string
  documentId: string
} {
  if (typeof input === 'string') {
    return {
      id: input,
      namespace: 'legacy',
      documentId: input,
    }
  }
  return {
    id: `${input.namespace}:${input.documentId}`,
    namespace: input.namespace,
    documentId: input.documentId,
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
      if (!db.objectStoreNames.contains(KEY_MATERIAL_STORE)) {
        db.createObjectStore(KEY_MATERIAL_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(BACKUP_QUEUE_STORE)) {
        db.createObjectStore(BACKUP_QUEUE_STORE, { keyPath: 'id' })
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
