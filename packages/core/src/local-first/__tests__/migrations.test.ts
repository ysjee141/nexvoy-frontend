import type { TripDocumentV1 } from '../documentModel'
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
      photo_reference: null,
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
      id: 'item-orphan',
      checklist_id: 'missing-checklist',
      item_name: 'Skipped',
      category: null,
      is_checked: false,
      is_private: false,
      assignment_type: 'specific',
      assigned_user_id: 'user-1',
      source_template_name: null,
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    },
  ],
  checklistCategories: [
    {
      id: 'category-1',
      user_id: 'user-1',
      name: 'Documents',
      sort_order: 1,
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    },
  ],
  checklistItemAssignees: [
    {
      id: 'assignee-1',
      item_id: 'item-1',
      user_id: 'user-1',
      created_at: '2026-06-01T00:00:00.000Z',
    },
  ],
  checklistItemUserChecks: [
    {
      id: 'user-check-1',
      item_id: 'item-1',
      user_id: 'user-1',
      created_at: '2026-06-01T00:00:00.000Z',
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
  ],
  shares: [
    {
      id: 'share-1',
      trip_id: 'trip-1',
      share_token: 'share-token',
      share_type: 'public',
      password_hash: null,
      expires_at: null,
      created_at: '2026-06-01T00:00:00.000Z',
      revoked_at: null,
    },
  ],
  invitationLinks: [
    {
      id: 'invite-1',
      trip_id: 'trip-1',
      token: 'invite-token',
      invite_code: 'ABCD12',
      role: 'editor',
      expires_at: null,
      max_uses: 5,
      used_count: 1,
      revoked_at: null,
      created_by: 'user-1',
      created_at: '2026-06-01T00:00:00.000Z',
    },
  ],
  assets: [
    {
      id: 'asset-1',
      storage_path: 'trips/user-1/trip-1/cover.jpg',
      bucket: 'trips',
      content_type: 'image/jpeg',
      owner_id: 'user-1',
      created_at: '2026-06-01T00:00:00.000Z',
    },
  ],
} satisfies LegacyTripRowBundle

const migrationResult = convertLegacyTripRowsToDocument(legacyBundle)
const document = migrationResult.document satisfies TripDocumentV1

if (document.trip.id !== legacyBundle.trip.id) {
  throw new Error('Trip id should be preserved as document id.')
}

if (document.planOrder.join(',') !== 'plan-1,plan-2') {
  throw new Error('Plan order should be sorted by start time, created time, then id.')
}

if (!document.checklistItems['item-1']?.legacyIsChecked) {
  throw new Error('Legacy checklist checked state should be preserved.')
}

if (document.checklistItems['item-orphan']) {
  throw new Error('Orphan checklist item should be skipped.')
}

if (!migrationResult.legacyRowMap.some((row) => row.pathInDocument === 'checklistItems.item-1')) {
  throw new Error('Checklist item mapping should be emitted.')
}

if (!migrationResult.validationMessages.some((message) => message.code === 'orphan_checklist_item')) {
  throw new Error('Orphan checklist item should produce a validation warning.')
}
