import type { Json } from '@nexvoy/types'
import type {
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
