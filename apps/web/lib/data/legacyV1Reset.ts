const LEGACY_DATABASE_NAME = 'onvoy-local-first-spike'
const RESET_MARKER = 'onvoy.task055.v1ResetCompleted'

const LEGACY_STORAGE_KEYS = new Set([
  'onvoy.localFirst.guestOwnerId',
  'onvoy.localFirst.webDeviceId',
  'onvoy.localFirstChecklistDualWrite',
  'onvoy.localFirstChecklistSpike',
  'onvoy.webDocumentPrimary',
  'onvoy.webServerAuthorityDisabled',
  'downloaded_trip_registry',
])

const LEGACY_STORAGE_PREFIXES = [
  'onvoy.localFirst.promotion.',
  'trip_bundle_',
] as const

let resetInFlight: Promise<void> | null = null

export function resetLegacyWebV1Storage(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  resetInFlight ??= resetLegacyWebV1StorageNow().finally(() => {
    resetInFlight = null
  })
  return resetInFlight
}

export function getLegacyWebStorageKeys(keys: readonly string[]): string[] {
  return keys.filter((key) =>
    LEGACY_STORAGE_KEYS.has(key)
    || LEGACY_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)),
  )
}

async function resetLegacyWebV1StorageNow(): Promise<void> {
  if (window.localStorage.getItem(RESET_MARKER)) return

  const keys = Array.from(
    { length: window.localStorage.length },
    (_, index) => window.localStorage.key(index),
  ).filter((key): key is string => key !== null)
  for (const key of getLegacyWebStorageKeys(keys)) window.localStorage.removeItem(key)

  await deleteDatabase(window.indexedDB, LEGACY_DATABASE_NAME)
  window.localStorage.setItem(RESET_MARKER, new Date().toISOString())
}

function deleteDatabase(indexedDB: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to reset legacy database.'))
    request.onblocked = () => reject(new Error('Legacy database reset is blocked.'))
  })
}
