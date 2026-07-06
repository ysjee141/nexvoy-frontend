import type { TripDocumentV1 } from '../documentModel'
import { createEmptyTripDocumentV1 } from '../tripDocument'
import {
  getGuestPromotionDecision,
  markGuestPromotionBackupUploaded,
  markGuestPromotionConflict,
  promoteTripDocumentOwner,
} from '../guestPromotion'

const guestDocument = createEmptyTripDocumentV1({
  id: 'trip-1',
  ownerId: 'guest:device-1',
  destination: 'Seoul',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  adultsCount: 1,
  childrenCount: 0,
  createdAt: '2026-07-06T00:00:00.000Z',
})
guestDocument.members['member:guest:device-1'] = {
  id: 'member:guest:device-1',
  userId: 'guest:device-1',
  invitedEmail: null,
  role: 'owner',
  status: 'accepted',
  nickname: 'Guest',
  email: null,
  createdAt: '2026-07-06T00:00:00.000Z',
  updatedAt: '2026-07-06T00:00:00.000Z',
}
guestDocument.checklistItems['item-1'] = {
  id: 'item-1',
  checklistId: 'checklist-1',
  name: 'Passport',
  categoryName: 'Documents',
  legacyIsChecked: false,
  isPrivate: false,
  assignmentType: 'specific',
  assignedUserId: 'guest:device-1',
  sourceTemplateName: null,
  createdAt: '2026-07-06T00:00:00.000Z',
  updatedAt: '2026-07-06T00:00:00.000Z',
}
guestDocument.checklistItemUserChecks['check:item-1:guest:device-1'] = {
  id: 'check:item-1:guest:device-1',
  itemId: 'item-1',
  userId: 'guest:device-1',
  createdAt: '2026-07-06T00:00:00.000Z',
}

const decision = getGuestPromotionDecision({
  document: guestDocument,
  authUserId: 'user-1',
  authDocumentExists: false,
})
if (decision.action !== 'promote') {
  throw new Error('Guest document without conflict should be promoted.')
}

const conflict = getGuestPromotionDecision({
  document: guestDocument,
  authUserId: 'user-1',
  authDocumentExists: true,
})
if (conflict.action !== 'user_choice_required') {
  throw new Error('Existing auth document should require user choice.')
}

const promoted = promoteTripDocumentOwner({
  document: guestDocument,
  authUserId: 'user-1',
  now: '2026-07-06T01:00:00.000Z',
})
assertPromoted(promoted)

const uploaded = markGuestPromotionBackupUploaded(promoted, '2026-07-06T01:01:00.000Z')
if (uploaded.meta.promotionStatus !== 'completed' || uploaded.meta.firstBackupUploadedAt !== '2026-07-06T01:01:00.000Z') {
  throw new Error('Uploaded promotion should be marked completed.')
}

const markedConflict = markGuestPromotionConflict(guestDocument)
if (markedConflict.meta.promotionStatus !== 'conflict') {
  throw new Error('Promotion conflict should be marked on document meta.')
}

function assertPromoted(document: TripDocumentV1): void {
  if (document.trip.ownerId !== 'user-1') {
    throw new Error('Promoted document should use auth user owner id.')
  }
  if (document.meta.localOwnerId !== 'guest:device-1' || document.meta.promotedOwnerId !== 'user-1') {
    throw new Error('Promoted document should record promotion metadata.')
  }
  if (!document.members['member:user-1'] || document.members['member:guest:device-1']) {
    throw new Error('Promoted document should replace guest owner member.')
  }
  if (document.checklistItems['item-1']?.assignedUserId !== 'user-1') {
    throw new Error('Promoted document should rewrite checklist owner references.')
  }
  if (document.checklistItemUserChecks['check:item-1:guest:device-1']?.userId !== 'user-1') {
    throw new Error('Promoted document should rewrite user check references.')
  }
}
