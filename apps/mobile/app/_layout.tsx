/**
 * Root 레이아웃
 * - SafeAreaProvider 로 전역 Safe Area 컨텍스트 제공(모든 SafeAreaView/useSafeAreaInsets 필수 선행).
 * - AuthProvider 로 세션 제공.
 * - 세션 분기(auth gate): 비로그인 → (auth) 그룹, 로그인 → (tabs) 그룹으로 리다이렉트.
 */
import { Component, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { colors } from '@/theme'

// 원인 오류를 Metro 터미널에 출력하기 위한 임시 핸들러 (디버깅용)
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const gu = (globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: Error, fatal: boolean) => void; setGlobalHandler: (h: (e: Error, fatal: boolean) => void) => void } }).ErrorUtils
  if (gu) {
    const prev = gu.getGlobalHandler()
    gu.setGlobalHandler((error, isFatal) => {
      console.log('🔴 GLOBAL ERROR:', error?.message)
      console.log(error?.stack)
      prev(error, isFatal)
    })
  }
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.log('🔴 RENDER ERROR:', error.message)
    console.log(error.stack)
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, color: 'red', marginBottom: 8 }}>렌더링 오류</Text>
          <Text style={{ fontSize: 12, color: '#666' }}>{(this.state.error as Error).message}</Text>
        </View>
      )
    }
    return this.props.children
  }
}

function RootNavigator() {
  const { session, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      // 비로그인 상태인데 보호 라우트에 있음 → 로그인으로
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup) {
      // 로그인 상태인데 인증 화면에 있음 → 홈으로
      router.replace('/(tabs)')
    }
  }, [session, isLoading, segments, router])

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg.canvas,
        }}
      >
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="trip/new" options={{ headerShown: false }} />
      <Stack.Screen name="templates/new" options={{ headerShown: false }} />
      <Stack.Screen name="templates/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="profile/travel-log" options={{ headerShown: false }} />
      <Stack.Screen name="profile/withdrawal" options={{ headerShown: false }} />
      <Stack.Screen name="profile/places-visited" options={{ headerShown: false }} />
      <Stack.Screen name="profile/licenses" options={{ headerShown: false }} />
      <Stack.Screen name="profile/terms" options={{ headerShown: false }} />
      <Stack.Screen name="join" options={{ headerShown: false }} />
      <Stack.Screen name="share/[id]" options={{ headerShown: false }} />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  )
}
