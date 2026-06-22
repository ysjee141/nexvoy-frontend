/**
 * 회원 탈퇴 화면 (nexvoy-app) — 2단계 확인 플로우.
 *
 * Step 1: 보유 데이터 현황 + 경고 표시.
 * Step 2: "탈퇴" 텍스트 입력 일치 시에만 최종 탈퇴 활성.
 *
 * 실제 삭제는 deleteUser(delete_user RPC, SECURITY DEFINER 서버측 검증) 호출.
 * 삭제 성공 후 signOut() → 루트 레이아웃 auth gate 가 로그인 화면으로 리다이렉트한다.
 * 데이터 카운트 조회는 RLS 로 본인 데이터만 노출됨을 전제로 한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { deleteUser } from '@nexvoy/core'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

const CONFIRM_KEYWORD = '탈퇴'

export default function WithdrawalScreen() {
  const router = useRouter()
  const { session, signOut } = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [tripCount, setTripCount] = useState(0)
  const [itemCount, setItemCount] = useState(0)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)
  useEffect(() => () => { isMounted.current = false }, [])

  const loadStats = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    setError(null)
    try {
      const { data: trips, error: tripErr } = await supabase
        .from('trips')
        .select('id')
        .eq('user_id', session.user.id)
      if (tripErr) throw tripErr

      const tripIds = (trips ?? []).map((t: { id: string }) => t.id)
      let items = 0
      if (tripIds.length > 0) {
        const { data: checklists, error: clErr } = await supabase
          .from('checklists')
          .select('id')
          .in('trip_id', tripIds)
        if (clErr) throw clErr

        const checklistIds = (checklists ?? []).map((c: { id: string }) => c.id)
        if (checklistIds.length > 0) {
          const { count, error: itemErr } = await supabase
            .from('checklist_items')
            .select('id', { count: 'exact', head: true })
            .in('checklist_id', checklistIds)
          if (itemErr) throw itemErr
          items = count ?? 0
        }
      }

      if (isMounted.current) {
        setTripCount(tripIds.length)
        setItemCount(items)
      }
    } catch {
      if (isMounted.current) {
        setError('정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const canConfirm = confirmText.trim() === CONFIRM_KEYWORD && !deleting

  const handleDelete = async () => {
    if (!canConfirm) return
    setDeleting(true)
    setError(null)
    try {
      await deleteUser(supabase)
      await signOut()
      // auth gate 가 세션 소멸을 감지해 자동 리다이렉트하지만,
      // 명시적으로 로그인 화면으로 이동시켜 잔여 상태를 정리한다.
      router.replace('/(auth)/login')
    } catch {
      if (isMounted.current) {
        setError('계정을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.')
        setDeleting(false)
      }
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressedFade]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.brand.ink} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          회원 탈퇴
        </Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 1 ? (
              <>
                {/* 경고 배너 */}
                <View style={styles.warnBox}>
                  <Ionicons
                    name="warning-outline"
                    size={22}
                    color={colors.brand.error}
                  />
                  <Text style={styles.warnText}>
                    탈퇴 시 계정과 모든 데이터가 영구적으로 삭제되며 복구할 수
                    없어요.
                  </Text>
                </View>

                {/* 데이터 현황 */}
                <View style={styles.dataCard}>
                  <Text style={styles.dataCardTitle}>삭제되는 데이터</Text>
                  <View style={styles.dataRow}>
                    <Ionicons
                      name="airplane-outline"
                      size={18}
                      color={colors.brand.muted}
                    />
                    <Text style={styles.dataLabel}>여행</Text>
                    <Text style={styles.dataValue}>{tripCount}건</Text>
                  </View>
                  <View style={styles.dataDivider} />
                  <View style={styles.dataRow}>
                    <Ionicons
                      name="bag-handle-outline"
                      size={18}
                      color={colors.brand.muted}
                    />
                    <Text style={styles.dataLabel}>준비물 아이템</Text>
                    <Text style={styles.dataValue}>{itemCount}개</Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => setStep(2)}
                  accessibilityRole="button"
                  accessibilityLabel="탈퇴하기"
                  style={({ pressed }) => [
                    styles.dangerBtn,
                    pressed && styles.pressedSoft,
                  ]}
                >
                  <Text style={styles.dangerBtnText}>탈퇴하기</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.back()}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.ghostBtn,
                    pressed && styles.pressedFade,
                  ]}
                >
                  <Text style={styles.ghostBtnText}>계속 함께하기</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.confirmHeading}>최종 확인</Text>
                <Text style={styles.confirmDesc}>
                  탈퇴를 확인하려면 아래 입력란에{' '}
                  <Text style={styles.confirmKeyword}>‘{CONFIRM_KEYWORD}’</Text>
                  를 입력해 주세요.
                </Text>

                <TextInput
                  style={styles.fieldInput}
                  value={confirmText}
                  onChangeText={setConfirmText}
                  placeholder={CONFIRM_KEYWORD}
                  placeholderTextColor={colors.brand.mutedSoft}
                  autoCorrect={false}
                  autoCapitalize="none"
                  editable={!deleting}
                  accessibilityLabel="탈퇴 확인 입력"
                  returnKeyType="done"
                />

                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <Pressable
                  onPress={handleDelete}
                  disabled={!canConfirm}
                  accessibilityRole="button"
                  accessibilityLabel="최종 탈퇴"
                  accessibilityState={{ disabled: !canConfirm }}
                  style={({ pressed }) => [
                    styles.dangerBtn,
                    pressed && canConfirm && styles.pressedSoft,
                    !canConfirm && styles.dangerBtnDisabled,
                  ]}
                >
                  {deleting ? (
                    <ActivityIndicator color={colors.bg.canvas} />
                  ) : (
                    <Text style={styles.dangerBtnText}>최종 탈퇴</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    setConfirmText('')
                    setError(null)
                    setStep(1)
                  }}
                  disabled={deleting}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.ghostBtn,
                    pressed && styles.pressedFade,
                  ]}
                >
                  <Text style={styles.ghostBtnText}>취소</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg.canvas },
  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
    textAlign: 'center',
  },
  headerRight: { width: 44, height: 44 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.base,
  },
  // 경고 배너
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: radii.md,
    backgroundColor: colors.bg.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.brand.error,
  },
  warnText: {
    flex: 1,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    color: colors.brand.body,
  },
  // 데이터 현황 카드
  dataCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    backgroundColor: colors.bg.canvas,
    padding: spacing.base,
    gap: spacing.sm,
  },
  dataCardTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.brand.muted,
    marginBottom: spacing.xxs,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dataLabel: {
    fontSize: fontSizes.base,
    color: colors.brand.ink,
  },
  dataValue: {
    marginLeft: 'auto',
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  dataDivider: {
    height: 1,
    backgroundColor: colors.brand.hairlineSoft,
  },
  // Step 2
  confirmHeading: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  confirmDesc: {
    fontSize: fontSizes.sm,
    lineHeight: 20,
    color: colors.brand.muted,
  },
  confirmKeyword: {
    fontWeight: fontWeights.bold,
    color: colors.brand.error,
  },
  fieldInput: {
    height: 52,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.base,
    color: colors.brand.ink,
  },
  // 버튼
  dangerBtn: {
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.brand.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  dangerBtnDisabled: {
    backgroundColor: colors.brand.mutedSoft,
  },
  dangerBtnText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.bg.canvas,
  },
  ghostBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.brand.muted,
  },
  // 에러
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.error,
    backgroundColor: colors.bg.surfaceSoft,
  },
  errorText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.brand.error,
  },
  // 인터랙션
  pressedSoft: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  pressedFade: { opacity: 0.6 },
})
