import type {
  Checklist,
  ChecklistItem,
  ChecklistItemAssignee,
  ChecklistItemUserCheck,
  ChecklistTemplateItem,
  ChecklistTemplateShareWithProfile,
  ChecklistTemplateWithAccess,
  Plan,
  PlanUrl,
  TemplateWithPreview,
  Trip,
  TripMember,
} from '@nexvoy/types'
import type {
  ChecklistItemReadModel,
  ChecklistReadModel,
  PlanTimelineItemReadModel,
  TemplateDetailReadModel,
  TemplateSummaryReadModel,
  TripDetailReadModel,
  TripMemberReadModel,
  TripSummaryReadModel,
} from '@nexvoy/core'

export type MobilePlanWithUrls = Plan & { plan_urls: PlanUrl[] }

export function toTripRow(readModel: TripDetailReadModel | TripSummaryReadModel): Trip {
  return {
    id: readModel.id,
    user_id: readModel.ownerId,
    destination: readModel.destination,
    start_date: readModel.startDate,
    end_date: readModel.endDate,
    adults_count: readModel.adultsCount,
    children_count: readModel.childrenCount,
    created_at: readModel.updatedAt,
    updated_at: readModel.updatedAt,
  }
}

export function toPlanRows(readModels: PlanTimelineItemReadModel[], tripId: string): MobilePlanWithUrls[] {
  return readModels.map((plan) => toPlanRow(plan, tripId))
}

export function toPlanRow(plan: PlanTimelineItemReadModel, tripId: string): MobilePlanWithUrls {
  return {
    id: plan.id,
    trip_id: tripId,
    title: plan.title,
    location: plan.location,
    address: plan.address,
    lat: plan.coordinates?.lat ?? null,
    lng: plan.coordinates?.lng ?? null,
    location_lat: plan.coordinates?.lat ?? null,
    location_lng: plan.coordinates?.lng ?? null,
    visit_date: plan.startDateTimeLocal.slice(0, 10),
    visit_time: parseTimePart(plan.startDateTimeLocal),
    start_datetime_local: plan.startDateTimeLocal,
    end_datetime_local: plan.endDateTimeLocal,
    timezone_string: plan.timezone,
    alarm_minutes_before: plan.alarmMinutesBefore,
    alarm_sent_at: plan.alarmSentAt,
    cost: plan.cost,
    memo: plan.memo,
    image_url: plan.imageUrl,
    photo_reference: plan.photoReference,
    google_place_id: plan.googlePlaceId,
    is_completed: plan.isCompleted,
    is_visited: plan.isVisited,
    created_at: plan.startDateTimeLocal,
    updated_at: plan.startDateTimeLocal,
    plan_urls: plan.urls.map((url) => ({
      id: url.id,
      plan_id: url.planId,
      url: url.url,
      created_at: url.createdAt,
    })),
  }
}

export function toChecklistSnapshotRows(
  checklists: ChecklistReadModel[],
  tripId: string,
): {
  checklist: Checklist | null
  items: ChecklistItem[]
  itemAssignees: ChecklistItemAssignee[]
  userChecks: ChecklistItemUserCheck[]
} {
  const firstChecklist = checklists[0] ?? null
  return {
    checklist: firstChecklist
      ? {
        id: firstChecklist.id,
        trip_id: tripId,
        title: firstChecklist.title,
        created_at: firstChecklist.createdAt,
      }
      : null,
    items: checklists.flatMap((checklist) => checklist.items.map(toChecklistItemRow)),
    itemAssignees: checklists.flatMap((checklist) =>
      checklist.items.flatMap((item) => item.assignees.map(toAssigneeRow)),
    ),
    userChecks: checklists.flatMap((checklist) =>
      checklist.items.flatMap((item) => item.userChecks.map(toUserCheckRow)),
    ),
  }
}

export function toTripMemberRows(members: TripMemberReadModel[], tripId: string): TripMember[] {
  return members
    .filter((member) => member.status !== 'revoked')
    .map((member) => ({
      id: member.id,
      trip_id: tripId,
      user_id: member.userId,
      invited_email: member.invitedEmail ?? member.email ?? '',
      role: member.role,
      status: member.status === 'pending' ? 'pending' : 'accepted',
      created_at: '',
      profiles: {
        nickname: member.nickname,
        email: member.email,
      },
    }))
}

export function toTemplatePreviewRow(
  template: TemplateSummaryReadModel,
  currentUserId: string | null | undefined,
): TemplateWithPreview {
  return {
    id: template.id,
    title: template.title,
    user_id: template.ownerId,
    item_count: template.itemCount,
    preview_items: template.previewItems,
    created_at: template.updatedAt,
    access: template.ownerId === currentUserId
      ? 'owner'
      : template.ownerId === null || template.visibility === 'public'
        ? 'default'
        : 'viewer',
  }
}

export function toTemplateWithAccessRow(
  template: TemplateDetailReadModel,
  currentUserId: string | null | undefined,
): ChecklistTemplateWithAccess {
  const access = template.ownerId === currentUserId
    ? 'owner'
    : template.ownerId === null || template.visibility === 'public'
      ? 'default'
      : 'viewer'

  return {
    id: template.id,
    title: template.title,
    user_id: template.ownerId,
    created_at: template.updatedAt,
    access,
    share_role: access === 'viewer' ? 'viewer' : null,
  }
}

export function toTemplateItemRows(template: TemplateDetailReadModel): ChecklistTemplateItem[] {
  return template.items.map((item) => ({
    id: item.id,
    template_id: item.templateId,
    item_name: item.name,
    category: item.categoryName,
    is_private: item.isPrivate,
    created_at: item.createdAt,
  }))
}

export function toTemplateShareRows(template: TemplateDetailReadModel): ChecklistTemplateShareWithProfile[] {
  return template.shares.map((share) => ({
    id: share.id,
    template_id: share.templateId,
    shared_with_user_id: share.sharedWithUserId,
    role: share.role,
    created_by: share.createdBy,
    created_at: share.createdAt,
    profiles: null,
  }))
}

function toChecklistItemRow(item: ChecklistItemReadModel): ChecklistItem {
  return {
    id: item.id,
    checklist_id: item.checklistId,
    item_name: item.name,
    category: item.categoryName,
    is_checked: item.status.isChecked,
    is_private: item.isPrivate,
    assignment_type: item.assignmentType,
    assigned_user_id: item.assignedUserId,
    source_template_name: item.sourceTemplateName,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }
}

function toAssigneeRow(assignee: ChecklistItemReadModel['assignees'][number]): ChecklistItemAssignee {
  return {
    id: assignee.id,
    item_id: assignee.itemId,
    user_id: assignee.userId,
    created_at: assignee.createdAt,
  }
}

function toUserCheckRow(check: ChecklistItemReadModel['userChecks'][number]): ChecklistItemUserCheck {
  return {
    id: check.id,
    item_id: check.itemId,
    user_id: check.userId,
    created_at: check.createdAt,
  }
}

function parseTimePart(dateTime: string): string | null {
  return dateTime.match(/[T\s](\d{1,2}:\d{2})/)?.[1] ?? null
}
