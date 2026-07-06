import type { ChecklistRepositorySnapshot } from './types'

export type ChecklistMismatchReasonCode =
  | 'checklist_count_mismatch'
  | 'checklist_metadata_mismatch'
  | 'item_count_mismatch'
  | 'missing_local_item'
  | 'extra_local_item'
  | 'item_field_mismatch'
  | 'assignee_set_mismatch'
  | 'user_check_set_mismatch'

export interface ChecklistMismatchSummary {
  matched: boolean
  reasonCodes: ChecklistMismatchReasonCode[]
  legacyChecklistCount: number
  localChecklistCount: number
  legacyItemCount: number
  localItemCount: number
}

interface CanonicalChecklistSnapshot {
  checklists: Map<string, CanonicalChecklist>
  items: Map<string, CanonicalChecklistItem>
  assignees: Set<string>
  userChecks: Set<string>
}

interface CanonicalChecklist {
  id: string
  title: string
}

interface CanonicalChecklistItem {
  id: string
  checklistId: string
  name: string
  category: string
  isChecked: boolean
  isPrivate: boolean
  assignmentType: string
  assignedUserId: string | null
  sourceTemplateName: string | null
}

export function detectChecklistMismatch(
  legacy: ChecklistRepositorySnapshot,
  local: ChecklistRepositorySnapshot,
): ChecklistMismatchSummary {
  const legacySnapshot = toCanonicalSnapshot(legacy)
  const localSnapshot = toCanonicalSnapshot(local)
  const reasonCodes = new Set<ChecklistMismatchReasonCode>()

  if (legacySnapshot.checklists.size !== localSnapshot.checklists.size) {
    reasonCodes.add('checklist_count_mismatch')
  }
  for (const [checklistId, legacyChecklist] of legacySnapshot.checklists) {
    const localChecklist = localSnapshot.checklists.get(checklistId)
    if (!localChecklist || localChecklist.title !== legacyChecklist.title) {
      reasonCodes.add('checklist_metadata_mismatch')
    }
  }

  if (legacySnapshot.items.size !== localSnapshot.items.size) {
    reasonCodes.add('item_count_mismatch')
  }
  for (const [itemId, legacyItem] of legacySnapshot.items) {
    const localItem = localSnapshot.items.get(itemId)
    if (!localItem) {
      reasonCodes.add('missing_local_item')
      continue
    }
    if (!areItemsEquivalent(legacyItem, localItem)) {
      reasonCodes.add('item_field_mismatch')
    }
  }
  for (const itemId of localSnapshot.items.keys()) {
    if (!legacySnapshot.items.has(itemId)) {
      reasonCodes.add('extra_local_item')
    }
  }

  if (!areSetsEqual(legacySnapshot.assignees, localSnapshot.assignees)) {
    reasonCodes.add('assignee_set_mismatch')
  }
  if (!areSetsEqual(legacySnapshot.userChecks, localSnapshot.userChecks)) {
    reasonCodes.add('user_check_set_mismatch')
  }

  return {
    matched: reasonCodes.size === 0,
    reasonCodes: Array.from(reasonCodes).sort(),
    legacyChecklistCount: legacySnapshot.checklists.size,
    localChecklistCount: localSnapshot.checklists.size,
    legacyItemCount: legacySnapshot.items.size,
    localItemCount: localSnapshot.items.size,
  }
}

function toCanonicalSnapshot(snapshot: ChecklistRepositorySnapshot): CanonicalChecklistSnapshot {
  return {
    checklists: new Map(snapshot.checklists.map((checklist) => [
      checklist.id,
      {
        id: checklist.id,
        title: checklist.title,
      },
    ])),
    items: new Map(snapshot.items.map((item) => [
      item.id,
      {
        id: item.id,
        checklistId: item.checklist_id,
        name: item.item_name.trim(),
        category: item.category ?? '기타',
        isChecked: item.is_checked,
        isPrivate: item.is_private ?? false,
        assignmentType: item.assignment_type ?? 'anyone',
        assignedUserId: item.assigned_user_id ?? null,
        sourceTemplateName: item.source_template_name ?? null,
      },
    ])),
    assignees: new Set(snapshot.itemAssignees
      .map((assignee) => `${assignee.item_id}:${assignee.user_id}`)
      .sort()),
    userChecks: new Set(snapshot.userChecks
      .map((check) => `${check.item_id}:${check.user_id}`)
      .sort()),
  }
}

function areItemsEquivalent(left: CanonicalChecklistItem, right: CanonicalChecklistItem): boolean {
  return left.id === right.id
    && left.checklistId === right.checklistId
    && left.name === right.name
    && left.category === right.category
    && left.isChecked === right.isChecked
    && left.isPrivate === right.isPrivate
    && left.assignmentType === right.assignmentType
    && left.assignedUserId === right.assignedUserId
    && left.sourceTemplateName === right.sourceTemplateName
}

function areSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false
  for (const value of left) {
    if (!right.has(value)) return false
  }
  return true
}
