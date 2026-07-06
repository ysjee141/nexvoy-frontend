import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import {
  createLocalFirstObservabilityEvent,
  type LocalNotificationScheduleResult,
  type LocalNotificationScheduler,
  type NotificationPermissionStatus,
  type PlanAlarmScheduleInput,
  type ReconcilePlanAlarmOptions,
} from '@nexvoy/core'
import { logLocalFirstEvent } from '@/lib/observability'

type ExpoNotificationsModule = typeof import('expo-notifications')

type StoredPlanAlarm = {
  planId: string
  tripId: string
  documentId: string
  notificationId: string
  scheduledAt: string
}

const STORAGE_KEY = '@onvoy/local-notifications/v1'
const LOCAL_NOTIFICATION_TITLE = '일정 시간이 다가오고 있어요'
const LOCAL_NOTIFICATION_BODY = 'OnVoy에서 여행 일정을 확인해 주세요.'

let notificationsModulePromise: Promise<ExpoNotificationsModule | null> | null = null
let notificationHandlerConfigured = false

async function loadNotificationsModule(): Promise<ExpoNotificationsModule | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications')
      .then((module) => {
        if (!notificationHandlerConfigured) {
          module.setNotificationHandler({
            handleNotification: async () => ({
              shouldPlaySound: true,
              shouldSetBadge: false,
              shouldShowBanner: true,
              shouldShowList: true,
            }),
          })
          notificationHandlerConfigured = true
        }
        return module
      })
      .catch(() => null)
  }
  return notificationsModulePromise
}

async function readStore(): Promise<Record<string, StoredPlanAlarm>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, StoredPlanAlarm>
  } catch {
    return {}
  }
}

async function writeStore(store: Record<string, StoredPlanAlarm>) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function normalizePermission(status: string | undefined): NotificationPermissionStatus {
  if (status === 'granted') return 'granted'
  if (status === 'denied') return 'denied'
  return 'undetermined'
}

function planAlarmDate(input: PlanAlarmScheduleInput): Date | null {
  const startDate = zonedLocalDateTimeToDate(
    input.startDateTimeLocal,
    input.timezoneString || 'Asia/Seoul',
  )
  if (!startDate) return null
  const alarmMinutes = Math.max(0, Math.floor(input.alarmMinutesBefore ?? 0))
  return new Date(startDate.getTime() - alarmMinutes * 60_000)
}

function zonedLocalDateTimeToDate(dateTime: string, timeZone: string): Date | null {
  const match = dateTime
    .trim()
    .replace('T', ' ')
    .match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null

  const [, year, month, day, hour, minute, second = '00'] = match
  const localIso = `${year}-${month}-${day}T${hour.padStart(2, '0')}:${minute}:${second.padStart(2, '0')}`
  const fakeUtc = new Date(`${localIso}Z`)
  if (!Number.isFinite(fakeUtc.getTime())) return null

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(fakeUtc)
    const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '00'
    const asTimeZone = new Date(
      `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}Z`,
    )
    const offsetMs = fakeUtc.getTime() - asTimeZone.getTime()
    return new Date(fakeUtc.getTime() + offsetMs)
  } catch {
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    )
  }
}

async function emitScheduleEvent(
  name: 'local_notification_scheduled' | 'local_notification_cancelled' | 'local_notification_schedule_failed',
  status: 'completed' | 'failed' | 'skipped',
  reasonCode?: string,
) {
  await logLocalFirstEvent(name, {
    provider: 'local',
    entity_type: 'plan',
    status,
    reason_code: reasonCode,
  })
}

async function cancelStoredNotification(
  Notifications: ExpoNotificationsModule,
  store: Record<string, StoredPlanAlarm>,
  planId: string,
): Promise<boolean> {
  const current = store[planId]
  if (!current) return false
  try {
    await Notifications.cancelScheduledNotificationAsync(current.notificationId)
  } finally {
    delete store[planId]
  }
  return true
}

export const localNotificationScheduler: LocalNotificationScheduler = {
  async getPermissionStatus() {
    const Notifications = await loadNotificationsModule()
    if (!Notifications) return 'unsupported'
    const permission = await Notifications.getPermissionsAsync()
    return normalizePermission(permission.status)
  },

  async requestPermission() {
    const Notifications = await loadNotificationsModule()
    if (!Notifications) return 'unsupported'

    await logLocalFirstEvent('notification_permission_prompt_shown', {
      provider: 'local',
      entity_type: 'plan',
      status: 'started',
    })
    const permission = await Notifications.requestPermissionsAsync()
    const status = normalizePermission(permission.status)
    await logLocalFirstEvent(
      status === 'granted'
        ? 'notification_permission_granted'
        : 'notification_permission_denied',
      {
        provider: 'local',
        entity_type: 'plan',
        status: status === 'granted' ? 'completed' : 'failed',
      },
    )
    return status
  },

  async schedulePlanAlarm(input) {
    const Notifications = await loadNotificationsModule()
    if (!Notifications) return { status: 'unsupported', reason: 'unsupported_platform' }

    const triggerDate = planAlarmDate(input)
    if (!triggerDate) {
      await emitScheduleEvent('local_notification_schedule_failed', 'failed', 'invalid_plan_time')
      return { status: 'failed', reason: 'invalid_plan_time' }
    }
    if (triggerDate.getTime() <= Date.now()) {
      const cancelled = await this.cancelPlanAlarm(input.planId)
      await emitScheduleEvent('local_notification_cancelled', 'skipped', 'past_alarm')
      return { status: cancelled.status === 'failed' ? 'failed' : 'skipped', reason: 'past_alarm' }
    }

    const store = await readStore()
    await cancelStoredNotification(Notifications, store, input.planId)

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: LOCAL_NOTIFICATION_TITLE,
          body: LOCAL_NOTIFICATION_BODY,
          data: {
            trip_id: input.tripId,
            document_id: input.documentId ?? input.tripId,
            plan_id: input.planId,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      })

      store[input.planId] = {
        planId: input.planId,
        tripId: input.tripId,
        documentId: input.documentId ?? input.tripId,
        notificationId,
        scheduledAt: triggerDate.toISOString(),
      }
      await writeStore(store)
      await emitScheduleEvent('local_notification_scheduled', 'completed')
      return { status: 'scheduled', notificationId }
    } catch {
      await emitScheduleEvent('local_notification_schedule_failed', 'failed', 'schedule_error')
      return { status: 'failed', reason: 'schedule_error' }
    }
  },

  async cancelPlanAlarm(planId) {
    const Notifications = await loadNotificationsModule()
    if (!Notifications) return { status: 'unsupported', reason: 'unsupported_platform' }

    try {
      const store = await readStore()
      const cancelled = await cancelStoredNotification(Notifications, store, planId)
      await writeStore(store)
      await emitScheduleEvent('local_notification_cancelled', cancelled ? 'completed' : 'skipped')
      return { status: cancelled ? 'cancelled' : 'skipped' }
    } catch {
      await emitScheduleEvent('local_notification_schedule_failed', 'failed', 'cancel_error')
      return { status: 'failed', reason: 'cancel_error' }
    }
  },

  async cancelDocumentAlarms(documentId) {
    const Notifications = await loadNotificationsModule()
    if (!Notifications) return { status: 'unsupported', reason: 'unsupported_platform' }

    try {
      const store = await readStore()
      const planIds = Object.values(store)
        .filter((entry) => entry.documentId === documentId || entry.tripId === documentId)
        .map((entry) => entry.planId)
      for (const planId of planIds) {
        await cancelStoredNotification(Notifications, store, planId)
      }
      await writeStore(store)
      await emitScheduleEvent('local_notification_cancelled', planIds.length > 0 ? 'completed' : 'skipped')
      return { status: planIds.length > 0 ? 'cancelled' : 'skipped', reason: 'document_cleanup' }
    } catch {
      await emitScheduleEvent('local_notification_schedule_failed', 'failed', 'document_cancel_error')
      return { status: 'failed', reason: 'document_cancel_error' }
    }
  },

  async cancelAllLocalNotifications() {
    const Notifications = await loadNotificationsModule()
    if (!Notifications) return { status: 'unsupported', reason: 'unsupported_platform' }

    try {
      await Notifications.cancelAllScheduledNotificationsAsync()
      await writeStore({})
      await emitScheduleEvent('local_notification_cancelled', 'completed')
      return { status: 'cancelled', reason: 'account_cleanup' }
    } catch {
      await emitScheduleEvent('local_notification_schedule_failed', 'failed', 'cancel_all_error')
      return { status: 'failed', reason: 'cancel_all_error' }
    }
  },

  async reconcilePlanAlarm(
    input: PlanAlarmScheduleInput,
    options: ReconcilePlanAlarmOptions = {},
  ) {
    const alarmMinutes = Math.max(0, Math.floor(input.alarmMinutesBefore ?? 0))
    if (alarmMinutes <= 0) {
      return this.cancelPlanAlarm(input.planId)
    }

    const currentPermissionStatus = await this.getPermissionStatus()
    const permissionStatus = options.requestPermission && currentPermissionStatus === 'undetermined'
      ? await this.requestPermission()
      : currentPermissionStatus
    if (permissionStatus !== 'granted') {
      return {
        status: permissionStatus === 'unsupported' ? 'unsupported' : 'permission_required',
        reason: permissionStatus,
      }
    }

    return this.schedulePlanAlarm({
      ...input,
      alarmMinutesBefore: alarmMinutes,
    })
  },
}

export function createSafeLocalNotificationEvent(
  name: 'local_notification_scheduled' | 'local_notification_cancelled' | 'local_notification_schedule_failed',
  status: 'completed' | 'failed' | 'skipped',
  reasonCode?: string,
) {
  return createLocalFirstObservabilityEvent(name, {
    provider: 'local',
    entity_type: 'plan',
    status,
    reason_code: reasonCode,
  })
}
