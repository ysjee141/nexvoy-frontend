export type P2PUpdateMessageType = 'yjs-update' | 'yjs-update-chunk'

export interface P2PUpdateMessage {
  type: 'yjs-update'
  documentId: string
  updateId: string
  byteLength: number
  payloadBase64: string
}

export interface P2PUpdateChunkMessage {
  type: 'yjs-update-chunk'
  documentId: string
  updateId: string
  seq: number
  total: number
  byteLength: number
  totalByteLength: number
  payloadBase64: string
}

export type P2PUpdateProtocolMessage = P2PUpdateMessage | P2PUpdateChunkMessage

export interface ReassembledP2PUpdate {
  documentId: string
  updateId: string
  update: Uint8Array
}

export const DEFAULT_P2P_UPDATE_CHUNK_BYTES = 16 * 1024
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function createP2PUpdateMessages(input: {
  documentId: string
  update: Uint8Array
  updateId?: string
  maxChunkBytes?: number
}): P2PUpdateProtocolMessage[] {
  const updateId = input.updateId ?? createUpdateId()
  const maxChunkBytes = normalizeChunkSize(input.maxChunkBytes)

  if (input.update.byteLength <= maxChunkBytes) {
    return [{
      type: 'yjs-update',
      documentId: input.documentId,
      updateId,
      byteLength: input.update.byteLength,
      payloadBase64: bytesToBase64(input.update),
    }]
  }

  const messages: P2PUpdateChunkMessage[] = []
  const total = Math.ceil(input.update.byteLength / maxChunkBytes)
  for (let seq = 0; seq < total; seq += 1) {
    const start = seq * maxChunkBytes
    const end = Math.min(start + maxChunkBytes, input.update.byteLength)
    const chunk = input.update.slice(start, end)
    messages.push({
      type: 'yjs-update-chunk',
      documentId: input.documentId,
      updateId,
      seq,
      total,
      byteLength: chunk.byteLength,
      totalByteLength: input.update.byteLength,
      payloadBase64: bytesToBase64(chunk),
    })
  }
  return messages
}

export function parseP2PUpdateProtocolMessage(input: unknown): P2PUpdateProtocolMessage | null {
  if (!isRecord(input)) return null

  if (input.type === 'yjs-update') {
    if (
      typeof input.documentId === 'string'
      && typeof input.updateId === 'string'
      && isSafeByteLength(input.byteLength)
      && typeof input.payloadBase64 === 'string'
    ) {
      return {
        type: 'yjs-update',
        documentId: input.documentId,
        updateId: input.updateId,
        byteLength: input.byteLength,
        payloadBase64: input.payloadBase64,
      }
    }
    return null
  }

  if (input.type === 'yjs-update-chunk') {
    if (
      typeof input.documentId === 'string'
      && typeof input.updateId === 'string'
      && isSafeByteLength(input.seq)
      && isSafeByteLength(input.total)
      && input.total > 0
      && input.seq < input.total
      && isSafeByteLength(input.byteLength)
      && isSafeByteLength(input.totalByteLength)
      && typeof input.payloadBase64 === 'string'
    ) {
      return {
        type: 'yjs-update-chunk',
        documentId: input.documentId,
        updateId: input.updateId,
        seq: input.seq,
        total: input.total,
        byteLength: input.byteLength,
        totalByteLength: input.totalByteLength,
        payloadBase64: input.payloadBase64,
      }
    }
  }

  return null
}

export class P2PUpdateReassembler {
  private readonly pending = new Map<string, {
    documentId: string
    updateId: string
    total: number
    totalByteLength: number
    chunks: Map<number, Uint8Array>
  }>()

  ingest(message: P2PUpdateProtocolMessage): ReassembledP2PUpdate | null {
    if (message.type === 'yjs-update') {
      const update = base64ToBytes(message.payloadBase64)
      if (!update) return null
      if (update.byteLength !== message.byteLength) return null
      return {
        documentId: message.documentId,
        updateId: message.updateId,
        update,
      }
    }

    const chunk = base64ToBytes(message.payloadBase64)
    if (!chunk) return null
    if (chunk.byteLength !== message.byteLength) return null

    const key = `${message.documentId}:${message.updateId}`
    const entry = this.pending.get(key) ?? {
      documentId: message.documentId,
      updateId: message.updateId,
      total: message.total,
      totalByteLength: message.totalByteLength,
      chunks: new Map<number, Uint8Array>(),
    }
    if (entry.total !== message.total || entry.totalByteLength !== message.totalByteLength) {
      this.pending.delete(key)
      return null
    }

    entry.chunks.set(message.seq, chunk)
    this.pending.set(key, entry)
    if (entry.chunks.size !== entry.total) return null

    const update = new Uint8Array(entry.totalByteLength)
    let offset = 0
    for (let seq = 0; seq < entry.total; seq += 1) {
      const part = entry.chunks.get(seq)
      if (!part) return null
      update.set(part, offset)
      offset += part.byteLength
    }

    this.pending.delete(key)
    return offset === entry.totalByteLength
      ? { documentId: entry.documentId, updateId: entry.updateId, update }
      : null
  }

  clear(): void {
    this.pending.clear()
  }
}

function normalizeChunkSize(input: number | null | undefined): number {
  return Number.isFinite(input) && Number(input) > 0
    ? Math.floor(Number(input))
    : DEFAULT_P2P_UPDATE_CHUNK_BYTES
}

function createUpdateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
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

function isSafeByteLength(input: unknown): input is number {
  return Number.isInteger(input) && Number(input) >= 0
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}
