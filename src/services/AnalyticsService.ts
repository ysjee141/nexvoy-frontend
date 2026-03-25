import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics } from '@capacitor-community/firebase-analytics';

/**
 * 서비스 개선을 위한 애널리틱스 이벤트 관리 서비스 (ADR-002)
 */
class AnalyticsService {
    private static instance: AnalyticsService;
    private initialized: boolean = false;

    private constructor() {
        // 싱글톤
    }

    public static getInstance(): AnalyticsService {
        if (!AnalyticsService.instance) {
            AnalyticsService.instance = new AnalyticsService();
        }
        return AnalyticsService.instance;
    }

    /**
     * 초기화 (Native 환경 전용)
     */
    public async init() {
        if (this.initialized) return;
        
        if (Capacitor.isNativePlatform()) {
            try {
                await (FirebaseAnalytics as any).initializeFirebase({});
                this.initialized = true;
                console.log('[Analytics] Firebase initialized');
            } catch (e) {
                console.error('[Analytics] Initialization failed:', e);
            }
        } else {
            console.log('[Analytics] Running in non-native environment (Web/Dev Mode)');
            this.initialized = true; // Web에서도 로그는 찍히도록 초기화 처리
        }
    }

    /**
     * 사용자 ID 설정
     */
    public async setUserId(userId: string) {
        if (Capacitor.isNativePlatform()) {
            await FirebaseAnalytics.setUserId({ userId }).catch(e => console.error(e));
        } else {
            console.log(`[Analytics] Set UserId: ${userId}`);
        }
    }

    /**
     * 화면 이름 설정
     */
    public async setScreenName(screenName: string) {
        if (Capacitor.isNativePlatform()) {
            await FirebaseAnalytics.setScreenName({ screenName }).catch(e => console.error(e));
        } else {
            console.log(`[Analytics] Screen View: ${screenName}`);
        }
    }

    /**
     * 커스텀 이벤트 기록
     */
    public async logEvent(name: string, params: any = {}) {
        if (Capacitor.isNativePlatform()) {
            await FirebaseAnalytics.logEvent({
                name,
                params
            }).catch(e => console.error(`[Analytics] LogEvent Error (${name}):`, e));
        } else {
            console.log(`[Analytics] Event: ${name}`, params);
        }
    }

    // --- 사전 정의된 헬퍼 메서드들 ---

    /** 여행 생성 */
    public logTripCreate(destination: string) {
        this.logEvent('trip_create', { destination });
    }

    /** 일정 추가 */
    public logPlanAdd(category: string, location: string, hasAlarm: boolean) {
        this.logEvent('plan_add', { 
            category, 
            location,
            has_alarm: hasAlarm ? 'true' : 'false' 
        });
    }

    /** 탭 전환 (일정 <-> 체크리스트) */
    public logTabSwitch(fromTab: string, toTab: string) {
        this.logEvent('tab_switch', { from_tab: fromTab, to_tab: toTab });
    }

    /** 체크리스트 항목 체크/해제 */
    public logChecklistCheck(itemName: string, isChecked: boolean) {
        this.logEvent('checklist_check', { 
            item_name: itemName, 
            is_checked: isChecked ? 'true' : 'false' 
        });
    }

    /** 여행 공유 */
    public logTripShare(method: 'copy' | 'system') {
        this.logEvent('trip_share', { method });
    }

    /** 알림 클릭 */
    public logNotificationClick(type: 'local' | 'push', planId: string) {
        this.logEvent('notif_click', { type, plan_id: planId });
    }

    /** 오프라인 모드 진입 */
    public logOfflineEntry() {
        this.logEvent('offline_entry', { timestamp: Date.now() });
    }
}

export const analytics = AnalyticsService.getInstance();
