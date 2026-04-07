'use client'
import { css } from 'styled-system/css'
import { WifiOff } from 'lucide-react'
import { useNetworkStore } from '@/stores/useNetworkStore'
import { useEffect, useState } from 'react'
import { NotificationService } from '@/services/NotificationService'
import { NativeUIService } from '@/services/NativeUIService'
import { LifecycleService } from '@/services/LifecycleService'

export default function OfflineBanner() {
    const { isOnline, initializeNetworkListener } = useNetworkStore()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        initializeNetworkListener()
        // 앱 초기화 시 네이티브 UI 및 알림 권한 획득, 생명주기 리스너 필수
        NativeUIService.initialize()
        NotificationService.initialize()
        LifecycleService.initialize()
    }, [initializeNetworkListener])

    if (!mounted || isOnline) return null

    return (
        <div className={css({
            bg: 'brand.error',
            color: 'white',
            px: '20px',
            py: '10px',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            animation: 'fadeIn 0.3s ease-out',
            zIndex: 1100,
            position: 'relative'
        })}>
            <WifiOff size={16} />
            오프라인 상태입니다. 기능이 일부 제한됩니다.
        </div>
    )
}
