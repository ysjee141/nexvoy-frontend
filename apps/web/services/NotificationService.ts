// 웹 전용 NotificationService 스텁.
//
// 원본은 Capacitor PushNotifications / LocalNotifications 기반 네이티브 서비스로,
// 모든 메서드가 `!Capacitor.isNativePlatform()`일 때 즉시 return하여 웹에서는 no-op였다.
// 마이그레이션 이후 네이티브 의존을 제거하면서, 호출부(TripClient, ChecklistClient)의
// API 표면을 보존하기 위해 동일 시그니처의 no-op 구현만 남긴다.
//
// 향후 웹 푸시(Service Worker + Push API)를 도입할 경우 이 스텁을 실제 구현으로 대체한다.
export const NotificationService = {
    /** 오프라인 일정 리마인더 예약 (웹 no-op) */
    async scheduleOfflineReminders(_plans: any[]): Promise<void> {
        return
    },

    /** 체크리스트 미완료 리마인더 예약 (웹 no-op) */
    async scheduleChecklistReminder(
        _tripId: string,
        _tripTitle: string,
        _startDate: string,
        _pendingItemsCount: number,
    ): Promise<void> {
        return
    },
}
