import type {
  PlanTimelineItemReadModel,
  TripDetailReadModel,
  TripSummaryReadModel,
} from '@nexvoy/core/local-first/materialize'

export interface WebTripRowLike {
  id: string
  destination: string
  start_date: string
  end_date: string
  adults_count: number
  children_count: number
  user_id: string
  checklists?: { checklist_items: { is_checked: boolean }[] }[]
}

export interface WebTripMemberRowLike {
  id: string
  user_id: string | null
  invited_email: string | null
  role: 'owner' | 'editor' | 'viewer'
  status: 'pending' | 'accepted' | 'revoked'
  profiles?: {
    nickname: string | null
    email: string | null
  } | null
}

export function tripSummaryToWebTripRow(summary: TripSummaryReadModel): WebTripRowLike {
  return {
    id: summary.id,
    destination: summary.destination,
    start_date: summary.startDate,
    end_date: summary.endDate,
    adults_count: summary.adultsCount,
    children_count: summary.childrenCount,
    user_id: summary.ownerId,
    checklists: [{
      checklist_items: createChecklistProgressItems(summary.checklistTotalCount, summary.checklistDoneCount),
    }],
  }
}

export function tripDetailToWebTripRow(detail: TripDetailReadModel): WebTripRowLike {
  return {
    id: detail.id,
    destination: detail.destination,
    start_date: detail.startDate,
    end_date: detail.endDate,
    adults_count: detail.adultsCount,
    children_count: detail.childrenCount,
    user_id: detail.ownerId,
    checklists: [{
      checklist_items: createChecklistProgressItems(detail.checklistTotalCount, detail.checklistDoneCount),
    }],
  }
}

export function tripDetailToWebMemberRows(detail: TripDetailReadModel): WebTripMemberRowLike[] {
  return detail.members.map((member) => ({
    id: member.id,
    user_id: member.userId,
    invited_email: member.invitedEmail,
    role: member.role,
    status: member.status,
    profiles: {
      nickname: member.nickname,
      email: member.email,
    },
  }))
}

export function planTimelineItemToWebPlanRow(
  tripId: string,
  plan: PlanTimelineItemReadModel,
): Record<string, unknown> {
  return {
    id: plan.id,
    trip_id: tripId,
    title: plan.title,
    location: plan.location,
    address: plan.address,
    location_lat: plan.coordinates?.lat ?? null,
    location_lng: plan.coordinates?.lng ?? null,
    google_place_id: plan.googlePlaceId,
    image_url: plan.imageUrl,
    photo_reference: plan.photoReference,
    start_datetime_local: plan.startDateTimeLocal,
    end_datetime_local: plan.endDateTimeLocal,
    timezone_string: plan.timezone,
    alarm_minutes_before: plan.alarmMinutesBefore,
    alarm_sent_at: plan.alarmSentAt,
    cost: plan.cost,
    memo: plan.memo,
    is_completed: plan.isCompleted,
    is_visited: plan.isVisited,
    plan_urls: plan.urls,
  }
}

function createChecklistProgressItems(totalCount: number, doneCount: number): { is_checked: boolean }[] {
  return Array.from({ length: totalCount }, (_, index) => ({
    is_checked: index < doneCount,
  }))
}
