/**
 * Root 레이아웃
 * - SafeAreaProvider 로 전역 Safe Area 컨텍스트 제공(모든 SafeAreaView/useSafeAreaInsets 필수 선행).
 * - AuthProvider 로 세션 제공.
 * - 세션 분기(auth gate): 비로그인 → (auth) 그룹, 로그인 → (tabs) 그룹으로 리다이렉트.
 */
import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { colors } from '@/theme'

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
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
