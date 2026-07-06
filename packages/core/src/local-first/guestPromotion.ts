import type { TripDocumentV1, UserId } from './documentModel'
import { isGuestOwnerId } from './guestIdentity'

export type GuestPromotionDecision =
  | { action: 'promote' }
  | { action: 'already_promoted' }
  | { action: 'user_choice_required'; reason: 'document_id_conflict' }

export interface PromoteTripDocumentOwnerInput {
  document: TripDocumentV1
  authUserId: UserId
  now?: string
}

export function getGuestPromotionDecision(input: {
  document: TripDocumentV1
  authUserId: UserId
  authDocumentExists: boolean
}): GuestPromotionDecision {
  if (input.document.trip.ownerId === input.authUserId) {
    return { action: 'already_promoted' }
  }
  if (input.authDocumentExists) {
    return { action: 'user_choice_required', reason: 'document_id_conflict' }
  }
  return { action: 'promote' }
}

export function promoteTripDocumentOwner(input: PromoteTripDocumentOwnerInput): TripDocumentV1 {
  const previousOwnerId = input.document.meta.localOwnerId
    ?? (isGuestOwnerId(input.document.trip.ownerId) ? input.document.trip.ownerId : null)
    ?? input.document.trip.ownerId
  const now = input.now ?? new Date().toISOString()
  const next = cloneTripDocument(input.document)

  next.trip.ownerId = input.authUserId
  next.trip.updatedAt = now
  next.meta = {
    ...next.meta,
    localOwnerId: previousOwnerId,
    promotedOwnerId: input.authUserId,
    promotionStatus: 'backup_pending',
    promotedAt: now,
    promotionErrorCode: undefined,
  }

  replaceUserReferences(next, previousOwnerId, input.authUserId)
  ensureOwnerMember(next, previousOwnerId, input.authUserId, now)

  return next
}

export function markGuestPromotionBackupQueued(
  document: TripDocumentV1,
  now = new Date().toISOString(),
): TripDocumentV1 {
  return {
    ...cloneTripDocument(document),
    meta: {
      ...document.meta,
      promotionStatus: 'backup_queued',
      firstBackupQueuedAt: now,
      promotionErrorCode: undefined,
    },
  }
}

export function markGuestPromotionBackupUploaded(
  document: TripDocumentV1,
  now = new Date().toISOString(),
): TripDocumentV1 {
  return {
    ...cloneTripDocument(document),
    meta: {
      ...document.meta,
      promotionStatus: 'completed',
      firstBackupUploadedAt: now,
      lastBackupAt: now,
      promotionErrorCode: undefined,
    },
  }
}

export function markGuestPromotionFailed(
  document: TripDocumentV1,
  errorCode: string,
): TripDocumentV1 {
  return {
    ...cloneTripDocument(document),
    meta: {
      ...document.meta,
      promotionStatus: 'failed',
      promotionErrorCode: errorCode,
    },
  }
}

export function markGuestPromotionConflict(document: TripDocumentV1): TripDocumentV1 {
  return {
    ...cloneTripDocument(document),
    meta: {
      ...document.meta,
      promotionStatus: 'conflict',
      promotionErrorCode: 'document_id_conflict',
    },
  }
}

function replaceUserReferences(
  document: TripDocumentV1,
  previousOwnerId: string,
  authUserId: string,
): void {
  for (const item of Object.values(document.checklistItems)) {
    if (item.assignedUserId === previousOwnerId) item.assignedUserId = authUserId
  }
  for (const category of Object.values(document.checklistCategories)) {
    if (category.userId === previousOwnerId) category.userId = authUserId
  }
  for (const assignee of Object.values(document.checklistItemAssignees)) {
    if (assignee.userId === previousOwnerId) userIdReplace(assignee, authUserId)
  }
  for (const check of Object.values(document.checklistItemUserChecks)) {
    if (check.userId === previousOwnerId) userIdReplace(check, authUserId)
  }
  for (const invitation of Object.values(document.invitationLinks)) {
    if (invitation.createdBy === previousOwnerId) invitation.createdBy = authUserId
  }
  for (const asset of Object.values(document.assets)) {
    if (asset.ownerId === previousOwnerId) asset.ownerId = authUserId
  }
  for (const tombstone of Object.values(document.tombstones)) {
    if (tombstone.deletedBy === previousOwnerId) tombstone.deletedBy = authUserId
  }
}

function ensureOwnerMember(
  document: TripDocumentV1,
  previousOwnerId: string,
  authUserId: string,
  now: string,
): void {
  for (const [memberId, member] of Object.entries(document.members)) {
    if (member.userId === previousOwnerId || member.role === 'owner') {
      delete document.members[memberId]
    }
  }
  document.members[`member:${authUserId}`] = {
    id: `member:${authUserId}`,
    userId: authUserId,
    invitedEmail: null,
    role: 'owner',
    status: 'accepted',
    nickname: null,
    email: null,
    createdAt: now,
    updatedAt: now,
  }
}

function userIdReplace<T extends { userId: string }>(value: T, authUserId: string): void {
  value.userId = authUserId
}

function cloneTripDocument(document: TripDocumentV1): TripDocumentV1 {
  return JSON.parse(JSON.stringify(document)) as TripDocumentV1
}
