import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import type {
  AuthorityApplyResult,
  AuthorityCommand,
  CanonicalResourceBundle,
} from '@nexvoy/core'
import {
  WebAuthorityIndexedDbStore,
  deleteWebAuthorityDatabase,
} from '../indexedDbStore'
import { getLegacyWebStorageKeys } from '../../data/legacyV1Reset'

const databaseName = `onvoy-server-authority-test-${Date.now()}`
const now = '2026-07-17T01:00:00.000Z'
const tripId = '48000000-0000-0000-0000-000000000001'

function bundle(destination: string, revision = 0): CanonicalResourceBundle {
  return {
    resourceType: 'trip',
    resourceId: tripId,
    revision,
    serverUpdatedAt: now,
    data: {
      trip: {
        id: tripId,
        destination,
        version: 1,
        deleted_at: null,
      },
      plans: [],
    },
  }
}

function command(operationId: string, destination = '전주'): AuthorityCommand {
  return {
    operationId,
    resourceId: tripId,
    entityType: 'trip',
    entityId: tripId,
    action: 'upsert',
    payload: { destination },
    createdAt: now,
  }
}

async function run(): Promise<void> {
  assert.deepEqual(getLegacyWebStorageKeys([
    'onvoy.localFirst.webDeviceId',
    'onvoy.localFirst.promotion.trip-1',
    'downloaded_trip_registry',
    'trip_bundle_trip-1',
    'onvoy.task055.v1ResetCompleted',
    'rememberedEmail',
  ]), [
    'onvoy.localFirst.webDeviceId',
    'onvoy.localFirst.promotion.trip-1',
    'downloaded_trip_registry',
    'trip_bundle_trip-1',
  ])

  const store = new WebAuthorityIndexedDbStore({ databaseName })
  const firstOperation = '48000000-0000-0000-0000-000000000011'
  await store.commitOptimisticMutation({
    accountId: 'account-a',
    bundle: bundle('전주'),
    command: command(firstOperation),
    now,
  })

  assert.equal((await store.getResource('account-a', 'trip', tripId))?.data.trip !== undefined, true)
  assert.equal(await store.getResource('account-b', 'trip', tripId), null)
  assert.equal((await store.listReadyOutbox('account-a', now, 10)).length, 1)

  const batchOperations = [
    command('48000000-0000-0000-0000-000000000021'),
    command('48000000-0000-0000-0000-000000000022'),
  ]
  await store.commitOptimisticMutations({
    accountId: 'account-batch',
    bundle: bundle('batch trip'),
    commands: batchOperations,
    now,
  })
  assert.equal((await store.listReadyOutbox('account-batch', now, 10)).length, 2)
  assert.equal((await store.listResources('account-batch', 'trip')).length, 1)
  assert.deepEqual(await store.getSyncSnapshot('account-batch', 'trip', tripId, true), {
    status: 'pending',
    pendingCount: 2,
    lastError: null,
  })
  await store.markRejected(
    'account-batch',
    [batchOperations[0].operationId],
    'authority_trip_forbidden',
    now,
  )
  assert.equal(
    (await store.getSyncSnapshot('account-batch', 'trip', tripId, true)).status,
    'error',
  )
  assert.equal(
    (await store.getSyncSnapshot('account-batch', 'trip', tripId, false)).status,
    'error',
  )

  const planId = '48000000-0000-0000-0000-000000000099'
  const repairBase: CanonicalResourceBundle = {
    resourceType: 'trip',
    resourceId: tripId,
    revision: 0,
    serverUpdatedAt: now,
    data: { trip: null, plans: [], checklists: [], _role: 'owner' },
  }
  const repairCommands: AuthorityCommand[] = [
    command('48000000-0000-0000-0000-000000000031', '전주 복구'),
    {
      operationId: '48000000-0000-0000-0000-000000000032',
      resourceId: tripId,
      entityType: 'checklist',
      entityId: '48000000-0000-0000-0000-000000000098',
      action: 'upsert',
      payload: { title: '준비물' },
      createdAt: now,
    },
    {
      operationId: '48000000-0000-0000-0000-000000000033',
      resourceId: tripId,
      entityType: 'trip',
      entityId: planId,
      action: 'upsert',
      payload: { title: '한옥마을 산책', start_datetime_local: '2026-07-17T10:00:00' },
      createdAt: now,
    },
  ]
  const corruptedProjection: CanonicalResourceBundle = {
    ...repairBase,
    data: {
      ...repairBase.data,
      trip: {
        id: planId,
        title: '한옥마을 산책',
        start_datetime_local: '2026-07-17T10:00:00',
      },
      checklists: [{
        id: '48000000-0000-0000-0000-000000000098',
        title: '준비물',
      }],
    },
  }
  await store.commitOptimisticMutations({
    accountId: 'account-repair',
    baseBundle: repairBase,
    bundle: corruptedProjection,
    commands: repairCommands,
    now,
  })
  await store.markRejected(
    'account-repair',
    repairCommands.map((item) => item.operationId),
    '22023',
    now,
  )
  assert.equal(
    ((await store.getResource('account-repair', 'trip', tripId))?.data.trip as { id?: string }).id,
    planId,
  )

  assert.equal(
    await store.repairMislabeledPlanCommands(
      'account-repair',
      '2026-07-17T01:00:01.000Z',
    ),
    1,
  )
  const repairedRows = await store.listReadyOutbox('account-repair', now, 10)
  assert.deepEqual(repairedRows.map((row) => row.command.entityType), [
    'trip',
    'checklist',
    'plan',
  ])
  assert.equal(
    ((await store.getResource('account-repair', 'trip', tripId))?.data.trip as { id?: string }).id,
    tripId,
  )
  assert.equal(
    ((await store.getResource('account-repair', 'trip', tripId))?.data.plans as Array<{ id?: string }>)[0]?.id,
    planId,
  )
  assert.equal(
    (await store.getSyncSnapshot('account-repair', 'trip', tripId, true)).status,
    'pending',
  )

  await store.commitOptimisticMutation({
    accountId: 'account-a',
    bundle: bundle('전주'),
    command: command(firstOperation),
    now,
  })
  assert.equal((await store.listReadyOutbox('account-a', now, 10)).length, 1)

  await assert.rejects(
    store.commitOptimisticMutation({
      accountId: 'account-b',
      bundle: bundle('부산'),
      command: command(firstOperation),
      now,
    }),
    /operation id/,
  )
  assert.equal(await store.getResource('account-b', 'trip', tripId), null)

  await store.markSending('account-a', [firstOperation], '2026-07-17T01:01:00.000Z')
  const recovered = await store.recoverStaleSending(
    'account-a',
    '2026-07-17T01:02:00.000Z',
    '2026-07-17T01:03:00.000Z',
  )
  assert.equal(recovered, 1)
  assert.equal(
    (await store.listReadyOutbox('account-a', '2026-07-17T01:03:00.000Z', 10))[0]?.status,
    'retryable',
  )
  assert.equal(await store.getNextRetryAt('account-a'), '2026-07-17T01:03:00.000Z')

  const secondOperation = '48000000-0000-0000-0000-000000000013'
  await store.commitOptimisticMutation({
    accountId: 'account-a',
    bundle: bundle('전주 후속 변경'),
    command: command(secondOperation, '전주 후속 변경'),
    now: '2026-07-17T01:03:30.000Z',
  })

  const acknowledgement: AuthorityApplyResult = {
    status: 'applied',
    resourceType: 'trip',
    resourceId: tripId,
    revision: 1,
    serverUpdatedAt: '2026-07-17T01:04:00.000Z',
    acknowledgedOperationIds: [firstOperation],
    changes: [
      {
        operationId: firstOperation,
        entityType: 'trip',
        entityId: tripId,
        action: 'upsert',
        row: {
          id: tripId,
          destination: '전주 canonical',
          version: 1,
          deleted_at: null,
        },
      },
    ],
  }
  await store.applyAcknowledgement('account-a', acknowledgement, '2026-07-17T01:04:00.000Z')
  const rebased = await store.listReadyOutbox('account-a', now, 10)
  assert.equal(rebased.length, 1)
  assert.equal(rebased[0]?.operationId, secondOperation)
  assert.equal(rebased[0]?.baseRevision, 1)
  assert.equal((await store.getResource('account-a', 'trip', tripId))?.revision, 1)
  assert.equal(
    ((await store.getResource('account-a', 'trip', tripId))?.data.trip as { destination?: string })
      .destination,
    '전주 후속 변경',
  )

  await store.putResource('account-role', {
    ...bundle('role cache', 1),
    data: { ...bundle('role cache', 1).data, _role: 'editor' },
  })
  await store.putResource('account-role', bundle('remote without role', 2))
  assert.equal(
    (await store.getResource('account-role', 'trip', tripId))?.data._role,
    'editor',
  )

  await store.putResource('account-a', {
    ...bundle('newer canonical', 3),
    serverUpdatedAt: '2026-07-17T01:05:00.000Z',
  })
  assert.equal(
    ((await store.getResource('account-a', 'trip', tripId))?.data.trip as { destination?: string })
      .destination,
    '전주 후속 변경',
  )
  await store.applyAcknowledgement(
    'account-a',
    {
      ...acknowledgement,
      revision: 2,
      serverUpdatedAt: '2026-07-17T01:04:30.000Z',
      acknowledgedOperationIds: [secondOperation],
    },
    '2026-07-17T01:05:30.000Z',
  )
  assert.equal((await store.getResource('account-a', 'trip', tripId))?.revision, 3)
  assert.equal(
    ((await store.getResource('account-a', 'trip', tripId))?.data.trip as { destination?: string })
      .destination,
    'newer canonical',
  )
  assert.equal((await store.listReadyOutbox('account-a', now, 10)).length, 0)

  await assert.rejects(
    store.commitOptimisticMutation({
      accountId: 'account-a',
      bundle: bundle('stale', 0),
      command: command('48000000-0000-0000-0000-000000000014'),
      now: '2026-07-17T01:04:30.000Z',
    }),
    /stale authority revision/,
  )

  const guestOperation = '48000000-0000-0000-0000-000000000012'
  await store.commitOptimisticMutation({
    accountId: 'guest:device-1',
    bundle: bundle('제주', 2),
    command: command(guestOperation),
    now,
  })
  await store.promoteGuestAccount(
    'guest:device-1',
    'account-c',
    '2026-07-17T01:05:00.000Z',
  )
  assert.equal(await store.getResource('guest:device-1', 'trip', tripId), null)
  assert.equal((await store.getResource('account-c', 'trip', tripId))?.revision, 2)
  assert.equal((await store.listReadyOutbox('account-c', now, 10))[0]?.operationId, guestOperation)

  await store.purgeAccount('account-batch')
  assert.deepEqual(await store.listResources('account-batch'), [])
  assert.deepEqual(await store.listReadyOutbox('account-batch', now, 10), [])
  assert.notEqual(await store.getResource('account-a', 'trip', tripId), null)

  store.close()
  await deleteWebAuthorityDatabase(indexedDB, databaseName)
  console.log('web authority IndexedDB tests passed')
}

run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
