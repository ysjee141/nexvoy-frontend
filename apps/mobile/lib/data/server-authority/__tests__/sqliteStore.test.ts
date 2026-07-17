import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyOptimisticAuthorityCommandsToBundle,
  type AuthorityCommand,
  type AuthorityOutboxRecord,
  type AuthorityResourceType,
  type CanonicalResourceBundle,
} from '@nexvoy/core'
import type {
  MobileAuthorityDatabase,
  MobileAuthorityDatabaseTransaction,
  MobileAuthoritySyncState,
  StoredMobileAuthorityResource,
} from '../database'
import { MobileAuthoritySqliteStore } from '../sqliteStore'

const ACCOUNT_A = 'account-a'
const ACCOUNT_B = 'account-b'
const TRIP_ID = 'trip-1'
const T0 = '2026-07-17T00:00:00.000Z'
const T1 = '2026-07-17T00:01:00.000Z'
const T2 = '2026-07-17T00:02:00.000Z'

test('optimistic resource and outbox append commit atomically', async () => {
  const database = new FakeMobileAuthorityDatabase()
  const store = new MobileAuthoritySqliteStore(database)
  const base = tripBundle(1, T0)
  const command = planCommand('operation-1', 'plan-1', T1)
  const optimistic = applyOptimisticAuthorityCommandsToBundle(base, [command], T1)

  await store.commitOptimisticMutation({
    accountId: ACCOUNT_A,
    baseBundle: base,
    bundle: optimistic,
    command,
    now: T1,
  })

  assert.equal(database.transactionCount, 1)
  assert.deepEqual(await store.getResource(ACCOUNT_A, 'trip', TRIP_ID), optimistic)
  assert.deepEqual((await store.listReadyOutbox(ACCOUNT_A, T1, 10))[0]?.command, command)
})

test('transaction rollback prevents a resource-only optimistic write', async () => {
  const database = new FakeMobileAuthorityDatabase()
  const store = new MobileAuthoritySqliteStore(database)
  const base = tripBundle(1, T0)
  const command = planCommand('operation-1', 'plan-1', T1)
  database.failNextOutboxWrite = true

  await assert.rejects(
    store.commitOptimisticMutation({
      accountId: ACCOUNT_A,
      baseBundle: base,
      bundle: applyOptimisticAuthorityCommandsToBundle(base, [command], T1),
      command,
      now: T1,
    }),
    /simulated outbox failure/,
  )

  assert.equal(await store.getResource(ACCOUNT_A, 'trip', TRIP_ID), null)
  assert.deepEqual(await store.listReadyOutbox(ACCOUNT_A, T1, 10), [])
})

test('canonical acknowledgement removes acked commands and rebases pending projection', async () => {
  const database = new FakeMobileAuthorityDatabase()
  const store = new MobileAuthoritySqliteStore(database)
  const base = tripBundle(1, T0)
  const first = planCommand('operation-1', 'plan-1', T1)
  const second = planCommand('operation-2', 'plan-2', T2)
  const optimistic = applyOptimisticAuthorityCommandsToBundle(base, [first, second], T2)

  await store.commitOptimisticMutations({
    accountId: ACCOUNT_A,
    baseBundle: base,
    bundle: optimistic,
    commands: [first, second],
    now: T2,
  })
  await store.markSending(ACCOUNT_A, [first.operationId], T2)
  await store.applyAcknowledgement(
    ACCOUNT_A,
    {
      status: 'applied',
      resourceType: 'trip',
      resourceId: TRIP_ID,
      revision: 2,
      serverUpdatedAt: T2,
      acknowledgedOperationIds: [first.operationId],
      changes: [{
        operationId: first.operationId,
        entityType: 'plan',
        entityId: first.entityId,
        action: 'upsert',
        row: { id: first.entityId, title: 'canonical', version: 1, updated_at: T2 },
      }],
    },
    T2,
  )

  const outbox = await store.listReadyOutbox(ACCOUNT_A, T2, 10)
  assert.equal(outbox.length, 1)
  assert.equal(outbox[0]?.operationId, second.operationId)
  assert.equal(outbox[0]?.baseRevision, 2)
  const bundle = await store.getResource(ACCOUNT_A, 'trip', TRIP_ID)
  assert.equal(bundle?.revision, 2)
  assert.deepEqual(
    (bundle?.data.plans as Array<{ id: string }>).map((plan) => plan.id).sort(),
    ['plan-1', 'plan-2'],
  )
})

test('account namespaces stay isolated and purge removes only the selected account', async () => {
  const database = new FakeMobileAuthorityDatabase()
  const store = new MobileAuthoritySqliteStore(database)
  await store.putResource(ACCOUNT_A, tripBundle(1, T0))
  await store.putResource(ACCOUNT_B, tripBundle(2, T1))

  await store.purgeAccount(ACCOUNT_A)

  assert.equal(await store.getResource(ACCOUNT_A, 'trip', TRIP_ID), null)
  assert.equal((await store.getResource(ACCOUNT_B, 'trip', TRIP_ID))?.revision, 2)
})

test('guest promotion moves cache and recovers interrupted sending work', async () => {
  const database = new FakeMobileAuthorityDatabase()
  const store = new MobileAuthoritySqliteStore(database)
  const guestId = 'guest:device-1'
  const base = tripBundle(1, T0)
  const command = planCommand('operation-guest', 'plan-guest', T1)
  await store.commitOptimisticMutation({
    accountId: guestId,
    baseBundle: base,
    bundle: applyOptimisticAuthorityCommandsToBundle(base, [command], T1),
    command,
    now: T1,
  })
  await store.markSending(guestId, [command.operationId], T1)

  await store.promoteGuestAccount(guestId, ACCOUNT_A, T2)
  assert.equal((await store.listReadyOutbox(ACCOUNT_A, T2, 10))[0]?.status, 'retryable')
  await store.markSending(ACCOUNT_A, [command.operationId], T1)
  const recovered = await store.recoverStaleSending(ACCOUNT_A, T2, T2)

  assert.equal(recovered, 1)
  assert.equal(await store.getResource(guestId, 'trip', TRIP_ID), null)
  assert.ok(await store.getResource(ACCOUNT_A, 'trip', TRIP_ID))
  assert.equal((await store.listReadyOutbox(ACCOUNT_A, T2, 10))[0]?.status, 'retryable')
})

function tripBundle(revision: number, updatedAt: string): CanonicalResourceBundle {
  return {
    resourceType: 'trip',
    resourceId: TRIP_ID,
    revision,
    serverUpdatedAt: updatedAt,
    data: {
      _role: 'owner',
      trip: { id: TRIP_ID, destination: 'Seoul', version: revision },
      plans: [],
    },
  }
}

function planCommand(operationId: string, entityId: string, createdAt: string): AuthorityCommand {
  return {
    operationId,
    resourceId: TRIP_ID,
    entityType: 'plan',
    entityId,
    action: 'upsert',
    payload: { title: entityId },
    createdAt,
  }
}

class FakeMobileAuthorityDatabase
implements MobileAuthorityDatabase, MobileAuthorityDatabaseTransaction {
  private resources = new Map<string, StoredMobileAuthorityResource>()
  private outbox = new Map<string, AuthorityOutboxRecord>()
  private syncStates = new Map<string, MobileAuthoritySyncState>()
  transactionCount = 0
  failNextOutboxWrite = false

  async transaction<T>(
    task: (transaction: MobileAuthorityDatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    this.transactionCount += 1
    const snapshot = {
      resources: cloneMap(this.resources),
      outbox: cloneMap(this.outbox),
      syncStates: cloneMap(this.syncStates),
    }
    try {
      return await task(this)
    } catch (error) {
      this.resources = snapshot.resources
      this.outbox = snapshot.outbox
      this.syncStates = snapshot.syncStates
      throw error
    }
  }

  async getResource(accountId: string, resourceType: AuthorityResourceType, resourceId: string) {
    return cloneValue(this.resources.get(resourceKey(accountId, resourceType, resourceId)) ?? null)
  }

  async listResources(accountId: string, resourceType?: AuthorityResourceType) {
    return [...this.resources.values()]
      .filter((row) => row.accountId === accountId && (!resourceType || row.resourceType === resourceType))
      .map(cloneValue)
  }

  async putResource(resource: StoredMobileAuthorityResource) {
    this.resources.set(
      resourceKey(resource.accountId, resource.resourceType, resource.resourceId),
      cloneValue(resource),
    )
  }

  async deleteResource(accountId: string, resourceType: AuthorityResourceType, resourceId: string) {
    this.resources.delete(resourceKey(accountId, resourceType, resourceId))
    for (const [operationId, row] of this.outbox) {
      if (row.accountId === accountId && row.resourceType === resourceType && row.resourceId === resourceId) {
        this.outbox.delete(operationId)
      }
    }
    this.syncStates.delete(resourceKey(accountId, resourceType, resourceId))
  }

  async getOutbox(operationId: string) {
    return cloneValue(this.outbox.get(operationId) ?? null)
  }

  async listOutbox(accountId: string, resourceType?: AuthorityResourceType, resourceId?: string) {
    return [...this.outbox.values()]
      .filter((row) =>
        row.accountId === accountId &&
        (!resourceType || row.resourceType === resourceType) &&
        (!resourceId || row.resourceId === resourceId),
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(cloneValue)
  }

  async putOutbox(record: AuthorityOutboxRecord) {
    if (this.failNextOutboxWrite) {
      this.failNextOutboxWrite = false
      throw new Error('simulated outbox failure')
    }
    this.outbox.set(record.operationId, cloneValue(record))
  }

  async deleteOutbox(operationId: string) {
    this.outbox.delete(operationId)
  }

  async getSyncState(accountId: string, resourceType: AuthorityResourceType, resourceId: string) {
    return cloneValue(this.syncStates.get(resourceKey(accountId, resourceType, resourceId)) ?? null)
  }

  async listSyncStates(accountId: string) {
    return [...this.syncStates.values()]
      .filter((state) => state.accountId === accountId)
      .map(cloneValue)
  }

  async putSyncState(state: MobileAuthoritySyncState) {
    this.syncStates.set(
      resourceKey(state.accountId, state.resourceType, state.resourceId),
      cloneValue(state),
    )
  }

  async deleteAccount(accountId: string) {
    for (const row of await this.listResources(accountId)) {
      await this.deleteResource(accountId, row.resourceType, row.resourceId)
    }
  }

  async close() {}
}

function resourceKey(
  accountId: string,
  resourceType: AuthorityResourceType,
  resourceId: string,
): string {
  return `${accountId}:${resourceType}:${resourceId}`
}

function cloneMap<T>(source: Map<string, T>): Map<string, T> {
  return new Map([...source].map(([key, value]) => [key, cloneValue(value)]))
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
