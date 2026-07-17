import type {
  AuthorityOutboxRecord,
  AuthorityResourceType,
  CanonicalResourceBundle,
} from '@nexvoy/core'

export interface StoredMobileAuthorityResource {
  accountId: string
  resourceType: AuthorityResourceType
  resourceId: string
  bundle: CanonicalResourceBundle
  canonicalBundle: CanonicalResourceBundle
  updatedAt: string
}

export interface MobileAuthoritySyncState {
  accountId: string
  resourceType: AuthorityResourceType
  resourceId: string
  lastSeenRevision: number
  lastReconciledRevision: number
  lastRefreshedAt: string | null
  lastError: string | null
  updatedAt: string
}

export interface MobileAuthorityDatabaseReader {
  getResource(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<StoredMobileAuthorityResource | null>
  listResources(
    accountId: string,
    resourceType?: AuthorityResourceType,
  ): Promise<StoredMobileAuthorityResource[]>
  getOutbox(operationId: string): Promise<AuthorityOutboxRecord | null>
  listOutbox(
    accountId: string,
    resourceType?: AuthorityResourceType,
    resourceId?: string,
  ): Promise<AuthorityOutboxRecord[]>
  getSyncState(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<MobileAuthoritySyncState | null>
  listSyncStates(accountId: string): Promise<MobileAuthoritySyncState[]>
}

export interface MobileAuthorityDatabaseTransaction extends MobileAuthorityDatabaseReader {
  putResource(resource: StoredMobileAuthorityResource): Promise<void>
  deleteResource(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<void>
  putOutbox(record: AuthorityOutboxRecord): Promise<void>
  deleteOutbox(operationId: string): Promise<void>
  putSyncState(state: MobileAuthoritySyncState): Promise<void>
  deleteAccount(accountId: string): Promise<void>
}

export interface MobileAuthorityDatabase extends MobileAuthorityDatabaseReader {
  transaction<T>(
    task: (transaction: MobileAuthorityDatabaseTransaction) => Promise<T>,
  ): Promise<T>
  close(): Promise<void>
}
