import { Platform } from 'react-native'
import { subtle } from 'react-native-quick-crypto'
import type { DocumentEncryptionKey, RsaOaepPublicKeyMaterial } from '@nexvoy/core/sync/encryption'
import {
  deleteNativeRsaKey,
  ensureNativeRsaKey,
  getNativeRsaPublicKeyJwk,
  hasNativeRsaKey,
  isOnvoyNativeCryptoAvailable,
  unwrapDekWithNativeRsaKey,
  type OnvoyNativeCryptoAttestationStatus,
  type OnvoyNativeCryptoPlatform,
} from 'onvoy-native-crypto'

const AES_GCM_ALGORITHM = 'AES-GCM'
const AES_KEY_LENGTH = 256

export type MobileNativeKeyProviderErrorCode =
  | 'provider_unavailable'
  | 'native_key_unavailable'
  | 'native_unwrap_failed'

export class MobileNativeKeyProviderError extends Error {
  constructor(readonly code: MobileNativeKeyProviderErrorCode) {
    super(code)
    this.name = 'MobileNativeKeyProviderError'
  }
}

export interface MobileNativeRsaKeyMaterial {
  publicKeyJwk: RsaOaepPublicKeyMaterial
  platform: OnvoyNativeCryptoPlatform
  hardwareBacked: boolean | null
  attestationStatus: OnvoyNativeCryptoAttestationStatus
}

export function isMobileNativeRsaKeyProviderAvailable(): boolean {
  return (Platform.OS === 'android' || Platform.OS === 'ios') && isOnvoyNativeCryptoAvailable()
}

export async function ensureMobileNativeRsaKeyMaterial(deviceId: string): Promise<MobileNativeRsaKeyMaterial> {
  if (!isMobileNativeRsaKeyProviderAvailable()) {
    throw new MobileNativeKeyProviderError('provider_unavailable')
  }

  try {
    return normalizeNativeKeyInfo(await ensureNativeRsaKey(deviceId))
  } catch {
    throw new MobileNativeKeyProviderError('provider_unavailable')
  }
}

export async function loadMobileNativeRsaPublicKeyMaterial(deviceId: string): Promise<MobileNativeRsaKeyMaterial> {
  if (!isMobileNativeRsaKeyProviderAvailable()) {
    throw new MobileNativeKeyProviderError('provider_unavailable')
  }

  try {
    return normalizeNativeKeyInfo(await getNativeRsaPublicKeyJwk(deviceId))
  } catch {
    throw new MobileNativeKeyProviderError('native_key_unavailable')
  }
}

export async function hasMobileNativeRsaKey(deviceId: string): Promise<boolean> {
  if (!isMobileNativeRsaKeyProviderAvailable()) return false
  try {
    return await hasNativeRsaKey(deviceId)
  } catch {
    return false
  }
}

export async function unwrapMobileDocumentKeyWithNativeRsa(input: {
  deviceId: string
  wrappedDek: Uint8Array
}): Promise<DocumentEncryptionKey> {
  if (!isMobileNativeRsaKeyProviderAvailable()) {
    throw new MobileNativeKeyProviderError('provider_unavailable')
  }

  let rawDek: Uint8Array
  try {
    rawDek = await unwrapDekWithNativeRsaKey(input.deviceId, input.wrappedDek)
  } catch {
    throw new MobileNativeKeyProviderError('native_unwrap_failed')
  }

  try {
    return subtle.importKey(
      'raw',
      toArrayBuffer(rawDek),
      { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
      true,
      ['decrypt', 'encrypt'],
    ) as Promise<DocumentEncryptionKey>
  } catch {
    throw new MobileNativeKeyProviderError('native_unwrap_failed')
  }
}

export async function deleteMobileNativeRsaKey(deviceId: string): Promise<void> {
  if (!isMobileNativeRsaKeyProviderAvailable()) return
  try {
    await deleteNativeRsaKey(deviceId)
  } catch {
    // Logout/revoke cleanup is best effort; do not leak native details.
  }
}

function normalizeNativeKeyInfo(value: MobileNativeRsaKeyMaterial): MobileNativeRsaKeyMaterial {
  return {
    publicKeyJwk: value.publicKeyJwk,
    platform: value.platform === 'android' || value.platform === 'ios' ? value.platform : 'unknown',
    hardwareBacked: typeof value.hardwareBacked === 'boolean' ? value.hardwareBacked : null,
    attestationStatus: value.attestationStatus === 'verified' || value.attestationStatus === 'not_supported'
      ? value.attestationStatus
      : 'not_verified',
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
