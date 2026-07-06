import type {
  LocalNotificationScheduleResult,
  LocalNotificationScheduler,
  NotificationPermissionStatus,
  PlanAlarmScheduleInput,
  ReconcilePlanAlarmOptions,
} from '@nexvoy/core'

const unsupportedResult: LocalNotificationScheduleResult = {
  status: 'unsupported',
  reason: 'unsupported_platform',
}

export const noopNotificationScheduler: LocalNotificationScheduler = {
  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    return 'unsupported'
  },
  async requestPermission(): Promise<NotificationPermissionStatus> {
    return 'unsupported'
  },
  async schedulePlanAlarm(_input: PlanAlarmScheduleInput) {
    return unsupportedResult
  },
  async cancelPlanAlarm(_planId: string) {
    return unsupportedResult
  },
  async cancelDocumentAlarms(_documentId: string) {
    return unsupportedResult
  },
  async cancelAllLocalNotifications() {
    return unsupportedResult
  },
  async reconcilePlanAlarm(
    _input: PlanAlarmScheduleInput,
    _options?: ReconcilePlanAlarmOptions,
  ) {
    return unsupportedResult
  },
}
