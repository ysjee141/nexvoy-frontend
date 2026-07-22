import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { getLegacyMobileAsyncStorageKeys } from './legacyV1ResetKeys'

const RESET_MARKER = 'onvoy:task055:v1-reset-completed'
const LEGACY_DEVICE_ID_KEY = 'onvoy.mobileDeviceId'
const LEGACY_KEY_MATERIAL_PREFIX = 'onvoy.mobileKeyMaterial'
let resetInFlight: Promise<void> | null = null

export function resetLegacyMobileV1Storage(): Promise<void> {
  resetInFlight ??= resetLegacyMobileV1StorageNow().finally(() => {
    resetInFlight = null
  })
  return resetInFlight
}

async function resetLegacyMobileV1StorageNow(): Promise<void> {
  if (await AsyncStorage.getItem(RESET_MARKER)) return

  const [keys, deviceId] = await Promise.all([
    AsyncStorage.getAllKeys(),
    SecureStore.getItemAsync(LEGACY_DEVICE_ID_KEY),
  ])
  const legacyKeys = getLegacyMobileAsyncStorageKeys(keys)
  if (legacyKeys.length > 0) await AsyncStorage.multiRemove(legacyKeys)

  if (deviceId) {
    await Promise.all([
      SecureStore.deleteItemAsync(`${LEGACY_KEY_MATERIAL_PREFIX}:${deviceId}:1`),
      SecureStore.deleteItemAsync(`${LEGACY_KEY_MATERIAL_PREFIX}:${deviceId}:2`),
      SecureStore.deleteItemAsync(LEGACY_DEVICE_ID_KEY),
    ])
  }

  await AsyncStorage.setItem(RESET_MARKER, new Date().toISOString())
}
