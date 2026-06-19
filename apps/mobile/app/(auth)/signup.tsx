/**
 * 회원가입 화면 (nexvoy-app)
 *
 * login.tsx 의 디자인 언어를 그대로 계승. 닉네임(선택)·이메일·비밀번호·확인 필드.
 * 제출 후 Supabase 인증 메일 발송 → 성공 화면으로 전환.
 * 세션 생성은 이메일 인증 후 딥링크 콜백에서 처리.
 */
import { useState } from 'react'
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
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

export default function SignupScreen() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isPasswordValid = password.length >= 6
  const isConfirmValid = password === confirmPassword && isPasswordValid
  const canSubmit = isEmailValid && isPasswordValid && isConfirmValid && !loading

  const handleSignup = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: nickname.trim() || null },
        emailRedirectTo: 'onvoy://auth/callback',
      },
    })

    setLoading(false)

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        setError('이미 가입된 이메일 주소예요. 로그인을 시도해 보세요.')
      } else {
        setError(signUpError.message)
      }
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.successContainer}>
          <View style={styles.successIllust}>
            <Ionicons name="mail-outline" size={40} color={colors.brand.primary} />
          </View>
          <Text style={styles.successTitle}>인증 메일을 보냈어요!</Text>
          <Text style={styles.successDesc}>
            <Text style={styles.successEmail}>{email}</Text>
            {'\n'}로 인증 링크를 보냈어요.{'\n'}
            메일함을 확인하고 링크를 눌러 가입을 완료해 주세요.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backToLoginBtn,
              pressed && styles.pressedSoft,
            ]}
          >
            <Text style={styles.backToLoginBtnText}>로그인으로 돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
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
              <Text style={styles.title}>온여정에 오신 걸{'\n'}환영해요!</Text>
              <Text style={styles.subtitle}>
                소중한 여행의 모든 순간을 함께 기록해요.
              </Text>
            </View>

            <View style={styles.formZone}>
              <View style={styles.inputGroup}>
                {/* 닉네임 (선택) */}
                <View style={[styles.inputCell, styles.inputCellDivider]}>
                  <Text style={styles.inputLabel}>닉네임 (선택)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={nickname}
                    onChangeText={setNickname}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="여행자 이름"
                    placeholderTextColor={colors.brand.mutedSoft}
                    returnKeyType="next"
                  />
                </View>

                {/* 이메일 */}
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
                    returnKeyType="next"
                  />
                </View>

                {/* 비밀번호 */}
                <View style={[styles.inputCell, styles.inputCellDivider]}>
                  <Text style={styles.inputLabel}>비밀번호</Text>
                  <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="6자 이상"
                    placeholderTextColor={colors.brand.mutedSoft}
                    returnKeyType="next"
                  />
                </View>

                {/* 비밀번호 확인 */}
                <View style={styles.inputCell}>
                  <Text style={styles.inputLabel}>비밀번호 확인</Text>
                  <TextInput
                    style={styles.textInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    placeholder="비밀번호를 다시 입력하세요"
                    placeholderTextColor={colors.brand.mutedSoft}
                    returnKeyType="done"
                    onSubmitEditing={handleSignup}
                  />
                </View>
              </View>

              {/* 비밀번호 불일치 인라인 경고 */}
              {confirmPassword.length > 0 && !isConfirmValid && (
                <Text style={styles.fieldError}>
                  비밀번호가 일치하지 않아요.
                </Text>
              )}

              {/* 서버 에러 */}
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Pressable
                onPress={handleSignup}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && canSubmit && styles.pressedSoft,
                  !canSubmit && styles.submitBtnDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.bg.canvas} />
                ) : (
                  <Text style={styles.submitBtnText}>계정 만들기</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>이미 계정이 있으신가요? </Text>
              <Pressable onPress={() => router.back()}>
                <Text style={styles.loginLink}>로그인하기</Text>
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
    paddingVertical: spacing.xl,
  },
  card: {
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brandRow: {
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
    lineHeight: 38,
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
    letterSpacing: 0.5,
    marginBottom: spacing.xxs,
  },
  textInput: {
    fontSize: fontSizes.md,
    color: colors.brand.ink,
    padding: 0,
  },
  fieldError: {
    fontSize: fontSizes.sm,
    color: colors.brand.error,
    marginTop: -spacing.sm,
    marginBottom: spacing.base,
    paddingHorizontal: spacing.xs,
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.error,
    backgroundColor: colors.bg.surfaceSoft,
    marginBottom: spacing.base,
  },
  errorText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.brand.error,
  },
  submitBtn: {
    paddingVertical: spacing.base,
    borderRadius: radii.md,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginBottom: spacing.lg,
  },
  submitBtnDisabled: {
    opacity: 0.45,
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
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.brand.border,
  },
  loginText: {
    fontSize: fontSizes.md,
    color: colors.brand.muted,
  },
  loginLink: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    textDecorationLine: 'underline',
  },
  // 성공 화면
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  successIllust: {
    width: 88,
    height: 88,
    borderRadius: radii.full,
    backgroundColor: colors.bg.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  successTitle: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    letterSpacing: -0.5,
  },
  successDesc: {
    fontSize: fontSizes.base,
    color: colors.brand.muted,
    textAlign: 'center',
    lineHeight: 26,
  },
  successEmail: {
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  backToLoginBtn: {
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    backgroundColor: colors.brand.primary,
    marginTop: spacing.sm,
  },
  backToLoginBtnText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.bg.canvas,
  },
})
