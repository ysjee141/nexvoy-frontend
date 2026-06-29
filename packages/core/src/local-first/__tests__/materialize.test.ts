import type { TripDocumentV1 } from '../documentModel'
import {
  estimateDocumentSizeBytes,
  getChecklistItemStatusFromDocument,
  materializeChecklists,
  materializePlanTimeline,
  materializeTripDetail,
} from '../materialize'
import { convertLegacyTripRowsToDocument, type LegacyTripRowBundle } from '../migrations'

const legacyBundle = {
  exportedAt: '2026-06-29T00:00:00.000Z',
  trip: {
    id: 'trip-1',
    user_id: 'user-1',
    destination: 'Seoul',
    start_date: '2026-07-01',
    end_date: '2026-07-03',
    adults_count: 2,
    children_count: 0,
    cover_image_ref: 'trips/user-1/trip-1/cover.jpg',
    bg_color: '#2563EB',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-02T00:00:00.000Z',
  },
  plans: [
    {
      id: 'plan-2',
      trip_id: 'trip-1',
      title: 'Dinner',
      location: 'Restaurant',
      address: 'Seoul',
      location_lat: 37.5,
      location_lng: 127,
      google_place_id: 'place-2',
      image_url: null,
      photo_reference: 'photo-2',
      start_datetime_local: '2026-07-01T18:00:00',
      end_datetime_local: '2026-07-01T19:00:00',
      timezone_string: 'Asia/Seoul',
      alarm_minutes_before: 30,
      alarm_sent_at: null,
      cost: 30000,
      memo: null,
      is_completed: false,
      is_visited: false,
      created_at: '2026-06-02T00:00:00.000Z',
      updated_at: '2026-06-02T00:00:00.000Z',
    },
    {
      id: 'plan-1',
      trip_id: 'trip-1',
      title: 'Airport',
      location: 'ICN',
      address: 'Incheon',
      location_lat: null,
      location_lng: null,
      google_place_id: null,
      image_url: null,
      photo_reference: null,
      start_datetime_local: '2026-07-01T09:00:00',
      end_datetime_local: '2026-07-01T10:00:00',
      timezone_string: 'Asia/Seoul',
      alarm_minutes_before: null,
      alarm_sent_at: null,
      cost: null,
      memo: 'Arrive early',
      is_completed: false,
      is_visited: false,
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    },
  ],
  planUrls: [
    {
      id: 'plan-url-1',
      plan_id: 'plan-1',
      url: 'https://example.com',
      created_at: '2026-06-01T00:00:00.000Z',
    },
  ],
  checklists: [
    {
      id: 'checklist-1',
      trip_id: 'trip-1',
      title: 'Packing',
      created_at: '2026-06-01T00:00:00.000Z',
    },
  ],
  checklistItems: [
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
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    },
    {
      id: 'item-2',
      checklist_id: 'checklist-1',
      item_name: 'Team ticket',
      category: 'Documents',
      is_checked: false,
      is_private: false,
      assignment_type: 'everyone',
      assigned_user_id: null,
      source_template_name: null,
      created_at: '2026-06-02T00:00:00.000Z',
      updated_at: '2026-06-02T00:00:00.000Z',
    },
    {
      id: 'item-3',
      checklist_id: 'checklist-1',
      item_name: 'Hidden item',
      category: 'Documents',
      is_checked: false,
      is_private: false,
      assignment_type: 'anyone',
      assigned_user_id: null,
      source_template_name: null,
      created_at: '2026-06-03T00:00:00.000Z',
      updated_at: '2026-06-03T00:00:00.000Z',
    },
  ],
  checklistItemAssignees: [],
  checklistItemUserChecks: [
    {
      id: 'user-check-1',
      item_id: 'item-2',
      user_id: 'user-1',
      created_at: '2026-06-01T00:00:00.000Z',
    },
    {
      id: 'user-check-2',
      item_id: 'item-2',
      user_id: 'user-2',
      created_at: '2026-06-01T00:01:00.000Z',
    },
  ],
  members: [
    {
      id: 'member-1',
      trip_id: 'trip-1',
      user_id: 'user-1',
      invited_email: null,
      role: 'owner',
      status: 'accepted',
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
      profiles: {
        nickname: 'Owner',
        email: 'owner@example.com',
      },
    },
    {
      id: 'member-2',
      trip_id: 'trip-1',
      user_id: 'user-2',
      invited_email: null,
      role: 'editor',
      status: 'accepted',
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
      profiles: {
        nickname: 'Editor',
        email: 'editor@example.com',
      },
    },
  ],
} satisfies LegacyTripRowBundle

let now = 100
const result = convertLegacyTripRowsToDocument(legacyBundle)
const document = {
  ...result.document,
  tombstones: {
    tombstone_item_3: {
      id: 'tombstone_item_3',
      entityType: 'checklistItem',
      entityId: 'item-3',
      deletedBy: 'user-1',
      deletedAt: '2026-06-04T00:00:00.000Z',
    },
    tombstone_plan_2: {
      id: 'tombstone_plan_2',
      entityType: 'plan',
      entityId: 'plan-2',
      deletedBy: 'user-1',
      deletedAt: '2026-06-04T00:00:00.000Z',
    },
    tombstone_member_2: {
      id: 'tombstone_member_2',
      entityType: 'member',
      entityId: 'member-2',
      deletedBy: 'user-1',
      deletedAt: '2026-06-04T00:00:00.000Z',
    },
  },
} satisfies TripDocumentV1

const detail = materializeTripDetail(document, {
  currentUserId: 'user-1',
  now: () => {
    now += 3
    return now
  },
})

if (detail.id !== 'trip-1' || detail.destination !== 'Seoul') {
  throw new Error('Trip detail read model should expose trip summary fields.')
}

if (detail.plans.map((plan) => plan.id).join(',') !== 'plan-1') {
  throw new Error('Plan timeline should follow plan order and hide tombstoned plans.')
}

if (detail.plans[0]?.urls[0]?.url !== 'https://example.com') {
  throw new Error('Plan timeline should retain related plan urls.')
}

if (detail.plans.some((plan) => plan.photoReference === 'photo-2')) {
  throw new Error('Tombstoned plan should not leak Storage photo references into read model.')
}

const checklist = detail.checklists[0]
if (!checklist) {
  throw new Error('Checklist read model should be generated.')
}

if (checklist.items.map((item) => item.id).join(',') !== 'item-1,item-2') {
  throw new Error('Checklist items should be sorted and tombstoned items hidden.')
}

if (checklist.totalCount !== 2 || checklist.doneCount !== 2 || checklist.progressPercent !== 100) {
  throw new Error('Checklist progress should match legacy checked semantics.')
}

const everyoneItem = checklist.items.find((item) => item.id === 'item-2')
if (
  !everyoneItem?.status.isChecked ||
  everyoneItem.status.checksCount !== 1 ||
  everyoneItem.status.requiredCount !== 1
) {
  throw new Error('Everyone-assigned checklist state should require all active accepted participants.')
}

if (!everyoneItem.status.isMyChecked || !everyoneItem.status.canCheck) {
  throw new Error('Current user status should be materialized for checklist items.')
}

if (detail.metrics.documentSizeBytes !== estimateDocumentSizeBytes(document)) {
  throw new Error('Materialize metrics should include document byte size.')
}

if (detail.metrics.durationMs !== 3) {
  throw new Error('Materialize metrics should include duration from the provided timer hook.')
}

if (detail.members.map((member) => member.id).join(',') !== 'member-1') {
  throw new Error('Tombstoned members should be hidden from participants and member read model.')
}

const standaloneChecklists = materializeChecklists(document, { currentUserId: 'user-2' })
if (standaloneChecklists[0]?.items[1]?.status.isMyChecked !== true) {
  throw new Error('Checklist materializer should accept current user options independently.')
}

const timeline = materializePlanTimeline(document)
if (timeline.length !== 1 || timeline[0]?.id !== 'plan-1') {
  throw new Error('Plan timeline materializer should be callable independently.')
}

const legacyAnyoneStatus = getChecklistItemStatusFromDocument(
  document.checklistItems['item-1'],
  'guest-user',
  ['user-1', 'user-2'],
)
if (!legacyAnyoneStatus.isChecked || legacyAnyoneStatus.requiredCount !== 1) {
  throw new Error('Standalone status helper should preserve legacy anyone semantics.')
}
