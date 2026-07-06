import { createDualWriteChecklistRepository, type DualWriteMismatchEvent } from '../dualWriteChecklistRepository'
import type {
  ChecklistItemMutationResult,
  ChecklistRepository,
  ChecklistRepositorySnapshot,
} from '../types'

const legacySnapshot = createSnapshot('legacy')
const localSnapshot = createSnapshot('legacy')
const itemResult: ChecklistItemMutationResult = {
  item: legacySnapshot.items[0]!,
  assignees: legacySnapshot.itemAssignees,
}
const events: DualWriteMismatchEvent[] = []
let localCreateCalled = false

const legacy: ChecklistRepository = {
  getChecklist: async () => legacySnapshot,
  createItem: async () => itemResult,
  updateItem: async () => itemResult,
  deleteItem: async () => undefined,
  toggleItem: async () => undefined,
  toggleItemForUser: async () => legacySnapshot.userChecks,
}

const repository = createDualWriteChecklistRepository({
  legacy,
  local: {
    getChecklist: async () => localSnapshot,
    applyCreateItem: async () => {
      localCreateCalled = true
      return { tripId: 'trip-1' }
    },
    applyUpdateItem: async () => ({ tripId: 'trip-1' }),
    applyDeleteItem: async () => ({ tripId: 'trip-1' }),
    applyToggleItem: async () => ({ tripId: 'trip-1' }),
    applyToggleItemForUser: async () => ({ tripId: 'trip-1' }),
  },
  reporter: (event) => {
    events.push(event)
  },
})

runDualWriteRepositoryTest().catch((error) => {
  throw error
})

async function runDualWriteRepositoryTest(): Promise<void> {
  const created = await repository.createItem('checklist-1', {
    item_name: 'Passport',
    category: 'Documents',
  })
  if (created.item.id !== 'item-1' || !localCreateCalled) {
    throw new Error('Dual-write create should return legacy result and apply local writer.')
  }
  if (events.length !== 0) {
    throw new Error('Matched snapshots should not report mismatch.')
  }

  const mismatchRepository = createDualWriteChecklistRepository({
    legacy,
    local: {
      getChecklist: async () => createSnapshot('local-mismatch'),
      applyCreateItem: async () => ({ tripId: 'trip-1' }),
      applyUpdateItem: async () => ({ tripId: 'trip-1' }),
      applyDeleteItem: async () => ({ tripId: 'trip-1' }),
      applyToggleItem: async () => ({ tripId: 'trip-1' }),
      applyToggleItemForUser: async () => ({ tripId: 'trip-1' }),
    },
    reporter: (event) => {
      events.push(event)
    },
  })
  await mismatchRepository.updateItem('item-1', {
    item_name: 'Passport',
    category: 'Documents',
  })
  if (!events.some((event) => event.reasonCodes.includes('item_field_mismatch'))) {
    throw new Error('Dual-write repository should report mismatch after mutation.')
  }

  const failingRepository = createDualWriteChecklistRepository({
    legacy,
    local: {
      getChecklist: async () => localSnapshot,
      applyCreateItem: async () => {
        throw new Error('indexeddb unavailable')
      },
      applyUpdateItem: async () => ({ tripId: 'trip-1' }),
      applyDeleteItem: async () => ({ tripId: 'trip-1' }),
      applyToggleItem: async () => ({ tripId: 'trip-1' }),
      applyToggleItemForUser: async () => ({ tripId: 'trip-1' }),
    },
    reporter: (event) => {
      events.push(event)
    },
  })
  const fallbackResult = await failingRepository.createItem('checklist-1', {
    item_name: 'Passport',
    category: 'Documents',
  })
  if (fallbackResult.item.id !== 'item-1') {
    throw new Error('Local failure should not change legacy mutation result.')
  }
  if (!events.some((event) => event.reasonCodes.includes('local_write_failed'))) {
    throw new Error('Local failure should be reported as mismatch event.')
  }
}

function createSnapshot(kind: 'legacy' | 'local-mismatch'): ChecklistRepositorySnapshot {
  return {
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
        item_name: kind === 'legacy' ? 'Passport' : 'Different',
        category: 'Documents',
        is_checked: false,
        is_private: false,
        assignment_type: 'anyone',
        assigned_user_id: null,
        source_template_name: null,
        created_at: '2026-07-06T00:00:00.000Z',
        updated_at: '2026-07-06T00:00:00.000Z',
      },
    ],
    members: [],
    userChecks: [],
    itemAssignees: [],
  }
}
