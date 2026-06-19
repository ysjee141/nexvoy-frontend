/**
 * 로그인 화면 (nexvoy-app)
 *
 * 웹 apps/web/app/login/page.tsx 의 디자인 언어를 RN(StyleSheet.create)으로 재표현.
 * - 카드형 중앙 정렬 + 로고/헤딩/서브카피 + 이메일 점진 확장 폼 + 회원가입 링크.
 * - 토큰은 @/theme(@nexvoy/design-tokens) 의 숫자값을 그대로 사용(px 없음).
 * - 동적 값(체크박스 on/off, press 피드백)은 인라인 style 배열로 분리(정적/동적 분리 원칙).
 * - 세션 자동 리다이렉트는 Root _layout 의 auth gate 가 담당. 이 화면은 폼만 책임.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AntDesign } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from '@/lib/supabase'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

// OAuth 외부 인증 세션 복귀 시 브라우저 탭을 정리한다(Expo 권장 보일러플레이트).
WebBrowser.maybeCompleteAuthSession()

const REMEMBERED_EMAIL_KEY = 'rememberedEmail'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberEmail, setRememberEmail] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'error' | 'success'
    text: string
  } | null>(null)

  // 저장된 이메일 복원 (웹 localStorage → RN AsyncStorage)
  useEffect(() => {
    AsyncStorage.getItem(REMEMBERED_EMAIL_KEY).then((saved) => {
      if (saved) {
        setEmail(saved)
        setRememberEmail(true)
      }
    })
  }, [])

  const handleLogin = async () => {
    setLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setMessage({
        type: 'error',
        text:
          error.message === 'Invalid login credentials'
            ? '이메일 또는 비밀번호를 다시 한번 확인해 주시겠어요?'
            : error.message,
      })
      setLoading(false)
      return
    }

    if (rememberEmail) {
      await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, email)
    } else {
      await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY)
    }
    // 성공 시 onAuthStateChange → Root auth gate 가 홈으로 리다이렉트.
  }

  const handleGoogleLogin = async () => {
    setOauthLoading(true)
    setMessage(null)

    try {
      // 딥링크 redirect URI (scheme: onvoy, path: auth/callback).
      // 이 URI 는 Supabase 대시보드의 Redirect URLs 에 등록되어 있어야 한다.
      const redirectTo = makeRedirectUri({ scheme: 'onvoy', path: 'auth/callback' })

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      })

      if (error || !data?.url) {
        throw error ?? new Error('OAuth URL 생성에 실패했습니다.')
      }

      // 외부 브라우저로 Google 인증을 진행하고, redirectTo 로 복귀하면 결과를 받는다.
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

      if (result.type === 'success' && result.url) {
        const code = new URL(result.url).searchParams.get('code')
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
          // 세션 생성 성공 → onAuthStateChange → Root auth gate 가 홈으로 리다이렉트.
        }
      }
      // result.type 이 'cancel'/'dismiss' 면 사용자가 인증을 중단한 것 → 조용히 화면 잔류.
    } catch (e) {
      setMessage({ type: 'error', text: 'Google 로그인에 실패했습니다.' })
    } finally {
      setOauthLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.brandRow}>
                <Text style={styles.brandName}>온여정</Text>
              </View>
              <Text style={styles.title}>반가워요! 다시 오셨네요.</Text>
              <Text style={styles.subtitle}>
                소중한 여행의 모든 순간, 온여정이 동행할게요.
              </Text>
            </View>

            <View style={styles.formZone}>
              {!showEmailForm ? (
                <Pressable
                  onPress={() => setShowEmailForm(true)}
                  style={({ pressed }) => [
                    styles.emailEntryBtn,
                    pressed && styles.pressedSoft,
                  ]}
                >
                  <Text style={styles.emailEntryBtnText}>이메일로 계속하기</Text>
                </Pressable>
              ) : (
                <View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>이메일</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="you@example.com"
                      placeholderTextColor={colors.brand.mutedSoft}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>비밀번호</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      placeholder="••••••••"
                      placeholderTextColor={colors.brand.mutedSoft}
                    />
                  </View>

                  <Pressable
                    style={styles.rememberRow}
                    onPress={() => setRememberEmail((v) => !v)}
                  >
                    <View
                      style={[
                        styles.checkboxBase,
                        rememberEmail
                          ? { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary }
                          : { borderColor: colors.brand.border },
                      ]}
                    >
                      {rememberEmail && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.rememberText}>아이디 기억하기</Text>
                  </Pressable>

                  {message && (
                    <View
                      style={[
                        styles.messageBox,
                        message.type === 'error'
                          ? styles.messageBoxError
                          : styles.messageBoxSuccess,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          { color: message.type === 'error' ? colors.brand.error : colors.brand.primaryActive },
                        ]}
                      >
                        {message.text}
                      </Text>
                    </View>
                  )}

                  <Pressable
                    onPress={handleLogin}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.submitBtn,
                      pressed && styles.pressedSoft,
                      loading && styles.submitBtnDisabled,
                    ]}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.bg.canvas} />
                    ) : (
                      <Text style={styles.submitBtnText}>여정 시작하기</Text>
                    )}
                  </Pressable>
                </View>
              )}

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>또는</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google OAuth 로그인 (P2-2 PoC) — Google 가이드: 흰 배경 + 무채색 텍스트, 10% Rule 준수(블루 미사용) */}
              <Pressable
                onPress={handleGoogleLogin}
                disabled={oauthLoading}
                style={({ pressed }) => [
                  styles.googleBtn,
                  pressed && styles.pressedSoft,
                  oauthLoading && styles.googleBtnDisabled,
                ]}
              >
                {oauthLoading ? (
                  <ActivityIndicator color={colors.brand.muted} />
                ) : (
                  <>
                    <AntDesign
                      name="google"
                      size={18}
                      color={colors.brand.ink}
                    />
                    <Text style={styles.googleBtnText}>Google로 계속하기</Text>
                  </>
                )}
              </Pressable>
            </View>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>계정이 없으신가요? </Text>
              <Pressable onPress={() => router.push('/(auth)/signup')}>
                <Text style={styles.signupLink}>회원가입하기</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  scrollBody: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    paddingVertical: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  brandName: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    letterSpacing: -0.4,
  },
  title: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    marginBottom: spacing.md,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSizes.base,
    color: colors.brand.muted,
    textAlign: 'center',
    lineHeight: 24,
  },
  formZone: {
    flexDirection: 'column',
  },
  emailEntryBtn: {
    height: 52,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.brand.border,
    backgroundColor: colors.bg.canvas,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  emailEntryBtnText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  field: {
    marginBottom: spacing.base,
  },
  fieldLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.brand.muted,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    height: 52,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.normal,
    color: colors.brand.ink,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  checkboxBase: {
    width: 18,
    height: 18,
    borderRadius: radii.xs,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: colors.bg.canvas,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.sm,
  },
  rememberText: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
  },
  messageBox: {
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  messageBoxError: {
    backgroundColor: colors.bg.surfaceSoft,
    borderColor: colors.brand.error,
  },
  messageBoxSuccess: {
    backgroundColor: colors.bg.surfaceSoft,
    borderColor: colors.brand.border,
  },
  messageText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
  },
  submitBtn: {
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.brand.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  submitBtnDisabled: {
    backgroundColor: colors.brand.primaryDisabled,
  },
  submitBtnText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.bg.canvas,
  },
  pressedSoft: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.base,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.brand.border,
  },
  dividerText: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.brand.borderStrong,
    backgroundColor: colors.bg.canvas,
    marginBottom: spacing.lg,
  },
  googleBtnDisabled: {
    opacity: 0.6,
  },
  googleBtnText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  signupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.brand.border,
  },
  signupText: {
    fontSize: fontSizes.md,
    color: colors.brand.muted,
  },
  signupLink: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    textDecorationLine: 'underline',
  },
})
