import type {
  Checklist,
  ChecklistItem,
  ChecklistItemAssignee,
  ChecklistItemUserCheck,
  Plan,
  Trip,
  TripMember,
} from '@nexvoy/types'
import type {
  ChecklistItemInput,
  CreateTripInput,
  UpdateTripInput,
} from '../supabase/queries'
import type { TripDocumentV1 } from '../local-first/documentModel'

export interface TripRepository {
  listTrips(userId: string): Promise<Trip[]>
  getTrip(tripId: string): Promise<Trip | null>
  getTripDocument(tripId: string): Promise<TripDocumentV1 | null>
  getTripWithPlans(tripId: string): Promise<{ trip: Trip; plans: Plan[] }>
  createTrip(input: CreateTripInput): Promise<Trip>
  updateTrip(tripId: string, input: UpdateTripInput): Promise<Trip>
  deleteTrip(tripId: string, ownerId?: string): Promise<void>
}

export interface ChecklistRepository {
  getChecklist(tripId: string): Promise<ChecklistRepositorySnapshot>
  createItem(
    checklistId: string,
    input: ChecklistItemInput,
  ): Promise<ChecklistItemMutationResult>
  updateItem(
    itemId: string,
    input: ChecklistItemInput,
  ): Promise<ChecklistItemMutationResult>
  deleteItem(itemId: string): Promise<void>
  toggleItem(itemId: string, isChecked: boolean): Promise<void>
  toggleItemForUser(input: ToggleChecklistItemForUserInput): Promise<ChecklistItemUserCheck[]>
}

export interface ChecklistRepositorySnapshot {
  checklistId: string | null
  checklists: Checklist[]
  trip: ChecklistTripSnapshot | null
  items: ChecklistItem[]
  members: ChecklistMemberSnapshot[]
  userChecks: ChecklistItemUserCheck[]
  itemAssignees: ChecklistItemAssignee[]
}

export interface ChecklistItemMutationResult {
  item: ChecklistItem
  assignees: ChecklistItemAssignee[]
}

export interface ToggleChecklistItemForUserInput {
  item: ChecklistItem
  currentUserId: string
  nextChecked: boolean
  participantIds?: string[]
}

export type ChecklistTripSnapshot = Trip & {
  profiles?: {
    nickname: string | null
    email: string | null
  } | null
}

export type ChecklistMemberSnapshot = TripMember & {
  email?: string | null
  profiles?: {
    nickname: string | null
    email: string | null
  }
}
