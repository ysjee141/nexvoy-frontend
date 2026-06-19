/**
 * 새 여행 만들기 화면 (nexvoy-app)
 *
 * signup.tsx / login.tsx 의 폼 디자인 언어(독립 필드, primary 제출 버튼)를
 * 계승하되 여행 생성 폼 필드(여행지·출발일·도착일·인원 스테퍼)에 맞게 조정.
 *
 * 날짜는 네이티브 DateTimePicker 로 Date 객체를 직접 다루고, 제출/검증 시에만
 * toDateString() 으로 YYYY-MM-DD 문자열을 만든다. `toISOString()` 은 UTC 변환으로
 * TZ 왜곡 위험이 있어 금지 — 로컬 연/월/일을 직접 조합한다.
 *
 * createTrip 호출로 여행을 생성하고 상세 화면으로 이동한다. 화면은 폼 UI/검증/상태만 담당.
 */
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import DateTimePicker from '@react-native-community/datetimepicker'
import { createTrip } from '@nexvoy/core'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

const DESTINATION_MAX = 50

/** Date → YYYY-MM-DD. 로컬 연/월/일을 직접 조합한다(toISOString TZ 왜곡 방지). */
function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function NewTripScreen() {
  const router = useRouter()
  const { session } = useAuth()

  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)
  const [adultsCount, setAdultsCount] = useState(1)
  const [childrenCount, setChildrenCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)
  useEffect(() => () => { isMounted.current = false }, [])

  const startDateStr = toDateString(startDate)
  const endDateStr = toDateString(endDate)

  // 도착일이 출발일보다 이른 경우 인라인 경고용 플래그.
  const isDateOrderInvalid = endDate < startDate

  const canSubmit =
    destination.trim().length > 0 &&
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
        start_date: toDateString(startDate),
        end_date: toDateString(endDate),
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
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>여행지</Text>
            <TextInput
              style={styles.fieldInput}
              value={destination}
              onChangeText={setDestination}
              maxLength={DESTINATION_MAX}
              autoCorrect={false}
              placeholder="예) 제주도, 도쿄, 파리"
              placeholderTextColor={colors.brand.mutedSoft}
              returnKeyType="next"
            />
          </View>

          {/* 출발일 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>출발일</Text>
            <Pressable
              onPress={() => setShowStartPicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`출발일 ${startDateStr} 선택`}
              style={({ pressed }) => [styles.dateBtn, pressed && styles.pressedFade]}
            >
              <Text style={styles.dateBtnText}>{startDateStr}</Text>
              <Ionicons name="calendar-outline" size={18} color={colors.brand.muted} />
            </Pressable>
          </View>

          {/* 도착일 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>도착일</Text>
            <Pressable
              onPress={() => setShowEndPicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`도착일 ${endDateStr} 선택`}
              style={({ pressed }) => [styles.dateBtn, pressed && styles.pressedFade]}
            >
              <Text style={styles.dateBtnText}>{endDateStr}</Text>
              <Ionicons name="calendar-outline" size={18} color={colors.brand.muted} />
            </Pressable>
            {/* 날짜 순서 인라인 경고 */}
            {isDateOrderInvalid && (
              <Text style={styles.fieldError}>
                도착일은 출발일과 같거나 이후여야 해요.
              </Text>
            )}
          </View>

          {/* 출발일 피커 */}
          {showStartPicker &&
            (Platform.OS === 'ios' ? (
              <Modal transparent animationType="slide" visible>
                <Pressable
                  style={styles.pickerBackdrop}
                  onPress={() => setShowStartPicker(false)}
                />
                <View style={styles.pickerSheet}>
                  <View style={styles.pickerHeader}>
                    <Pressable
                      onPress={() => setShowStartPicker(false)}
                      hitSlop={8}
                      accessibilityRole="button"
                    >
                      <Text style={styles.pickerDone}>완료</Text>
                    </Pressable>
                  </View>
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="spinner"
                    onChange={(_, date) => {
                      if (date) setStartDate(date)
                    }}
                    locale="ko"
                  />
                </View>
              </Modal>
            ) : (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowStartPicker(false)
                  if (event.type === 'set' && date) setStartDate(date)
                }}
              />
            ))}

          {/* 도착일 피커 */}
          {showEndPicker &&
            (Platform.OS === 'ios' ? (
              <Modal transparent animationType="slide" visible>
                <Pressable
                  style={styles.pickerBackdrop}
                  onPress={() => setShowEndPicker(false)}
                />
                <View style={styles.pickerSheet}>
                  <View style={styles.pickerHeader}>
                    <Pressable
                      onPress={() => setShowEndPicker(false)}
                      hitSlop={8}
                      accessibilityRole="button"
                    >
                      <Text style={styles.pickerDone}>완료</Text>
                    </Pressable>
                  </View>
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display="spinner"
                    onChange={(_, date) => {
                      if (date) setEndDate(date)
                    }}
                    locale="ko"
                  />
                </View>
              </Modal>
            ) : (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowEndPicker(false)
                  if (event.type === 'set' && date) setEndDate(date)
                }}
              />
            ))}

          {/* 인원 섹션 */}
          <Text style={styles.sectionLabel}>인원</Text>
          <View style={styles.stepperGroup}>
            <Stepper
              label="성인"
              value={adultsCount}
              min={1}
              onChange={setAdultsCount}
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
}

function Stepper({ label, value, min, onChange }: StepperProps) {
  const canDecrement = value > min

  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={() => canDecrement && onChange(value - 1)}
          disabled={!canDecrement}
          accessibilityRole="button"
          accessibilityLabel={`${label} 인원 줄이기`}
          hitSlop={8}
          style={({ pressed }) => [
            canDecrement ? styles.minusBtnActive : styles.minusBtnDisabled,
            pressed && canDecrement && styles.pressedFade,
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
            styles.plusBtn,
            pressed && styles.pressedFade,
          ]}
        >
          <Ionicons name="add" size={18} color={colors.bg.canvas} />
        </Pressable>
      </View>
    </View>
  )
}

const STEP_VALUE_WIDTH = 24

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
  dateBtn: {
    height: 52,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateBtnText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.normal,
    color: colors.brand.ink,
  },
  // iOS DatePicker 모달 시트
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pickerSheet: {
    backgroundColor: colors.bg.canvas,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: spacing.xl,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.hairline,
  },
  pickerDone: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.brand.primary,
  },
  sectionLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.brand.muted,
    marginBottom: spacing.sm,
  },
  fieldError: {
    fontSize: fontSizes.sm,
    color: colors.brand.error,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  // 스테퍼
  stepperGroup: {
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusBtnActive: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusBtnDisabled: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
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
  // 제출 버튼
  submitBtn: {
    marginTop: spacing.sm,
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: colors.brand.primaryDisabled,
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
