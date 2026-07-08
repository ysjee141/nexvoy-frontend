import * as SecureStore from 'expo-secure-store'
import type {
  RsaOaepPrivateKeyMaterial,
  RsaOaepPublicKeyMaterial,
} from '@nexvoy/core/sync/encryption'
import type {
  UserKeyMaterialAttestationStatus,
  UserKeyMaterialPlatform,
  UserKeyMaterialType,
} from '@nexvoy/core/sync/keyProvisioning'

export interface StoredNativeMobileDeviceKeyMaterial {
  deviceId: string
  materialVersion: typeof MOBILE_NATIVE_MATERIAL_VERSION
  materialType: Extract<UserKeyMaterialType, 'native_rsa'>
  platform: Extract<UserKeyMaterialPlatform, 'ios' | 'android' | 'unknown'>
  hardwareBacked: boolean | null
  attestationStatus: UserKeyMaterialAttestationStatus
  publicKeyJwk: RsaOaepPublicKeyMaterial
  updatedAt: string
}

export interface StoredLegacyMobileDeviceKeyMaterial {
  deviceId: string
  materialVersion: typeof MOBILE_LEGACY_SECURESTORE_MATERIAL_VERSION
  publicKeyJwk: RsaOaepPublicKeyMaterial
  privateKeyJwk: RsaOaepPrivateKeyMaterial
  updatedAt: string
}

export const MOBILE_LEGACY_SECURESTORE_MATERIAL_VERSION = 1
export const MOBILE_NATIVE_MATERIAL_VERSION = 2
const MATERIAL_PREFIX = 'onvoy.mobileKeyMaterial'

export function getMobileKeyMaterialVersion(): number {
  return MOBILE_NATIVE_MATERIAL_VERSION
}

export async function loadMobileDeviceKeyMaterial(
  deviceId: string,
): Promise<StoredNativeMobileDeviceKeyMaterial | null> {
  const raw = await SecureStore.getItemAsync(nativeMaterialStorageKey(deviceId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as StoredNativeMobileDeviceKeyMaterial
    if (parsed.deviceId !== deviceId || parsed.materialVersion !== MOBILE_NATIVE_MATERIAL_VERSION) {
      return null
    }
    if (parsed.materialType !== 'native_rsa' || !parsed.publicKeyJwk) return null
    if ('privateKeyJwk' in parsed) {
      await SecureStore.deleteItemAsync(nativeMaterialStorageKey(deviceId))
      return null
    }
    return parsed
  } catch {
    await SecureStore.deleteItemAsync(nativeMaterialStorageKey(deviceId))
    return null
  }
}

export async function saveMobileDeviceKeyMaterial(
  material: Omit<StoredNativeMobileDeviceKeyMaterial, 'updatedAt'>,
): Promise<void> {
  await SecureStore.setItemAsync(
    nativeMaterialStorageKey(material.deviceId),
    JSON.stringify({
      ...material,
      updatedAt: new Date().toISOString(),
    } satisfies StoredNativeMobileDeviceKeyMaterial),
  )
}

export async function clearMobileDeviceKeyMaterial(deviceId: string): Promise<void> {
  await SecureStore.deleteItemAsync(nativeMaterialStorageKey(deviceId))
}

export async function loadLegacyMobileDeviceKeyMaterial(
  deviceId: string,
): Promise<StoredLegacyMobileDeviceKeyMaterial | null> {
  const raw = await SecureStore.getItemAsync(legacyMaterialStorageKey(deviceId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as StoredLegacyMobileDeviceKeyMaterial
    if (parsed.deviceId !== deviceId || parsed.materialVersion !== MOBILE_LEGACY_SECURESTORE_MATERIAL_VERSION) {
      await SecureStore.deleteItemAsync(legacyMaterialStorageKey(deviceId))
      return null
    }
    if (!parsed.publicKeyJwk || !parsed.privateKeyJwk) {
      await SecureStore.deleteItemAsync(legacyMaterialStorageKey(deviceId))
      return null
    }
    return parsed
  } catch {
    await SecureStore.deleteItemAsync(legacyMaterialStorageKey(deviceId))
    return null
  }
}

export async function saveLegacyMobileDeviceKeyMaterial(
  material: Omit<StoredLegacyMobileDeviceKeyMaterial, 'updatedAt'>,
): Promise<void> {
  await SecureStore.setItemAsync(
    legacyMaterialStorageKey(material.deviceId),
    JSON.stringify({
      ...material,
      updatedAt: new Date().toISOString(),
    } satisfies StoredLegacyMobileDeviceKeyMaterial),
  )
}

export async function clearLegacyMobileDeviceKeyMaterial(deviceId: string): Promise<void> {
  await SecureStore.deleteItemAsync(legacyMaterialStorageKey(deviceId))
}

export async function clearAllMobileDeviceKeyMaterial(deviceId: string): Promise<void> {
  await Promise.all([
    clearMobileDeviceKeyMaterial(deviceId),
    clearLegacyMobileDeviceKeyMaterial(deviceId),
  ])
}

function nativeMaterialStorageKey(deviceId: string): string {
  return `${MATERIAL_PREFIX}:${deviceId}:${MOBILE_NATIVE_MATERIAL_VERSION}`
}

function legacyMaterialStorageKey(deviceId: string): string {
  return `${MATERIAL_PREFIX}:${deviceId}:${MOBILE_LEGACY_SECURESTORE_MATERIAL_VERSION}`
}
