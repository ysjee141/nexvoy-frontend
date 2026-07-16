import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ServerAuthorityRepositoryError,
  type ServerAuthorityRepository,
} from '../repositories/serverAuthorityRepository'
import {
  isAuthorityResourceType,
  type ApplyAuthorityCommandsInput,
  type AuthorityApplyResult,
  type AuthorityChangeFetchResult,
  type AuthorityCommand,
  type AuthorityCommandAction,
  type AuthorityEntityType,
  type AuthorityResourceSummary,
  type AuthorityResourceType,
  type CanonicalAuthorityChange,
  type CanonicalResourceBundle,
  type JsonObject,
} from '../sync/serverAuthorityTypes'

interface SupabaseRpcErrorShape {
  code?: string
  message?: string
  details?: string | null
}

export function createServerAuthorityRepository(
  supabase: SupabaseClient,
): ServerAuthorityRepository {
  return {
    applyCommands: async (input) => {
      const functionName =
        input.resourceType === 'trip'
          ? 'apply_trip_commands'
          : 'apply_template_commands'
      const idArgument = input.resourceType === 'trip' ? 'p_trip_id' : 'p_template_id'
      const { data, error, status } = await supabase.rpc(functionName, {
        [idArgument]: input.resourceId,
        p_commands: input.commands.map(toAuthorityWireCommand),
        p_base_revision: input.baseRevision,
      })
      if (error) throw toRepositoryError(error, status)
      return parseAuthorityApplyResult(data)
    },

    getChanges: async (resourceType, resourceId, entities, revision) => {
      const functionName =
        resourceType === 'trip'
          ? 'get_trip_authority_changes'
          : 'get_template_authority_changes'
      const idArgument = resourceType === 'trip' ? 'p_trip_id' : 'p_template_id'
      const { data, error, status } = await supabase.rpc(functionName, {
        [idArgument]: resourceId,
        p_entities: entities.map((entity) => ({
          entity_type: entity.entityType,
          entity_id: entity.entityId,
          action: entity.action,
        })),
        p_revision: revision,
      })
      if (error) throw toRepositoryError(error, status)
      return parseAuthorityChangeFetchResult(data)
    },

    getBundle: async (resourceType, resourceId) => {
      const functionName =
        resourceType === 'trip'
          ? 'get_trip_authority_bundle'
          : 'get_template_authority_bundle'
      const idArgument = resourceType === 'trip' ? 'p_trip_id' : 'p_template_id'
      const { data, error, status } = await supabase.rpc(functionName, {
        [idArgument]: resourceId,
      })
      if (error) throw toRepositoryError(error, status)
      return data === null ? null : parseCanonicalResourceBundle(data)
    },

    getRevision: async (resourceType, resourceId) => {
      const functionName =
        resourceType === 'trip'
          ? 'get_trip_authority_revision'
          : 'get_template_authority_revision'
      const idArgument = resourceType === 'trip' ? 'p_trip_id' : 'p_template_id'
      const { data, error, status } = await supabase.rpc(functionName, {
        [idArgument]: resourceId,
      })
      if (error) throw toRepositoryError(error, status)
      return requiredNonNegativeNumber(data, 'authority revision')
    },

    listMySummaries: async (resourceType) => {
      const functionName =
        resourceType === 'trip'
          ? 'list_my_trip_authority_summaries'
          : 'list_my_template_authority_summaries'
      const { data, error, status } = await supabase.rpc(functionName)
      if (error) throw toRepositoryError(error, status)
      if (!Array.isArray(data)) {
        throw invalidResponse('Authority summaries must be an array.')
      }
      return data.map(parseAuthorityResourceSummary)
    },
  }
}

export function toAuthorityWireCommand(command: AuthorityCommand): JsonObject {
  return {
    operation_id: command.operationId,
    entity_type: command.entityType,
    entity_id: command.entityId,
    action: command.action,
    payload: command.payload,
    expected_version: command.expectedVersion,
    created_at: command.createdAt,
  }
}

export function parseAuthorityApplyResult(value: unknown): AuthorityApplyResult {
  const record = requiredRecord(value, 'authority apply result')
  const status = record.status
  if (status !== 'applied' && status !== 'duplicate' && status !== 'conflict') {
    throw invalidResponse('Unknown authority apply status.')
  }

  const changesValue = record.changes
  const acknowledgedValue = record.acknowledged_operation_ids
  if (!Array.isArray(changesValue) || !Array.isArray(acknowledgedValue)) {
    throw invalidResponse('Authority apply arrays are missing.')
  }

  return {
    status,
    resourceType: requiredResourceType(record.resource_type),
    resourceId: requiredString(record.resource_id, 'resource id'),
    revision: requiredNonNegativeNumber(record.revision, 'revision'),
    serverUpdatedAt:
      record.server_updated_at === undefined
        ? undefined
        : requiredString(record.server_updated_at, 'server updated at'),
    acknowledgedOperationIds: acknowledgedValue.map((item) =>
      requiredString(item, 'acknowledged operation id'),
    ),
    changes: changesValue.map(parseCanonicalAuthorityChange),
    conflict:
      record.conflict === undefined
        ? undefined
        : parseAuthorityConflict(record.conflict),
    bundle:
      record.bundle === undefined || record.bundle === null
        ? record.bundle
        : parseCanonicalResourceBundle(record.bundle),
  }
}

export function parseAuthorityChangeFetchResult(value: unknown): AuthorityChangeFetchResult {
  const record = requiredRecord(value, 'authority change fetch result')
  if (record.status !== 'ok' && record.status !== 'gap') {
    throw invalidResponse('Unknown authority change fetch status.')
  }
  if (!Array.isArray(record.changes)) {
    throw invalidResponse('Authority change fetch changes must be an array.')
  }
  return {
    status: record.status,
    resourceType: requiredResourceType(record.resource_type),
    resourceId: requiredString(record.resource_id, 'resource id'),
    revision: requiredNonNegativeNumber(record.revision, 'revision'),
    serverUpdatedAt: requiredString(record.server_updated_at, 'server updated at'),
    changes: record.changes.map(parseCanonicalAuthorityChange),
  }
}

function parseAuthorityConflict(value: unknown): AuthorityApplyResult['conflict'] {
  const record = requiredRecord(value, 'authority conflict')
  if (record.kind !== 'resource_revision' && record.kind !== 'entity_version') {
    throw invalidResponse('Unknown authority conflict kind.')
  }
  return {
    kind: record.kind,
    code: requiredString(record.code, 'conflict code'),
    entityType:
      record.entity_type === undefined ? undefined : requiredEntityType(record.entity_type),
    entityId:
      record.entity_id === undefined
        ? undefined
        : requiredString(record.entity_id, 'conflict entity id'),
  }
}

export function parseCanonicalResourceBundle(value: unknown): CanonicalResourceBundle {
  const record = requiredRecord(value, 'canonical resource bundle')
  const data = { ...record } as unknown as JsonObject
  delete data.resource_type
  delete data.resource_id
  delete data.revision
  delete data.server_updated_at

  return {
    resourceType: requiredResourceType(record.resource_type),
    resourceId: requiredString(record.resource_id, 'resource id'),
    revision: requiredNonNegativeNumber(record.revision, 'revision'),
    serverUpdatedAt: requiredString(record.server_updated_at, 'server updated at'),
    data,
  }
}

function parseCanonicalAuthorityChange(value: unknown): CanonicalAuthorityChange {
  const record = requiredRecord(value, 'canonical authority change')
  return {
    operationId: requiredString(record.operation_id, 'operation id'),
    entityType: requiredEntityType(record.entity_type),
    entityId: requiredString(record.entity_id, 'entity id'),
    action: requiredAction(record.action),
    row: record.row as CanonicalAuthorityChange['row'],
  }
}

function parseAuthorityResourceSummary(value: unknown): AuthorityResourceSummary {
  const record = requiredRecord(value, 'authority resource summary')
  const data = { ...record } as unknown as JsonObject
  delete data.resource_type
  delete data.resource_id
  delete data.revision
  delete data.updated_at
  delete data.role
  return {
    resourceType: requiredResourceType(record.resource_type),
    resourceId: requiredString(record.resource_id, 'resource id'),
    revision: requiredNonNegativeNumber(record.revision, 'revision'),
    updatedAt: requiredString(record.updated_at, 'updated at'),
    role: requiredString(record.role, 'role'),
    data,
  }
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidResponse(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw invalidResponse(`${label} must be a non-empty string.`)
  }
  return value
}

function requiredNonNegativeNumber(value: unknown, label: string): number {
  const numberValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(numberValue) || numberValue < 0) {
    throw invalidResponse(`${label} must be a non-negative safe integer.`)
  }
  return numberValue
}

function requiredResourceType(value: unknown): AuthorityResourceType {
  if (!isAuthorityResourceType(value)) throw invalidResponse('Unknown authority resource type.')
  return value
}

function requiredEntityType(value: unknown): AuthorityEntityType {
  if (
    value !== 'trip' &&
    value !== 'plan' &&
    value !== 'plan_url' &&
    value !== 'checklist' &&
    value !== 'checklist_item' &&
    value !== 'checklist_item_assignees' &&
    value !== 'checklist_item_user_check' &&
    value !== 'template' &&
    value !== 'template_item' &&
    value !== 'template_share'
  ) {
    throw invalidResponse('Unknown authority entity type.')
  }
  return value
}

function requiredAction(value: unknown): AuthorityCommandAction {
  if (value !== 'upsert' && value !== 'delete' && value !== 'set') {
    throw invalidResponse('Unknown authority command action.')
  }
  return value
}

function toRepositoryError(
  error: SupabaseRpcErrorShape,
  status: number | undefined,
): ServerAuthorityRepositoryError {
  const code = error.code ?? 'authority_rpc_failed'
  const responseStatus = status ?? null
  const retryable =
    responseStatus === null ||
    responseStatus === 0 ||
    responseStatus === 408 ||
    responseStatus === 429 ||
    responseStatus >= 500 ||
    code === '40001' ||
    code === '57014'

  return new ServerAuthorityRepositoryError({
    message: error.message ?? error.details ?? 'Authority RPC failed.',
    code,
    retryable,
    status: responseStatus,
  })
}

function invalidResponse(message: string): ServerAuthorityRepositoryError {
  return new ServerAuthorityRepositoryError({
    message,
    code: 'authority_invalid_response',
    retryable: false,
  })
}

export type { ApplyAuthorityCommandsInput }
