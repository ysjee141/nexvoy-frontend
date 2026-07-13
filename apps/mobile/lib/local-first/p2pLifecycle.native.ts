import { AppState, Platform, type AppStateStatus } from 'react-native'
import type { P2PObservabilityEvent } from '@nexvoy/core/sync/iceServers'

export interface BindMobileP2PLifecycleInput {
  closeActiveConnection: () => void | Promise<void>
  reconnectActiveConnection?: () => void | Promise<void>
  onEvent?: (event: P2PObservabilityEvent) => void
}

export function bindMobileP2PLifecycle(
  input: BindMobileP2PLifecycleInput,
): () => void {
  let previousState: AppStateStatus = AppState.currentState
  const platform = Platform.OS === 'ios' || Platform.OS === 'android'
    ? Platform.OS
    : 'unknown'

  const subscription = AppState.addEventListener('change', (nextState) => {
    const wasForeground = isForegroundAppState(previousState)
    const isForeground = isForegroundAppState(nextState)
    previousState = nextState

    if (wasForeground && !isForeground) {
      input.onEvent?.({
        name: 'p2p_lifecycle_cleanup',
        platform,
        reason: 'app_background',
      })
      void input.closeActiveConnection()
      return
    }

    if (!wasForeground && isForeground) {
      input.onEvent?.({
        name: 'p2p_reconnect_attempted',
        platform,
        reason: 'app_foreground',
      })
      void input.reconnectActiveConnection?.()
    }
  })

  return () => {
    subscription.remove()
  }
}

function isForegroundAppState(state: AppStateStatus): boolean {
  return state === 'active'
}
