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
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

const REMEMBERED_EMAIL_KEY = 'rememberedEmail'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberEmail, setRememberEmail] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [loading, setLoading] = useState(false)
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
                  <View style={styles.inputGroup}>
                    <View style={[styles.inputCell, styles.inputCellDivider]}>
                      <Text style={styles.inputLabel}>이메일</Text>
                      <TextInput
                        style={styles.textInput}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder="you@example.com"
                        placeholderTextColor={colors.brand.mutedSoft}
                      />
                    </View>
                    <View style={styles.inputCell}>
                      <Text style={styles.inputLabel}>비밀번호</Text>
                      <TextInput
                        style={styles.textInput}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        placeholder="••••••••"
                        placeholderTextColor={colors.brand.mutedSoft}
                      />
                    </View>
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

              {/* 소셜 로그인(Google/Kakao)은 P2-2 OAuth PoC 에서 구현 — 셋업 단계 placeholder */}
              <View style={styles.socialPlaceholder}>
                <Text style={styles.socialPlaceholderText}>
                  소셜 로그인은 곧 제공될 예정이에요.
                </Text>
              </View>
            </View>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>계정이 없으신가요? </Text>
              <Pressable>
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
    paddingVertical: spacing.base,
    borderRadius: radii.md,
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
  inputGroup: {
    borderWidth: 1,
    borderColor: colors.brand.border,
    borderRadius: radii.md,
    overflow: 'hidden',
    marginBottom: spacing.base,
  },
  inputCell: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  inputCellDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  inputLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    textTransform: 'uppercase',
    marginBottom: spacing.xxs,
  },
  textInput: {
    fontSize: fontSizes.md,
    color: colors.brand.ink,
    padding: 0,
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
    borderRadius: radii.md,
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
    paddingVertical: spacing.base,
    borderRadius: radii.md,
    backgroundColor: colors.brand.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  submitBtnDisabled: {
    opacity: 0.7,
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
  socialPlaceholder: {
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  socialPlaceholderText: {
    fontSize: fontSizes.sm,
    color: colors.brand.mutedSoft,
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
