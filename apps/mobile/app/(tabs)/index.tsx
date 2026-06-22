/**
 * 홈 탭 — 여행 목록(진행 중/예정/지난) + 빈 상태.
 * @nexvoy/core 의 getTripsWithProgress 쿼리를 supabase client 주입하여 사용(ADR-010).
 * 웹 HomeClient/TripSection 카드 구조에 맞춰 3섹션 분류 + 진행률 카드로 정렬.
 * 디자인 토큰은 @/theme 사용.
 */
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  type DimensionValue,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getTripsWithProgress, formatDate } from '@nexvoy/core'
import type { TripWithProgress } from '@nexvoy/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { colors, fontSizes, fontWeights, radii, spacing, shadows } from '@/theme'

type TripStatus = 'ongoing' | 'upcoming' | 'past'

interface TripSection {
  key: TripStatus
  emoji: string
  title: string
  trips: TripWithProgress[]
}

/** `new Date('YYYY-MM-DD')` 는 UTC 로 해석되어 로컬 자정과 어긋난다. 로컬 자정 Date 로 변환. */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const STATUS_BADGE: Record<TripStatus, { label: string; bg: string; color: string }> = {
  // 여행 중: success 계열 (디자인 토큰에 accent 없음 → success 사용)
  ongoing: { label: '여행 중', bg: colors.brand.success + '1A', color: colors.brand.success },
  upcoming: { label: '예정', bg: colors.brand.primary + '1A', color: colors.brand.primary },
  past: { label: '완료', bg: colors.bg.surfaceStrong, color: colors.brand.muted },
}

const STATUS_FILL: Record<TripStatus, string> = {
  ongoing: colors.brand.success,
  upcoming: colors.brand.primary,
  past: colors.brand.primary,
}

export default function HomeScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const [trips, setTrips] = useState<TripWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [openSections, setOpenSections] = useState<Record<TripStatus, boolean>>({
    ongoing: true,
    upcoming: true,
    past: false,
  })

  const loadTrips = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    try {
      const data = await getTripsWithProgress(supabase, session.user.id)
      setTrips(data)
    } catch {
      // 조회 실패 시 직전 목록 유지 (useFocusEffect 재진입 시 깜박임 방지)
    } finally {
      setLoading(false)
    }
  }, [session?.user])

  useFocusEffect(
    useCallback(() => {
      loadTrips()
    }, [loadTrips])
  )

  const sections = useMemo<TripSection[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const ongoingTrips = trips.filter(
      (t) => parseLocalDate(t.start_date) <= today && parseLocalDate(t.end_date) >= today
    )
    const upcomingTrips = trips.filter((t) => parseLocalDate(t.start_date) > today)
    const pastTrips = trips.filter((t) => parseLocalDate(t.end_date) < today)

    return [
      { key: 'ongoing', emoji: '✈️', title: '여행 중', trips: ongoingTrips },
      { key: 'upcoming', emoji: '📅', title: '예정', trips: upcomingTrips },
      { key: 'past', emoji: '📷', title: '다녀온 여행', trips: pastTrips },
    ]
  }, [trips])

  const hasAnyTrip = sections.some((s) => s.trips.length > 0)
  const toggleSection = (key: TripStatus) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const renderCard = (trip: TripWithProgress, status: TripStatus) => {
    const badge = STATUS_BADGE[status]
    const isDone = trip.progressPercent === 100
    const fillColor = isDone ? colors.brand.success : STATUS_FILL[status]
    const showPeople = trip.adults_count > 0 || trip.children_count > 0

    return (
      <Pressable
        key={trip.id}
        onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
        style={({ pressed }) => [
          styles.tripCard,
          pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
        ]}
      >
        {/* 배지 row */}
        <View style={styles.badgeRow}>
          <View style={[styles.ownerBadge, trip.isOwner ? styles.ownerBadgeOwned : styles.ownerBadgeShared]}>
            <Text style={[styles.ownerBadgeText, { color: trip.isOwner ? colors.brand.primary : colors.brand.muted }]}>
              {trip.isOwner ? '내 소중한 여정' : '함께하고 있어요'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        {/* 목적지 row */}
        <View style={styles.destinationRow}>
          <Ionicons name="location" size={18} color={colors.brand.ink} />
          <Text style={styles.destinationText} numberOfLines={1}>
            {trip.destination}
          </Text>
        </View>

        {/* 날짜 row */}
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.brand.muted} />
          <Text style={styles.metaText}>
            {formatDate(trip.start_date)} ~ {formatDate(trip.end_date)}
          </Text>
        </View>

        {/* 인원 row */}
        {showPeople && (
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color={colors.brand.muted} />
            <Text style={styles.metaText}>
              성인 {trip.adults_count}명
              {trip.children_count > 0 ? ` · 아동 ${trip.children_count}명` : ''}
            </Text>
          </View>
        )}

        {/* 진행률 */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>준비물</Text>
            <Text style={[styles.progressValue, { color: isDone ? colors.brand.success : colors.brand.primary }]}>
              {trip.progressPercent}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${trip.progressPercent}%` as DimensionValue,
                  backgroundColor: fillColor,
                },
              ]}
            />
          </View>
        </View>
      </Pressable>
    )
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>안녕하세요 👋</Text>
        <Text style={styles.heading}>어디로 떠나볼까요?</Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : hasAnyTrip ? (
        <>
          <ScrollView contentContainerStyle={styles.listBody}>
            {sections.map((section) =>
              section.trips.length === 0 ? null : (
                <View key={section.key} style={styles.section}>
                  <Pressable
                    onPress={() => toggleSection(section.key)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: openSections[section.key] }}
                    accessibilityLabel={`${section.title} 섹션 ${openSections[section.key] ? '접기' : '펼치기'}`}
                    style={({ pressed }) => [styles.sectionHeader, pressed && styles.sectionHeaderPressed]}
                  >
                    <Text style={styles.sectionEmoji}>{section.emoji}</Text>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionCount}>{section.trips.length}개</Text>
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={colors.brand.muted}
                      style={openSections[section.key] ? styles.sectionChevronOpen : styles.sectionChevron}
                    />
                  </Pressable>
                  {openSections[section.key]
                    ? section.trips.map((trip) => renderCard(trip, section.key))
                    : null}
                </View>
              )
            )}
          </ScrollView>
          <Pressable
            onPress={() => router.push('/trip/new')}
            accessibilityRole="button"
            accessibilityLabel="새 여행 만들기"
            style={({ pressed }) => [
              styles.fab,
              pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Ionicons name="add" size={28} color={colors.bg.canvas} />
          </Pressable>
        </>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIllust}>
            <Ionicons name="map-outline" size={40} color={colors.brand.primary} />
          </View>
          <Text style={styles.emptyTitle}>아직 떠날 여정이 없어요</Text>
          <Text style={styles.emptyDesc}>
            첫 여행을 만들고 설렘을 기록해 보세요.
          </Text>
          <Pressable
            onPress={() => router.push('/trip/new')}
            accessibilityRole="button"
            accessibilityLabel="새 여행 만들기"
            style={({ pressed }) => [
              styles.emptyCta,
              pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.emptyCtaText}>새 여행 만들기</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.canvas },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
  },
  greeting: {
    fontSize: fontSizes.base,
    color: colors.brand.muted,
    marginBottom: spacing.xs,
  },
  heading: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    letterSpacing: -0.5,
  },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 44,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bg.surfaceSoft,
  },
  sectionHeaderPressed: {
    opacity: 0.75,
  },
  sectionEmoji: { fontSize: 20 },
  sectionTitle: {
    flex: 1,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  sectionCount: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
  },
  sectionChevron: {
    transform: [{ rotate: '0deg' }],
  },
  sectionChevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  tripCard: {
    backgroundColor: colors.bg.canvas,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    padding: spacing.base,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  ownerBadge: {
    borderRadius: radii.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  ownerBadgeOwned: {
    backgroundColor: colors.brand.primary + '1A',
  },
  ownerBadgeShared: {
    backgroundColor: colors.bg.surfaceSoft,
  },
  ownerBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  statusBadge: {
    borderRadius: radii.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  statusBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  destinationText: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  metaText: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
  },
  progressSection: {
    borderTopWidth: 1,
    borderTopColor: colors.brand.hairline,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    fontSize: fontSizes.xs,
    color: colors.brand.muted,
  },
  progressValue: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  progressTrack: {
    height: 6,
    borderRadius: 10,
    backgroundColor: colors.brand.hairline,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
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
  emptyCta: {
    backgroundColor: colors.brand.primary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  emptyCtaText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.bg.canvas,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
})
