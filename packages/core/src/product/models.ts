export type EntityId = string
export type UserId = string
export type IsoDateString = string
export type IsoDateTimeString = string

export type TripMemberRole = 'owner' | 'editor' | 'viewer'
export type TripMemberStatus = 'pending' | 'accepted' | 'revoked'
export type ChecklistAssignmentType = 'anyone' | 'specific' | 'everyone'
export type TemplateVisibility = 'private' | 'shared' | 'public'
export type TemplateShareRole = 'viewer' | 'editor'

export interface TripProductState {
  trip: TripRoot
  plans: Record<EntityId, Plan>
  planOrder: EntityId[]
  planUrls: Record<EntityId, PlanUrl>
  checklists: Record<EntityId, Checklist>
  checklistItems: Record<EntityId, ChecklistItem>
  checklistItemAssignees: Record<EntityId, ChecklistItemAssignee>
  checklistItemUserChecks: Record<EntityId, ChecklistItemUserCheck>
  members: Record<EntityId, TripMember>
  assets: Record<EntityId, AssetRef>
}

export interface TripRoot {
  id: EntityId
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

export interface Plan {
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

export interface PlanUrl {
  id: EntityId
  planId: EntityId
  url: string
  createdAt: IsoDateTimeString
}

export interface Checklist {
  id: EntityId
  title: string
  createdAt: IsoDateTimeString
}

export interface ChecklistItem {
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

export interface ChecklistItemAssignee {
  id: EntityId
  itemId: EntityId
  userId: UserId
  createdAt: IsoDateTimeString
}

export interface ChecklistItemUserCheck {
  id: EntityId
  itemId: EntityId
  userId: UserId
  createdAt: IsoDateTimeString
}

export interface TripMember {
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

export interface AssetRef {
  id: EntityId
  storagePath: string
  bucket: string
  contentType: string | null
  ownerId: UserId | null
  createdAt: IsoDateTimeString
}

export interface TemplateProductState {
  template: TemplateRoot
  items: Record<EntityId, TemplateItem>
  shares: Record<EntityId, TemplateShare>
}

export interface TemplateRoot {
  id: EntityId
  ownerId: UserId | null
  title: string
  visibility: TemplateVisibility
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
}

export interface TemplateItem {
  id: EntityId
  templateId: EntityId
  name: string
  categoryName: string
  isPrivate: boolean
  sortOrder: number
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
}

export interface TemplateShare {
  id: EntityId
  templateId: EntityId
  sharedWithUserId: UserId
  role: TemplateShareRole
  createdBy: UserId | null
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString | null
}
