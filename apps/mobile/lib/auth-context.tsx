/**
 * 인증 컨텍스트 (nexvoy-app)
 *
 * - 앱 전역에서 Supabase 세션 상태를 구독/제공한다.
 * - AppState 리스너로 foreground 시 startAutoRefresh / background 시 stopAutoRefresh
 *   (Supabase 공식 RN 가이드 — RN 필수 패턴).
 * - 세션 분기(auth gate)는 app/_layout.tsx 가 이 컨텍스트의 session/isLoading 을 사용해 처리.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { AppState } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { cancelAllLocalNotifications } from './notifications'
import { logLocalFirstEvent } from './observability'
import { setMobileBackgroundWorkPaused } from './backgroundTaskCoordinator'
import { revokeAndClearCurrentMobileKeyMaterial } from './local-first/keyProvisioningService'
import {
  registerMobileProvisioningBackgroundTask,
  unregisterMobileProvisioningBackgroundTask,
} from './local-first/provisioningBackgroundTask'
import {
  registerMobileAuthorityBackgroundTask,
  unregisterMobileAuthorityBackgroundTask,
} from './data/server-authority/backgroundTask'
import {
  startMobileAuthoritySync,
  stopMobileAuthoritySync,
} from './data/server-authority/syncService'

interface AuthContextValue {
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 초기 세션 로드 (SecureStore에 저장된 세션 복원)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })

    // 세션 변화 구독 (로그인/로그아웃/토큰 갱신)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    // foreground/background 에 따른 토큰 자동 갱신 제어
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh()
      } else {
        supabase.auth.stopAutoRefresh()
      }
    })

    return () => {
      subscription.unsubscribe()
      appStateSub.remove()
    }
  }, [])

  useEffect(() => {
    if (isLoading) return
    const accountId = session?.user.id
    if (accountId) {
      setMobileBackgroundWorkPaused(false)
      void registerMobileProvisioningBackgroundTask()
      void registerMobileAuthorityBackgroundTask()
      void startMobileAuthoritySync(accountId)
      return
    }
    setMobileBackgroundWorkPaused(true)
    void unregisterMobileProvisioningBackgroundTask()
    void unregisterMobileAuthorityBackgroundTask()
    void stopMobileAuthoritySync()
  }, [isLoading, session?.user.id])

  const signOut = async () => {
    setMobileBackgroundWorkPaused(true)
    await Promise.all([
      unregisterMobileProvisioningBackgroundTask(),
      unregisterMobileAuthorityBackgroundTask(),
      stopMobileAuthoritySync(),
    ])
    try {
      await cancelAllLocalNotifications()
    } catch {
      // 알림 정리 실패가 로그아웃을 막으면 계정 전환 시 더 위험하다.
    }
    try {
      await revokeAndClearCurrentMobileKeyMaterial(supabase)
    } catch {
      // 서버/로컬 키 정리 실패도 로그아웃 자체를 막지 않는다.
    }
    try {
      await supabase.rpc('cleanup_current_user_push_tokens')
      await logLocalFirstEvent('push_token_revoked', {
        provider: 'fcm',
        status: 'completed',
      })
    } catch {
      await logLocalFirstEvent('push_token_revoked', {
        provider: 'fcm',
        status: 'failed',
        reason_code: 'cleanup_failed',
      })
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
