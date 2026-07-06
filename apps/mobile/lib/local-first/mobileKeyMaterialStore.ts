import * as SecureStore from 'expo-secure-store'
import type {
  RsaOaepPrivateKeyMaterial,
  RsaOaepPublicKeyMaterial,
} from '@nexvoy/core/sync/encryption'

export interface StoredMobileDeviceKeyMaterial {
  deviceId: string
  materialVersion: number
  publicKeyJwk: RsaOaepPublicKeyMaterial
  privateKeyJwk: RsaOaepPrivateKeyMaterial
  updatedAt: string
}

const KEY_MATERIAL_VERSION = 1
const MATERIAL_PREFIX = 'onvoy.mobileKeyMaterial'

export function getMobileKeyMaterialVersion(): number {
  return KEY_MATERIAL_VERSION
}

export async function loadMobileDeviceKeyMaterial(
  deviceId: string,
): Promise<StoredMobileDeviceKeyMaterial | null> {
  const raw = await SecureStore.getItemAsync(materialStorageKey(deviceId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as StoredMobileDeviceKeyMaterial
    if (parsed.deviceId !== deviceId || parsed.materialVersion !== KEY_MATERIAL_VERSION) {
      return null
    }
    if (!parsed.publicKeyJwk || !parsed.privateKeyJwk) return null
    return parsed
  } catch {
    await SecureStore.deleteItemAsync(materialStorageKey(deviceId))
    return null
  }
}

export async function saveMobileDeviceKeyMaterial(
  material: Omit<StoredMobileDeviceKeyMaterial, 'updatedAt'>,
): Promise<void> {
  await SecureStore.setItemAsync(
    materialStorageKey(material.deviceId),
    JSON.stringify({
      ...material,
      updatedAt: new Date().toISOString(),
    } satisfies StoredMobileDeviceKeyMaterial),
  )
}

export async function clearMobileDeviceKeyMaterial(deviceId: string): Promise<void> {
  await SecureStore.deleteItemAsync(materialStorageKey(deviceId))
}

function materialStorageKey(deviceId: string): string {
  return `${MATERIAL_PREFIX}:${deviceId}:${KEY_MATERIAL_VERSION}`
}
