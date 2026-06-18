'use client'
import { useNetworkStore } from '@/stores/useNetworkStore'
import { useEffect } from 'react'

export default function OfflineBanner() {
    const { initializeNetworkListener } = useNetworkStore()

    useEffect(() => {
        // 웹 환경: navigator.onLine 기반 네트워크 상태 리스너 초기화
        initializeNetworkListener()
    }, [initializeNetworkListener])

    return null
}
