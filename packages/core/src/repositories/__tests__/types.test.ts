import type {
  ChecklistRepository,
  ChecklistRepositorySnapshot,
  TripRepository,
} from '../types'

const snapshot: ChecklistRepositorySnapshot = {
  checklistId: 'checklist-1',
  checklists: [
    {
      id: 'checklist-1',
      trip_id: 'trip-1',
      title: 'Packing',
      created_at: '2026-06-29T00:00:00.000Z',
    },
  ],
  trip: {
    id: 'trip-1',
    user_id: 'user-1',
    destination: 'Seoul',
    start_date: '2026-07-01',
    end_date: '2026-07-03',
    adults_count: 2,
    children_count: 0,
    created_at: '2026-06-29T00:00:00.000Z',
    updated_at: '2026-06-29T00:00:00.000Z',
  },
  items: [],
  members: [],
  userChecks: [],
  itemAssignees: [],
}

const checklistRepository: ChecklistRepository = {
  getChecklist: async () => snapshot,
  createItem: async () => {
    throw new Error('not implemented in repository contract smoke test')
  },
  updateItem: async () => {
    throw new Error('not implemented in repository contract smoke test')
  },
  deleteItem: async () => undefined,
  toggleItem: async () => undefined,
  toggleItemForUser: async () => [],
}

const tripRepository: TripRepository = {
  listTrips: async () => [snapshot.trip!],
  getTrip: async () => snapshot.trip,
  getTripDocument: async () => null,
  getTripWithPlans: async () => ({ trip: snapshot.trip!, plans: [] }),
  createTrip: async () => snapshot.trip!,
  updateTrip: async () => snapshot.trip!,
  deleteTrip: async () => undefined,
}

async function runRepositoryContractSmokeTest(): Promise<void> {
  const loaded = await checklistRepository.getChecklist('trip-1')
  if (loaded.checklistId !== 'checklist-1') {
    throw new Error('ChecklistRepository mock should return a checklist snapshot.')
  }

  const trips = await tripRepository.listTrips('user-1')
  if (trips[0]?.id !== 'trip-1') {
    throw new Error('TripRepository mock should return trip summaries independent of data source.')
  }
}

void runRepositoryContractSmokeTest()
