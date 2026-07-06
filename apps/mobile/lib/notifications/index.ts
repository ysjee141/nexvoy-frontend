import { Platform } from 'react-native'
import { localNotificationScheduler } from './localNotificationScheduler'
import { noopNotificationScheduler } from './noopNotificationScheduler'

const notificationScheduler =
  Platform.OS === 'ios' || Platform.OS === 'android'
    ? localNotificationScheduler
    : noopNotificationScheduler

export const getPermissionStatus = notificationScheduler.getPermissionStatus.bind(notificationScheduler)
export const requestPermission = notificationScheduler.requestPermission.bind(notificationScheduler)
export const schedulePlanAlarm = notificationScheduler.schedulePlanAlarm.bind(notificationScheduler)
export const cancelPlanAlarm = notificationScheduler.cancelPlanAlarm.bind(notificationScheduler)
export const cancelDocumentAlarms = notificationScheduler.cancelDocumentAlarms.bind(notificationScheduler)
export const cancelAllLocalNotifications = notificationScheduler.cancelAllLocalNotifications.bind(notificationScheduler)
export const reconcilePlanAlarm = notificationScheduler.reconcilePlanAlarm.bind(notificationScheduler)
export { notificationScheduler }
export type {
  LocalNotificationScheduleResult,
  LocalNotificationScheduleStatus,
  NotificationPermissionStatus,
  PlanAlarmScheduleInput,
} from '@nexvoy/core'
