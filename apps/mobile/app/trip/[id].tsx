/**
 * 여행 상세 화면 — Trip 메타 + 날짜별 일정 타임라인.
 * @nexvoy/core 의 getTripWithPlans 를 supabase client 주입하여 사용(ADR-010).
 * loading / error / data 3-상태 분기. 디자인 토큰은 @/theme 사용.
 *
 * 날짜/시간 표기는 `new Date()` 생성자 파싱 금지(TZ 왜곡 방지) — 문자열 슬라이싱으로 처리.
 * 단, "N박 M일" 일수 계산은 자정 고정 date 문자열 차이라 안전하게 Date 연산 사용.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getTripWithPlans, formatDate } from '@nexvoy/core'
import type { Plan, Trip } from '@nexvoy/types'
import { Card } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import {
  colors,
  fontSizes,
  fontWeights,
  radii,
  spacing,
} from '@/theme'

// ─── 날짜/시간 파싱 유틸 (파일 로컬, new Date() 생성자 금지) ───────────────────

/** "2024-06-19 14:30:00" → "14:30" */
function parseTime(dt: string): string {
  return dt.replace(' ', 'T').split('T')[1]?.slice(0, 5) ?? ''
}

/** "2024-06-19 14:30:00" → "2024-06-19" */
function parseDate(dt: string): string {
  return dt.split(' ')[0] ?? dt
}

/** "2024-06-19" → "6월 19일" */
function formatSectionDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

/**
 * "N박 M일" 라벨. start/end 모두 YYYY-MM-DD(자정 고정)이라 Date 차이 연산 안전.
 * nights<=0(당일/이상치)이면 "당일" 처리.
 */
function formatDuration(startDate: string, endDate: string): string {
  const nights = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000
  )
  if (nights <= 0) return '당일'
  return `${nights}박 ${nights + 1}일`
}

// ─── Plan 날짜 그룹화 ─────────────────────────────────────────────────────────

interface PlanGroup {
  date: string // YYYY-MM-DD
  plans: Plan[]
}

/** plans 는 start_datetime_local 오름차순(쿼리 보장) → 순회하며 날짜 파트로 그룹화. */
function groupPlansByDate(plans: Plan[]): PlanGroup[] {
  const groups: PlanGroup[] = []
  for (const plan of plans) {
    const date = parseDate(plan.start_datetime_local)
    const last = groups[groups.length - 1]
    if (last && last.date === date) {
      last.plans.push(plan)
    } else {
      groups.push({ date, plans: [plan] })
    }
  }
  return groups
}

// ─── 화면 ─────────────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadTrip = useCallback(async () => {
    if (!id) {
      setError(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    try {
      const data = await getTripWithPlans(supabase, id)
      setTrip(data.trip)
      setPlans(data.plans)
    } catch {
      // 상세는 특정 trip 이 필수 → 에러를 명시(빈 목록 흡수 X)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadTrip()
  }, [loadTrip])

  const groups = groupPlansByDate(plans)

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* 헤더 (고정) */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={12}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressedFade]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.brand.ink} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {trip?.destination ?? ''}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : error || !trip ? (
        <View style={styles.centerFill}>
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color={colors.brand.mutedSoft}
          />
          <Text style={styles.errorTitle}>여행 정보를 불러오지 못했어요</Text>
          <Pressable
            onPress={loadTrip}
            accessibilityRole="button"
            style={({ pressed }) => [pressed && styles.pressedFade]}
          >
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {/* 메타 섹션 (평면형) */}
          <View style={styles.meta}>
            <Text
              style={styles.destination}
              accessibilityRole="header"
              numberOfLines={2}
            >
              {trip.destination}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={colors.brand.muted}
              />
              <Text style={styles.metaText}>
                {formatDate(trip.start_date)} ~ {formatDate(trip.end_date)} ·{' '}
                {formatDuration(trip.start_date, trip.end_date)}
              </Text>
            </View>
            {trip.adults_count > 0 || trip.children_count > 0 ? (
              <View style={styles.metaRow}>
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={colors.brand.muted}
                />
                <Text style={styles.metaTextSmall}>
                  성인 {trip.adults_count}
                  {trip.children_count > 0 ? ` · 아동 ${trip.children_count}` : ''}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.divider} />

          {/* 일정 타임라인 */}
          {groups.length > 0 ? (
            groups.map((group) => (
              <View key={group.date} style={styles.section}>
                <Text style={styles.sectionHeader} accessibilityRole="header">
                  {formatSectionDate(group.date)}
                </Text>
                {group.plans.map((plan) => (
                  <View key={plan.id} style={styles.timelineRow}>
                    {/* 레일: 세로선 + dot (장식 → a11y 제외) */}
                    <View
                      style={styles.rail}
                      importantForAccessibility="no"
                      accessibilityElementsHidden
                    >
                      <View style={styles.railLine} />
                      <View style={styles.dot} />
                    </View>
                    {/* 시간 + Plan Card */}
                    <View style={styles.timelineContent}>
                      <Text style={styles.timeLabel}>
                        {parseTime(plan.start_datetime_local)}
                      </Text>
                      <Card elevated padding="md" style={styles.planCard}>
                        <Text style={styles.planTitle} numberOfLines={2}>
                          {plan.title}
                        </Text>
                        {plan.location ? (
                          <View style={styles.planLocationRow}>
                            <Ionicons
                              name="location-outline"
                              size={13}
                              color={colors.brand.muted}
                            />
                            <Text style={styles.planLocation} numberOfLines={1}>
                              {plan.location}
                            </Text>
                          </View>
                        ) : null}
                      </Card>
                    </View>
                  </View>
                ))}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIllust}>
                <Ionicons
                  name="calendar-outline"
                  size={40}
                  color={colors.brand.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>아직 등록된 일정이 없어요</Text>
              <Text style={styles.emptyDesc}>
                첫 일정을 추가해 여정을 그려보세요.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const RAIL_WIDTH = 24
const DOT_SIZE = 8

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
    gap: spacing.xs,
  },
  backButton: {
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
  },
  pressedFade: { opacity: 0.7 },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontSize: fontSizes.md,
    color: colors.brand.muted,
    textAlign: 'center',
  },
  retryText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.brand.primary,
  },
  body: {
    paddingBottom: spacing.xxxl,
  },
  meta: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
    gap: spacing.xs,
  },
  destination: {
    fontSize: fontSizes['4xl'],
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  metaText: {
    fontSize: fontSizes.md,
    color: colors.brand.muted,
  },
  metaTextSmall: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.brand.hairlineSoft,
    marginHorizontal: spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
    marginBottom: spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
  },
  railLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.brand.border,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.brand.mutedSoft,
    marginTop: spacing.xs,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  timeLabel: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
  },
  planCard: {
    gap: spacing.xs,
  },
  planTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  planLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  planLocation: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.base,
  },
  emptyIllust: {
    width: 96,
    height: 96,
    borderRadius: radii.full,
    backgroundColor: colors.bg.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  emptyDesc: {
    fontSize: fontSizes.md,
    color: colors.brand.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
})
