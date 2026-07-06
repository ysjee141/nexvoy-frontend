import * as SecureStore from 'expo-secure-store'

const MOBILE_DEVICE_ID_STORAGE_KEY = 'onvoy.mobileDeviceId'

export async function getMobileDeviceId(): Promise<string | null> {
  return SecureStore.getItemAsync(MOBILE_DEVICE_ID_STORAGE_KEY)
}

export async function getOrCreateMobileDeviceId(): Promise<string> {
  const existing = await getMobileDeviceId()
  if (existing) return existing

  const deviceId = `mobile:${randomId()}`
  await SecureStore.setItemAsync(MOBILE_DEVICE_ID_STORAGE_KEY, deviceId)
  return deviceId
}

export async function clearMobileDeviceId(): Promise<void> {
  await SecureStore.deleteItemAsync(MOBILE_DEVICE_ID_STORAGE_KEY)
}

function randomId(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
