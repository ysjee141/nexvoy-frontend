'use client'

import { useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { Bell, BellOff, X } from 'lucide-react'
import { requestNotificationPermission, registerServiceWorker, useAlarmScheduler } from '@/utils/notifications'

// 알람 스케줄러를 전역으로 활성화하는 내부 컴포넌트
function AlarmSchedulerActivator() {
    useAlarmScheduler()
    return null
}

export default function NotificationBanner() {
    const [permission, setPermission] = useState<NotificationPermission | null>(null)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        if (!('Notification' in window)) {
            setPermission('denied')
            return
        }
        setPermission(Notification.permission)
        registerServiceWorker()

        // 세션 내 이미 닫았으면 숨기기
        if (sessionStorage.getItem('notification-banner-dismissed')) {
            setDismissed(true)
        }
    }, [])

    const handleAllow = async () => {
        const result = await requestNotificationPermission()
        setPermission(result)
        if (result === 'granted') {
            setDismissed(true)
        }
    }

    const handleDismiss = () => {
        setDismissed(true)
        sessionStorage.setItem('notification-banner-dismissed', '1')
    }

    // 권한이 이미 granted 상태거나 지원 안 하거나 닫혔으면 스케줄러만 실행
    if (permission === 'granted') {
        return <AlarmSchedulerActivator />
    }

    if (dismissed || permission === null || permission === 'denied') {
        return null
    }

    // 권한 요청 대기 상태 배너 표시
    return (
        <>
            <AlarmSchedulerActivator />
            <div className={css({
                position: 'fixed',
                bottom: { base: '12px', sm: '24px' },
                right: { base: '12px', sm: '24px' },
                left: { base: '12px', sm: 'auto' }, // 모바일에서는 양옆 여백 확보
                zIndex: 999,
                bg: '#111',
                color: 'white',
                borderRadius: '16px',
                p: '16px 20px',
                maxW: { base: 'calc(100vw - 24px)', sm: '340px' },
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                animation: 'slideUp 0.3s ease',
            })}>
                <div className={css({ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' })}>
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '10px' })}>
                        <Bell size={20} color="#10B981" />
                        <div>
                            <p className={css({ fontWeight: 'bold', fontSize: '14px', mb: '2px' })}>일정 알림을 받으시겠어요?</p>
                            <p className={css({ fontSize: '12px', color: '#aaa', lineHeight: '1.4' })}>
                                출발 전 미리 알림을 받으려면<br />알림 권한이 필요합니다.
                            </p>
                        </div>
                    </div>
                    <button onClick={handleDismiss} className={css({ bg: 'transparent', border: 'none', color: '#666', cursor: 'pointer', flexShrink: 0, pt: '2px' })}>
                        <X size={16} />
                    </button>
                </div>
                <div className={css({ display: 'flex', gap: '8px' })}>
                    <button
                        onClick={handleAllow}
                        className={css({ flex: 1, py: '9px', bg: '#10B981', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', _hover: { bg: '#059669' } })}
                    >
                        알림 허용
                    </button>
                    <button
                        onClick={handleDismiss}
                        className={css({ px: '16px', py: '9px', bg: '#333', color: '#aaa', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', _hover: { bg: '#444' } })}
                    >
                        나중에
                    </button>
                </div>
            </div>
        </>
    )
}
