import type {
  AssetRef,
  ChecklistItem,
  ChecklistItemAssignee,
  ChecklistItemUserCheck,
  Plan,
  PlanUrl,
  TripMember,
  TripProductState,
} from './models'

export interface MaterializeOptions {
  currentUserId?: string | null
  now?: () => number
}

export interface MaterializeMetrics {
  stateSizeBytes: number
  durationMs: number
  planCount: number
  checklistItemCount: number
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
  assets: AssetRef[]
  metrics: MaterializeMetrics
}

export interface PlanTimelineItemReadModel {
  id: string
  title: string
  location: string | null
  address: string | null
  coordinates: Plan['coordinates']
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
  urls: PlanUrl[]
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
  assignmentType: ChecklistItem['assignmentType']
  assignedUserId: string | null
  sourceTemplateName: string | null
  status: ChecklistItemStatusReadModel
  assignees: ChecklistItemAssignee[]
  userChecks: ChecklistItemUserCheck[]
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
  role: TripMember['role']
  status: TripMember['status']
  nickname: string | null
  email: string | null
}

export function materializeTripDetail(
  state: TripProductState,
  options: MaterializeOptions = {},
): TripDetailReadModel {
  const timer = createMaterializeTimer(options.now)
  const plans = materializePlanTimeline(state)
  const checklists = materializeChecklists(state, options)
  const members = Object.values(state.members)
    .filter((member) => member.status !== 'revoked')
    .map(toTripMemberReadModel)
  const assets = Object.values(state.assets)
  const checklistTotalCount = checklists.reduce((sum, checklist) => sum + checklist.totalCount, 0)
  const checklistDoneCount = checklists.reduce((sum, checklist) => sum + checklist.doneCount, 0)

  return {
    ...materializeTripSummary(state, {
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
    metrics: {
      stateSizeBytes: getUtf8ByteLength(JSON.stringify(state)),
      durationMs: timer(),
      planCount: plans.length,
      checklistItemCount: checklistTotalCount,
    },
  }
}

export function materializeTripSummary(
  state: TripProductState,
  options: MaterializeOptions & {
    checklistTotalCount?: number
    checklistDoneCount?: number
    memberCount?: number
    planCount?: number
  } = {},
): TripSummaryReadModel {
  const checklists =
    options.checklistTotalCount === undefined || options.checklistDoneCount === undefined
      ? materializeChecklists(state, options)
      : []
  const checklistTotalCount = options.checklistTotalCount
    ?? checklists.reduce((sum, checklist) => sum + checklist.totalCount, 0)
  const checklistDoneCount = options.checklistDoneCount
    ?? checklists.reduce((sum, checklist) => sum + checklist.doneCount, 0)
  const memberCount = options.memberCount
    ?? Object.values(state.members).filter((member) => member.status !== 'revoked').length
  const planCount = options.planCount ?? Object.keys(state.plans).length

  return {
    id: state.trip.id,
    ownerId: state.trip.ownerId,
    destination: state.trip.destination,
    startDate: state.trip.startDate,
    endDate: state.trip.endDate,
    adultsCount: state.trip.adultsCount,
    childrenCount: state.trip.childrenCount,
    coverImageRef: state.trip.coverImageRef,
    bgColor: state.trip.bgColor,
    memberCount,
    planCount,
    checklistTotalCount,
    checklistDoneCount,
    progressPercent: toProgressPercent(checklistDoneCount, checklistTotalCount),
    updatedAt: state.trip.updatedAt,
  }
}

export function materializePlanTimeline(state: TripProductState): PlanTimelineItemReadModel[] {
  const plans = new Map(Object.values(state.plans).map((plan) => [plan.id, plan]))
  const orderedIds = state.planOrder.filter((planId) => plans.has(planId))
  const unorderedPlans = Array.from(plans.values()).filter((plan) => !orderedIds.includes(plan.id))
  const sortedPlans = [
    ...orderedIds.map((planId) => plans.get(planId)).filter(isPresent),
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
    urls: getPlanUrls(state, plan.id),
  }))
}

export function materializeChecklists(
  state: TripProductState,
  options: MaterializeOptions = {},
): ChecklistReadModel[] {
  const participantIds = getAcceptedParticipantIds(state)

  return Object.values(state.checklists)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((checklist) => {
      const items = Object.values(state.checklistItems)
        .filter((item) => item.checklistId === checklist.id)
        .sort(compareChecklistItems)
        .map((item) => materializeChecklistItem(state, item, participantIds, options))
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
  state: TripProductState,
  item: ChecklistItem,
  participantIds: string[],
  options: MaterializeOptions = {},
): ChecklistItemReadModel {
  const assignees = getItemAssignees(state, item.id)
  const userChecks = getItemUserChecks(state, item.id)

  return {
    id: item.id,
    checklistId: item.checklistId,
    name: item.name,
    categoryName: item.categoryName,
    isPrivate: item.isPrivate,
    assignmentType: item.assignmentType,
    assignedUserId: item.assignedUserId,
    sourceTemplateName: item.sourceTemplateName,
    status: getChecklistItemStatus(item, options.currentUserId, participantIds, userChecks, assignees),
    assignees,
    userChecks,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export function getChecklistItemStatus(
  item: ChecklistItem,
  currentUserId: string | null | undefined,
  participantIds: string[],
  userChecks: ChecklistItemUserCheck[] = [],
  assignees: ChecklistItemAssignee[] = [],
): ChecklistItemStatusReadModel {
  const assignedIds = assignees.map((assignee) => assignee.userId)
  const specificIds = assignedIds.length > 0
    ? assignedIds
    : item.assignedUserId ? [item.assignedUserId] : []
  const requiredIds = item.assignmentType === 'everyone'
    ? participantIds
    : item.assignmentType === 'specific' ? specificIds : []
  const checks = userChecks.filter((check) => check.itemId === item.id)
  const isMyChecked = currentUserId
    ? checks.some((check) => check.userId === currentUserId)
    : false

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

function getPlanUrls(state: TripProductState, planId: string): PlanUrl[] {
  return Object.values(state.planUrls)
    .filter((url) => url.planId === planId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

function getItemAssignees(state: TripProductState, itemId: string): ChecklistItemAssignee[] {
  return Object.values(state.checklistItemAssignees)
    .filter((assignee) => assignee.itemId === itemId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

function getItemUserChecks(state: TripProductState, itemId: string): ChecklistItemUserCheck[] {
  return Object.values(state.checklistItemUserChecks)
    .filter((check) => check.itemId === itemId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

function getAcceptedParticipantIds(state: TripProductState): string[] {
  return Array.from(new Set([
    state.trip.ownerId,
    ...Object.values(state.members)
      .filter((member) => member.status === 'accepted' && member.userId)
      .map((member) => member.userId)
      .filter(isPresent),
  ]))
}

function toTripMemberReadModel(member: TripMember): TripMemberReadModel {
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

function comparePlansForTimeline(a: Plan, b: Plan): number {
  return a.startDateTimeLocal.localeCompare(b.startDateTimeLocal)
    || a.createdAt.localeCompare(b.createdAt)
    || a.id.localeCompare(b.id)
}

function compareChecklistItems(a: ChecklistItem, b: ChecklistItem): number {
  return a.categoryName.localeCompare(b.categoryName)
    || a.createdAt.localeCompare(b.createdAt)
    || a.id.localeCompare(b.id)
}

function createMaterializeTimer(now: (() => number) | undefined): () => number {
  const readTime = now ?? (() => typeof performance !== 'undefined' ? performance.now() : Date.now())
  const start = readTime()
  return () => Math.max(0, readTime() - start)
}

function toProgressPercent(doneCount: number, totalCount: number): number {
  return totalCount <= 0 ? 0 : Math.round((doneCount / totalCount) * 100)
}

function getUtf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).byteLength
  return unescape(encodeURIComponent(value)).length
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}
