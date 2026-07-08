import { requireNativeModule } from 'expo-modules-core'

export type OnvoyNativeCryptoPlatform = 'android' | 'ios' | 'unknown'
export type OnvoyNativeCryptoAttestationStatus = 'not_supported' | 'not_verified' | 'verified'

export interface OnvoyNativeCryptoKeyInfo {
  publicKeyJwk: Record<string, unknown>
  platform: OnvoyNativeCryptoPlatform
  hardwareBacked: boolean | null
  attestationStatus: OnvoyNativeCryptoAttestationStatus
}

interface OnvoyNativeCryptoModule {
  ensureKey(deviceId: string): Promise<OnvoyNativeCryptoKeyInfo>
  getPublicKeyJwk(deviceId: string): Promise<OnvoyNativeCryptoKeyInfo>
  unwrapDek(deviceId: string, wrappedDek: number[]): Promise<number[]>
  deleteKey(deviceId: string): Promise<boolean>
  hasKey(deviceId: string): Promise<boolean>
}

let nativeModule: OnvoyNativeCryptoModule | null | undefined

function getNativeModule(): OnvoyNativeCryptoModule | null {
  if (nativeModule !== undefined) return nativeModule

  try {
    nativeModule = requireNativeModule<OnvoyNativeCryptoModule>('OnvoyNativeCrypto')
  } catch {
    nativeModule = null
  }

  return nativeModule ?? null
}

export function isOnvoyNativeCryptoAvailable(): boolean {
  return getNativeModule() !== null
}

export async function ensureNativeRsaKey(deviceId: string): Promise<OnvoyNativeCryptoKeyInfo> {
  const module = getNativeModule()
  if (!module) throw new Error('native_crypto_unavailable')
  return module.ensureKey(deviceId)
}

export async function getNativeRsaPublicKeyJwk(deviceId: string): Promise<OnvoyNativeCryptoKeyInfo> {
  const module = getNativeModule()
  if (!module) throw new Error('native_crypto_unavailable')
  return module.getPublicKeyJwk(deviceId)
}

export async function unwrapDekWithNativeRsaKey(deviceId: string, wrappedDek: Uint8Array): Promise<Uint8Array> {
  const module = getNativeModule()
  if (!module) throw new Error('native_crypto_unavailable')
  const unwrapped = await module.unwrapDek(deviceId, Array.from(wrappedDek))
  return new Uint8Array(unwrapped)
}

export async function deleteNativeRsaKey(deviceId: string): Promise<boolean> {
  const module = getNativeModule()
  if (!module) return false
  return module.deleteKey(deviceId)
}

export async function hasNativeRsaKey(deviceId: string): Promise<boolean> {
  const module = getNativeModule()
  if (!module) return false
  return module.hasKey(deviceId)
}
