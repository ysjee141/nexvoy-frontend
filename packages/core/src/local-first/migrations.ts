import {
  type AssetRefNode,
  type ChecklistCategoryNode,
  type ChecklistItemAssigneeNode,
  type ChecklistItemNode,
  type ChecklistItemUserCheckNode,
  type ChecklistNode,
  type EntityId,
  type LegacyRowDocumentPath,
  type PlanNode,
  type PlanUrlNode,
  type TripDocumentV1,
  type TripInvitationLinkNode,
  type TripMemberNode,
  type TripShareNode,
  getLegacyRowDocumentPath,
} from './documentModel'
import { createEmptyTripDocumentV1 } from './tripDocument'

export type MigrationValidationSeverity = 'warning' | 'error'

export interface MigrationValidationMessage {
  severity: MigrationValidationSeverity
  code: string
  message: string
  rowId?: string
  tableName?: string
}

export interface LegacyTripRowBundle {
  trip: LegacyTripRow
  plans?: LegacyPlanRow[]
  planUrls?: LegacyPlanUrlRow[]
  checklists?: LegacyChecklistRow[]
  checklistItems?: LegacyChecklistItemRow[]
  checklistCategories?: LegacyChecklistCategoryRow[]
  checklistItemAssignees?: LegacyChecklistItemAssigneeRow[]
  checklistItemUserChecks?: LegacyChecklistItemUserCheckRow[]
  members?: LegacyTripMemberRow[]
  shares?: LegacyTripShareRow[]
  invitationLinks?: LegacyTripInvitationLinkRow[]
  assets?: LegacyAssetRow[]
  exportedAt?: string
}

export interface TripDocumentMigrationResult {
  document: TripDocumentV1
  legacyRowMap: LegacyRowDocumentPath[]
  validationMessages: MigrationValidationMessage[]
}

export interface LegacyTripRow {
  id: string
  user_id: string
  destination: string
  start_date: string
  end_date: string
  adults_count?: number | null
  children_count?: number | null
  cover_image_ref?: string | null
  bg_color?: string | null
  created_at: string
  updated_at: string
}

export interface LegacyPlanRow {
  id: string
  trip_id: string
  title: string
  location: string | null
  address: string | null
  location_lat?: number | null
  location_lng?: number | null
  lat?: number | null
  lng?: number | null
  google_place_id: string | null
  image_url: string | null
  photo_reference: string | null
  start_datetime_local: string
  end_datetime_local: string
  timezone_string: string
  alarm_minutes_before: number | null
  alarm_sent_at: string | null
  cost: number | null
  memo: string | null
  is_completed?: boolean | null
  is_visited: boolean
  created_at: string
  updated_at: string
}

export interface LegacyPlanUrlRow {
  id: string
  plan_id: string
  url: string
  created_at: string
}

export interface LegacyChecklistRow {
  id: string
  trip_id: string
  title: string
  created_at: string
}

export interface LegacyChecklistItemRow {
  id: string
  checklist_id: string
  item_name: string
  category: string | null
  is_checked: boolean
  is_private: boolean | null
  assignment_type: string
  assigned_user_id: string | null
  source_template_name: string | null
  created_at: string
  updated_at: string
}

export interface LegacyChecklistCategoryRow {
  id: string
  user_id: string | null
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface LegacyChecklistItemAssigneeRow {
  id: string
  item_id: string
  user_id: string
  created_at: string
}

export interface LegacyChecklistItemUserCheckRow {
  id: string
  item_id: string
  user_id: string
  created_at: string
}

export interface LegacyTripMemberRow {
  id: string
  trip_id: string
  user_id: string | null
  invited_email: string | null
  role: string
  status: string
  created_at: string
  updated_at?: string | null
  profiles?: {
    nickname: string | null
    email: string | null
  } | null
}

export interface LegacyTripShareRow {
  id: string
  trip_id: string
  share_token: string
  share_type: string
  password_hash: string | null
  expires_at: string | null
  created_at: string
  revoked_at?: string | null
}

export interface LegacyTripInvitationLinkRow {
  id: string
  trip_id: string
  token: string
  invite_code?: string | null
  role?: string | null
  expires_at: string | null
  max_uses?: number | null
  used_count?: number | null
  revoked_at?: string | null
  created_by: string
  created_at: string
}

export interface LegacyAssetRow {
  id: string
  storage_path: string
  bucket: string
  content_type: string | null
  owner_id: string | null
  created_at: string
}

export function convertLegacyTripRowsToDocument(
  bundle: LegacyTripRowBundle,
): TripDocumentMigrationResult {
  const validationMessages: MigrationValidationMessage[] = []
  const legacyRowMap: LegacyRowDocumentPath[] = []
  const document = createEmptyTripDocumentV1({
    id: bundle.trip.id,
    ownerId: bundle.trip.user_id,
    destination: bundle.trip.destination,
    startDate: bundle.trip.start_date,
    endDate: bundle.trip.end_date,
    adultsCount: normalizeCount(bundle.trip.adults_count, 'trips', bundle.trip.id, validationMessages),
    childrenCount: normalizeCount(
      bundle.trip.children_count,
      'trips',
      bundle.trip.id,
      validationMessages,
    ),
    coverImageRef: bundle.trip.cover_image_ref ?? null,
    bgColor: bundle.trip.bg_color ?? null,
    createdAt: bundle.trip.created_at,
    updatedAt: bundle.trip.updated_at,
    createdFromLegacyAt: bundle.exportedAt,
  })

  legacyRowMap.push(getLegacyRowDocumentPath('trips', bundle.trip.id))

  for (const plan of bundle.plans ?? []) {
    if (!isTripScopedRow(plan, bundle.trip.id, 'plans', validationMessages)) continue
    document.plans[plan.id] = toPlanNode(plan)
    legacyRowMap.push(getLegacyRowDocumentPath('plans', plan.id))
  }

  document.planOrder = Object.values(document.plans)
    .sort(comparePlansForDocumentOrder)
    .map((plan) => plan.id)

  for (const planUrl of bundle.planUrls ?? []) {
    if (!document.plans[planUrl.plan_id]) {
      pushValidation(validationMessages, {
        code: 'orphan_plan_url',
        message: `Plan URL ${planUrl.id} references missing plan ${planUrl.plan_id}.`,
        rowId: planUrl.id,
        tableName: 'plan_urls',
      })
      continue
    }

    document.planUrls[planUrl.id] = toPlanUrlNode(planUrl)
    legacyRowMap.push(getLegacyRowDocumentPath('plan_urls', planUrl.id))
  }

  for (const checklist of bundle.checklists ?? []) {
    if (!isTripScopedRow(checklist, bundle.trip.id, 'checklists', validationMessages)) continue
    document.checklists[checklist.id] = toChecklistNode(checklist)
    legacyRowMap.push(getLegacyRowDocumentPath('checklists', checklist.id))
  }

  for (const category of bundle.checklistCategories ?? []) {
    document.checklistCategories[category.id] = toChecklistCategoryNode(category)
    legacyRowMap.push(getLegacyRowDocumentPath('checklist_categories', category.id))
  }

  for (const item of bundle.checklistItems ?? []) {
    if (!document.checklists[item.checklist_id]) {
      pushValidation(validationMessages, {
        code: 'orphan_checklist_item',
        message: `Checklist item ${item.id} references missing checklist ${item.checklist_id}.`,
        rowId: item.id,
        tableName: 'checklist_items',
      })
      continue
    }

    const itemNode = toChecklistItemNode(item, validationMessages)
    document.checklistItems[item.id] = itemNode
    validateLegacyChecklistState(itemNode, validationMessages)
    legacyRowMap.push(getLegacyRowDocumentPath('checklist_items', item.id))
  }

  for (const assignee of bundle.checklistItemAssignees ?? []) {
    if (!document.checklistItems[assignee.item_id]) {
      pushValidation(validationMessages, {
        code: 'orphan_checklist_item_assignee',
        message: `Checklist assignee ${assignee.id} references missing item ${assignee.item_id}.`,
        rowId: assignee.id,
        tableName: 'checklist_item_assignees',
      })
      continue
    }

    document.checklistItemAssignees[assignee.id] = toChecklistItemAssigneeNode(assignee)
    legacyRowMap.push(getLegacyRowDocumentPath('checklist_item_assignees', assignee.id))
  }

  for (const userCheck of bundle.checklistItemUserChecks ?? []) {
    if (!document.checklistItems[userCheck.item_id]) {
      pushValidation(validationMessages, {
        code: 'orphan_checklist_user_check',
        message: `Checklist user check ${userCheck.id} references missing item ${userCheck.item_id}.`,
        rowId: userCheck.id,
        tableName: 'checklist_item_user_checks',
      })
      continue
    }

    document.checklistItemUserChecks[userCheck.id] = toChecklistItemUserCheckNode(userCheck)
    legacyRowMap.push(getLegacyRowDocumentPath('checklist_item_user_checks', userCheck.id))
  }

  for (const member of bundle.members ?? []) {
    if (!isTripScopedRow(member, bundle.trip.id, 'trip_members', validationMessages)) continue
    document.members[member.id] = toTripMemberNode(member, validationMessages)
    legacyRowMap.push(getLegacyRowDocumentPath('trip_members', member.id))
  }

  for (const share of bundle.shares ?? []) {
    if (!isTripScopedRow(share, bundle.trip.id, 'trip_shares', validationMessages)) continue
    document.shares[share.id] = toTripShareNode(share, validationMessages)
    legacyRowMap.push(getLegacyRowDocumentPath('trip_shares', share.id))
  }

  for (const invitationLink of bundle.invitationLinks ?? []) {
    if (!isTripScopedRow(invitationLink, bundle.trip.id, 'trip_invitation_links', validationMessages)) {
      continue
    }

    document.invitationLinks[invitationLink.id] = toTripInvitationLinkNode(
      invitationLink,
      validationMessages,
    )
    legacyRowMap.push(getLegacyRowDocumentPath('trip_invitation_links', invitationLink.id))
  }

  for (const asset of bundle.assets ?? []) {
    document.assets[asset.id] = toAssetRefNode(asset)
    legacyRowMap.push(getLegacyRowDocumentPath('assets', asset.id))
  }

  return {
    document,
    legacyRowMap,
    validationMessages,
  }
}

function toPlanNode(row: LegacyPlanRow): PlanNode {
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    address: row.address,
    coordinates: toCoordinates(row),
    googlePlaceId: row.google_place_id,
    imageUrl: row.image_url,
    photoReference: row.photo_reference,
    startDateTimeLocal: row.start_datetime_local,
    endDateTimeLocal: row.end_datetime_local,
    timezone: row.timezone_string,
    alarmMinutesBefore: row.alarm_minutes_before,
    alarmSentAt: row.alarm_sent_at,
    cost: row.cost ?? 0,
    memo: row.memo,
    isCompleted: row.is_completed ?? false,
    isVisited: row.is_visited,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toCoordinates(row: LegacyPlanRow): PlanNode['coordinates'] {
  const lat = row.location_lat ?? row.lat ?? null
  const lng = row.location_lng ?? row.lng ?? null

  return lat === null || lng === null ? null : { lat, lng }
}

function toPlanUrlNode(row: LegacyPlanUrlRow): PlanUrlNode {
  return {
    id: row.id,
    planId: row.plan_id,
    url: row.url,
    createdAt: row.created_at,
  }
}

function toChecklistNode(row: LegacyChecklistRow): ChecklistNode {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
  }
}

function toChecklistItemNode(
  row: LegacyChecklistItemRow,
  validationMessages: MigrationValidationMessage[],
): ChecklistItemNode {
  return {
    id: row.id,
    checklistId: row.checklist_id,
    name: row.item_name,
    categoryName: row.category ?? '',
    legacyIsChecked: row.is_checked,
    isPrivate: row.is_private ?? false,
    assignmentType: normalizeAssignmentType(row.assignment_type, row.id, validationMessages),
    assignedUserId: row.assigned_user_id,
    sourceTemplateName: row.source_template_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toChecklistCategoryNode(row: LegacyChecklistCategoryRow): ChecklistCategoryNode {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toChecklistItemAssigneeNode(row: LegacyChecklistItemAssigneeRow): ChecklistItemAssigneeNode {
  return {
    id: row.id,
    itemId: row.item_id,
    userId: row.user_id,
    createdAt: row.created_at,
  }
}

function toChecklistItemUserCheckNode(row: LegacyChecklistItemUserCheckRow): ChecklistItemUserCheckNode {
  return {
    id: row.id,
    itemId: row.item_id,
    userId: row.user_id,
    createdAt: row.created_at,
  }
}

function toTripMemberNode(
  row: LegacyTripMemberRow,
  validationMessages: MigrationValidationMessage[],
): TripMemberNode {
  return {
    id: row.id,
    userId: row.user_id,
    invitedEmail: row.invited_email,
    role: normalizeTripMemberRole(row.role, row.id, validationMessages),
    status: normalizeTripMemberStatus(row.status, row.id, validationMessages),
    nickname: row.profiles?.nickname ?? null,
    email: row.profiles?.email ?? row.invited_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  }
}

function toTripShareNode(
  row: LegacyTripShareRow,
  validationMessages: MigrationValidationMessage[],
): TripShareNode {
  return {
    id: row.id,
    shareToken: row.share_token,
    shareType: normalizeShareType(row.share_type, row.id, validationMessages),
    passwordHash: row.password_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at ?? null,
  }
}

function toTripInvitationLinkNode(
  row: LegacyTripInvitationLinkRow,
  validationMessages: MigrationValidationMessage[],
): TripInvitationLinkNode {
  return {
    id: row.id,
    token: row.token,
    inviteCode: row.invite_code ?? null,
    role: normalizeInvitationRole(row.role, row.id, validationMessages),
    expiresAt: row.expires_at,
    maxUses: row.max_uses ?? null,
    usedCount: row.used_count ?? 0,
    revokedAt: row.revoked_at ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

function toAssetRefNode(row: LegacyAssetRow): AssetRefNode {
  return {
    id: row.id,
    storagePath: row.storage_path,
    bucket: row.bucket,
    contentType: row.content_type,
    ownerId: row.owner_id,
    createdAt: row.created_at,
  }
}

function comparePlansForDocumentOrder(a: PlanNode, b: PlanNode): number {
  return (
    a.startDateTimeLocal.localeCompare(b.startDateTimeLocal) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  )
}

export function compareChecklistItemsForLegacyOrder(
  a: ChecklistItemNode,
  b: ChecklistItemNode,
): number {
  return (
    a.categoryName.localeCompare(b.categoryName) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  )
}

function normalizeAssignmentType(
  assignmentType: string,
  rowId: string,
  validationMessages: MigrationValidationMessage[],
): ChecklistItemNode['assignmentType'] {
  if (
    assignmentType === 'anyone' ||
    assignmentType === 'specific' ||
    assignmentType === 'everyone'
  ) {
    return assignmentType
  }

  pushValidation(validationMessages, {
    code: 'unknown_assignment_type_normalized',
    message: `Checklist item ${rowId} had unknown assignment_type ${assignmentType} and was normalized to anyone.`,
    rowId,
    tableName: 'checklist_items',
  })

  return 'anyone'
}

function normalizeTripMemberRole(
  role: string,
  rowId: string,
  validationMessages: MigrationValidationMessage[],
): TripMemberNode['role'] {
  if (role === 'owner' || role === 'editor' || role === 'viewer') return role

  pushValidation(validationMessages, {
    code: 'unknown_member_role_normalized',
    message: `Trip member ${rowId} had unknown role ${role} and was normalized to viewer.`,
    rowId,
    tableName: 'trip_members',
  })

  return 'viewer'
}

function normalizeTripMemberStatus(
  status: string,
  rowId: string,
  validationMessages: MigrationValidationMessage[],
): TripMemberNode['status'] {
  if (status === 'pending' || status === 'accepted' || status === 'revoked') return status

  pushValidation(validationMessages, {
    code: 'unknown_member_status_normalized',
    message: `Trip member ${rowId} had unknown status ${status} and was normalized to pending.`,
    rowId,
    tableName: 'trip_members',
  })

  return 'pending'
}

function normalizeShareType(
  shareType: string,
  rowId: string,
  validationMessages: MigrationValidationMessage[],
): TripShareNode['shareType'] {
  if (shareType === 'public' || shareType === 'password') return shareType

  pushValidation(validationMessages, {
    code: 'unknown_share_type_normalized',
    message: `Trip share ${rowId} had unknown share_type ${shareType} and was normalized to public.`,
    rowId,
    tableName: 'trip_shares',
  })

  return 'public'
}

function normalizeInvitationRole(
  role: string | null | undefined,
  rowId: string,
  validationMessages: MigrationValidationMessage[],
): TripInvitationLinkNode['role'] {
  if (role === 'editor' || role === 'viewer') return role

  if (role !== null && role !== undefined) {
    pushValidation(validationMessages, {
      code: 'unknown_invitation_role_normalized',
      message: `Invitation link ${rowId} had unknown role ${role} and was normalized to viewer.`,
      rowId,
      tableName: 'trip_invitation_links',
    })
  }

  return 'viewer'
}

function validateLegacyChecklistState(
  item: ChecklistItemNode,
  validationMessages: MigrationValidationMessage[],
): void {
  if (!item.legacyIsChecked) return

  pushValidation(validationMessages, {
    code: 'legacy_checked_state_requires_user_check_reconstruction',
    message:
      `Checklist item ${item.id} is legacy checked. ` +
      'TASK-003 materialization must use legacyIsChecked until user-check reconstruction is available.',
    rowId: item.id,
    tableName: 'checklist_items',
  })
}

function normalizeCount(
  value: number | null | undefined,
  tableName: string,
  rowId: string,
  validationMessages: MigrationValidationMessage[],
): number {
  if (typeof value === 'number') return value

  pushValidation(validationMessages, {
    code: 'null_count_normalized',
    message: `${tableName}.${rowId} had a null count and was normalized to 0.`,
    rowId,
    tableName,
  })

  return 0
}

function isTripScopedRow(
  row: { id: string; trip_id: string },
  tripId: EntityId,
  tableName: string,
  validationMessages: MigrationValidationMessage[],
): boolean {
  if (row.trip_id === tripId) return true

  pushValidation(validationMessages, {
    code: 'cross_trip_row_skipped',
    message: `${tableName}.${row.id} belongs to trip ${row.trip_id}, not ${tripId}.`,
    rowId: row.id,
    tableName,
  })

  return false
}

function pushValidation(
  validationMessages: MigrationValidationMessage[],
  message: Omit<MigrationValidationMessage, 'severity'> & {
    severity?: MigrationValidationSeverity
  },
): void {
  validationMessages.push({
    severity: message.severity ?? 'warning',
    code: message.code,
    message: message.message,
    rowId: message.rowId,
    tableName: message.tableName,
  })
}
