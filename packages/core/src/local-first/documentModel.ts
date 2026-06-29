export const TRIP_DOCUMENT_SCHEMA_VERSION = 1

export const TRIP_DOCUMENT_TYPE = 'trip'

export const TRIP_SUBDOCUMENT_BOUNDARIES = [
  'plans',
  'checklist',
  'members',
  'assets',
] as const

export type TripDocumentSchemaVersion = typeof TRIP_DOCUMENT_SCHEMA_VERSION
export type TripSubdocumentBoundary = (typeof TRIP_SUBDOCUMENT_BOUNDARIES)[number]

export type DocumentId = string
export type EntityId = string
export type UserId = string
export type IsoDateString = string
export type IsoDateTimeString = string

export type TripMemberRole = 'owner' | 'editor' | 'viewer'
export type TripMemberStatus = 'pending' | 'accepted' | 'revoked'
export type ShareType = 'public' | 'password'
export type ChecklistAssignmentType = 'anyone' | 'specific' | 'everyone'
export type TombstoneEntityType =
  | 'trip'
  | 'plan'
  | 'planUrl'
  | 'checklist'
  | 'checklistItem'
  | 'checklistCategory'
  | 'checklistItemAssignee'
  | 'checklistItemUserCheck'
  | 'member'
  | 'share'
  | 'invitationLink'
  | 'asset'

export interface TripDocumentV1 {
  schemaVersion: TripDocumentSchemaVersion
  trip: TripRootNode
  plans: Record<EntityId, PlanNode>
  planOrder: EntityId[]
  planUrls: Record<EntityId, PlanUrlNode>
  checklists: Record<EntityId, ChecklistNode>
  checklistItems: Record<EntityId, ChecklistItemNode>
  checklistCategories: Record<EntityId, ChecklistCategoryNode>
  checklistItemAssignees: Record<EntityId, ChecklistItemAssigneeNode>
  checklistItemUserChecks: Record<EntityId, ChecklistItemUserCheckNode>
  members: Record<EntityId, TripMemberNode>
  shares: Record<EntityId, TripShareNode>
  invitationLinks: Record<EntityId, TripInvitationLinkNode>
  assets: Record<EntityId, AssetRefNode>
  tombstones: Record<EntityId, TombstoneNode>
  meta: TripDocumentMeta
}

export interface TripRootNode {
  id: DocumentId
  ownerId: UserId
  destination: string
  startDate: IsoDateString
  endDate: IsoDateString
  adultsCount: number
  childrenCount: number
  coverImageRef: string | null
  bgColor: string | null
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
}

export interface PlanNode {
  id: EntityId
  title: string
  location: string | null
  address: string | null
  coordinates: GeoCoordinates | null
  googlePlaceId: string | null
  imageUrl: string | null
  photoReference: string | null
  startDateTimeLocal: IsoDateTimeString
  endDateTimeLocal: IsoDateTimeString
  timezone: string
  alarmMinutesBefore: number | null
  alarmSentAt: IsoDateTimeString | null
  cost: number
  memo: string | null
  isCompleted: boolean
  isVisited: boolean
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
}

export interface GeoCoordinates {
  lat: number
  lng: number
}

export interface PlanUrlNode {
  id: EntityId
  planId: EntityId
  url: string
  createdAt: IsoDateTimeString
}

export interface ChecklistNode {
  id: EntityId
  title: string
  createdAt: IsoDateTimeString
}

export interface ChecklistItemNode {
  id: EntityId
  checklistId: EntityId
  name: string
  categoryName: string
  legacyIsChecked: boolean
  isPrivate: boolean
  assignmentType: ChecklistAssignmentType
  assignedUserId: UserId | null
  sourceTemplateName: string | null
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
}

export interface ChecklistCategoryNode {
  id: EntityId
  userId: UserId | null
  name: string
  sortOrder: number
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
}

export interface ChecklistItemAssigneeNode {
  id: EntityId
  itemId: EntityId
  userId: UserId
  createdAt: IsoDateTimeString
}

export interface ChecklistItemUserCheckNode {
  id: EntityId
  itemId: EntityId
  userId: UserId
  createdAt: IsoDateTimeString
}

export interface TripMemberNode {
  id: EntityId
  userId: UserId | null
  invitedEmail: string | null
  role: TripMemberRole
  status: TripMemberStatus
  nickname: string | null
  email: string | null
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString | null
}

export interface TripShareNode {
  id: EntityId
  shareToken: string
  shareType: ShareType
  passwordHash: string | null
  expiresAt: IsoDateTimeString | null
  createdAt: IsoDateTimeString
  revokedAt: IsoDateTimeString | null
}

export interface TripInvitationLinkNode {
  id: EntityId
  token: string
  inviteCode: string | null
  role: Exclude<TripMemberRole, 'owner'>
  expiresAt: IsoDateTimeString | null
  maxUses: number | null
  usedCount: number
  revokedAt: IsoDateTimeString | null
  createdBy: UserId
  createdAt: IsoDateTimeString
}

export interface AssetRefNode {
  id: EntityId
  storagePath: string
  bucket: string
  contentType: string | null
  ownerId: UserId | null
  createdAt: IsoDateTimeString
}

export interface TombstoneNode {
  id: EntityId
  entityType: TombstoneEntityType
  entityId: EntityId
  deletedBy: UserId
  deletedAt: IsoDateTimeString
  reason?: string
}

export interface TripDocumentMeta {
  createdFromLegacyAt?: IsoDateTimeString
  lastLegacyExportAt?: IsoDateTimeString
  lastBackupAt?: IsoDateTimeString
}

export type LegacyTripRowTable =
  | 'trips'
  | 'plans'
  | 'plan_urls'
  | 'checklists'
  | 'checklist_items'
  | 'checklist_categories'
  | 'checklist_item_assignees'
  | 'checklist_item_user_checks'
  | 'trip_members'
  | 'trip_shares'
  | 'trip_invitation_links'
  | 'assets'

export interface LegacyRowDocumentPath {
  tableName: LegacyTripRowTable
  rowId: EntityId
  pathInDocument: string
}

export function getLegacyRowDocumentPath(
  tableName: LegacyTripRowTable,
  rowId: EntityId,
): LegacyRowDocumentPath {
  const collectionPath = getLegacyRowDocumentCollectionPath(tableName)

  return {
    tableName,
    rowId,
    pathInDocument: collectionPath === 'trip' ? collectionPath : `${collectionPath}.${rowId}`,
  }
}

export function getLegacyRowDocumentCollectionPath(tableName: LegacyTripRowTable): string {
  switch (tableName) {
    case 'trips':
      return 'trip'
    case 'plans':
      return 'plans'
    case 'plan_urls':
      return 'planUrls'
    case 'checklists':
      return 'checklists'
    case 'checklist_items':
      return 'checklistItems'
    case 'checklist_categories':
      return 'checklistCategories'
    case 'checklist_item_assignees':
      return 'checklistItemAssignees'
    case 'checklist_item_user_checks':
      return 'checklistItemUserChecks'
    case 'trip_members':
      return 'members'
    case 'trip_shares':
      return 'shares'
    case 'trip_invitation_links':
      return 'invitationLinks'
    case 'assets':
      return 'assets'
  }
}
