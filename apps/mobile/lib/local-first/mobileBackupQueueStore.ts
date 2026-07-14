import AsyncStorage from '@react-native-async-storage/async-storage'
import type { BackupQueueState, PendingBackupUpdate } from '@nexvoy/core'

const BACKUP_QUEUE_PREFIX = 'onvoy:local-first:backup-queue:'
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export async function loadMobileBackupQueueState(queueId: string): Promise<BackupQueueState | null> {
  const encoded = await AsyncStorage.getItem(`${BACKUP_QUEUE_PREFIX}${queueId}`)
  if (!encoded) return null
  return parseBackupQueueState(JSON.parse(encoded))
}

export async function saveMobileBackupQueueState(
  queueId: string,
  state: BackupQueueState,
): Promise<void> {
  await AsyncStorage.setItem(`${BACKUP_QUEUE_PREFIX}${queueId}`, JSON.stringify(serializeBackupQueueState(state)))
}

function serializeBackupQueueState(state: BackupQueueState): unknown {
  return {
    ...state,
    pending: state.pending.map((update) => ({
      ...update,
      updateBlob: bytesToBase64(update.updateBlob),
    })),
  }
}

function parseBackupQueueState(input: unknown): BackupQueueState | null {
  if (!input || typeof input !== 'object') return null
  const state = input as BackupQueueState & { pending?: Array<PendingBackupUpdate & { updateBlob: string }> }
  if (!Array.isArray(state.pending)) return null
  return {
    ...state,
    pending: state.pending.map((update) => ({
      ...update,
      updateBlob: base64ToBytes(String(update.updateBlob)) ?? new Uint8Array(),
    })),
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let output = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    const combined = (first << 16) | ((second ?? 0) << 8) | (third ?? 0)

    output += BASE64_ALPHABET[(combined >> 18) & 63]
    output += BASE64_ALPHABET[(combined >> 12) & 63]
    output += index + 1 < bytes.length ? BASE64_ALPHABET[(combined >> 6) & 63] : '='
    output += index + 2 < bytes.length ? BASE64_ALPHABET[combined & 63] : '='
  }
  return output
}

function base64ToBytes(base64: string): Uint8Array | null {
  const normalized = base64.replace(/\s/g, '')
  if (normalized.length % 4 !== 0) return null

  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  const bytes = new Uint8Array((normalized.length / 4) * 3 - padding)
  let byteIndex = 0

  for (let index = 0; index < normalized.length; index += 4) {
    const first = decodeBase64Char(normalized[index])
    const second = decodeBase64Char(normalized[index + 1])
    const third = normalized[index + 2] === '=' ? 0 : decodeBase64Char(normalized[index + 2])
    const fourth = normalized[index + 3] === '=' ? 0 : decodeBase64Char(normalized[index + 3])

    if (first < 0 || second < 0 || third < 0 || fourth < 0) return null
    const combined = (first << 18) | (second << 12) | (third << 6) | fourth

    if (byteIndex < bytes.length) bytes[byteIndex] = (combined >> 16) & 255
    byteIndex += 1
    if (byteIndex < bytes.length) bytes[byteIndex] = (combined >> 8) & 255
    byteIndex += 1
    if (byteIndex < bytes.length) bytes[byteIndex] = combined & 255
    byteIndex += 1
  }

  return bytes
}

function decodeBase64Char(char: string): number {
  return BASE64_ALPHABET.indexOf(char)
}
