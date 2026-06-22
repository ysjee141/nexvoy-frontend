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
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '@/theme'

const DESTINATION_MAX = 50
const PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ??
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
  ''

type GooglePlaceData = {
  description: string
  place_id?: string
  structured_formatting?: {
    main_text?: string
    secondary_text?: string
  }
}

type GoogleAutocompleteResponse = {
  status?: string
  predictions?: GooglePlaceData[]
}

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
  const [destinationResults, setDestinationResults] = useState<GooglePlaceData[]>([])
  const [destinationSearching, setDestinationSearching] = useState(false)
  const isMounted = useRef(true)
  const skipDestinationSearch = useRef(false)
  useEffect(() => () => { isMounted.current = false }, [])

  useEffect(() => {
    if (!PLACES_API_KEY) return
    if (skipDestinationSearch.current) {
      skipDestinationSearch.current = false
      return
    }

    const query = destination.trim()
    if (query.length < 2) {
      setDestinationResults([])
      setDestinationSearching(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setDestinationSearching(true)
      try {
        const params = new URLSearchParams({
          input: query,
          key: PLACES_API_KEY,
          language: 'ko',
          types: '(cities)',
        })
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
          { signal: controller.signal }
        )
        const json = (await res.json()) as GoogleAutocompleteResponse
        if (!isMounted.current) return
        setDestinationResults(json.status === 'OK' ? json.predictions ?? [] : [])
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
        if (isMounted.current) setDestinationResults([])
      } finally {
        if (isMounted.current) setDestinationSearching(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [destination])

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
          새로운 여행 계획
        </Text>
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
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="sparkles-outline" size={30} color={colors.brand.primary} />
            </View>
            <Text style={styles.heroTitle}>어디로 떠나시나요?</Text>
            <Text style={styles.heroSubtitle}>새로운 여행의 시작을 함께 계획해봐요.</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Ionicons name="location-outline" size={16} color={colors.brand.primary} />
                <Text style={styles.fieldLabel}>여행지 (국가/도시) *</Text>
              </View>
              <TextInput
                style={styles.fieldInput}
                value={destination}
                onChangeText={(value) => {
                  skipDestinationSearch.current = false
                  setDestination(value)
                }}
                maxLength={DESTINATION_MAX}
                autoCorrect={false}
                placeholder={PLACES_API_KEY ? '도시나 국가를 검색하세요' : '예) 제주도, 도쿄, 파리'}
                placeholderTextColor={colors.brand.mutedSoft}
                returnKeyType="next"
              />
              {destinationSearching ? (
                <View style={styles.searchStatus}>
                  <ActivityIndicator size="small" color={colors.brand.primary} />
                  <Text style={styles.searchStatusText}>여행지를 찾는 중...</Text>
                </View>
              ) : null}
              {destinationResults.length > 0 ? (
                <View style={styles.destinationResults}>
                  {destinationResults.map((result) => (
                    <Pressable
                      key={result.place_id ?? result.description}
                      onPress={() => {
                        skipDestinationSearch.current = true
                        setDestination(result.description)
                        setDestinationResults([])
                      }}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.destinationResultRow, pressed && styles.pressedFade]}
                    >
                      <Ionicons name="location-outline" size={17} color={colors.brand.primary} />
                      <View style={styles.destinationResultBody}>
                        <Text style={styles.destinationResultTitle} numberOfLines={1}>
                          {result.structured_formatting?.main_text ?? result.description}
                        </Text>
                        {result.structured_formatting?.secondary_text ? (
                          <Text style={styles.destinationResultSubtitle} numberOfLines={1}>
                            {result.structured_formatting.secondary_text}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.dateGrid}>
              <View style={styles.dateField}>
                <View style={styles.labelRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.brand.primary} />
                  <Text style={styles.fieldLabel}>시작일 *</Text>
                </View>
                <Pressable
                  onPress={() => setShowStartPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`시작일 ${startDateStr} 선택`}
                  style={({ pressed }) => [styles.dateBtn, pressed && styles.pressedFade]}
                >
                  <Text style={styles.dateBtnText}>{startDateStr}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.brand.muted} />
                </Pressable>
              </View>

              <View style={styles.dateField}>
                <View style={styles.labelRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.brand.primary} />
                  <Text style={styles.fieldLabel}>종료일 *</Text>
                </View>
                <Pressable
                  onPress={() => setShowEndPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`종료일 ${endDateStr} 선택`}
                  style={({ pressed }) => [styles.dateBtn, pressed && styles.pressedFade]}
                >
                  <Text style={styles.dateBtnText}>{endDateStr}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.brand.muted} />
                </Pressable>
              </View>
            </View>

            {isDateOrderInvalid && (
              <Text style={styles.fieldError}>
                종료일은 시작일과 같거나 이후여야 해요.
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
                    display="inline"
                    onChange={(_, date) => {
                      if (date) setStartDate(date)
                    }}
                    locale="ko"
                    themeVariant="light"
                    accentColor={colors.brand.primary}
                    textColor={colors.brand.ink}
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
                    display="inline"
                    onChange={(_, date) => {
                      if (date) setEndDate(date)
                    }}
                    locale="ko"
                    themeVariant="light"
                    accentColor={colors.brand.primary}
                    textColor={colors.brand.ink}
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

          <View style={styles.counterGrid}>
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

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.brand.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
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
              <>
                <ActivityIndicator color={colors.bg.canvas} />
                <Text style={styles.submitBtnText}>저장 중...</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={colors.bg.canvas} />
                <Text style={styles.submitBtnText}>여행 계획 시작하기</Text>
              </>
            )}
          </Pressable>
        </View>
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
    <View style={styles.counterCard}>
      <View style={styles.counterLabelRow}>
        <Ionicons name="people-outline" size={16} color={colors.brand.primary} />
        <Text style={styles.stepperLabel}>{label}</Text>
      </View>
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
    backgroundColor: colors.bg.surfaceSoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
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
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 44,
    height: 44,
  },
  scrollBody: {
    flexGrow: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
    backgroundColor: '#EFF6FF',
  },
  heroTitle: {
    color: colors.brand.ink,
    fontSize: 22,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    marginTop: spacing.xs,
    color: colors.brand.muted,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    textAlign: 'center',
  },
  formCard: {
    padding: spacing.base,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
    ...shadows.card,
  },
  field: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  fieldInput: {
    height: 58,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  searchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  searchStatusText: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
  },
  destinationResults: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
    overflow: 'hidden',
  },
  destinationResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.hairlineSoft,
  },
  destinationResultBody: {
    flex: 1,
    minWidth: 0,
  },
  destinationResultTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  destinationResultSubtitle: {
    marginTop: 2,
    color: colors.brand.muted,
    fontSize: fontSizes.xs,
  },
  dateGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  dateField: {
    flex: 1,
    gap: spacing.xs,
  },
  dateBtn: {
    height: 56,
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
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
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
  fieldError: {
    fontSize: fontSizes.sm,
    color: colors.brand.error,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
    fontWeight: fontWeights.semibold,
  },
  counterGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.base,
  },
  counterCard: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
    padding: spacing.sm,
    ...shadows.card,
  },
  counterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  stepperLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  plusBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusBtnActive: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusBtnDisabled: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    width: STEP_VALUE_WIDTH,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.error,
    backgroundColor: colors.bg.surfaceSoft,
    marginTop: spacing.base,
  },
  errorText: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.brand.error,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  submitBtn: {
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    ...shadows.fab,
  },
  submitBtnDisabled: {
    backgroundColor: colors.brand.primaryDisabled,
    shadowOpacity: 0,
    elevation: 0,
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
  pressedFade: {
    opacity: 0.6,
  },
})
