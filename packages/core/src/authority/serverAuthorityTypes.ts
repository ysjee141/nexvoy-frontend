import type { Json } from '@nexvoy/types'

export type AuthorityResourceType = 'trip' | 'template'

export type TripAuthorityEntityType =
  | 'trip'
  | 'plan'
  | 'plan_url'
  | 'checklist'
  | 'checklist_item'
  | 'checklist_item_assignees'
  | 'checklist_item_user_check'

export type TemplateAuthorityEntityType =
  | 'template'
  | 'template_item'
  | 'template_share'

export type AuthorityEntityType = TripAuthorityEntityType | TemplateAuthorityEntityType
export type AuthorityCommandAction = 'upsert' | 'delete' | 'set'

export interface AuthorityChangedEntity {
  entityType: AuthorityEntityType
  entityId: string
  action: AuthorityCommandAction
}

export type JsonObject = { [key: string]: Json | undefined }

interface AuthorityCommandBase<
  TEntity extends AuthorityEntityType,
  TAction extends AuthorityCommandAction,
> {
  operationId: string
  resourceId: string
  entityType: TEntity
  entityId: string
  action: TAction
  payload: JsonObject
  expectedVersion?: number
  createdAt: string
}

export type TripAuthorityCommand =
  | AuthorityCommandBase<'trip', 'upsert' | 'delete'>
  | AuthorityCommandBase<'plan', 'upsert' | 'delete'>
  | AuthorityCommandBase<'plan_url', 'upsert' | 'delete'>
  | AuthorityCommandBase<'checklist', 'upsert' | 'delete'>
  | AuthorityCommandBase<'checklist_item', 'upsert' | 'delete'>
  | AuthorityCommandBase<'checklist_item_assignees', 'set'>
  | AuthorityCommandBase<'checklist_item_user_check', 'set'>

export type TemplateAuthorityCommand =
  | AuthorityCommandBase<'template', 'upsert' | 'delete'>
  | AuthorityCommandBase<'template_item', 'upsert' | 'delete'>
  | AuthorityCommandBase<'template_share', 'upsert' | 'delete'>

export type AuthorityCommand = TripAuthorityCommand | TemplateAuthorityCommand

export interface CanonicalAuthorityChange {
  operationId: string
  entityType: AuthorityEntityType
  entityId: string
  action: AuthorityCommandAction
  row: Json
}

export interface CanonicalResourceBundle {
  resourceType: AuthorityResourceType
  resourceId: string
  revision: number
  serverUpdatedAt: string
  data: JsonObject
}

export interface AuthorityResourceSummary {
  resourceType: AuthorityResourceType
  resourceId: string
  revision: number
  updatedAt: string
  role: string
  data: JsonObject
}

export type AuthorityApplyStatus = 'applied' | 'duplicate' | 'conflict'

export interface AuthorityConflict {
  kind: 'resource_revision' | 'entity_version'
  code: string
  entityType?: AuthorityEntityType
  entityId?: string
}

export interface AuthorityChangeFetchResult {
  status: 'ok' | 'gap'
  resourceType: AuthorityResourceType
  resourceId: string
  revision: number
  serverUpdatedAt: string
  changes: CanonicalAuthorityChange[]
}

export interface AuthorityApplyResult {
  status: AuthorityApplyStatus
  resourceType: AuthorityResourceType
  resourceId: string
  revision: number
  serverUpdatedAt?: string
  acknowledgedOperationIds: string[]
  changes: CanonicalAuthorityChange[]
  conflict?: AuthorityConflict
  bundle?: CanonicalResourceBundle | null
}

export interface ApplyAuthorityCommandsInput {
  resourceType: AuthorityResourceType
  resourceId: string
  commands: AuthorityCommand[]
  baseRevision: number | null
}

export type AuthorityOutboxStatus =
  | 'pending'
  | 'sending'
  | 'acked'
  | 'retryable'
  | 'rejected'
  | 'conflict'

export interface AuthorityOutboxRecord {
  operationId: string
  accountId: string
  resourceType: AuthorityResourceType
  resourceId: string
  baseRevision: number
  command: AuthorityCommand
  status: AuthorityOutboxStatus
  attempts: number
  nextAttemptAt: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export interface CommitOptimisticAuthorityMutationInput {
  accountId: string
  baseBundle?: CanonicalResourceBundle
  bundle: CanonicalResourceBundle
  command: AuthorityCommand
  now: string
}

export interface CommitOptimisticAuthorityMutationsInput {
  accountId: string
  baseBundle?: CanonicalResourceBundle
  bundle: CanonicalResourceBundle
  commands: AuthorityCommand[]
  now: string
}

export type AuthorityProductSyncStatus =
  | 'offline'
  | 'pending'
  | 'synced'
  | 'conflict'
  | 'error'

export interface AuthorityProductSyncSnapshot {
  status: AuthorityProductSyncStatus
  pendingCount: number
  lastError: string | null
}

export interface AuthorityLocalStore {
  getResource(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<CanonicalResourceBundle | null>
  putResource(accountId: string, bundle: CanonicalResourceBundle): Promise<void>
  commitOptimisticMutation(input: CommitOptimisticAuthorityMutationInput): Promise<void>
  commitOptimisticMutations(input: CommitOptimisticAuthorityMutationsInput): Promise<void>
  listReadyOutbox(accountId: string, now: string, limit: number): Promise<AuthorityOutboxRecord[]>
  markSending(accountId: string, operationIds: string[], now: string): Promise<void>
  applyAcknowledgement(
    accountId: string,
    result: AuthorityApplyResult,
    now: string,
  ): Promise<void>
  markRetryable(
    accountId: string,
    operationIds: string[],
    errorCode: string,
    nextAttemptAt: string,
    now: string,
  ): Promise<void>
  markRejected(
    accountId: string,
    operationIds: string[],
    errorCode: string,
    now: string,
  ): Promise<void>
  markConflict(
    accountId: string,
    operationIds: string[],
    bundle: CanonicalResourceBundle | null,
    now: string,
  ): Promise<void>
  recoverStaleSending(accountId: string, staleBefore: string, now: string): Promise<number>
  promoteGuestAccount(guestAccountId: string, accountId: string, now: string): Promise<void>
  purgeResource(
    accountId: string,
    resourceType: AuthorityResourceType,
    resourceId: string,
  ): Promise<void>
}

export type AuthoritySyncMetric =
  | {
      name: 'authority_flush_started'
      accountId: string
      commandCount: number
      queueOldestAgeMs: number
      estimatedBytes: number
    }
  | {
      name: 'authority_batch_applied'
      accountId: string
      resourceType: AuthorityResourceType
      resourceId: string
      commandCount: number
      revision: number
    }
  | {
      name: 'authority_batch_conflict' | 'authority_batch_retryable' | 'authority_batch_rejected'
      accountId: string
      resourceType: AuthorityResourceType
      resourceId: string
      commandCount: number
      errorCode?: string
    }
  | {
      name: 'authority_sending_recovered'
      accountId: string
      commandCount: number
    }
  | {
      name: 'authority_membership_revoked'
      accountId: string
      resourceType: AuthorityResourceType
      resourceId: string
    }

export type AuthoritySyncMetricSink = (metric: AuthoritySyncMetric) => void

export function authorityResourceTypeForCommand(command: AuthorityCommand): AuthorityResourceType {
  return command.entityType.startsWith('template') ? 'template' : 'trip'
}

export function isAuthorityResourceType(value: unknown): value is AuthorityResourceType {
  return value === 'trip' || value === 'template'
}
