import type { ObservabilityEvent } from '../observability/events'

export type NotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unsupported'

export type LocalNotificationScheduleStatus =
  | 'scheduled'
  | 'cancelled'
  | 'skipped'
  | 'permission_required'
  | 'unsupported'
  | 'failed'

export interface PlanAlarmScheduleInput {
  tripId: string
  documentId?: string | null
  planId: string
  startDateTimeLocal: string
  timezoneString?: string | null
  alarmMinutesBefore?: number | null
}

export interface LocalNotificationScheduleResult {
  status: LocalNotificationScheduleStatus
  notificationId?: string
  reason?: string
}

export interface ReconcilePlanAlarmOptions {
  requestPermission?: boolean
}

export interface LocalNotificationScheduler {
  getPermissionStatus(): Promise<NotificationPermissionStatus>
  requestPermission(): Promise<NotificationPermissionStatus>
  schedulePlanAlarm(input: PlanAlarmScheduleInput): Promise<LocalNotificationScheduleResult>
  cancelPlanAlarm(planId: string): Promise<LocalNotificationScheduleResult>
  cancelDocumentAlarms(documentId: string): Promise<LocalNotificationScheduleResult>
  cancelAllLocalNotifications(): Promise<LocalNotificationScheduleResult>
  reconcilePlanAlarm(
    input: PlanAlarmScheduleInput,
    options?: ReconcilePlanAlarmOptions,
  ): Promise<LocalNotificationScheduleResult>
}

export type LocalNotificationObservabilitySink = (
  event: ObservabilityEvent,
) => void | Promise<void>
