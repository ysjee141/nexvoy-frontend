import assert from 'node:assert/strict'
import { createUuid } from '../id'

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const ids = Array.from({ length: 100 }, () => createUuid())
assert.equal(new Set(ids).size, ids.length)
ids.forEach((id) => assert.match(id, UUID_V4))

const nativeCrypto = globalThis.crypto
try {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      getRandomValues<T extends ArrayBufferView>(array: T): T {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
        bytes.forEach((_, index) => {
          bytes[index] = index
        })
        return array
      },
    },
  })
  assert.equal(createUuid(), '00010203-0405-4607-8809-0a0b0c0d0e0f')
} finally {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: nativeCrypto,
  })
}
