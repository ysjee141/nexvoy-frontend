import { PushNotifications } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'
import { createClient } from '@/utils/supabase/client'
import { Capacitor } from '@capacitor/core'

/**
 * 모바일 알림 (Push & Local) 중앙 제어 서비스
 */
export const NotificationService = {
    /**
     * 알림 권한을 요청하고 승인시 Push Token을 백엔드에 등록합니다.
     */
    async initialize() {
        if (!Capacitor.isNativePlatform()) {
            console.log("Not a native platform, skipping notification init.")
            return
        }

        try {
            // 1. 푸시 알림 권한 요청
            let permStatus = await PushNotifications.checkPermissions()

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions()
            }

            if (permStatus.receive !== 'granted') {
                throw new Error('User denied permissions!')
            }

            // 2. 권한 승인 시 Native OS에 푸시 토큰 등록 요청 (APNs / FCM)
            try {
                await PushNotifications.register()
                
                // 3. 리스너 등록
                await this.registerListeners()
            } catch (regError) {
                console.warn('PushNotifications.register() failed. This usually means google-services.json is missing on Android, or Push Capability is missing on iOS:', regError)
            }
        } catch (error) {
            console.warn('Failed to initialize notifications:', error)
        }
    },

    async registerListeners() {
        // 토큰 발급 완료
        PushNotifications.addListener('registration', async (token) => {
            console.log('Push registration success, token: ' + token.value)
            // TODO: supabase에 user_id 와 token.value 저장
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                // 기기 토큰 upsert (중복 발급 시 updated_at만 갱신)
                const { error } = await supabase.from('user_devices').upsert({
                    user_id: session.user.id,
                    fcm_token: token.value,
                    platform: Capacitor.getPlatform(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'fcm_token' })

                if (error) {
                    console.error('Failed to sync push token to Supabase:', error)
                } else {
                    console.log('Push token synced to Supabase successfully.')
                }
            }
        })

        // 토큰 발급 에러
        PushNotifications.addListener('registrationError', (error: any) => {
            console.error('Error on registration: ' + JSON.stringify(error))
        })

        // Foreground에서 실제 알림 수신 시
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('Push received: ' + JSON.stringify(notification))
            // TODO: 앱 안에서 Toast 띄우기 등 추가 효과
        })

        // 백그라운드나 배너에서 사용자가 알림 탭 시 (라우팅 등)
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('Push action performed: ' + JSON.stringify(notification))
            const data = notification.notification.data
            // 예: data.tripId 가 থাকলে 해당 trip 방으로 이동 (window.location.href='/trips/...')
            if (data?.tripId) {
                window.location.href = `/trips/detail?id=${data.tripId}`
            }
        })
    },

    /**
     * 문자열을 32비트 정수 해시맵으로 변환 (로컬 알림 ID용)
     */
    hashCode(str: string) {
        let hash = 0;
        for (let i = 0, len = str.length; i < len; i++) {
            let chr = str.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash);
    },

    /**
     * [오프라인 리마인더] 일정 배열을 받아서, 다가오는 일정들에 대해 로컬 알림을 OS에 직접 예약합니다.
     */
    async scheduleOfflineReminders(plans: any[]) {
        if (!Capacitor.isNativePlatform()) return

        try {
            // 기존 예약 내역 초기화 (덮어쓰기 위해)
            const pending = await LocalNotifications.getPending()
            if (pending.notifications.length > 0) {
                await LocalNotifications.cancel(pending)
            }

            const now = new Date()
            const notificationsToSchedule = []

            for (let i = 0; i < plans.length; i++) {
                const plan = plans[i]
                // local time string (예: 2024-05-15 14:30:00)을 Date 객체로 파싱
                const planDate = new Date(plan.start_datetime_local.replace(' ', 'T'))

                // 시작 시각 15분 전
                const reminderTime = new Date(planDate.getTime() - 15 * 60 * 1000)

                // 이미 지난 일정이면 무시, 오직 미래의 일정만 예약 (단, 너무 먼 미래 50개 제한 등 최적화 가능)
                if (reminderTime > now) {
                    notificationsToSchedule.push({
                        id: this.hashCode(plan.id),
                        title: '다가오는 넥스보이 일정',
                        body: `15분 뒤 '${plan.title}' 일정이 시작됩니다!`,
                        schedule: { at: reminderTime },
                        sound: "default",
                        smallIcon: "ic_stat_icon_config_sample", // Android 용. 추후 실제 에셋 이름으로 변경 필요
                        extra: {
                            tripId: plan.trip_id
                        }
                    })
                }
            }

            if (notificationsToSchedule.length > 0) {
                await LocalNotifications.schedule({
                    notifications: notificationsToSchedule.slice(0, 60) // OS 별 예약 한도 방어 (예: 60개)
                })
                console.log(`Scheduled ${notificationsToSchedule.length} local offline reminders.`)
            }

        } catch (e) {
            console.error('Failed to schedule offline reminders:', e)
        }
    }
}
