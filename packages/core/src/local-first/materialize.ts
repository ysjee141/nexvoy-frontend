import type {
  AssetRefNode,
  ChecklistItemAssigneeNode,
  ChecklistItemNode,
  ChecklistItemUserCheckNode,
  ChecklistNode,
  EntityId,
  PlanNode,
  PlanUrlNode,
  TripDocumentV1,
  TripMemberNode,
} from './documentModel'
import { compareChecklistItemsForLegacyOrder } from './migrations'
import { filterActiveNodes } from './tombstone'

export interface MaterializeOptions {
  currentUserId?: string | null
  now?: () => number
}

export interface MaterializeMetrics {
  documentSizeBytes: number
  durationMs: number
  planCount: number
  checklistItemCount: number
  tombstoneCount: number
}

export interface TripSummaryReadModel {
  id: string
  ownerId: string
  destination: string
  startDate: string
  endDate: string
  adultsCount: number
  childrenCount: number
  coverImageRef: string | null
  bgColor: string | null
  memberCount: number
  planCount: number
  checklistTotalCount: number
  checklistDoneCount: number
  progressPercent: number
  updatedAt: string
}

export interface TripDetailReadModel extends TripSummaryReadModel {
  plans: PlanTimelineItemReadModel[]
  checklists: ChecklistReadModel[]
  members: TripMemberReadModel[]
  assets: AssetRefNode[]
  metrics: MaterializeMetrics
}

export interface PlanTimelineItemReadModel {
  id: string
  title: string
  location: string | null
  address: string | null
  coordinates: PlanNode['coordinates']
  googlePlaceId: string | null
  imageUrl: string | null
  photoReference: string | null
  startDateTimeLocal: string
  endDateTimeLocal: string
  timezone: string
  alarmMinutesBefore: number | null
  alarmSentAt: string | null
  cost: number
  memo: string | null
  isCompleted: boolean
  isVisited: boolean
  urls: PlanUrlNode[]
}

export interface ChecklistReadModel {
  id: string
  title: string
  createdAt: string
  items: ChecklistItemReadModel[]
  totalCount: number
  doneCount: number
  progressPercent: number
}

export interface ChecklistItemReadModel {
  id: string
  checklistId: string
  name: string
  categoryName: string
  isPrivate: boolean
  assignmentType: ChecklistItemNode['assignmentType']
  assignedUserId: string | null
  sourceTemplateName: string | null
  status: ChecklistItemStatusReadModel
  assignees: ChecklistItemAssigneeNode[]
  userChecks: ChecklistItemUserCheckNode[]
  createdAt: string
  updatedAt: string
}

export interface ChecklistItemStatusReadModel {
  isChecked: boolean
  isMyChecked: boolean
  checksCount: number
  requiredCount: number
  canCheck: boolean
}

export interface TripMemberReadModel {
  id: string
  userId: string | null
  invitedEmail: string | null
  role: TripMemberNode['role']
  status: TripMemberNode['status']
  nickname: string | null
  email: string | null
}

export function materializeTripDetail(
  document: TripDocumentV1,
  options: MaterializeOptions = {},
): TripDetailReadModel {
  const timer = createMaterializeTimer(options.now)
  const plans = materializePlanTimeline(document)
  const checklists = materializeChecklists(document, options)
  const members = filterActiveNodes(document.members, document.tombstones, 'member')
    .filter((member) => member.status !== 'revoked')
    .map(toTripMemberReadModel)
  const assets = filterActiveNodes(document.assets, document.tombstones, 'asset')

  const checklistTotalCount = checklists.reduce((sum, checklist) => sum + checklist.totalCount, 0)
  const checklistDoneCount = checklists.reduce((sum, checklist) => sum + checklist.doneCount, 0)
  const metrics = createMaterializeMetrics(document, timer(), plans.length, checklistTotalCount)

  return {
    ...materializeTripSummary(document, {
      ...options,
      checklistTotalCount,
      checklistDoneCount,
      memberCount: members.length,
      planCount: plans.length,
    }),
    plans,
    checklists,
    members,
    assets,
    metrics,
  }
}

export function materializeTripSummary(
  document: TripDocumentV1,
  options: MaterializeOptions & {
    checklistTotalCount?: number
    checklistDoneCount?: number
    memberCount?: number
    planCount?: number
  } = {},
): TripSummaryReadModel {
  const checklists =
    options.checklistTotalCount === undefined || options.checklistDoneCount === undefined
      ? materializeChecklists(document, options)
      : []
  const checklistTotalCount =
    options.checklistTotalCount ?? checklists.reduce((sum, checklist) => sum + checklist.totalCount, 0)
  const checklistDoneCount =
    options.checklistDoneCount ?? checklists.reduce((sum, checklist) => sum + checklist.doneCount, 0)
  const memberCount =
    options.memberCount ??
    filterActiveNodes(document.members, document.tombstones, 'member').filter(
      (member) => member.status !== 'revoked',
    ).length
  const planCount =
    options.planCount ?? filterActiveNodes(document.plans, document.tombstones, 'plan').length

  return {
    id: document.trip.id,
    ownerId: document.trip.ownerId,
    destination: document.trip.destination,
    startDate: document.trip.startDate,
    endDate: document.trip.endDate,
    adultsCount: document.trip.adultsCount,
    childrenCount: document.trip.childrenCount,
    coverImageRef: document.trip.coverImageRef,
    bgColor: document.trip.bgColor,
    memberCount,
    planCount,
    checklistTotalCount,
    checklistDoneCount,
    progressPercent: toProgressPercent(checklistDoneCount, checklistTotalCount),
    updatedAt: document.trip.updatedAt,
  }
}

export function materializePlanTimeline(document: TripDocumentV1): PlanTimelineItemReadModel[] {
  const activePlans = new Map(
    filterActiveNodes(document.plans, document.tombstones, 'plan').map((plan) => [plan.id, plan]),
  )
  const orderedIds = document.planOrder.filter((planId) => activePlans.has(planId))
  const unorderedPlans = Array.from(activePlans.values()).filter((plan) => !orderedIds.includes(plan.id))
  const sortedPlans = [
    ...orderedIds.map((planId) => activePlans.get(planId)).filter(isPresent),
    ...unorderedPlans.sort(comparePlansForTimeline),
  ]

  return sortedPlans.map((plan) => ({
    id: plan.id,
    title: plan.title,
    location: plan.location,
    address: plan.address,
    coordinates: plan.coordinates,
    googlePlaceId: plan.googlePlaceId,
    imageUrl: plan.imageUrl,
    photoReference: plan.photoReference,
    startDateTimeLocal: plan.startDateTimeLocal,
    endDateTimeLocal: plan.endDateTimeLocal,
    timezone: plan.timezone,
    alarmMinutesBefore: plan.alarmMinutesBefore,
    alarmSentAt: plan.alarmSentAt,
    cost: plan.cost,
    memo: plan.memo,
    isCompleted: plan.isCompleted,
    isVisited: plan.isVisited,
    urls: getPlanUrls(document, plan.id),
  }))
}

export function materializeChecklists(
  document: TripDocumentV1,
  options: MaterializeOptions = {},
): ChecklistReadModel[] {
  const activeChecklists = filterActiveNodes(document.checklists, document.tombstones, 'checklist')
  const activeItems = filterActiveNodes(document.checklistItems, document.tombstones, 'checklistItem')
  const participantIds = getAcceptedParticipantIds(document)

  return activeChecklists
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((checklist) => {
      const items = activeItems
        .filter((item) => item.checklistId === checklist.id)
        .sort(compareChecklistItemsForLegacyOrder)
        .map((item) => materializeChecklistItem(document, item, participantIds, options))
      const doneCount = items.filter((item) => item.status.isChecked).length

      return {
        id: checklist.id,
        title: checklist.title,
        createdAt: checklist.createdAt,
        items,
        totalCount: items.length,
        doneCount,
        progressPercent: toProgressPercent(doneCount, items.length),
      }
    })
}

export function materializeChecklistItem(
  document: TripDocumentV1,
  item: ChecklistItemNode,
  participantIds: string[],
  options: MaterializeOptions = {},
): ChecklistItemReadModel {
  const assignees = getItemAssignees(document, item.id)
  const userChecks = getItemUserChecks(document, item.id)

  return {
    id: item.id,
    checklistId: item.checklistId,
    name: item.name,
    categoryName: item.categoryName,
    isPrivate: item.isPrivate,
    assignmentType: item.assignmentType,
    assignedUserId: item.assignedUserId,
    sourceTemplateName: item.sourceTemplateName,
    status: getChecklistItemStatusFromDocument(item, options.currentUserId, participantIds, userChecks, assignees),
    assignees,
    userChecks,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export function getChecklistItemStatusFromDocument(
  item: ChecklistItemNode,
  currentUserId: string | null | undefined,
  participantIds: string[],
  userChecks: ChecklistItemUserCheckNode[] = [],
  assignees: ChecklistItemAssigneeNode[] = [],
): ChecklistItemStatusReadModel {
  const assignedIds = assignees.map((assignee) => assignee.userId)
  const legacyAssignedIds = item.assignedUserId ? [item.assignedUserId] : []
  const specificIds = assignedIds.length > 0 ? assignedIds : legacyAssignedIds
  const requiredIds =
    item.assignmentType === 'everyone'
      ? participantIds
      : item.assignmentType === 'specific'
        ? specificIds
        : []
  const checks = userChecks.filter((check) => check.itemId === item.id)
  const isMyChecked = currentUserId ? checks.some((check) => check.userId === currentUserId) : false

  if (item.assignmentType === 'everyone' || specificIds.length > 1) {
    const requiredSet = new Set(requiredIds)
    const checksCount = checks.filter((check) => requiredSet.has(check.userId)).length
    return {
      isChecked: requiredIds.length > 0 && checksCount >= requiredIds.length,
      isMyChecked,
      checksCount,
      requiredCount: requiredIds.length,
      canCheck: Boolean(currentUserId && requiredSet.has(currentUserId)),
    }
  }

  if (item.assignmentType === 'specific') {
    const targetId = specificIds[0] ?? item.assignedUserId
    return {
      isChecked: item.legacyIsChecked,
      isMyChecked: item.legacyIsChecked,
      checksCount: item.legacyIsChecked ? 1 : 0,
      requiredCount: targetId ? 1 : 0,
      canCheck: Boolean(currentUserId && targetId === currentUserId),
    }
  }

  return {
    isChecked: item.legacyIsChecked,
    isMyChecked: item.legacyIsChecked,
    checksCount: item.legacyIsChecked ? 1 : 0,
    requiredCount: 1,
    canCheck: Boolean(currentUserId),
  }
}

function getPlanUrls(document: TripDocumentV1, planId: EntityId): PlanUrlNode[] {
  return filterActiveNodes(document.planUrls, document.tombstones, 'planUrl')
    .filter((url) => url.planId === planId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

function getItemAssignees(document: TripDocumentV1, itemId: EntityId): ChecklistItemAssigneeNode[] {
  return filterActiveNodes(
    document.checklistItemAssignees,
    document.tombstones,
    'checklistItemAssignee',
  )
    .filter((assignee) => assignee.itemId === itemId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

function getItemUserChecks(document: TripDocumentV1, itemId: EntityId): ChecklistItemUserCheckNode[] {
  return filterActiveNodes(
    document.checklistItemUserChecks,
    document.tombstones,
    'checklistItemUserCheck',
  )
    .filter((check) => check.itemId === itemId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

function getAcceptedParticipantIds(document: TripDocumentV1): string[] {
  return filterActiveNodes(document.members, document.tombstones, 'member')
    .filter((member) => member.status === 'accepted' && member.userId)
    .map((member) => member.userId)
    .filter(isPresent)
}

function toTripMemberReadModel(member: TripMemberNode): TripMemberReadModel {
  return {
    id: member.id,
    userId: member.userId,
    invitedEmail: member.invitedEmail,
    role: member.role,
    status: member.status,
    nickname: member.nickname,
    email: member.email,
  }
}

function createMaterializeTimer(now: (() => number) | undefined): () => number {
  const readTime =
    now ??
    (() => {
      if (typeof performance !== 'undefined') return performance.now()
      return Date.now()
    })
  const start = readTime()

  return () => Math.max(0, readTime() - start)
}

function createMaterializeMetrics(
  document: TripDocumentV1,
  durationMs: number,
  planCount: number,
  checklistItemCount: number,
): MaterializeMetrics {
  return {
    documentSizeBytes: estimateDocumentSizeBytes(document),
    durationMs,
    planCount,
    checklistItemCount,
    tombstoneCount: Object.keys(document.tombstones).length,
  }
}

export function estimateDocumentSizeBytes(document: TripDocumentV1): number {
  return getUtf8ByteLength(JSON.stringify(document))
}

function comparePlansForTimeline(a: PlanNode, b: PlanNode): number {
  return (
    a.startDateTimeLocal.localeCompare(b.startDateTimeLocal) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  )
}

function toProgressPercent(doneCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0
  return Math.round((doneCount / totalCount) * 100)
}

function getUtf8ByteLength(value: string): number {
  let bytes = 0

  for (let i = 0; i < value.length; i += 1) {
    const codePoint = value.codePointAt(i)
    if (codePoint === undefined) continue
    if (codePoint > 0xffff) i += 1

    if (codePoint <= 0x7f) bytes += 1
    else if (codePoint <= 0x7ff) bytes += 2
    else if (codePoint <= 0xffff) bytes += 3
    else bytes += 4
  }

  return bytes
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}
