'use client'

export async function requestNotificationPermission(): Promise<NotificationPermission> {
    return 'denied'
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    return null
}

export function showNotification(_title: string, _body: string, _url?: string) {
    return
}

/**
 * TASK-014 이후 일정 리마인더는 모바일 로컬 알림이 primary다.
 * Web Push/브라우저 알림은 content-free 정책을 재설계할 때까지 no-op으로 둔다.
 */
export function useAlarmScheduler() {
    return
}
