import assert from 'node:assert/strict'
import test from 'node:test'
import { getLegacyMobileAsyncStorageKeys } from '../../legacyV1ResetKeys'

test('legacy V1 reset selects only retired mobile storage keys', () => {
  assert.deepEqual(getLegacyMobileAsyncStorageKeys([
    'onvoy:local-first:yjs-update:trip-1',
    'onvoy:local-first:template-yjs-update:template-1',
    'onvoy:local-first:backup-queue:trip-1',
    'onvoy:authority:resource:trip-1',
    '@onvoy/local-notifications/v1',
  ]), [
    'onvoy:local-first:yjs-update:trip-1',
    'onvoy:local-first:template-yjs-update:template-1',
    'onvoy:local-first:backup-queue:trip-1',
  ])
})
