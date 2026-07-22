import { create } from 'zustand'
import { analytics } from '@/services/AnalyticsService'

interface NetworkState {
    isOnline: boolean
    initializeNetworkListener: () => void
}

export const useNetworkStore = create<NetworkState>((set) => ({
    isOnline: true,
    initializeNetworkListener: () => {
        if (typeof window === 'undefined') return

        // 초기 상태 반영
        set({ isOnline: navigator.onLine })

        const handleOnline = () => set({ isOnline: true })
        const handleOffline = () => {
            analytics.logOfflineEntry()
            set({ isOnline: false })
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
    }
}))
