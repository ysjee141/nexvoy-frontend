import { PushNotifications } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'
import { createClient } from '@/utils/supabase/client'
import { Capacitor } from '@capacitor/core'

/**
 * 모바일 알림 (Push & Local) 중앙 제어 서비스
 */
export const NotificationService = {
    _token: null as string | null,
    /**
     * 알림 권한을 요청하고 승인시 Push Token을 백엔드에 등록합니다.
     */
    async initialize() {
        if (!Capacitor.isNativePlatform()) {
            console.log("Not a native platform, skipping notification init.")
            return
        }

        console.log('--- Notification Initialization Started ---');

        try {
            // 1. 푸시 알림 권한 요청
            let permStatus = await PushNotifications.checkPermissions()
            console.log('Initial permission status:', JSON.stringify(permStatus));

            if (permStatus.receive === 'prompt') {
                console.log('Requesting permissions...');
                permStatus = await PushNotifications.requestPermissions()
                console.log('Permission request result:', JSON.stringify(permStatus));
            }

            if (permStatus.receive !== 'granted') {
                console.warn('Permission not granted. Current status:', permStatus.receive);
                return;
            }

            // 2. 권한 승인 시 Native OS에 푸시 토큰 등록 요청 (APNs / FCM)
            try {
                console.log('Calling PushNotifications.register()...');
                await PushNotifications.register()
                
                // 3. 리스너 등록
                console.log('Registering listeners...');
                await this.registerListeners()

                // 4. 인증 상태 변경 감지 후 토큰 동기화
                this.setupAuthChangeListener()
            } catch (regError) {
                console.error('PushNotifications.register() failed:', regError);
            }
        } catch (error) {
            console.error('Critical failure in notification init:', error);
        }
    },

    /**
     * 인증 상태가 바뀔 때(로그인 시) 보관 중인 토큰이 있다면 DB에 동기화합니다.
     */
    setupAuthChangeListener() {
        const supabase = createClient()
        supabase.auth.onAuthStateChange(async (event: string, session: any) => {
            console.log(`Auth state changed: ${event}`)
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user && this._token) {
                await this.syncToken(session.user.id, this._token)
            }
        })
    },

    async syncToken(userId: string, fcmToken: string) {
        const supabase = createClient()
        console.log(`Syncing token for user ${userId}...`)
        const { error } = await supabase.from('user_devices').upsert({
            user_id: userId,
            fcm_token: fcmToken,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'fcm_token' })

        if (error) {
            console.error('Failed to sync push token to Supabase:', error)
        } else {
            console.log('Push token synced to Supabase successfully.')
        }
    },

    async registerListeners() {
        console.log('Adding Push Notification listeners...');
        // 토큰 발급 완료
        PushNotifications.addListener('registration', async (token) => {
            console.log('✅ Push registration successful. Token:', token.value);
            this._token = token.value // 토큰 보관
            
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                console.log('Session found during registration. Syncing...');
                await this.syncToken(session.user.id, token.value)
            } else {
                console.log('No session found yet. Token stored, waiting for login.');
            }
        })

        // 토큰 발급 에러
        PushNotifications.addListener('registrationError', (error: any) => {
            console.error('❌ Registration Error:', JSON.stringify(error));
        })

        // Foreground에서 실제 알림 수신 시
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('🔔 Push notification received:', JSON.stringify(notification));
        })

        // 백그라운드나 배너에서 사용자가 알림 탭 시 (라우팅 등)
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('Push action performed: ' + JSON.stringify(notification))
            this.handleNotificationAction(notification);
        })

        // Cold Start: 앱이 꺼진 상태에서 알림을 눌러 들어온 경우를 위해 지연된 처리 확인
        // (Capacitor는 보통 리스너 등록 시점에 마지막 액션을 다시 쏴주지만, 확실히 하기 위해 추가 가능)
    },

    handleNotificationAction(notification: any) {
        const data = notification.notification?.data || notification.data;
        console.log('Handling notification action with data:', JSON.stringify(data));
        
        if (data?.tripId) {
            console.log('Deep linking to trip:', data.tripId);
            const url = `/trips/detail?id=${data.tripId}`;
            
            // Next.js 라우팅이 완전히 준비되지 않았을 수 있으므로 약간의 지연 후 이동하거나
            // window.location.href 사용
            if (window.location.pathname + window.location.search === url) {
                console.log('Already on target page, skipping navigation.');
                return;
            }
            
            window.location.href = url;
        }
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
    },

    /**
     * [체크리스트 리마인더] 여행 출발 1일 전 오전 10시에 남은 준비물을 알림으로 예약합니다.
     */
    async scheduleChecklistReminder(tripId: string, tripTitle: string, startDate: string, pendingItemsCount: number) {
        if (!Capacitor.isNativePlatform() || pendingItemsCount <= 0) return

        try {
            const start = new Date(startDate)
            // 출발 1일 전 오전 10시 (KST 기준이지만 Date 객체로 계산)
            const reminderTime = new Date(start.getTime() - 24 * 60 * 60 * 1000)
            reminderTime.setHours(10, 0, 0, 0)

            const now = new Date()
            if (reminderTime <= now) {
                console.log('Checklist reminder time already passed or too close.')
                return
            }

            const notificationId = this.hashCode(`checklist_${tripId}`)
            
            // 기존 동일 여행의 체크리스트 알림 취소 후 재등록
            await LocalNotifications.cancel({ notifications: [{ id: notificationId }] })

            await LocalNotifications.schedule({
                notifications: [{
                    id: notificationId,
                    title: '짐은 다 챙기셨나요?',
                    body: `'${tripTitle}' 여행 출발까지 1일 전입니다. 아직 챙기지 않은 준비물이 ${pendingItemsCount}개 있어요!`,
                    schedule: { at: reminderTime },
                    sound: "default",
                    extra: {
                        tripId: tripId,
                        type: 'checklist'
                    }
                }]
            })
            console.log(`Scheduled checklist reminder for ${tripTitle} at ${reminderTime.toLocaleString()}`)
        } catch (e) {
            console.error('Failed to schedule checklist reminder:', e)
        }
    }
}
