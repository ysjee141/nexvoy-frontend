/**
 * 딥링크 인증 콜백 — onvoy://auth/callback?code=<PKCE_CODE>
 *
 * Supabase 이메일 인증 완료 후 이 화면으로 복귀한다.
 * code 파라미터를 exchangeCodeForSession 에 전달해 세션을 생성하고,
 * 성공 시 즉시 홈 탭으로 replace 한다.
 * onAuthStateChange 는 Root _layout 의 auth gate 가 수신하므로 여기서는 navigate 만 수행.
 */
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

export default function AuthCallbackScreen() {
  const router = useRouter()
  const { code } = useLocalSearchParams<{ code?: string }>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (!code) {
      setError('인증 코드가 없어요. 이메일 링크를 다시 확인해 주세요.')
      return () => { active = false }
    }

    const resolvedCode = Array.isArray(code) ? code[0] : code
    supabase.auth.exchangeCodeForSession(resolvedCode).then(({ error: exchangeError }) => {
      if (!active) return
      if (exchangeError) {
        setError(
          exchangeError.message.includes('code verifier')
            ? '인증 링크가 만료되었어요. 회원가입을 다시 시도해 주세요.'
            : '인증에 실패했어요. 잠시 후 다시 시도해 주세요.'
        )
        return
      }
      // 세션 생성 성공 → Root auth gate 가 홈으로 이동시키지만
      // replace 로 콜백 화면을 히스토리에서 제거한다.
      router.replace('/(tabs)')
    })

    return () => { active = false }
  }, [code, router])

  if (error) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <View style={styles.iconWrap}>
            <Ionicons name="alert-circle-outline" size={44} color={colors.brand.error} />
          </View>
          <Text style={styles.errorTitle}>인증에 실패했어요</Text>
          <Text style={styles.errorDesc}>{error}</Text>
          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.btnText}>로그인으로 돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Text style={styles.brand}>온여정</Text>
        <ActivityIndicator size="large" color={colors.brand.primary} style={styles.spinner} />
        <Text style={styles.loadingText}>인증을 확인하고 있어요...</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.canvas },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.base,
  },
  brand: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    letterSpacing: -0.4,
    marginBottom: spacing.lg,
  },
  spinner: { marginBottom: spacing.sm },
  loadingText: {
    fontSize: fontSizes.base,
    color: colors.brand.muted,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: radii.full,
    backgroundColor: colors.bg.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  errorTitle: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: fontSizes.base,
    color: colors.brand.muted,
    textAlign: 'center',
    lineHeight: 24,
  },
  btn: {
    marginTop: spacing.md,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    backgroundColor: colors.brand.primary,
  },
  btnText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.bg.canvas,
  },
})
