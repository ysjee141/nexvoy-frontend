/**
 * 여행 기록 화면 (nexvoy-app)
 *
 * getTravelStats(@nexvoy/core)로 사용자 여행 통계를 집계해
 * 4칸 통계 카드 + 지난/예정 여정 목록으로 표시한다.
 * 화면은 데이터 표시/로딩/에러 상태만 담당하며 집계 로직은 core 쿼리에 위임.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { formatDate, getTravelStats } from '@nexvoy/core'
import type { TravelStats } from '@nexvoy/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

type TripEntry = TravelStats['pastTrips'][number]

export default function TravelLogScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const [stats, setStats] = useState<TravelStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)
  useEffect(() => () => { isMounted.current = false }, [])

  const load = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    setError(null)
    try {
      const data = await getTravelStats(supabase, session.user.id)
      if (isMounted.current) setStats(data)
    } catch {
      if (isMounted.current) {
        setError('여행 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    load()
  }, [load])

  const hasAny =
    !!stats &&
    (stats.pastTrips.length > 0 || stats.upcomingTrips.length > 0)

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
          여행 기록
        </Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={load}
            accessibilityRole="button"
            style={({ pressed }) => [styles.retryBtn, pressed && styles.pressedFade]}
          >
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* 통계 카드 그리드 */}
          <View style={styles.statsGrid}>
            <StatCard value={`${stats?.totalDays ?? 0}일`} label="총 여행일" />
            <StatCard value={`${stats?.completedCount ?? 0}건`} label="완료한 여행" />
            <StatCard value={`${stats?.longestTripDays ?? 0}일`} label="최장 여행" />
            <StatCard
              value={`${stats?.uniqueDestinations ?? 0}곳`}
              label="방문 목적지"
            />
          </View>

          {!hasAny ? (
            <View style={styles.emptyBox}>
              <Ionicons
                name="airplane-outline"
                size={36}
                color={colors.brand.mutedSoft}
              />
              <Text style={styles.emptyText}>아직 여행 기록이 없어요</Text>
            </View>
          ) : (
            <>
              {(stats?.upcomingTrips.length ?? 0) > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>예정 여정</Text>
                  <View style={styles.tripList}>
                    {stats?.upcomingTrips.map((t) => (
                      <TripCard key={t.id} trip={t} />
                    ))}
                  </View>
                </View>
              )}

              {(stats?.pastTrips.length ?? 0) > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>지난 여정</Text>
                  <View style={styles.tripList}>
                    {stats?.pastTrips.map((t) => (
                      <TripCard key={t.id} trip={t} />
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function TripCard({ trip }: { trip: TripEntry }) {
  return (
    <View style={styles.tripCard}>
      <Ionicons
        name="location-outline"
        size={18}
        color={colors.brand.primary}
      />
      <View style={styles.tripCardBody}>
        <Text style={styles.tripDestination} numberOfLines={1}>
          {trip.destination || '여행지 미정'}
        </Text>
        <Text style={styles.tripDates}>
          {formatDate(trip.start_date)} ~ {formatDate(trip.end_date)}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
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
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.lg,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  // 통계 카드
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.bg.surfaceSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  statValue: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  statLabel: {
    fontSize: fontSizes.xs,
    color: colors.brand.muted,
  },
  // 섹션
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.brand.muted,
  },
  tripList: { gap: spacing.sm },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    backgroundColor: colors.bg.canvas,
  },
  tripCardBody: { flex: 1, gap: spacing.xxs },
  tripDestination: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.brand.ink,
  },
  tripDates: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
  },
  // 빈 상태
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSizes.base,
    color: colors.brand.muted,
  },
  // 에러
  errorText: {
    fontSize: fontSizes.sm,
    color: colors.brand.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.border,
  },
  retryText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  pressedFade: { opacity: 0.6 },
})
