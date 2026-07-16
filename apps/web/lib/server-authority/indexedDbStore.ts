import {
  applyCanonicalChangesToBundle,
  type AuthorityApplyResult,
  type AuthorityLocalStore,
  type AuthorityOutboxRecord,
  type AuthorityOutboxStatus,
  type AuthorityResourceType,
  type CanonicalResourceBundle,
  type CommitOptimisticAuthorityMutationInput,
} from '@nexvoy/core'

export const WEB_AUTHORITY_DB_NAME = 'onvoy-server-authority'
export const WEB_AUTHORITY_DB_VERSION = 1

const RESOURCE_STORE = 'resources'
const OUTBOX_STORE = 'outbox'
const ACCOUNT_INDEX = 'byAccount'
const ACCOUNT_RESOURCE_INDEX = 'byAccountResource'

interface StoredAuthorityResource {
  id: string
  accountId: string
  resourceType: AuthorityResourceType
  resourceId: string
  bundle: CanonicalResourceBundle
  updatedAt: string
}

interface WebAuthorityIndexedDbOptions {
  indexedDB?: IDBFactory
  databaseName?: string
}

export class WebAuthorityIndexedDbStore implements AuthorityLocalStore {
  private readonly indexedDB: IDBFactory
  private readonly databaseName: string
  private databasePromise: Promise<IDBDatabase> | null = null

  constructor(options: WebAuthorityIndexedDbOptions = {}) {
    const indexedDB = options.indexedDB ?? globalThis.indexedDB
    if (!indexedDB) throw new Error('IndexedDB is unavailable.')
    this.indexedDB = indexedDB
    this.databaseName = options.databaseName ?? WEB_AUTHORITY_DB_NAME
  }

  async getResource(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<CanonicalResourceBundle | null> {
    const database = await this.open()
    const transaction = database.transaction(RESOURCE_STORE, 'readonly')
    const row = await requestValue<StoredAuthorityResource | undefined>(
      transaction.objectStore(RESOURCE_STORE).get(resourceKey(accountId, resourceType, resourceId)),
    )
    await transactionComplete(transaction)
    return row?.bundle ?? null
  }

  async putResource(accountId: string, bundle: CanonicalResourceBundle): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction(RESOURCE_STORE, 'readwrite')
    const store = transaction.objectStore(RESOURCE_STORE)
    const id = resourceKey(accountId, bundle.resourceType, bundle.resourceId)
    const existing = await requestValue<StoredAuthorityResource | undefined>(store.get(id))
    if (!existing || shouldReplaceResource(existing.bundle, bundle)) {
      store.put(toStoredResource(accountId, bundle))
    }
    await transactionComplete(transaction)
  }

  async commitOptimisticMutation(
    input: CommitOptimisticAuthorityMutationInput,
  ): Promise<void> {
    validateMutation(input)
    const database = await this.open()
    const transaction = database.transaction([RESOURCE_STORE, OUTBOX_STORE], 'readwrite')
    const resources = transaction.objectStore(RESOURCE_STORE)
    const outbox = transaction.objectStore(OUTBOX_STORE)
    const resourceId = resourceKey(
      input.accountId,
      input.bundle.resourceType,
      input.bundle.resourceId,
    )
    const currentResource = await requestValue<StoredAuthorityResource | undefined>(
      resources.get(resourceId),
    )
    const existing = await requestValue<AuthorityOutboxRecord | undefined>(
      outbox.get(input.command.operationId),
    )

    if (existing) {
      if (
        existing.accountId !== input.accountId ||
        JSON.stringify(existing.command) !== JSON.stringify(input.command)
      ) {
        transaction.abort()
        throw new Error('Authority operation id is already used by another mutation.')
      }
      await transactionComplete(transaction)
      return
    }

    if (currentResource && input.bundle.revision < currentResource.bundle.revision) {
      transaction.abort()
      throw new Error('Optimistic mutation is based on a stale authority revision.')
    }

    resources.put(toStoredResource(input.accountId, input.bundle, input.now))
    outbox.put({
      operationId: input.command.operationId,
      accountId: input.accountId,
      resourceType: input.bundle.resourceType,
      resourceId: input.bundle.resourceId,
      baseRevision: input.bundle.revision,
      command: input.command,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: null,
      lastError: null,
      createdAt: input.command.createdAt,
      updatedAt: input.now,
    } satisfies AuthorityOutboxRecord)
    await transactionComplete(transaction)
  }

  async listReadyOutbox(
    accountId: string,
    now: string,
    limit: number,
  ): Promise<AuthorityOutboxRecord[]> {
    const rows = await this.listAccountOutbox(accountId)
    return rows
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
    const database = await this.open()
    const transaction = database.transaction([RESOURCE_STORE, OUTBOX_STORE], 'readwrite')
    const resources = transaction.objectStore(RESOURCE_STORE)
    const outbox = transaction.objectStore(OUTBOX_STORE)
    const id = resourceKey(accountId, result.resourceType, result.resourceId)
    const existing = await requestValue<StoredAuthorityResource | undefined>(resources.get(id))

    let effectiveRevision = existing?.bundle.revision ?? 0
    if (result.bundle && (!existing || shouldReplaceResource(existing.bundle, result.bundle))) {
      resources.put(toStoredResource(accountId, result.bundle, now))
      effectiveRevision = result.bundle.revision
    } else if (existing && result.revision >= existing.bundle.revision) {
      const canonical = applyCanonicalChangesToBundle(existing.bundle, result, now)
      resources.put(toStoredResource(accountId, canonical, now))
      effectiveRevision = canonical.revision
    } else if (!existing) {
      transaction.abort()
      throw new Error('Cannot acknowledge authority commands without a local resource cache.')
    }

    for (const operationId of result.acknowledgedOperationIds) {
      const row = await requestValue<AuthorityOutboxRecord | undefined>(outbox.get(operationId))
      if (row?.accountId === accountId) outbox.delete(operationId)
    }

    const remaining = await requestValue<AuthorityOutboxRecord[]>(
      outbox.index(ACCOUNT_RESOURCE_INDEX).getAll([
        accountId,
        result.resourceType,
        result.resourceId,
      ]),
    )
    for (const row of remaining) {
      if (
        (row.status === 'pending' || row.status === 'retryable') &&
        row.baseRevision < effectiveRevision
      ) {
        outbox.put({ ...row, baseRevision: effectiveRevision, updatedAt: now })
      }
    }
    await transactionComplete(transaction)
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
    const database = await this.open()
    const transaction = database.transaction([RESOURCE_STORE, OUTBOX_STORE], 'readwrite')
    const resources = transaction.objectStore(RESOURCE_STORE)
    const outbox = transaction.objectStore(OUTBOX_STORE)

    if (bundle) resources.put(toStoredResource(accountId, bundle, now))
    for (const operationId of operationIds) {
      const row = await requestValue<AuthorityOutboxRecord | undefined>(outbox.get(operationId))
      if (row?.accountId === accountId) {
        outbox.put({
          ...row,
          status: 'conflict',
          lastError: 'authority_revision_conflict',
          nextAttemptAt: null,
          updatedAt: now,
        } satisfies AuthorityOutboxRecord)
      }
    }
    await transactionComplete(transaction)
  }

  async recoverStaleSending(
    accountId: string,
    staleBefore: string,
    now: string,
  ): Promise<number> {
    const rows = (await this.listAccountOutbox(accountId)).filter(
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
    const database = await this.open()
    const transaction = database.transaction([RESOURCE_STORE, OUTBOX_STORE], 'readwrite')
    const resources = transaction.objectStore(RESOURCE_STORE)
    const outbox = transaction.objectStore(OUTBOX_STORE)
    const guestResources = await requestValue<StoredAuthorityResource[]>(
      resources.index(ACCOUNT_INDEX).getAll(guestAccountId),
    )
    const guestOutbox = await requestValue<AuthorityOutboxRecord[]>(
      outbox.index(ACCOUNT_INDEX).getAll(guestAccountId),
    )

    for (const guestResource of guestResources) {
      const destinationId = resourceKey(
        accountId,
        guestResource.resourceType,
        guestResource.resourceId,
      )
      const destination = await requestValue<StoredAuthorityResource | undefined>(
        resources.get(destinationId),
      )
      if (!destination || shouldReplaceResource(destination.bundle, guestResource.bundle)) {
        resources.put({
          ...guestResource,
          id: destinationId,
          accountId,
          updatedAt: now,
        } satisfies StoredAuthorityResource)
      }
      resources.delete(guestResource.id)
    }

    for (const guestRecord of guestOutbox) {
      const destination = await requestValue<AuthorityOutboxRecord | undefined>(
        outbox.get(guestRecord.operationId),
      )
      if (destination && destination.accountId !== guestAccountId) {
        transaction.abort()
        throw new Error('Guest authority operation collides with an account operation.')
      }
      outbox.put({
        ...guestRecord,
        accountId,
        status: normalizePromotedStatus(guestRecord.status),
        updatedAt: now,
      } satisfies AuthorityOutboxRecord)
    }

    await transactionComplete(transaction)
  }

  close(): void {
    void this.databasePromise?.then((database) => database.close())
    this.databasePromise = null
  }

  private open(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = openAuthorityDatabase(this.indexedDB, this.databaseName)
    }
    return this.databasePromise
  }

  private async listAccountOutbox(accountId: string): Promise<AuthorityOutboxRecord[]> {
    const database = await this.open()
    const transaction = database.transaction(OUTBOX_STORE, 'readonly')
    const rows = await requestValue<AuthorityOutboxRecord[]>(
      transaction.objectStore(OUTBOX_STORE).index(ACCOUNT_INDEX).getAll(accountId),
    )
    await transactionComplete(transaction)
    return rows
  }

  private async updateOutbox(
    accountId: string,
    operationIds: string[],
    transform: (row: AuthorityOutboxRecord) => AuthorityOutboxRecord,
  ): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite')
    const outbox = transaction.objectStore(OUTBOX_STORE)
    for (const operationId of operationIds) {
      const row = await requestValue<AuthorityOutboxRecord | undefined>(outbox.get(operationId))
      if (row?.accountId === accountId) outbox.put(transform(row))
    }
    await transactionComplete(transaction)
  }
}

export async function deleteWebAuthorityDatabase(
  indexedDB: IDBFactory = globalThis.indexedDB,
  databaseName = WEB_AUTHORITY_DB_NAME,
): Promise<void> {
  await requestValue(indexedDB.deleteDatabase(databaseName))
}

function openAuthorityDatabase(indexedDB: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, WEB_AUTHORITY_DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(RESOURCE_STORE)) {
        const resources = database.createObjectStore(RESOURCE_STORE, { keyPath: 'id' })
        resources.createIndex(ACCOUNT_INDEX, 'accountId', { unique: false })
        resources.createIndex(
          ACCOUNT_RESOURCE_INDEX,
          ['accountId', 'resourceType', 'resourceId'],
          { unique: true },
        )
      }
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = database.createObjectStore(OUTBOX_STORE, { keyPath: 'operationId' })
        outbox.createIndex(ACCOUNT_INDEX, 'accountId', { unique: false })
        outbox.createIndex(
          ACCOUNT_RESOURCE_INDEX,
          ['accountId', 'resourceType', 'resourceId'],
          { unique: false },
        )
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'))
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked.'))
  })
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
  })
}

function resourceKey(
  accountId: string,
  resourceType: AuthorityResourceType,
  resourceId: string,
): string {
  return `${accountId}:${resourceType}:${resourceId}`
}

function toStoredResource(
  accountId: string,
  bundle: CanonicalResourceBundle,
  updatedAt = bundle.serverUpdatedAt,
): StoredAuthorityResource {
  return {
    id: resourceKey(accountId, bundle.resourceType, bundle.resourceId),
    accountId,
    resourceType: bundle.resourceType,
    resourceId: bundle.resourceId,
    bundle,
    updatedAt,
  }
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

function validateMutation(input: CommitOptimisticAuthorityMutationInput): void {
  const commandResourceType = input.command.entityType.startsWith('template')
    ? 'template'
    : 'trip'
  if (
    input.command.resourceId !== input.bundle.resourceId ||
    commandResourceType !== input.bundle.resourceType
  ) {
    throw new Error('Authority command and optimistic bundle do not match.')
  }
}

function compareOutbox(left: AuthorityOutboxRecord, right: AuthorityOutboxRecord): number {
  return left.createdAt.localeCompare(right.createdAt) || left.operationId.localeCompare(right.operationId)
}

function normalizePromotedStatus(status: AuthorityOutboxStatus): AuthorityOutboxStatus {
  return status === 'sending' ? 'retryable' : status
}
