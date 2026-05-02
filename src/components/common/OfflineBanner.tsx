'use client'
import { css } from 'styled-system/css'
import { WifiOff } from 'lucide-react'
import { useNetworkStore } from '@/stores/useNetworkStore'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { NotificationService } from '@/services/NotificationService'
import { NativeUIService } from '@/services/NativeUIService'
import { LifecycleService } from '@/services/LifecycleService'

export default function OfflineBanner() {
    const { isOnline, isOfflineMode, initializeNetworkListener, setOfflineMode } = useNetworkStore()
    const [mounted, setMounted] = useState(false)
    const router = useRouter()
    const pathname = usePathname()

    const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()

    useEffect(() => {
        setMounted(true)
        initializeNetworkListener()
        // 앱 초기화 시 네이티브 UI 및 알림 권한 획득, 생명주기 리스너 필수
        NativeUIService.initialize()
        NotificationService.initialize()
        LifecycleService.initialize()
    }, [initializeNetworkListener])

    if (!mounted || (isOnline && !isOfflineMode)) return null

    return (
        <div className={css({
            bg: isOfflineMode ? 'brand.secondary' : 'brand.error',
            color: 'white',
            px: '20px',
            py: '12px',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: '700',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            animation: 'fadeIn 0.3s ease-out',
            zIndex: 1100,
            position: 'relative',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        })}>
            <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                <WifiOff size={16} />
                {isOfflineMode ? '현재 오프라인 모드로 동작 중입니다.' : '네트워크 연결이 끊어졌습니다.'}
            </div>

            {isOfflineMode && isOnline && (
                <button
                    onClick={() => {
                        setOfflineMode(false)
                        // 온라인 복귀 시 새로고침하여 최신 상태 반영
                        window.location.reload() 
                    }}
                    className={css({
                        mt: '4px',
                        bg: 'brand.primary',
                        color: 'white',
                        border: 'none',
                        px: '16px',
                        py: '6px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '800',
                        cursor: 'pointer'
                    })}
                >
                    온라인 모드로 복귀
                </button>
            )}
        </div>
    )
}
