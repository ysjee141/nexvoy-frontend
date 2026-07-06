import { detectChecklistMismatch } from '../checklistMismatchDetector'
import type { ChecklistRepositorySnapshot } from '../types'

const baseSnapshot: ChecklistRepositorySnapshot = {
  checklistId: 'checklist-1',
  checklists: [
    {
      id: 'checklist-1',
      trip_id: 'trip-1',
      title: 'Packing',
      created_at: '2026-07-06T00:00:00.000Z',
    },
  ],
  trip: null,
  items: [
    {
      id: 'item-1',
      checklist_id: 'checklist-1',
      item_name: 'Passport',
      category: 'Documents',
      is_checked: true,
      is_private: false,
      assignment_type: 'anyone',
      assigned_user_id: null,
      source_template_name: null,
      created_at: '2026-07-06T00:00:00.000Z',
      updated_at: '2026-07-06T00:00:00.000Z',
    },
  ],
  members: [],
  userChecks: [
    {
      id: 'check:item-1:user-1',
      item_id: 'item-1',
      user_id: 'user-1',
      created_at: '2026-07-06T00:00:00.000Z',
    },
  ],
  itemAssignees: [
    {
      id: 'assignee:item-1:user-1',
      item_id: 'item-1',
      user_id: 'user-1',
      created_at: '2026-07-06T00:00:00.000Z',
    },
  ],
}

const matched = detectChecklistMismatch(baseSnapshot, cloneSnapshot(baseSnapshot))
if (!matched.matched || matched.reasonCodes.length !== 0) {
  throw new Error('Identical snapshots should match.')
}

const missingLocalItem = cloneSnapshot(baseSnapshot)
missingLocalItem.items = []
const missingItemResult = detectChecklistMismatch(baseSnapshot, missingLocalItem)
if (!missingItemResult.reasonCodes.includes('missing_local_item')) {
  throw new Error('Detector should report missing local item.')
}

const changedCheckState = cloneSnapshot(baseSnapshot)
changedCheckState.items[0] = {
  ...changedCheckState.items[0]!,
  is_checked: false,
}
const checkStateResult = detectChecklistMismatch(baseSnapshot, changedCheckState)
if (!checkStateResult.reasonCodes.includes('item_field_mismatch')) {
  throw new Error('Detector should report item field mismatch.')
}

const assigneeMismatch = cloneSnapshot(baseSnapshot)
assigneeMismatch.itemAssignees = []
const assigneeResult = detectChecklistMismatch(baseSnapshot, assigneeMismatch)
if (!assigneeResult.reasonCodes.includes('assignee_set_mismatch')) {
  throw new Error('Detector should report assignee mismatch.')
}

const userCheckMismatch = cloneSnapshot(baseSnapshot)
userCheckMismatch.userChecks = []
const userCheckResult = detectChecklistMismatch(baseSnapshot, userCheckMismatch)
if (!userCheckResult.reasonCodes.includes('user_check_set_mismatch')) {
  throw new Error('Detector should report user check mismatch.')
}

function cloneSnapshot(snapshot: ChecklistRepositorySnapshot): ChecklistRepositorySnapshot {
  return {
    ...snapshot,
    checklists: snapshot.checklists.map((checklist) => ({ ...checklist })),
    items: snapshot.items.map((item) => ({ ...item })),
    members: snapshot.members.map((member) => ({ ...member })),
    userChecks: snapshot.userChecks.map((check) => ({ ...check })),
    itemAssignees: snapshot.itemAssignees.map((assignee) => ({ ...assignee })),
  }
}
