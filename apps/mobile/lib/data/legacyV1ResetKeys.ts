const LEGACY_ASYNC_STORAGE_PREFIXES = [
  'onvoy:local-first:yjs-update:',
  'onvoy:local-first:template-yjs-update:',
  'onvoy:local-first:backup-queue:',
] as const

export function getLegacyMobileAsyncStorageKeys(keys: readonly string[]): string[] {
  return keys.filter((key) => LEGACY_ASYNC_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)))
}
