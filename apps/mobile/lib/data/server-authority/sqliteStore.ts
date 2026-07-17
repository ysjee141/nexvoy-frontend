import {
  applyCanonicalChangesToBundle,
  applyOptimisticAuthorityCommandsToBundle,
  type AuthorityApplyResult,
  type AuthorityCommand,
  type AuthorityLocalStore,
  type AuthorityOutboxRecord,
  type AuthorityOutboxStatus,
  type AuthorityProductSyncSnapshot,
  type AuthorityResourceType,
  type CanonicalResourceBundle,
  type CommitOptimisticAuthorityMutationInput,
  type CommitOptimisticAuthorityMutationsInput,
} from '@nexvoy/core'
import type {
  MobileAuthorityDatabase,
  MobileAuthorityDatabaseTransaction,
  MobileAuthoritySyncState,
  StoredMobileAuthorityResource,
} from './database'

export interface MobileAuthorityStoreChange {
  accountId: string
  resourceType?: AuthorityResourceType
  resourceId?: string
}

type MobileAuthorityStoreListener = (change: MobileAuthorityStoreChange) => void

export class MobileAuthoritySqliteStore implements AuthorityLocalStore {
  private readonly listeners = new Set<MobileAuthorityStoreListener>()

  constructor(private readonly database: MobileAuthorityDatabase) {}

  async getResource(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<CanonicalResourceBundle | null> {
    return (await this.database.getResource(accountId, resourceType, resourceId))?.bundle ?? null
  }

  async putResource(accountId: string, bundle: CanonicalResourceBundle): Promise<void> {
    let changed = false
    await this.database.transaction(async (transaction) => {
      const existing = await transaction.getResource(
        accountId,
        bundle.resourceType,
        bundle.resourceId,
      )
      const currentCanonical = existing?.canonicalBundle ?? existing?.bundle
      const candidate = existing ? preserveLocalMetadata(existing.bundle, bundle) : bundle
      if (currentCanonical && !shouldReplaceResource(currentCanonical, candidate)) return

      const remaining = await transaction.listOutbox(
        accountId,
        bundle.resourceType,
        bundle.resourceId,
      )
      const optimisticCommands = activeOutboxCommands(remaining)
      const projected = optimisticCommands.length > 0
        ? {
            ...applyOptimisticAuthorityCommandsToBundle(
              candidate,
              optimisticCommands,
              candidate.serverUpdatedAt,
            ),
            serverUpdatedAt: candidate.serverUpdatedAt,
          }
        : candidate
      await transaction.putResource(
        toStoredResource(accountId, projected, candidate, candidate.serverUpdatedAt),
      )
      await transaction.putSyncState(
        toSyncState(accountId, candidate, candidate.serverUpdatedAt),
      )
      changed = true
    })
    if (changed) this.emit({ accountId, resourceType: bundle.resourceType, resourceId: bundle.resourceId })
  }

  async commitOptimisticMutation(
    input: CommitOptimisticAuthorityMutationInput,
  ): Promise<void> {
    await this.commitOptimisticMutations({
      accountId: input.accountId,
      baseBundle: input.baseBundle,
      bundle: input.bundle,
      commands: [input.command],
      now: input.now,
    })
  }

  async commitOptimisticMutations(
    input: CommitOptimisticAuthorityMutationsInput,
  ): Promise<void> {
    if (input.commands.length === 0) throw new Error('Authority mutation batch is empty.')
    input.commands.forEach((command) => validateMutation(input.bundle, command))

    await this.database.transaction(async (transaction) => {
      const current = await transaction.getResource(
        input.accountId,
        input.bundle.resourceType,
        input.bundle.resourceId,
      )
      if (current && input.bundle.revision < current.bundle.revision) {
        throw new Error('Optimistic mutation is based on a stale authority revision.')
      }

      const canonicalBundle = current?.canonicalBundle
        ?? current?.bundle
        ?? input.baseBundle
        ?? input.bundle
      await transaction.putResource(
        toStoredResource(input.accountId, input.bundle, canonicalBundle, input.now),
      )
      await transaction.putSyncState(
        toSyncState(input.accountId, canonicalBundle, input.now),
      )

      for (const command of input.commands) {
        const existing = await transaction.getOutbox(command.operationId)
        if (existing) {
          if (
            existing.accountId !== input.accountId ||
            JSON.stringify(existing.command) !== JSON.stringify(command)
          ) {
            throw new Error('Authority operation id is already used by another mutation.')
          }
          continue
        }
        await transaction.putOutbox({
          operationId: command.operationId,
          accountId: input.accountId,
          resourceType: input.bundle.resourceType,
          resourceId: input.bundle.resourceId,
          baseRevision: input.bundle.revision,
          command,
          status: 'pending',
          attempts: 0,
          nextAttemptAt: null,
          lastError: null,
          createdAt: command.createdAt,
          updatedAt: input.now,
        })
      }
    })
    this.emit({
      accountId: input.accountId,
      resourceType: input.bundle.resourceType,
      resourceId: input.bundle.resourceId,
    })
  }

  async listResources(
    accountId: string,
    resourceType?: AuthorityResourceType,
  ): Promise<CanonicalResourceBundle[]> {
    return (await this.database.listResources(accountId, resourceType)).map((row) => row.bundle)
  }

  async deleteResource(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<void> {
    await this.database.transaction((transaction) =>
      transaction.deleteResource(accountId, resourceType, resourceId),
    )
    this.emit({ accountId, resourceType, resourceId })
  }

  async purgeAccount(accountId: string): Promise<void> {
    await this.database.transaction((transaction) => transaction.deleteAccount(accountId))
    this.emit({ accountId })
  }

  async getSyncSnapshot(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
    online = true,
  ): Promise<AuthorityProductSyncSnapshot> {
    const rows = await this.database.listOutbox(accountId, resourceType, resourceId)
    const conflict = rows.find((row) => row.status === 'conflict')
    const rejected = rows.find((row) => row.status === 'rejected')
    const pending = rows.filter(isActiveOutboxRecord)
    if (conflict) {
      return { status: 'conflict', pendingCount: rows.length, lastError: conflict.lastError }
    }
    if (rejected) {
      return { status: 'error', pendingCount: rows.length, lastError: rejected.lastError }
    }
    if (!online) {
      return { status: 'offline', pendingCount: pending.length, lastError: null }
    }
    return {
      status: pending.length > 0 ? 'pending' : 'synced',
      pendingCount: pending.length,
      lastError: pending.find((row) => row.lastError)?.lastError ?? null,
    }
  }

  subscribe(listener: MobileAuthorityStoreListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async setResourceRole(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
    role: string,
  ): Promise<CanonicalResourceBundle | null> {
    let updated: CanonicalResourceBundle | null = null
    await this.database.transaction(async (transaction) => {
      const row = await transaction.getResource(accountId, resourceType, resourceId)
      if (!row) return
      const bundle = { ...row.bundle, data: { ...row.bundle.data, _role: role } }
      const canonicalBundle = {
        ...row.canonicalBundle,
        data: { ...row.canonicalBundle.data, _role: role },
      }
      await transaction.putResource({ ...row, bundle, canonicalBundle })
      updated = bundle
    })
    if (updated) this.emit({ accountId, resourceType, resourceId })
    return updated
  }

  async getNextRetryAt(accountId: string): Promise<string | null> {
    const retryAt = (await this.database.listOutbox(accountId))
      .filter((row) => row.status === 'retryable' && row.nextAttemptAt)
      .map((row) => row.nextAttemptAt as string)
      .sort()[0]
    return retryAt ?? null
  }

  async listReadyOutbox(
    accountId: string,
    now: string,
    limit: number,
  ): Promise<AuthorityOutboxRecord[]> {
    return (await this.database.listOutbox(accountId))
      .filter((row) => {
        if (row.status === 'pending') return true
        return row.status === 'retryable' && (!row.nextAttemptAt || row.nextAttemptAt <= now)
      })
      .sort(compareOutbox)
      .slice(0, Math.max(0, limit))
  }

  async markSending(accountId: string, operationIds: string[], now: string): Promise<void> {
    await this.updateOutbox(accountId, operationIds, (row) => ({
      ...row,
      status: 'sending',
      updatedAt: now,
    }))
  }

  async applyAcknowledgement(
    accountId: string,
    result: AuthorityApplyResult,
    now: string,
  ): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const existing = await transaction.getResource(
        accountId,
        result.resourceType,
        result.resourceId,
      )
      const existingCanonical = existing?.canonicalBundle ?? existing?.bundle ?? null
      const resultBundle = result.bundle && existing
        ? preserveLocalMetadata(existing.bundle, result.bundle)
        : result.bundle
      let canonicalBundle = existingCanonical
      if (resultBundle && (!existingCanonical || shouldReplaceResource(existingCanonical, resultBundle))) {
        canonicalBundle = resultBundle
      } else if (existingCanonical && result.revision >= existingCanonical.revision) {
        canonicalBundle = applyCanonicalChangesToBundle(existingCanonical, result, now)
      } else if (!existingCanonical) {
        throw new Error('Cannot acknowledge authority commands without a local resource cache.')
      }
      if (!canonicalBundle) {
        throw new Error('Canonical authority state is unavailable after acknowledgement.')
      }

      for (const operationId of result.acknowledgedOperationIds) {
        const row = await transaction.getOutbox(operationId)
        if (row?.accountId === accountId) await transaction.deleteOutbox(operationId)
      }

      const remaining = await transaction.listOutbox(
        accountId,
        result.resourceType,
        result.resourceId,
      )
      for (const row of remaining) {
        if (
          (row.status === 'pending' || row.status === 'retryable') &&
          row.baseRevision < canonicalBundle.revision
        ) {
          await transaction.putOutbox({
            ...row,
            baseRevision: canonicalBundle.revision,
            updatedAt: now,
          })
        }
      }

      const projection = activeOutboxCommands(remaining).length > 0
        ? applyOptimisticAuthorityCommandsToBundle(
            canonicalBundle,
            activeOutboxCommands(remaining),
            now,
          )
        : canonicalBundle
      await transaction.putResource(
        toStoredResource(accountId, projection, canonicalBundle, now),
      )
      await transaction.putSyncState(toSyncState(accountId, canonicalBundle, now))
    })
    this.emit({
      accountId,
      resourceType: result.resourceType,
      resourceId: result.resourceId,
    })
  }

  async markRetryable(
    accountId: string,
    operationIds: string[],
    errorCode: string,
    nextAttemptAt: string,
    now: string,
  ): Promise<void> {
    await this.updateOutbox(accountId, operationIds, (row) => ({
      ...row,
      status: 'retryable',
      attempts: row.attempts + 1,
      nextAttemptAt,
      lastError: errorCode,
      updatedAt: now,
    }))
  }

  async markRejected(
    accountId: string,
    operationIds: string[],
    errorCode: string,
    now: string,
  ): Promise<void> {
    await this.updateOutbox(accountId, operationIds, (row) => ({
      ...row,
      status: 'rejected',
      lastError: errorCode,
      nextAttemptAt: null,
      updatedAt: now,
    }))
  }

  async markConflict(
    accountId: string,
    operationIds: string[],
    bundle: CanonicalResourceBundle | null,
    now: string,
  ): Promise<void> {
    await this.database.transaction(async (transaction) => {
      if (bundle) {
        const existing = await transaction.getResource(
          accountId,
          bundle.resourceType,
          bundle.resourceId,
        )
        const canonicalBundle = existing ? preserveLocalMetadata(existing.bundle, bundle) : bundle
        await transaction.putResource(
          toStoredResource(accountId, canonicalBundle, canonicalBundle, now),
        )
        await transaction.putSyncState({
          ...toSyncState(accountId, canonicalBundle, now),
          lastError: 'authority_revision_conflict',
        })
      }
      for (const operationId of operationIds) {
        const row = await transaction.getOutbox(operationId)
        if (row?.accountId === accountId) {
          await transaction.putOutbox({
            ...row,
            status: 'conflict',
            lastError: 'authority_revision_conflict',
            nextAttemptAt: null,
            updatedAt: now,
          })
        }
      }
    })
    this.emit({ accountId })
  }

  async recoverStaleSending(
    accountId: string,
    staleBefore: string,
    now: string,
  ): Promise<number> {
    const rows = (await this.database.listOutbox(accountId)).filter(
      (row) => row.status === 'sending' && row.updatedAt < staleBefore,
    )
    if (rows.length === 0) return 0
    await this.updateOutbox(
      accountId,
      rows.map((row) => row.operationId),
      (row) => ({
        ...row,
        status: 'retryable',
        lastError: 'authority_sending_recovered',
        nextAttemptAt: now,
        updatedAt: now,
      }),
    )
    return rows.length
  }

  async promoteGuestAccount(
    guestAccountId: string,
    accountId: string,
    now: string,
  ): Promise<void> {
    if (guestAccountId === accountId) return
    await this.database.transaction(async (transaction) => {
      const guestResources = await transaction.listResources(guestAccountId)
      const guestOutbox = await transaction.listOutbox(guestAccountId)
      const guestSyncStates = await transaction.listSyncStates(guestAccountId)

      for (const guestResource of guestResources) {
        const destination = await transaction.getResource(
          accountId,
          guestResource.resourceType,
          guestResource.resourceId,
        )
        if (!destination || shouldReplaceResource(destination.bundle, guestResource.bundle)) {
          await transaction.putResource({ ...guestResource, accountId, updatedAt: now })
        }
      }

      for (const guestRecord of guestOutbox) {
        const existing = await transaction.getOutbox(guestRecord.operationId)
        if (existing && existing.accountId !== guestAccountId) {
          throw new Error('Guest authority operation collides with an account operation.')
        }
        await transaction.putOutbox({
          ...guestRecord,
          accountId,
          status: normalizePromotedStatus(guestRecord.status),
          updatedAt: now,
        })
      }

      for (const guestState of guestSyncStates) {
        const destination = await transaction.getSyncState(
          accountId,
          guestState.resourceType,
          guestState.resourceId,
        )
        if (!destination || guestState.lastSeenRevision >= destination.lastSeenRevision) {
          await transaction.putSyncState({ ...guestState, accountId, updatedAt: now })
        }
      }

      for (const guestResource of guestResources) {
        await transaction.deleteResource(
          guestAccountId,
          guestResource.resourceType,
          guestResource.resourceId,
        )
      }
    })
    this.emit({ accountId })
  }

  close(): Promise<void> {
    this.listeners.clear()
    return this.database.close()
  }

  private async updateOutbox(
    accountId: string,
    operationIds: string[],
    transform: (row: AuthorityOutboxRecord) => AuthorityOutboxRecord,
  ): Promise<void> {
    await this.database.transaction(async (transaction) => {
      for (const operationId of operationIds) {
        const row = await transaction.getOutbox(operationId)
        if (row?.accountId === accountId) await transaction.putOutbox(transform(row))
      }
    })
    this.emit({ accountId })
  }

  private emit(change: MobileAuthorityStoreChange): void {
    this.listeners.forEach((listener) => listener(change))
  }
}

function toStoredResource(
  accountId: string,
  bundle: CanonicalResourceBundle,
  canonicalBundle: CanonicalResourceBundle,
  updatedAt: string,
): StoredMobileAuthorityResource {
  return {
    accountId,
    resourceType: bundle.resourceType,
    resourceId: bundle.resourceId,
    bundle,
    canonicalBundle,
    updatedAt,
  }
}

function toSyncState(
  accountId: string,
  bundle: CanonicalResourceBundle,
  updatedAt: string,
): MobileAuthoritySyncState {
  return {
    accountId,
    resourceType: bundle.resourceType,
    resourceId: bundle.resourceId,
    lastSeenRevision: bundle.revision,
    lastReconciledRevision: bundle.revision,
    lastRefreshedAt: updatedAt,
    lastError: null,
    updatedAt,
  }
}

function activeOutboxCommands(rows: AuthorityOutboxRecord[]): AuthorityCommand[] {
  return rows.filter(isActiveOutboxRecord).sort(compareOutbox).map((row) => row.command)
}

function isActiveOutboxRecord(row: AuthorityOutboxRecord): boolean {
  return row.status === 'pending' || row.status === 'sending' || row.status === 'retryable'
}

function shouldReplaceResource(
  current: CanonicalResourceBundle,
  candidate: CanonicalResourceBundle,
): boolean {
  return (
    candidate.revision > current.revision ||
    (candidate.revision === current.revision &&
      candidate.serverUpdatedAt >= current.serverUpdatedAt)
  )
}

function preserveLocalMetadata(
  current: CanonicalResourceBundle,
  candidate: CanonicalResourceBundle,
): CanonicalResourceBundle {
  const role = current.data._role
  if (candidate.data._role !== undefined || role === undefined) return candidate
  return { ...candidate, data: { ...candidate.data, _role: role } }
}

function validateMutation(bundle: CanonicalResourceBundle, command: AuthorityCommand): void {
  const commandResourceType = command.entityType.startsWith('template') ? 'template' : 'trip'
  if (command.resourceId !== bundle.resourceId || commandResourceType !== bundle.resourceType) {
    throw new Error('Authority command and optimistic bundle do not match.')
  }
}

function compareOutbox(left: AuthorityOutboxRecord, right: AuthorityOutboxRecord): number {
  return left.createdAt.localeCompare(right.createdAt) ||
    left.operationId.localeCompare(right.operationId)
}

function normalizePromotedStatus(status: AuthorityOutboxStatus): AuthorityOutboxStatus {
  return status === 'sending' ? 'retryable' : status
}
