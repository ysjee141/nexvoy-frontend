'use client'
import { css } from 'styled-system/css'
import { WifiOff } from 'lucide-react'
import { useNetworkStore } from '@/stores/useNetworkStore'
import { useEffect, useState } from 'react'
import { NotificationService } from '@/services/NotificationService'

export default function OfflineBanner() {
    const { isOnline, initializeNetworkListener } = useNetworkStore()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        initializeNetworkListener()
        // 앱 초기화 시 네이티브 알림 권한 획득 및 리스너 부착
        NotificationService.initialize()
    }, [initializeNetworkListener])

    if (!mounted || isOnline) return null

    return (
        <div className={css({
            w: '100%',
            bg: '#EA4335',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            p: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            position: 'sticky',
            top: 0,
            zIndex: 1000
        })}>
            <WifiOff size={16} />
            오프라인 상태입니다. 기능이 일부 제한됩니다.
        </div>
    )
}
