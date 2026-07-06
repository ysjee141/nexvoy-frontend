import type { ChecklistItemInput } from '../supabase/queries'
import type { ChecklistItemUserCheck } from '@nexvoy/types'
import {
  detectChecklistMismatch,
  type ChecklistMismatchSummary,
} from './checklistMismatchDetector'
import type {
  ChecklistItemMutationResult,
  ChecklistRepository,
  ChecklistRepositorySnapshot,
  ToggleChecklistItemForUserInput,
} from './types'

export type DualWriteChecklistOperation =
  | 'getChecklist'
  | 'createItem'
  | 'updateItem'
  | 'deleteItem'
  | 'toggleItem'
  | 'toggleItemForUser'

export interface DualWriteMismatchEvent {
  domain: 'checklist'
  operation: DualWriteChecklistOperation
  tripId: string | null
  checklistId?: string | null
  itemId?: string | null
  reasonCodes: string[]
  legacyChecklistCount?: number
  localChecklistCount?: number
  legacyItemCount?: number
  localItemCount?: number
}

export interface DualWriteChecklistLocalWriter {
  getChecklist(tripId: string): Promise<ChecklistRepositorySnapshot>
  applyCreateItem(
    checklistId: string,
    input: ChecklistItemInput,
    result: ChecklistItemMutationResult,
  ): Promise<{ tripId: string }>
  applyUpdateItem(itemId: string, input: ChecklistItemInput): Promise<{ tripId: string }>
  applyDeleteItem(itemId: string): Promise<{ tripId: string }>
  applyToggleItem(itemId: string, isChecked: boolean): Promise<{ tripId: string }>
  applyToggleItemForUser(
    input: ToggleChecklistItemForUserInput,
    result: ChecklistItemUserCheck[],
  ): Promise<{ tripId: string }>
}

export interface CreateDualWriteChecklistRepositoryOptions {
  legacy: ChecklistRepository
  local: DualWriteChecklistLocalWriter
  reporter?: (event: DualWriteMismatchEvent) => void | Promise<void>
}

export function createDualWriteChecklistRepository(
  options: CreateDualWriteChecklistRepositoryOptions,
): ChecklistRepository {
  return {
    getChecklist: (tripId) => options.legacy.getChecklist(tripId),
    createItem: async (checklistId, input) => {
      const result = await options.legacy.createItem(checklistId, input)
      await applyLocalAndDetect(options, {
        operation: 'createItem',
        checklistId,
        itemId: result.item.id,
        applyLocal: () => options.local.applyCreateItem(checklistId, input, result),
      })
      return result
    },
    updateItem: async (itemId, input) => {
      const result = await options.legacy.updateItem(itemId, input)
      await applyLocalAndDetect(options, {
        operation: 'updateItem',
        checklistId: result.item.checklist_id,
        itemId,
        applyLocal: () => options.local.applyUpdateItem(itemId, input),
      })
      return result
    },
    deleteItem: async (itemId) => {
      await options.legacy.deleteItem(itemId)
      await applyLocalAndDetect(options, {
        operation: 'deleteItem',
        itemId,
        applyLocal: () => options.local.applyDeleteItem(itemId),
      })
    },
    toggleItem: async (itemId, isChecked) => {
      await options.legacy.toggleItem(itemId, isChecked)
      await applyLocalAndDetect(options, {
        operation: 'toggleItem',
        itemId,
        applyLocal: () => options.local.applyToggleItem(itemId, isChecked),
      })
    },
    toggleItemForUser: async (input) => {
      const result = await options.legacy.toggleItemForUser(input)
      await applyLocalAndDetect(options, {
        operation: 'toggleItemForUser',
        checklistId: input.item.checklist_id,
        itemId: input.item.id,
        applyLocal: () => options.local.applyToggleItemForUser(input, result),
      })
      return result
    },
  }
}

async function applyLocalAndDetect(
  options: CreateDualWriteChecklistRepositoryOptions,
  input: {
    operation: DualWriteChecklistOperation
    checklistId?: string | null
    itemId?: string | null
    applyLocal: () => Promise<{ tripId: string }>
  },
): Promise<void> {
  try {
    const { tripId } = await input.applyLocal()
    await detectAndReport(options, {
      operation: input.operation,
      tripId,
      checklistId: input.checklistId,
      itemId: input.itemId,
    })
  } catch {
    await reportMismatch(options, {
      domain: 'checklist',
      operation: input.operation,
      tripId: null,
      checklistId: input.checklistId,
      itemId: input.itemId,
      reasonCodes: ['local_write_failed'],
    })
  }
}

async function detectAndReport(
  options: CreateDualWriteChecklistRepositoryOptions,
  input: {
    operation: DualWriteChecklistOperation
    tripId: string
    checklistId?: string | null
    itemId?: string | null
  },
): Promise<void> {
  try {
    const [legacySnapshot, localSnapshot] = await Promise.all([
      options.legacy.getChecklist(input.tripId),
      options.local.getChecklist(input.tripId),
    ])
    const summary = detectChecklistMismatch(legacySnapshot, localSnapshot)
    if (!summary.matched) {
      await reportMismatch(options, toMismatchEvent(input, summary))
    }
  } catch {
    await reportMismatch(options, {
      domain: 'checklist',
      operation: input.operation,
      tripId: input.tripId,
      checklistId: input.checklistId,
      itemId: input.itemId,
      reasonCodes: ['detector_failed'],
    })
  }
}

function toMismatchEvent(
  input: {
    operation: DualWriteChecklistOperation
    tripId: string
    checklistId?: string | null
    itemId?: string | null
  },
  summary: ChecklistMismatchSummary,
): DualWriteMismatchEvent {
  return {
    domain: 'checklist',
    operation: input.operation,
    tripId: input.tripId,
    checklistId: input.checklistId,
    itemId: input.itemId,
    reasonCodes: summary.reasonCodes,
    legacyChecklistCount: summary.legacyChecklistCount,
    localChecklistCount: summary.localChecklistCount,
    legacyItemCount: summary.legacyItemCount,
    localItemCount: summary.localItemCount,
  }
}

async function reportMismatch(
  options: CreateDualWriteChecklistRepositoryOptions,
  event: DualWriteMismatchEvent,
): Promise<void> {
  try {
    await options.reporter?.(event)
  } catch {
    // Observability must not affect the user-facing legacy mutation result.
  }
}
