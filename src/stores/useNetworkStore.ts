import { create } from 'zustand'
import { Network, ConnectionStatus } from '@capacitor/network'
import { analytics } from '@/services/AnalyticsService'

interface NetworkState {
    isOnline: boolean
    connectionType: ConnectionStatus['connectionType']
    initializeNetworkListener: () => Promise<void>
}

export const useNetworkStore = create<NetworkState>((set) => ({
    isOnline: true,
    connectionType: 'unknown',
    initializeNetworkListener: async () => {
        try {
            // Get initial status
            const status = await Network.getStatus()
            set({ isOnline: status.connected, connectionType: status.connectionType })

            // Listen for changes
            Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
                if (!status.connected) {
                    analytics.logOfflineEntry();
                }
                set({ isOnline: status.connected, connectionType: status.connectionType })
            })
        } catch (e) {
            console.warn("Network plugin not available (might be running in standard web browser)", e)
        }
    }
}))
