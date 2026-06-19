/**
 * 새 여행 만들기 화면 (nexvoy-app)
 *
 * signup.tsx / login.tsx 의 폼 디자인 언어(셀형 inputGroup, divider, primary 제출 버튼)를
 * 계승하되 여행 생성 폼 필드(여행지·출발일·도착일·인원 스테퍼)에 맞게 조정.
 *
 * 날짜는 YYYY-MM-DD 문자열로만 다룬다. `new Date('YYYY-MM-DD')` 파싱은 TZ 왜곡 위험이
 * 있어 금지 — 형식 검증은 정규식, 선후 비교는 문자열 사전식 비교(endDate >= startDate)로 처리.
 *
 * createTrip API 호출은 frontend-developer 가 연결(TODO stub). 화면은 폼 UI/검증/상태만 담당.
 */
import { useEffect, useRef, useState } from 'react'
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
import { createTrip } from '@nexvoy/core'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

const DESTINATION_MAX = 50

/** YYYY-MM-DD 형식인지 검사. 값 파싱 없이 형식만 본다(TZ 왜곡 방지). */
const isDateValid = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)

export default function NewTripScreen() {
  const router = useRouter()
  const { session } = useAuth()

  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [adultsCount, setAdultsCount] = useState(1)
  const [childrenCount, setChildrenCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)
  useEffect(() => () => { isMounted.current = false }, [])

  // 날짜 형식은 맞으나 도착일이 출발일보다 이른 경우 인라인 경고용 플래그.
  const datesFilled = isDateValid(startDate) && isDateValid(endDate)
  const isDateOrderInvalid = datesFilled && endDate < startDate

  const canSubmit =
    destination.trim().length > 0 &&
    isDateValid(startDate) &&
    isDateValid(endDate) &&
    endDate >= startDate &&
    !loading

  const handleSubmit = async () => {
    if (!canSubmit || !session?.user) return
    setLoading(true)
    setError(null)
    try {
      const trip = await createTrip(supabase, {
        user_id: session.user.id,
        destination: destination.trim(),
        start_date: startDate,
        end_date: endDate,
        adults_count: adultsCount,
        children_count: childrenCount,
      })
      router.replace({ pathname: '/trip/[id]', params: { id: trip.id } })
    } catch (e) {
      if (isMounted.current) {
        setError(
          e instanceof Error
            ? e.message
            : '여행 생성에 실패했어요. 잠시 후 다시 시도해 주세요.'
        )
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* 헤더 (고정) */}
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
          새 여행 만들기
        </Text>
        {/* 타이틀 중앙 정렬을 위한 우측 균형 spacer */}
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled"
        >
          {/* 여행지 */}
          <View style={styles.inputGroup}>
            <View style={styles.inputCell}>
              <Text style={styles.inputLabel}>여행지</Text>
              <TextInput
                style={styles.textInput}
                value={destination}
                onChangeText={setDestination}
                maxLength={DESTINATION_MAX}
                autoCorrect={false}
                placeholder="예) 제주도, 도쿄, 파리"
                placeholderTextColor={colors.brand.mutedSoft}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* 출발일 / 도착일 */}
          <View style={styles.inputGroup}>
            <View style={[styles.inputCell, styles.inputCellDivider]}>
              <Text style={styles.inputLabel}>출발일</Text>
              <TextInput
                style={styles.textInput}
                value={startDate}
                onChangeText={setStartDate}
                keyboardType="numeric"
                autoCorrect={false}
                placeholder="2025-12-25"
                placeholderTextColor={colors.brand.mutedSoft}
                maxLength={10}
                returnKeyType="next"
              />
            </View>
            <View style={styles.inputCell}>
              <Text style={styles.inputLabel}>도착일</Text>
              <TextInput
                style={styles.textInput}
                value={endDate}
                onChangeText={setEndDate}
                keyboardType="numeric"
                autoCorrect={false}
                placeholder="2025-12-28"
                placeholderTextColor={colors.brand.mutedSoft}
                maxLength={10}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* 날짜 순서 인라인 경고 */}
          {isDateOrderInvalid && (
            <Text style={styles.fieldError}>
              도착일은 출발일과 같거나 이후여야 해요.
            </Text>
          )}

          {/* 인원 섹션 */}
          <Text style={styles.sectionLabel}>인원</Text>
          <View style={styles.inputGroup}>
            <Stepper
              label="성인"
              value={adultsCount}
              min={1}
              onChange={setAdultsCount}
              divider
            />
            <Stepper
              label="아동"
              value={childrenCount}
              min={0}
              onChange={setChildrenCount}
            />
          </View>

          {/* 서버 에러 */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* 제출 */}
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && canSubmit && styles.pressedSoft,
              !canSubmit && styles.submitBtnDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg.canvas} />
            ) : (
              <Text style={styles.submitBtnText}>여행 만들기</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── 인라인 스테퍼 (성인/아동 인원) ───────────────────────────────────────────

interface StepperProps {
  label: string
  value: number
  min: number
  onChange: (next: number) => void
  /** 하단 divider 표시 여부(그룹 내 마지막 행은 false). */
  divider?: boolean
}

function Stepper({ label, value, min, onChange, divider }: StepperProps) {
  const canDecrement = value > min

  return (
    <View style={[styles.stepperRow, divider && styles.inputCellDivider]}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={() => canDecrement && onChange(value - 1)}
          disabled={!canDecrement}
          accessibilityRole="button"
          accessibilityLabel={`${label} 인원 줄이기`}
          hitSlop={8}
          style={({ pressed }) => [
            styles.stepBtn,
            pressed && canDecrement && styles.pressedFade,
            !canDecrement && styles.stepBtnDisabled,
          ]}
        >
          <Ionicons
            name="remove"
            size={18}
            color={canDecrement ? colors.brand.ink : colors.brand.mutedSoft}
          />
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable
          onPress={() => onChange(value + 1)}
          accessibilityRole="button"
          accessibilityLabel={`${label} 인원 늘리기`}
          hitSlop={8}
          style={({ pressed }) => [
            styles.stepBtn,
            pressed && styles.pressedFade,
          ]}
        >
          <Ionicons name="add" size={18} color={colors.brand.ink} />
        </Pressable>
      </View>
    </View>
  )
}

const STEP_BTN_SIZE = 36
const STEP_VALUE_WIDTH = 20

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
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
  headerRight: {
    width: 44,
    height: 44,
  },
  // 본문
  scrollBody: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
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
  sectionLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  fieldError: {
    fontSize: fontSizes.sm,
    color: colors.brand.error,
    marginTop: -spacing.sm,
    marginBottom: spacing.base,
    paddingHorizontal: spacing.xs,
  },
  // 스테퍼
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  stepperLabel: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.brand.ink,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBtn: {
    width: STEP_BTN_SIZE,
    height: STEP_BTN_SIZE,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.5,
  },
  stepValue: {
    width: STEP_VALUE_WIDTH,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
    textAlign: 'center',
  },
  // 에러 박스
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
  // 제출 버튼
  submitBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.base,
    borderRadius: radii.md,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.bg.canvas,
  },
  // 인터랙션
  pressedSoft: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  pressedFade: {
    opacity: 0.6,
  },
})
