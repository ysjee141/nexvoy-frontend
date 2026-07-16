import {
  isAuthorityResourceType,
  type AuthorityChangedEntity,
  type AuthorityEntityType,
  type AuthorityResourceType,
} from './serverAuthorityTypes'

export const AUTHORITY_INVALIDATION_EVENT = 'authority_changed'

export type AuthorityInvalidationEntity = AuthorityChangedEntity

export interface AuthorityInvalidation {
  resourceType: AuthorityResourceType
  resourceId: string
  revision: number
  changeCount: number
  changedEntities: AuthorityInvalidationEntity[]
  updatedAt: string
}

export type AuthorityInvalidationDecision =
  | { action: 'ignore'; reason: 'stale_or_duplicate' }
  | { action: 'refresh'; revisionGap: boolean }

export function parseAuthorityInvalidation(value: unknown): AuthorityInvalidation | null {
  if (!isRecord(value)) return null
  if (!isAuthorityResourceType(value.resource_type)) return null
  if (typeof value.resource_id !== 'string' || value.resource_id.length === 0) return null
  if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 1) return null
  if (typeof value.updated_at !== 'string' || value.updated_at.length === 0) return null

  const changedEntities = Array.isArray(value.changed_entities)
    ? value.changed_entities.map(parseChangedEntity).filter(isPresent)
    : []

  const changeCount =
    typeof value.change_count === 'number' && Number.isSafeInteger(value.change_count)
      ? value.change_count
      : changedEntities.length
  if (changeCount < changedEntities.length) return null

  return {
    resourceType: value.resource_type,
    resourceId: value.resource_id,
    revision: value.revision as number,
    changeCount,
    changedEntities,
    updatedAt: value.updated_at,
  }
}

export function decideAuthorityInvalidation(
  localRevision: number,
  invalidationRevision: number,
): AuthorityInvalidationDecision {
  if (invalidationRevision <= localRevision) {
    return { action: 'ignore', reason: 'stale_or_duplicate' }
  }
  return {
    action: 'refresh',
    revisionGap: invalidationRevision > localRevision + 1,
  }
}

function parseChangedEntity(value: unknown): AuthorityInvalidationEntity | null {
  if (!isRecord(value)) return null
  if (!isEntityType(value.entity_type)) return null
  if (typeof value.entity_id !== 'string' || value.entity_id.length === 0) return null
  if (value.action !== 'upsert' && value.action !== 'delete' && value.action !== 'set') {
    return null
  }
  return {
    entityType: value.entity_type,
    entityId: value.entity_id,
    action: value.action,
  }
}

function isEntityType(value: unknown): value is AuthorityEntityType {
  return (
    value === 'trip' ||
    value === 'plan' ||
    value === 'plan_url' ||
    value === 'checklist' ||
    value === 'checklist_item' ||
    value === 'checklist_item_assignees' ||
    value === 'checklist_item_user_check' ||
    value === 'template' ||
    value === 'template_item' ||
    value === 'template_share'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isPresent<T>(value: T | null): value is T {
  return value !== null
}
