import type { Json } from '@nexvoy/types'
import type {
  AuthorityCommand,
  AuthorityConflict,
  AuthorityApplyResult,
  CanonicalAuthorityChange,
  CanonicalResourceBundle,
  JsonObject,
} from './serverAuthorityTypes'

const collectionKeyByEntity = {
  plan: 'plans',
  plan_url: 'plan_urls',
  checklist: 'checklists',
  checklist_item: 'checklist_items',
  template_item: 'items',
  template_share: 'shares',
} as const

export function applyCanonicalChangesToBundle(
  current: CanonicalResourceBundle,
  result: AuthorityApplyResult,
  fallbackUpdatedAt: string,
): CanonicalResourceBundle {
  if (
    current.resourceType !== result.resourceType ||
    current.resourceId !== result.resourceId
  ) {
    throw new Error('Canonical acknowledgement does not match the local resource.')
  }

  const data = cloneJsonObject(current.data)
  for (const change of result.changes) applyCanonicalChange(data, change)

  return {
    ...current,
    revision: result.revision,
    serverUpdatedAt: result.serverUpdatedAt ?? fallbackUpdatedAt,
    data,
  }
}

export function applyOptimisticAuthorityCommandsToBundle(
  current: CanonicalResourceBundle,
  commands: AuthorityCommand[],
  now: string,
): CanonicalResourceBundle {
  const data = cloneJsonObject(current.data)
  for (const command of commands) {
    if (
      command.resourceId !== current.resourceId ||
      (command.entityType.startsWith('template') ? 'template' : 'trip') !== current.resourceType
    ) {
      throw new Error('Optimistic authority command does not match the resource bundle.')
    }
    if (
      (command.entityType === 'trip' || command.entityType === 'template') &&
      command.entityId !== command.resourceId
    ) {
      throw new Error('Optimistic authority root command must target its resource id.')
    }
    applyOptimisticCommand(data, command, now)
  }
  return { ...current, serverUpdatedAt: now, data }
}

export function versionAuthorityCommandsForBundle(
  current: CanonicalResourceBundle,
  commands: AuthorityCommand[],
): AuthorityCommand[] {
  const data = cloneJsonObject(current.data)
  return commands.map((command) => {
    if (
      command.resourceId !== current.resourceId ||
      (command.entityType.startsWith('template') ? 'template' : 'trip') !== current.resourceType
    ) {
      throw new Error('Authority command does not match the resource bundle.')
    }

    const versioned = {
      ...command,
      expectedVersion: expectedVersionForCommand(data, command),
    } as AuthorityCommand
    applyOptimisticCommand(data, versioned, command.createdAt)
    return versioned
  })
}

export function rebaseAuthorityConflictCommands(
  current: CanonicalResourceBundle,
  commands: AuthorityCommand[],
  conflict: AuthorityConflict,
): AuthorityCommand[] {
  let projected = current
  return commands.map((command) => {
    const shouldRebase =
      conflict.kind === 'entity_version' &&
      (!conflict.entityType || command.entityType === conflict.entityType) &&
      (!conflict.entityId || command.entityId === conflict.entityId)
    const next = shouldRebase
      ? versionAuthorityCommandsForBundle(projected, [command])[0] ?? command
      : command
    projected = applyOptimisticAuthorityCommandsToBundle(
      projected,
      [next],
      command.createdAt,
    )
    return next
  })
}

function applyOptimisticCommand(data: JsonObject, command: AuthorityCommand, now: string): void {
  const payload = asObject(command.payload)
  if (command.entityType === 'trip' || command.entityType === 'template') {
    const existing = asObject(data[command.entityType])
    data[command.entityType] = command.action === 'delete'
      ? {
          ...existing,
          deleted_at: now,
          updated_at: now,
          version: nextAuthorityVersion(existing.version),
        }
      : optimisticRow(existing, payload, command.entityId, now)
    return
  }

  if (command.entityType === 'checklist_item_assignees') {
    const userIds = jsonArray(payload.user_ids).filter((value): value is string => typeof value === 'string')
    const existing = jsonArray(data.checklist_item_assignees).filter(
      (item) => stringValue(asObject(item).item_id) !== command.entityId,
    )
    data.checklist_item_assignees = [
      ...existing,
      ...userIds.map((userId) => ({
        id: `${command.entityId}:${userId}`,
        item_id: command.entityId,
        user_id: userId,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version: 0,
      })),
    ]
    return
  }

  if (command.entityType === 'checklist_item_user_check') {
    const userId = stringValue(payload.user_id)
    const existing = jsonArray(data.checklist_item_user_checks).filter((item) => {
      const row = asObject(item)
      return !(
        stringValue(row.item_id) === command.entityId &&
        stringValue(row.user_id) === userId
      )
    })
    if (userId && payload.checked === true) {
      existing.push({
        id: `${command.entityId}:${userId}`,
        item_id: command.entityId,
        user_id: userId,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version: 1,
      })
    }
    data.checklist_item_user_checks = existing
    return
  }

  const collectionKey = collectionKeyByEntity[command.entityType]
  const rows = jsonArray(data[collectionKey])
  const index = rows.findIndex((item) => stringValue(asObject(item).id) === command.entityId)
  if (command.action === 'delete') {
    if (index >= 0) rows.splice(index, 1)
  } else {
    const existing = index >= 0 ? asObject(rows[index]) : {}
    const row = optimisticRow(existing, payload, command.entityId, now)
    if (index >= 0) rows[index] = row
    else rows.push(row)
  }
  data[collectionKey] = rows
}

function optimisticRow(
  existing: JsonObject,
  payload: JsonObject,
  id: string,
  now: string,
): JsonObject {
  return {
    ...existing,
    ...payload,
    id,
    created_at: existing.created_at ?? now,
    updated_at: now,
    deleted_at: null,
    version: nextAuthorityVersion(existing.version),
  }
}

function expectedVersionForCommand(
  data: JsonObject,
  command: AuthorityCommand,
): number | undefined {
  if (command.entityType === 'trip' || command.entityType === 'template') {
    return authorityVersion(asObject(data[command.entityType]))
  }

  if (command.entityType === 'checklist_item_assignees') {
    // This command replaces the whole assignee set. Until the server exposes
    // an aggregate set version, stale assignee edits must use resource conflict
    // recovery instead of pretending the parent row version protects the set.
    return undefined
  }

  if (command.entityType === 'checklist_item_user_check') {
    // A user check is a deterministic set operation scoped to (item, actor).
    // Tombstones are intentionally absent from bundles, so a row version cannot
    // be reconstructed safely after a quick uncheck/check sequence.
    return undefined
  }

  const collectionKey = collectionKeyByEntity[command.entityType]
  const row = jsonArray(data[collectionKey])
    .map(asObject)
    .find((candidate) => stringValue(candidate.id) === command.entityId)
  return row ? authorityVersion(row) : undefined
}

function authorityVersion(row: JsonObject): number | undefined {
  const value = row.version
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined
}

function nextAuthorityVersion(value: Json | undefined): number {
  return (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0) + 1
}

function applyCanonicalChange(data: JsonObject, change: CanonicalAuthorityChange): void {
  if (change.entityType === 'trip' || change.entityType === 'template') {
    data[change.entityType] = change.row
    return
  }

  if (change.entityType === 'checklist_item_assignees') {
    const row = asObject(change.row)
    const itemId = stringValue(row.item_id)
    const assignees = Array.isArray(row.assignees) ? row.assignees : []
    const existing = jsonArray(data.checklist_item_assignees).filter(
      (item) => stringValue(asObject(item).item_id) !== itemId,
    )
    data.checklist_item_assignees = [...existing, ...assignees]
    return
  }

  if (change.entityType === 'checklist_item_user_check') {
    const row = asObject(change.row)
    const existing = jsonArray(data.checklist_item_user_checks)
    const itemId = stringValue(row.item_id)
    if (Array.isArray(row.checks)) {
      data.checklist_item_user_checks = [
        ...existing.filter((item) => stringValue(asObject(item).item_id) !== itemId),
        ...row.checks,
      ]
      return
    }
    const userId = stringValue(row.user_id)
    const filtered = existing.filter((item) => {
      const candidate = asObject(item)
      return !(
        stringValue(candidate.item_id) === itemId &&
        stringValue(candidate.user_id) === userId
      )
    })
    if (!row.deleted_at) filtered.push(change.row)
    data.checklist_item_user_checks = filtered
    return
  }

  const collectionKey = collectionKeyByEntity[change.entityType]
  const row = asObject(change.row)
  const id = stringValue(row.id) ?? change.entityId
  const existing = jsonArray(data[collectionKey]).filter(
    (item) => stringValue(asObject(item).id) !== id,
  )
  if (!row.deleted_at) existing.push(change.row)
  data[collectionKey] = existing
}

function cloneJsonObject(value: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject
}

function jsonArray(value: Json | undefined): Json[] {
  return Array.isArray(value) ? [...value] : []
}

function asObject(value: Json | undefined): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as JsonObject
}

function stringValue(value: Json | undefined): string | null {
  return typeof value === 'string' ? value : null
}
