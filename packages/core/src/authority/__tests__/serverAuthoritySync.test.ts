import assert from 'node:assert/strict'
import { ServerAuthorityRepositoryError } from '../../repositories/serverAuthorityRepository'
import type { ServerAuthorityRepository } from '../../repositories/serverAuthorityRepository'
import {
  ServerAuthoritySyncCoordinator,
  buildAuthorityOutboxBatches,
  computeAuthorityRetryDelayMs,
} from '../serverAuthoritySync'
import {
  decideAuthorityInvalidation,
  parseAuthorityInvalidation,
} from '../serverAuthorityInvalidation'
import { applyOptimisticAuthorityCommandsToBundle } from '../serverAuthorityMaterialize'
import type {
  AuthorityApplyResult,
  AuthorityLocalStore,
  AuthorityOutboxRecord,
  AuthorityResourceType,
  CanonicalResourceBundle,
} from '../serverAuthorityTypes'

const now = '2026-07-17T00:00:00.000Z'

function record(index: number, overrides: Partial<AuthorityOutboxRecord> = {}): AuthorityOutboxRecord {
  const operationId = `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`
  const resourceId = '10000000-0000-0000-0000-000000000001'
  return {
    operationId,
    accountId: 'account-1',
    resourceType: 'trip',
    resourceId,
    baseRevision: 4,
    command: {
      operationId,
      resourceId,
      entityType: 'trip',
      entityId: resourceId,
      action: 'upsert',
      payload: { destination: `trip-${index}` },
      createdAt: now,
    },
    status: 'pending',
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

class FakeStore implements AuthorityLocalStore {
  records: AuthorityOutboxRecord[]
  resources = new Map<string, CanonicalResourceBundle>()
  recovered = 0

  constructor(records: AuthorityOutboxRecord[]) {
    this.records = records
  }

  async getResource(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<CanonicalResourceBundle | null> {
    return this.resources.get(`${accountId}:${resourceType}:${resourceId}`) ?? null
  }

  async putResource(accountId: string, bundle: CanonicalResourceBundle): Promise<void> {
    this.resources.set(`${accountId}:${bundle.resourceType}:${bundle.resourceId}`, bundle)
  }

  async commitOptimisticMutation(): Promise<void> {}

  async commitOptimisticMutations(): Promise<void> {}

  async listReadyOutbox(): Promise<AuthorityOutboxRecord[]> {
    return this.records.filter((item) => item.status === 'pending' || item.status === 'retryable')
  }

  async markSending(_accountId: string, operationIds: string[], updatedAt: string): Promise<void> {
    this.update(operationIds, (item) => ({ ...item, status: 'sending', updatedAt }))
  }

  async applyAcknowledgement(
    accountId: string,
    result: AuthorityApplyResult,
  ): Promise<void> {
    this.records = this.records.filter(
      (item) => !result.acknowledgedOperationIds.includes(item.operationId),
    )
    if (result.bundle) await this.putResource(accountId, result.bundle)
  }

  async markRetryable(
    _accountId: string,
    operationIds: string[],
    errorCode: string,
    nextAttemptAt: string,
    updatedAt: string,
  ): Promise<void> {
    this.update(operationIds, (item) => ({
      ...item,
      status: 'retryable',
      attempts: item.attempts + 1,
      lastError: errorCode,
      nextAttemptAt,
      updatedAt,
    }))
  }

  async markRejected(
    _accountId: string,
    operationIds: string[],
    errorCode: string,
    updatedAt: string,
  ): Promise<void> {
    this.update(operationIds, (item) => ({
      ...item,
      status: 'rejected',
      lastError: errorCode,
      updatedAt,
    }))
  }

  async markConflict(
    accountId: string,
    operationIds: string[],
    bundle: CanonicalResourceBundle | null,
    updatedAt: string,
  ): Promise<void> {
    this.update(operationIds, (item) => ({ ...item, status: 'conflict', updatedAt }))
    if (bundle) await this.putResource(accountId, bundle)
  }

  async recoverStaleSending(): Promise<number> {
    return this.recovered
  }

  async promoteGuestAccount(): Promise<void> {}

  async purgeResource(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<void> {
    this.resources.delete(`${accountId}:${resourceType}:${resourceId}`)
    this.records = this.records.filter(
      (item) =>
        item.accountId !== accountId ||
        item.resourceType !== resourceType ||
        item.resourceId !== resourceId,
    )
  }

  private update(
    operationIds: string[],
    transform: (item: AuthorityOutboxRecord) => AuthorityOutboxRecord,
  ): void {
    this.records = this.records.map((item) =>
      operationIds.includes(item.operationId) ? transform(item) : item,
    )
  }
}

function repositoryWith(
  applyCommands: ServerAuthorityRepository['applyCommands'],
): ServerAuthorityRepository {
  return {
    applyCommands,
    getChanges: async (resourceType, resourceId, _entities, revision) => ({
      status: 'gap',
      resourceType,
      resourceId,
      revision,
      serverUpdatedAt: now,
      changes: [],
    }),
    getBundle: async () => null,
    getRevision: async () => 0,
    listMySummaries: async () => [],
  }
}

async function run(): Promise<void> {
  const optimisticTripId = '10000000-0000-0000-0000-000000000099'
  const optimistic = applyOptimisticAuthorityCommandsToBundle({
    resourceType: 'trip',
    resourceId: optimisticTripId,
    revision: 0,
    serverUpdatedAt: now,
    data: { trip: null, plans: [], checklists: [], checklist_item_assignees: [] },
  }, [
    {
      operationId: '00000000-0000-0000-0000-000000000091',
      resourceId: optimisticTripId,
      entityType: 'trip',
      entityId: optimisticTripId,
      action: 'upsert',
      payload: { destination: '전주', user_id: 'account-1' },
      createdAt: now,
    },
    {
      operationId: '00000000-0000-0000-0000-000000000092',
      resourceId: optimisticTripId,
      entityType: 'checklist',
      entityId: '10000000-0000-0000-0000-000000000098',
      action: 'upsert',
      payload: { title: '준비물' },
      createdAt: now,
    },
    {
      operationId: '00000000-0000-0000-0000-000000000093',
      resourceId: optimisticTripId,
      entityType: 'plan',
      entityId: '10000000-0000-0000-0000-000000000097',
      action: 'upsert',
      payload: { title: '한옥마을 산책' },
      createdAt: now,
    },
  ], now)
  assert.equal((optimistic.data.trip as { destination?: string }).destination, '전주')
  assert.equal((optimistic.data.checklists as Array<{ title?: string }>)[0]?.title, '준비물')
  assert.equal((optimistic.data.plans as Array<{ title?: string }>)[0]?.title, '한옥마을 산책')
  assert.throws(
    () => applyOptimisticAuthorityCommandsToBundle(optimistic, [{
      operationId: '00000000-0000-0000-0000-000000000094',
      resourceId: optimisticTripId,
      entityType: 'trip',
      entityId: '10000000-0000-0000-0000-000000000096',
      action: 'upsert',
      payload: { title: '잘못 분류된 일정' },
      createdAt: now,
    }], now),
    /root command must target its resource id/,
  )

  const invalidation = parseAuthorityInvalidation({
    resource_type: 'trip',
    resource_id: '10000000-0000-0000-0000-000000000001',
    revision: 7,
    change_count: 1,
    changed_entities: [
      { entity_type: 'plan', entity_id: 'plan-1', action: 'upsert' },
    ],
    updated_at: now,
  })
  assert.equal(invalidation?.revision, 7)
  assert.deepEqual(decideAuthorityInvalidation(5, 7), {
    action: 'refresh',
    revisionGap: true,
  })
  assert.deepEqual(decideAuthorityInvalidation(7, 7), {
    action: 'ignore',
    reason: 'stale_or_duplicate',
  })

  const invalidationStore = new FakeStore([])
  await invalidationStore.putResource('account-1', {
    resourceType: 'trip',
    resourceId: '10000000-0000-0000-0000-000000000001',
    revision: 4,
    serverUpdatedAt: now,
    data: { trip: { id: '10000000-0000-0000-0000-000000000001' }, plans: [] },
  })
  const invalidationRepository = repositoryWith(async () => {
    throw new Error('applyCommands should not be called')
  })
  invalidationRepository.getChanges = async (resourceType, resourceId) => ({
    status: 'ok',
    resourceType,
    resourceId,
    revision: 5,
    serverUpdatedAt: '2026-07-17T00:00:01.000Z',
    changes: [
      {
        operationId: 'invalidation:5:plan:plan-1',
        entityType: 'plan',
        entityId: 'plan-1',
        action: 'upsert',
        row: { id: 'plan-1', title: 'canonical plan', deleted_at: null },
      },
    ],
  })
  const invalidationCoordinator = new ServerAuthoritySyncCoordinator({
    store: invalidationStore,
    repository: invalidationRepository,
    now: () => new Date(now),
  })
  const reconciled = await invalidationCoordinator.reconcileInvalidation('account-1', {
    resourceType: 'trip',
    resourceId: '10000000-0000-0000-0000-000000000001',
    revision: 5,
    changeCount: 1,
    changedEntities: [{ entityType: 'plan', entityId: 'plan-1', action: 'upsert' }],
    updatedAt: '2026-07-17T00:00:01.000Z',
  })
  assert.equal(reconciled?.revision, 5)
  assert.equal(Array.isArray(reconciled?.data.plans) ? reconciled.data.plans.length : 0, 1)

  const thirtyThree = Array.from({ length: 33 }, (_, index) => record(index + 1))
  const batches = buildAuthorityOutboxBatches(thirtyThree)
  assert.equal(batches.length, 2)
  assert.equal(batches[0]?.records.length, 32)
  assert.equal(batches[1]?.records.length, 1)
  assert.equal(computeAuthorityRetryDelayMs(1, 0), 1_000)
  assert.equal(computeAuthorityRetryDelayMs(10, 1), 72_000)

  const oneHundred = Array.from({ length: 100 }, (_, index) => record(index + 1))
  const largeBatchStore = new FakeStore(oneHundred)
  const observedBaseRevisions: Array<number | null> = []
  const largeBatchCoordinator = new ServerAuthoritySyncCoordinator({
    store: largeBatchStore,
    repository: repositoryWith(async (input) => {
      observedBaseRevisions.push(input.baseRevision)
      return {
        status: 'applied',
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        revision: (input.baseRevision ?? 0) + 1,
        acknowledgedOperationIds: input.commands.map((command) => command.operationId),
        changes: [],
      }
    }),
    now: () => new Date(now),
  })
  const largeBatch = await largeBatchCoordinator.flush('account-1')
  assert.deepEqual(observedBaseRevisions, [4, 5, 6, 7])
  assert.equal(largeBatch.applied, 100)

  const appliedStore = new FakeStore([record(101), record(102)])
  const appliedCoordinator = new ServerAuthoritySyncCoordinator({
    store: appliedStore,
    repository: repositoryWith(async (input) => ({
      status: 'applied',
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      revision: 5,
      acknowledgedOperationIds: input.commands.map((command) => command.operationId),
      changes: [],
    })),
    now: () => new Date(now),
    random: () => 0,
  })
  const applied = await appliedCoordinator.flush('account-1')
  assert.deepEqual(applied, {
    attempted: 2,
    applied: 2,
    conflicted: 0,
    retryable: 0,
    rejected: 0,
  })
  assert.equal(appliedStore.records.length, 0)

  const retryStore = new FakeStore([record(201)])
  const retryCoordinator = new ServerAuthoritySyncCoordinator({
    store: retryStore,
    repository: repositoryWith(async () => {
      throw new ServerAuthorityRepositoryError({
        message: 'offline',
        code: 'network_unavailable',
        retryable: true,
      })
    }),
    now: () => new Date(now),
    random: () => 0,
  })
  const retry = await retryCoordinator.flush('account-1')
  assert.equal(retry.retryable, 1)
  assert.equal(retryStore.records[0]?.status, 'retryable')
  assert.equal(retryStore.records[0]?.nextAttemptAt, '2026-07-17T00:00:01.000Z')

  const conflictBundle: CanonicalResourceBundle = {
    resourceType: 'trip',
    resourceId: record(301).resourceId,
    revision: 8,
    serverUpdatedAt: now,
    data: { trip: { id: record(301).resourceId } },
  }
  const conflictStore = new FakeStore([record(301)])
  const conflictCoordinator = new ServerAuthoritySyncCoordinator({
    store: conflictStore,
    repository: repositoryWith(async (input) => ({
      status: 'conflict',
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      revision: 8,
      acknowledgedOperationIds: [],
      changes: [],
      bundle: conflictBundle,
    })),
    now: () => new Date(now),
  })
  const conflict = await conflictCoordinator.flush('account-1')
  assert.equal(conflict.conflicted, 1)
  assert.equal(conflictStore.records[0]?.status, 'conflict')
  assert.equal(
    (await conflictStore.getResource('account-1', 'trip', conflictBundle.resourceId))?.revision,
    8,
  )

  const revokedStore = new FakeStore([record(401), record(402)])
  await revokedStore.putResource('account-1', {
    resourceType: 'trip',
    resourceId: record(401).resourceId,
    revision: 4,
    serverUpdatedAt: now,
    data: { trip: { id: record(401).resourceId } },
  })
  const revokedEvents: string[] = []
  const revokedCoordinator = new ServerAuthoritySyncCoordinator({
    store: revokedStore,
    repository: repositoryWith(async () => {
      throw new ServerAuthorityRepositoryError({
        message: 'authority_trip_forbidden',
        code: '42501',
        retryable: false,
        status: 403,
      })
    }),
    now: () => new Date(now),
    random: () => 0,
    onMembershipRevoked: (accountId, resourceType, resourceId) => {
      revokedEvents.push(`${accountId}:${resourceType}:${resourceId}`)
    },
  })
  const revoked = await revokedCoordinator.flush('account-1')
  assert.equal(revoked.rejected, 2)
  assert.equal(revokedStore.records.length, 0)
  assert.equal(await revokedStore.getResource('account-1', 'trip', record(401).resourceId), null)
  assert.deepEqual(revokedEvents, [`account-1:trip:${record(401).resourceId}`])

  const revokedRefreshStore = new FakeStore([])
  await revokedRefreshStore.putResource('account-1', {
    resourceType: 'trip',
    resourceId: record(401).resourceId,
    revision: 4,
    serverUpdatedAt: now,
    data: { trip: { id: record(401).resourceId } },
  })
  const refreshDenied = repositoryWith(async () => {
    throw new Error('unused')
  })
  refreshDenied.getBundle = async () => {
    throw new ServerAuthorityRepositoryError({
      message: 'authority_trip_forbidden',
      code: '42501',
      retryable: false,
      status: 403,
    })
  }
  const revokedRefreshCoordinator = new ServerAuthoritySyncCoordinator({
    store: revokedRefreshStore,
    repository: refreshDenied,
    now: () => new Date(now),
  })
  await assert.rejects(
    revokedRefreshCoordinator.refreshResource(
      'account-1',
      'trip',
      record(401).resourceId,
      Number.MAX_SAFE_INTEGER,
    ),
  )
  assert.equal(
    await revokedRefreshStore.getResource('account-1', 'trip', record(401).resourceId),
    null,
  )

  console.log('serverAuthoritySync tests passed')
}

run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
