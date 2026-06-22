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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isTermsAgreed, setIsTermsAgreed] = useState(false)

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  // 웹 signup(>=6) 및 Supabase auth minimum_password_length(6) 과 통일.
  const isPasswordLengthValid = password.length >= 6
  const isPasswordValid = isPasswordLengthValid
  const isConfirmValid = password === confirmPassword && isPasswordValid
  const canSubmit =
    isEmailValid && isPasswordValid && isConfirmValid && isTermsAgreed && !loading

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
              {/* 닉네임 (선택) */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>닉네임 (선택)</Text>
                <TextInput
                  style={styles.fieldInput}
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
                  returnKeyType="next"
                />
              </View>

              {/* 비밀번호 */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>비밀번호</Text>
                <View style={styles.inputWithToggle}>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputFlex]}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="6자 이상"
                    placeholderTextColor={colors.brand.mutedSoft}
                    returnKeyType="next"
                  />
                  <Pressable
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.toggleBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="비밀번호 표시/숨기기"
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.brand.mutedSoft}
                    />
                  </Pressable>
                </View>
                {/* 비밀번호 유효성 피드백 */}
                {password.length > 0 && (
                  <View style={styles.validationRow}>
                    <Ionicons
                      name={isPasswordLengthValid ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={
                        isPasswordLengthValid
                          ? colors.brand.success
                          : colors.brand.error
                      }
                    />
                    <Text
                      style={[
                        styles.validationText,
                        {
                          color: isPasswordLengthValid
                            ? colors.brand.success
                            : colors.brand.error,
                        },
                      ]}
                    >
                      6자 이상
                    </Text>
                  </View>
                )}
              </View>

              {/* 비밀번호 확인 */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>비밀번호 확인</Text>
                <View style={styles.inputWithToggle}>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputFlex]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    placeholder="비밀번호를 다시 입력하세요"
                    placeholderTextColor={colors.brand.mutedSoft}
                    returnKeyType="done"
                    onSubmitEditing={handleSignup}
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword((prev) => !prev)}
                    style={styles.toggleBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="비밀번호 표시/숨기기"
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.brand.mutedSoft}
                    />
                  </Pressable>
                </View>
                {/* 비밀번호 일치 여부 피드백 */}
                {confirmPassword.length > 0 && (
                  <View style={styles.validationRow}>
                    <Ionicons
                      name={isConfirmValid ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={isConfirmValid ? colors.brand.success : colors.brand.error}
                    />
                    <Text
                      style={[
                        styles.validationText,
                        {
                          color: isConfirmValid
                            ? colors.brand.success
                            : colors.brand.error,
                        },
                      ]}
                    >
                      {isConfirmValid
                        ? '비밀번호가 일치합니다'
                        : '비밀번호가 일치하지 않습니다'}
                    </Text>
                  </View>
                )}
              </View>

              {/* 서버 에러 */}
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* 약관 동의 */}
              <Pressable
                onPress={() => setIsTermsAgreed((prev) => !prev)}
                style={styles.termsRow}
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isTermsAgreed }}
                accessibilityLabel="서비스 이용약관 및 개인정보 처리방침 동의"
              >
                <View
                  style={[
                    styles.checkbox,
                    isTermsAgreed && styles.checkboxChecked,
                  ]}
                >
                  {isTermsAgreed && (
                    <Ionicons name="checkmark" size={14} color={colors.bg.canvas} />
                  )}
                </View>
                <Text style={styles.termsText}>
                  서비스 이용약관 및 개인정보 처리방침에 동의합니다
                </Text>
              </Pressable>

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
  fieldError: {
    fontSize: fontSizes.sm,
    color: colors.brand.error,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  inputWithToggle: {
    position: 'relative',
    justifyContent: 'center',
  },
  fieldInputFlex: {
    paddingRight: 48,
  },
  toggleBtn: {
    position: 'absolute',
    right: spacing.md,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  validationText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radii.xs,
    borderWidth: 1.5,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primary,
  },
  termsText: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
    lineHeight: 20,
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.sm,
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
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: radii.sm,
    backgroundColor: colors.brand.primary,
    marginTop: spacing.sm,
  },
  backToLoginBtnText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.bg.canvas,
  },
})
