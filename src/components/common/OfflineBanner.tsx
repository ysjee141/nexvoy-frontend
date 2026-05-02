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

    return null
}
