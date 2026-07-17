import {
  applyCanonicalChangesToBundle,
  applyOptimisticAuthorityCommandsToBundle,
  type AuthorityApplyResult,
  type AuthorityLocalStore,
  type AuthorityOutboxRecord,
  type AuthorityOutboxStatus,
  type AuthorityProductSyncSnapshot,
  type AuthorityResourceType,
  type CanonicalResourceBundle,
  type CommitOptimisticAuthorityMutationInput,
  type CommitOptimisticAuthorityMutationsInput,
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
  canonicalBundle?: CanonicalResourceBundle
  updatedAt: string
}

interface WebAuthorityIndexedDbOptions {
  indexedDB?: IDBFactory
  databaseName?: string
}

export interface WebAuthorityStoreChange {
  accountId: string
  resourceType?: AuthorityResourceType
  resourceId?: string
}

type WebAuthorityStoreListener = (change: WebAuthorityStoreChange) => void

const storeListeners = new Map<string, Set<WebAuthorityStoreListener>>()

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
    const transaction = database.transaction([RESOURCE_STORE, OUTBOX_STORE], 'readwrite')
    const store = transaction.objectStore(RESOURCE_STORE)
    const outbox = transaction.objectStore(OUTBOX_STORE)
    const id = resourceKey(accountId, bundle.resourceType, bundle.resourceId)
    const existing = await requestValue<StoredAuthorityResource | undefined>(store.get(id))
    const currentCanonical = existing?.canonicalBundle ?? existing?.bundle
    const candidate = existing ? preserveLocalMetadata(existing.bundle, bundle) : bundle
    if (!currentCanonical || shouldReplaceResource(currentCanonical, candidate)) {
      const remaining = await requestValue<AuthorityOutboxRecord[]>(
        outbox.index(ACCOUNT_RESOURCE_INDEX).getAll([
          accountId,
          bundle.resourceType,
          bundle.resourceId,
        ]),
      )
      const optimisticCommands = remaining
        .filter((row) =>
          row.status === 'pending' || row.status === 'sending' || row.status === 'retryable',
        )
        .sort(compareOutbox)
        .map((row) => row.command)
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
      store.put(toStoredResource(accountId, projected, candidate.serverUpdatedAt, candidate))
    }
    await transactionComplete(transaction)
    emitStoreChange(this.databaseName, {
      accountId,
      resourceType: bundle.resourceType,
      resourceId: bundle.resourceId,
    })
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
    input.commands.forEach((command) => validateMutation({ ...input, command }))
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
    if (currentResource && input.bundle.revision < currentResource.bundle.revision) {
      transaction.abort()
      throw new Error('Optimistic mutation is based on a stale authority revision.')
    }

    const canonicalBundle = currentResource?.canonicalBundle
      ?? currentResource?.bundle
      ?? input.baseBundle
      ?? input.bundle
    resources.put(toStoredResource(input.accountId, input.bundle, input.now, canonicalBundle))
    for (const command of input.commands) {
      const existing = await requestValue<AuthorityOutboxRecord | undefined>(
        outbox.get(command.operationId),
      )
      if (existing) {
        if (
          existing.accountId !== input.accountId ||
          JSON.stringify(existing.command) !== JSON.stringify(command)
        ) {
          transaction.abort()
          throw new Error('Authority operation id is already used by another mutation.')
        }
        continue
      }
      outbox.put({
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
      } satisfies AuthorityOutboxRecord)
    }
    await transactionComplete(transaction)
    emitStoreChange(this.databaseName, {
      accountId: input.accountId,
      resourceType: input.bundle.resourceType,
      resourceId: input.bundle.resourceId,
    })
  }

  async listResources(
    accountId: string,
    resourceType?: AuthorityResourceType,
  ): Promise<CanonicalResourceBundle[]> {
    const database = await this.open()
    const transaction = database.transaction(RESOURCE_STORE, 'readonly')
    const rows = await requestValue<StoredAuthorityResource[]>(
      transaction.objectStore(RESOURCE_STORE).index(ACCOUNT_INDEX).getAll(accountId),
    )
    await transactionComplete(transaction)
    return rows
      .filter((row) => !resourceType || row.resourceType === resourceType)
      .map((row) => row.bundle)
      .sort((left, right) => right.serverUpdatedAt.localeCompare(left.serverUpdatedAt))
  }

  async deleteResource(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction(RESOURCE_STORE, 'readwrite')
    transaction.objectStore(RESOURCE_STORE).delete(resourceKey(accountId, resourceType, resourceId))
    await transactionComplete(transaction)
    emitStoreChange(this.databaseName, { accountId, resourceType, resourceId })
  }

  async getSyncSnapshot(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
    online = typeof navigator === 'undefined' || navigator.onLine,
  ): Promise<AuthorityProductSyncSnapshot> {
    const rows = (await this.listAccountOutbox(accountId)).filter(
      (row) => row.resourceType === resourceType && row.resourceId === resourceId,
    )
    const conflict = rows.find((row) => row.status === 'conflict')
    const rejected = rows.find((row) => row.status === 'rejected')
    const pending = rows.filter((row) =>
      row.status === 'pending' || row.status === 'sending' || row.status === 'retryable',
    )
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

  subscribe(listener: WebAuthorityStoreListener): () => void {
    const listeners = storeListeners.get(this.databaseName) ?? new Set<WebAuthorityStoreListener>()
    listeners.add(listener)
    storeListeners.set(this.databaseName, listeners)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) storeListeners.delete(this.databaseName)
    }
  }

  async setResourceRole(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
    role: string,
  ): Promise<CanonicalResourceBundle | null> {
    const database = await this.open()
    const transaction = database.transaction(RESOURCE_STORE, 'readwrite')
    const resources = transaction.objectStore(RESOURCE_STORE)
    const id = resourceKey(accountId, resourceType, resourceId)
    const row = await requestValue<StoredAuthorityResource | undefined>(resources.get(id))
    if (!row) {
      await transactionComplete(transaction)
      return null
    }

    const bundle = { ...row.bundle, data: { ...row.bundle.data, _role: role } }
    const canonical = row.canonicalBundle
      ? { ...row.canonicalBundle, data: { ...row.canonicalBundle.data, _role: role } }
      : undefined
    resources.put({ ...row, bundle, canonicalBundle: canonical })
    await transactionComplete(transaction)
    emitStoreChange(this.databaseName, { accountId, resourceType, resourceId })
    return bundle
  }

  async getNextRetryAt(accountId: string): Promise<string | null> {
    const retryAt = (await this.listAccountOutbox(accountId))
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

    const existingCanonical = existing?.canonicalBundle ?? existing?.bundle ?? null
    let canonicalBundle = existingCanonical
    const resultBundle = result.bundle && existing
      ? preserveLocalMetadata(existing.bundle, result.bundle)
      : result.bundle
    if (resultBundle && (!existingCanonical || shouldReplaceResource(existingCanonical, resultBundle))) {
      canonicalBundle = resultBundle
    } else if (existingCanonical && result.revision >= existingCanonical.revision) {
      canonicalBundle = applyCanonicalChangesToBundle(existingCanonical, result, now)
    } else if (!existingCanonical) {
      transaction.abort()
      throw new Error('Cannot acknowledge authority commands without a local resource cache.')
    }
    if (!canonicalBundle) {
      transaction.abort()
      throw new Error('Canonical authority state is unavailable after acknowledgement.')
    }
    const effectiveRevision = canonicalBundle.revision

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
    const optimisticCommands = remaining
      .filter((row) =>
        row.status === 'pending' || row.status === 'sending' || row.status === 'retryable',
      )
      .sort(compareOutbox)
      .map((row) => row.command)
    const projection = optimisticCommands.length > 0
      ? applyOptimisticAuthorityCommandsToBundle(canonicalBundle, optimisticCommands, now)
      : canonicalBundle
    resources.put(toStoredResource(accountId, projection, now, canonicalBundle))
    await transactionComplete(transaction)
    emitStoreChange(this.databaseName, {
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
    const database = await this.open()
    const transaction = database.transaction([RESOURCE_STORE, OUTBOX_STORE], 'readwrite')
    const resources = transaction.objectStore(RESOURCE_STORE)
    const outbox = transaction.objectStore(OUTBOX_STORE)

    if (bundle) {
      const id = resourceKey(accountId, bundle.resourceType, bundle.resourceId)
      const existing = await requestValue<StoredAuthorityResource | undefined>(resources.get(id))
      const canonicalBundle = existing ? preserveLocalMetadata(existing.bundle, bundle) : bundle
      resources.put(toStoredResource(accountId, canonicalBundle, now, canonicalBundle))
    }
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
    emitStoreChange(this.databaseName, { accountId })
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
    emitStoreChange(this.databaseName, { accountId })
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
    emitStoreChange(this.databaseName, { accountId })
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
  canonicalBundle: CanonicalResourceBundle = bundle,
): StoredAuthorityResource {
  return {
    id: resourceKey(accountId, bundle.resourceType, bundle.resourceId),
    accountId,
    resourceType: bundle.resourceType,
    resourceId: bundle.resourceId,
    bundle,
    canonicalBundle,
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

function preserveLocalMetadata(
  current: CanonicalResourceBundle,
  candidate: CanonicalResourceBundle,
): CanonicalResourceBundle {
  const role = current.data._role
  if (candidate.data._role !== undefined || role === undefined) return candidate
  return { ...candidate, data: { ...candidate.data, _role: role } }
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

function emitStoreChange(databaseName: string, change: WebAuthorityStoreChange): void {
  storeListeners.get(databaseName)?.forEach((listener) => listener(change))
}
