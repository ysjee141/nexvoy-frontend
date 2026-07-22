import type {
  ApplyAuthorityCommandsInput,
  AuthorityApplyResult,
  AuthorityChangeFetchResult,
  AuthorityChangedEntity,
  AuthorityResourceSummary,
  AuthorityResourceType,
  CanonicalResourceBundle,
} from '../authority/serverAuthorityTypes'

export interface ServerAuthorityRepository {
  applyCommands(input: ApplyAuthorityCommandsInput): Promise<AuthorityApplyResult>
  getChanges(
    resourceType: AuthorityResourceType,
    resourceId: string,
    entities: AuthorityChangedEntity[],
    revision: number,
  ): Promise<AuthorityChangeFetchResult>
  getBundle(
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<CanonicalResourceBundle | null>
  getRevision(resourceType: AuthorityResourceType, resourceId: string): Promise<number>
  listMySummaries(resourceType: AuthorityResourceType): Promise<AuthorityResourceSummary[]>
}

export class ServerAuthorityRepositoryError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly status: number | null

  constructor(input: {
    message: string
    code: string
    retryable: boolean
    status?: number | null
  }) {
    super(input.message)
    this.name = 'ServerAuthorityRepositoryError'
    this.code = input.code
    this.retryable = input.retryable
    this.status = input.status ?? null
  }
}
