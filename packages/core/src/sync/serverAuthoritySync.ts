import {
  ServerAuthorityRepositoryError,
  type ServerAuthorityRepository,
} from '../repositories/serverAuthorityRepository'
import { applyCanonicalChangesToBundle } from './serverAuthorityMaterialize'
import {
  decideAuthorityInvalidation,
  type AuthorityInvalidation,
} from './serverAuthorityInvalidation'
import type {
  AuthorityLocalStore,
  AuthorityOutboxRecord,
  AuthorityResourceType,
  AuthoritySyncMetricSink,
  CanonicalResourceBundle,
} from './serverAuthorityTypes'

const DEFAULT_BATCH_SIZE = 32
const DEFAULT_RECOVERY_AFTER_MS = 2 * 60 * 1000
const DEFAULT_OUTBOX_READ_LIMIT = 256

export interface ServerAuthoritySyncCoordinatorOptions {
  repository: ServerAuthorityRepository
  store: AuthorityLocalStore
  metricSink?: AuthoritySyncMetricSink
  now?: () => Date
  random?: () => number
  batchSize?: number
  recoveryAfterMs?: number
  outboxReadLimit?: number
  onMembershipRevoked?: (
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ) => void
}

export interface AuthorityFlushResult {
  attempted: number
  applied: number
  conflicted: number
  retryable: number
  rejected: number
}

interface AuthorityOutboxBatch {
  resourceType: AuthorityResourceType
  resourceId: string
  baseRevision: number
  records: AuthorityOutboxRecord[]
}

export class ServerAuthoritySyncCoordinator {
  private readonly repository: ServerAuthorityRepository
  private readonly store: AuthorityLocalStore
  private readonly metricSink?: AuthoritySyncMetricSink
  private readonly now: () => Date
  private readonly random: () => number
  private readonly batchSize: number
  private readonly recoveryAfterMs: number
  private readonly outboxReadLimit: number
  private readonly onMembershipRevoked?: (
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ) => void
  private readonly activeFlushes = new Map<string, Promise<AuthorityFlushResult>>()

  constructor(options: ServerAuthoritySyncCoordinatorOptions) {
    this.repository = options.repository
    this.store = options.store
    this.metricSink = options.metricSink
    this.now = options.now ?? (() => new Date())
    this.random = options.random ?? Math.random
    this.batchSize = clampBatchSize(options.batchSize ?? DEFAULT_BATCH_SIZE)
    this.recoveryAfterMs = options.recoveryAfterMs ?? DEFAULT_RECOVERY_AFTER_MS
    this.outboxReadLimit = options.outboxReadLimit ?? DEFAULT_OUTBOX_READ_LIMIT
    this.onMembershipRevoked = options.onMembershipRevoked
  }

  flush(accountId: string): Promise<AuthorityFlushResult> {
    const active = this.activeFlushes.get(accountId)
    if (active) return active

    const flush = this.runFlush(accountId).finally(() => {
      this.activeFlushes.delete(accountId)
    })
    this.activeFlushes.set(accountId, flush)
    return flush
  }

  async refreshResource(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
    minimumRevision = 0,
  ): Promise<CanonicalResourceBundle | null> {
    const local = await this.store.getResource(accountId, resourceType, resourceId)
    if (local && local.revision >= minimumRevision) return local

    let remote: CanonicalResourceBundle | null
    try {
      remote = await this.repository.getBundle(resourceType, resourceId)
    } catch (error) {
      if (isAuthorityMembershipDeniedError(error)) {
        await this.handleMembershipRevoked(accountId, resourceType, resourceId)
      }
      throw error
    }
    if (remote) await this.store.putResource(accountId, remote)
    return remote
  }

  private async handleMembershipRevoked(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<void> {
    await this.store.purgeResource(accountId, resourceType, resourceId)
    this.metricSink?.({
      name: 'authority_membership_revoked',
      accountId,
      resourceType,
      resourceId,
    })
    this.onMembershipRevoked?.(accountId, resourceType, resourceId)
  }

  async reconcileInvalidation(
    accountId: string,
    invalidation: AuthorityInvalidation,
  ): Promise<CanonicalResourceBundle | null> {
    const local = await this.store.getResource(
      accountId,
      invalidation.resourceType,
      invalidation.resourceId,
    )
    if (!local) {
      return this.refreshResource(
        accountId,
        invalidation.resourceType,
        invalidation.resourceId,
        Number.MAX_SAFE_INTEGER,
      )
    }

    const decision = decideAuthorityInvalidation(local.revision, invalidation.revision)
    if (decision.action === 'ignore') return local
    if (
      decision.revisionGap ||
      invalidation.changedEntities.length === 0 ||
      invalidation.changeCount !== invalidation.changedEntities.length
    ) {
      return this.refreshResource(
        accountId,
        invalidation.resourceType,
        invalidation.resourceId,
        Number.MAX_SAFE_INTEGER,
      )
    }

    const changes = await this.repository.getChanges(
      invalidation.resourceType,
      invalidation.resourceId,
      invalidation.changedEntities,
      invalidation.revision,
    )
    if (changes.status === 'gap' || changes.revision !== invalidation.revision) {
      return this.refreshResource(
        accountId,
        invalidation.resourceType,
        invalidation.resourceId,
        Number.MAX_SAFE_INTEGER,
      )
    }

    const canonical = applyCanonicalChangesToBundle(
      local,
      {
        status: 'applied',
        resourceType: changes.resourceType,
        resourceId: changes.resourceId,
        revision: changes.revision,
        serverUpdatedAt: changes.serverUpdatedAt,
        acknowledgedOperationIds: [],
        changes: changes.changes,
      },
      changes.serverUpdatedAt,
    )
    await this.store.putResource(accountId, canonical)
    return canonical
  }

  async promoteGuestAccount(
    guestAccountId: string,
    accountId: string,
  ): Promise<AuthorityFlushResult> {
    const now = this.now().toISOString()
    await this.store.promoteGuestAccount(guestAccountId, accountId, now)
    return this.flush(accountId)
  }

  private async runFlush(accountId: string): Promise<AuthorityFlushResult> {
    const startedAt = this.now()
    const recovered = await this.store.recoverStaleSending(
      accountId,
      new Date(startedAt.getTime() - this.recoveryAfterMs).toISOString(),
      startedAt.toISOString(),
    )
    if (recovered > 0) {
      this.metricSink?.({
        name: 'authority_sending_recovered',
        accountId,
        commandCount: recovered,
      })
    }

    const ready = await this.store.listReadyOutbox(
      accountId,
      startedAt.toISOString(),
      this.outboxReadLimit,
    )
    this.metricSink?.({
      name: 'authority_flush_started',
      accountId,
      commandCount: ready.length,
      queueOldestAgeMs: calculateOldestQueueAgeMs(ready, startedAt),
      estimatedBytes: ready.reduce(
        (total, record) => total + JSON.stringify(record.command).length,
        0,
      ),
    })

    const totals: AuthorityFlushResult = {
      attempted: ready.length,
      applied: 0,
      conflicted: 0,
      retryable: 0,
      rejected: 0,
    }

    const blockedResources = new Set<string>()
    const latestRevisions = new Map<string, number>()
    for (const batch of buildAuthorityOutboxBatches(ready, this.batchSize)) {
      const resourceKey = `${batch.resourceType}:${batch.resourceId}`
      if (blockedResources.has(resourceKey)) continue
      const rebasedRevision = latestRevisions.get(resourceKey) ?? batch.baseRevision
      const operationIds = batch.records.map((record) => record.operationId)
      const now = this.now().toISOString()
      await this.store.markSending(accountId, operationIds, now)

      try {
        const result = await this.repository.applyCommands({
          resourceType: batch.resourceType,
          resourceId: batch.resourceId,
          baseRevision: rebasedRevision,
          commands: batch.records.map((record) => record.command),
        })

        if (result.status === 'conflict') {
          await this.store.markConflict(
            accountId,
            operationIds,
            result.bundle ?? null,
            this.now().toISOString(),
          )
          totals.conflicted += operationIds.length
          blockedResources.add(resourceKey)
          this.metricSink?.({
            name: 'authority_batch_conflict',
            accountId,
            resourceType: batch.resourceType,
            resourceId: batch.resourceId,
            commandCount: operationIds.length,
          })
          continue
        }

        await this.store.applyAcknowledgement(accountId, result, this.now().toISOString())
        totals.applied += operationIds.length
        latestRevisions.set(resourceKey, result.revision)
        this.metricSink?.({
          name: 'authority_batch_applied',
          accountId,
          resourceType: batch.resourceType,
          resourceId: batch.resourceId,
          commandCount: operationIds.length,
          revision: result.revision,
        })
      } catch (error) {
        const classified = classifyAuthoritySyncError(error)
        if (classified.retryable) {
          const attempt = Math.max(...batch.records.map((record) => record.attempts + 1))
          const delayMs = computeAuthorityRetryDelayMs(attempt, this.random())
          await this.store.markRetryable(
            accountId,
            operationIds,
            classified.code,
            new Date(this.now().getTime() + delayMs).toISOString(),
            this.now().toISOString(),
          )
          totals.retryable += operationIds.length
          blockedResources.add(resourceKey)
          this.metricSink?.({
            name: 'authority_batch_retryable',
            accountId,
            resourceType: batch.resourceType,
            resourceId: batch.resourceId,
            commandCount: operationIds.length,
            errorCode: classified.code,
          })
        } else {
          await this.store.markRejected(
            accountId,
            operationIds,
            classified.code,
            this.now().toISOString(),
          )
          totals.rejected += operationIds.length
          blockedResources.add(resourceKey)
          this.metricSink?.({
            name: 'authority_batch_rejected',
            accountId,
            resourceType: batch.resourceType,
            resourceId: batch.resourceId,
            commandCount: operationIds.length,
            errorCode: classified.code,
          })
          if (isAuthorityMembershipDeniedError(error)) {
            await this.handleMembershipRevoked(accountId, batch.resourceType, batch.resourceId)
          }
        }
      }
    }

    return totals
  }
}

export function buildAuthorityOutboxBatches(
  records: AuthorityOutboxRecord[],
  batchSize = DEFAULT_BATCH_SIZE,
): AuthorityOutboxBatch[] {
  const clampedBatchSize = clampBatchSize(batchSize)
  const batches: AuthorityOutboxBatch[] = []

  for (const record of records) {
    const last = batches[batches.length - 1]
    const canAppend =
      last &&
      last.resourceType === record.resourceType &&
      last.resourceId === record.resourceId &&
      last.baseRevision === record.baseRevision &&
      last.records.length < clampedBatchSize

    if (canAppend) {
      last.records.push(record)
    } else {
      batches.push({
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        baseRevision: record.baseRevision,
        records: [record],
      })
    }
  }

  return batches
}

export function computeAuthorityRetryDelayMs(attempt: number, randomValue: number): number {
  const exponent = Math.min(Math.max(attempt - 1, 0), 6)
  const baseDelay = Math.min(1_000 * 2 ** exponent, 60_000)
  const jitter = Math.round(baseDelay * 0.2 * Math.min(Math.max(randomValue, 0), 1))
  return baseDelay + jitter
}

// 42501 covers command/resource mismatch errors too — only the explicit
// authority forbidden messages mean the caller lost membership.
const AUTHORITY_MEMBERSHIP_DENIED_MESSAGE = /^authority_(trip|template)_(create_|write_)?forbidden$/

export function isAuthorityMembershipDeniedError(error: unknown): boolean {
  if (!(error instanceof ServerAuthorityRepositoryError)) return false
  if (error.retryable) return false
  return AUTHORITY_MEMBERSHIP_DENIED_MESSAGE.test(error.message)
}

export function classifyAuthoritySyncError(error: unknown): {
  code: string
  retryable: boolean
} {
  if (error instanceof ServerAuthorityRepositoryError) {
    return { code: error.code, retryable: error.retryable }
  }
  return { code: 'authority_transport_failed', retryable: true }
}

function clampBatchSize(batchSize: number): number {
  return Math.min(Math.max(Math.trunc(batchSize), 1), DEFAULT_BATCH_SIZE)
}

function calculateOldestQueueAgeMs(records: AuthorityOutboxRecord[], now: Date): number {
  const oldestTimestamp = records.reduce((oldest, record) => {
    const timestamp = Date.parse(record.createdAt)
    return Number.isFinite(timestamp) ? Math.min(oldest, timestamp) : oldest
  }, Number.POSITIVE_INFINITY)
  return Number.isFinite(oldestTimestamp) ? Math.max(0, now.getTime() - oldestTimestamp) : 0
}
