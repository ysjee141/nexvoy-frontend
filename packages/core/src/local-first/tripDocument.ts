import {
  TRIP_DOCUMENT_SCHEMA_VERSION,
  type IsoDateString,
  type IsoDateTimeString,
  type TripDocumentV1,
  type TripRootNode,
  type UserId,
} from './documentModel'

export interface CreateTripDocumentInput {
  id: string
  ownerId: UserId
  destination: string
  startDate: IsoDateString
  endDate: IsoDateString
  adultsCount: number
  childrenCount: number
  coverImageRef?: string | null
  bgColor?: string | null
  createdAt: IsoDateTimeString
  updatedAt?: IsoDateTimeString
  createdFromLegacyAt?: IsoDateTimeString
}

export function createEmptyTripDocumentV1(input: CreateTripDocumentInput): TripDocumentV1 {
  const trip = createTripRootNode(input)

  return {
    schemaVersion: TRIP_DOCUMENT_SCHEMA_VERSION,
    trip,
    plans: {},
    planOrder: [],
    planUrls: {},
    checklists: {},
    checklistItems: {},
    checklistCategories: {},
    checklistItemAssignees: {},
    checklistItemUserChecks: {},
    members: {},
    shares: {},
    invitationLinks: {},
    assets: {},
    tombstones: {},
    meta: {
      createdFromLegacyAt: input.createdFromLegacyAt,
    },
  }
}

export function createTripRootNode(input: CreateTripDocumentInput): TripRootNode {
  return {
    id: input.id,
    ownerId: input.ownerId,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    adultsCount: input.adultsCount,
    childrenCount: input.childrenCount,
    coverImageRef: input.coverImageRef ?? null,
    bgColor: input.bgColor ?? null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
  }
}

export const SAMPLE_TRIP_DOCUMENT_V1 = {
  schemaVersion: TRIP_DOCUMENT_SCHEMA_VERSION,
  trip: {
    id: '00000000-0000-4000-8000-000000000001',
    ownerId: '00000000-0000-4000-8000-000000000002',
    destination: 'Seoul',
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    adultsCount: 2,
    childrenCount: 0,
    coverImageRef: null,
    bgColor: null,
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:00.000Z',
  },
  plans: {},
  planOrder: [],
  planUrls: {},
  checklists: {},
  checklistItems: {},
  checklistCategories: {},
  checklistItemAssignees: {},
  checklistItemUserChecks: {},
  members: {},
  shares: {},
  invitationLinks: {},
  assets: {},
  tombstones: {},
  meta: {
    createdFromLegacyAt: '2026-06-29T00:00:00.000Z',
  },
} satisfies TripDocumentV1
