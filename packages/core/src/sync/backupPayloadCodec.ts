import type { EncryptedBackupPayload } from './backupTypes'

/**
 * Yjs-free JSON envelope codec for encrypted backup payloads.
 *
 * Shared by `restore.ts` (Web, Yjs-aware) and Mobile restore/bootstrap code
 * (Yjs-free, must be safely importable in the React Native bundle). This
 * module must only depend on `backupTypes.ts` — never `yjsTripDocument`,
 * `yjs`, or `lib0` — so that any file importing it does not transitively
 * pull the Yjs dependency graph into the RN bundler's static analysis.
 */
export interface SerializedEncryptedBackupPayload {
  algorithm: EncryptedBackupPayload['algorithm']
  keyVersion: number
  iv: string
  ciphertext: string
}

export function serializeEncryptedBackupPayload(payload: EncryptedBackupPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({
    algorithm: payload.algorithm,
    keyVersion: payload.keyVersion,
    iv: encodeBase64(payload.iv),
    ciphertext: encodeBase64(payload.ciphertext),
  } satisfies SerializedEncryptedBackupPayload))
}

export function deserializeEncryptedBackupPayload(bytes: Uint8Array): EncryptedBackupPayload {
  const payload = JSON.parse(new TextDecoder().decode(bytes)) as SerializedEncryptedBackupPayload

  return {
    algorithm: payload.algorithm,
    keyVersion: payload.keyVersion,
    iv: decodeBase64(payload.iv),
    ciphertext: decodeBase64(payload.ciphertext),
  }
}

export function encodeBase64(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return globalThis.btoa(binary)
}

export function decodeBase64(value: string): Uint8Array {
  const binary = globalThis.atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}
