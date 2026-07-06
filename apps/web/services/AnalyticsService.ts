import { sendGAEvent } from '@next/third-parties/google'
import {
    createLocalFirstObservabilityEvent,
    sanitizeLocalFirstObservabilityEvent,
    type LocalFirstObservabilityEvent,
    type LocalFirstObservabilityEventName,
    type LocalFirstObservabilityParams,
} from '@nexvoy/core/observability/events'
import type { DualWriteMismatchEvent } from '@nexvoy/core/repositories/dualWriteChecklistRepository'
import type { P2PObservabilityEvent } from '@nexvoy/core/sync/iceServers'

/**
 * 서비스 개선을 위한 애널리틱스 이벤트 관리 서비스 (ADR-002)
 *
 * 웹 전용 — GA4(@next/third-parties/google)로 단순화.
 * Capacitor FirebaseAnalytics 의존 제거. 공개 API는 기존과 동일하게 유지하여
 * 호출부 변경을 최소화한다.
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
     * 초기화 — GA4는 layout의 <GoogleAnalytics />가 스크립트 로드를 담당하므로
     * 별도 초기화가 필요 없다. 호환성을 위해 메서드는 유지한다.
     */
    public async init() {
        if (this.initialized) return;
        this.initialized = true;
    }

    /**
     * 사용자 ID 설정
     */
    public async setUserId(_userId: string) {
        // TASK-014: raw Supabase user ids must not leave the app boundary.
        // Keep the compatibility method as a no-op until a pseudonymous id contract exists.
    }

    /**
     * 화면 이름 설정
     */
    public async setScreenName(screenName: string) {
        this.logEvent('screen_view', { screen_name: screenName });
    }

    /**
     * 커스텀 이벤트 기록
     */
    public async logEvent(name: string, params: Record<string, unknown> = {}) {
        if (typeof window === 'undefined') return;
        try {
            sendGAEvent('event', name, params);
        } catch (e) {
            console.error(`[Analytics] LogEvent Error (${name}):`, e);
        }
    }

    /** Local-first 공용 관측 이벤트 — core sanitizer allowlist를 통과한 params만 전송한다. */
    public logLocalFirstEvent(
        nameOrEvent: LocalFirstObservabilityEventName | LocalFirstObservabilityEvent,
        params: LocalFirstObservabilityParams = {},
    ) {
        const event = typeof nameOrEvent === 'string'
            ? (() => {
                try {
                    return createLocalFirstObservabilityEvent(nameOrEvent, {
                        platform: 'web',
                        ...params,
                    })
                } catch {
                    return sanitizeLocalFirstObservabilityEvent(nameOrEvent, {
                        platform: 'web',
                        ...params,
                    }).event
                }
            })()
            : sanitizeLocalFirstObservabilityEvent(nameOrEvent.name, {
                platform: 'web',
                ...nameOrEvent.params,
            }).event

        this.logEvent(event.name, event.params)
    }

    /** Local-first P2P 관측 이벤트 — document content/room id/CRDT payload는 포함하지 않는다. */
    public logP2PEvent(event: P2PObservabilityEvent) {
        const { name, ...params } = event;
        this.logLocalFirstEvent(name as LocalFirstObservabilityEventName, params as LocalFirstObservabilityParams);
    }

    /** Dual-write mismatch 관측 — item name/email/document payload는 포함하지 않는다. */
    public logDualWriteMismatch(event: DualWriteMismatchEvent) {
        this.logLocalFirstEvent('local_first_dual_write_mismatch', {
            document_type: event.domain === 'checklist' ? 'trip' : undefined,
            operation: event.operation.startsWith('delete')
                ? 'deleted'
                : event.operation.startsWith('create')
                    ? 'created'
                    : 'updated',
            entity_type: 'checklist',
            status: 'failed',
            reason_code: event.reasonCodes.join('_'),
            count: event.reasonCodes.length,
            pending_count: (event.legacyChecklistCount ?? 0) + (event.legacyItemCount ?? 0),
            queued_count: (event.localChecklistCount ?? 0) + (event.localItemCount ?? 0),
        });
    }

    // --- 사전 정의된 헬퍼 메서드들 ---

    /** 여행 생성 */
    public logTripCreate(_destination: string) {
        this.logEvent('trip_create', { document_type: 'trip' });
    }

    /** 일정 추가 */
    public logPlanAdd(category: string, _location: string, hasAlarm: boolean) {
        this.logEvent('plan_add', {
            category,
            has_alarm: hasAlarm ? 'true' : 'false'
        });
    }

    /** 탭 전환 (일정 <-> 체크리스트) */
    public logTabSwitch(fromTab: string, toTab: string) {
        this.logEvent('tab_switch', { from_tab: fromTab, to_tab: toTab });
    }

    /** 체크리스트 항목 체크/해제 */
    public logChecklistCheck(isChecked: boolean) {
        this.logEvent('checklist_check', {
            is_checked: isChecked ? 'true' : 'false'
        });
    }

    /** 여행 공유 */
    public logTripShare(method: 'copy' | 'system') {
        this.logEvent('trip_share', { method });
    }

    /** 알림 클릭 */
    public logNotificationClick(type: 'local' | 'push', _planId: string) {
        this.logEvent('notif_click', { type, entity_type: 'plan' });
    }

    /** 오프라인 모드 진입 */
    public logOfflineEntry() {
        this.logEvent('offline_entry', { timestamp: Date.now() });
    }
}

export const analytics = AnalyticsService.getInstance();
