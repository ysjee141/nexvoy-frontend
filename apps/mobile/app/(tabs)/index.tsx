/**
 * 홈 탭 — 여행 목록 + 빈 상태.
 * @nexvoy/core 의 getTripsByUser 쿼리를 supabase client 주입하여 사용(ADR-010).
 * loading / empty / list 3-상태 분기. 디자인 토큰은 @/theme 사용.
 */
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getTripsByUser, formatDate } from '@nexvoy/core'
import type { Trip } from '@nexvoy/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { colors, fontSizes, fontWeights, radii, spacing, shadows } from '@/theme'

export default function HomeScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  const loadTrips = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    try {
      const data = await getTripsByUser(supabase, session.user.id)
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

  const renderTrip = ({ item }: { item: Trip }) => (
    <Pressable
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: item.id } })}
      style={({ pressed }) => [
        styles.tripCard,
        pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={styles.tripCardThumb}>
        <Ionicons name="airplane" size={22} color={colors.brand.muted} />
      </View>
      <View style={styles.tripCardBody}>
        <Text style={styles.tripTitle} numberOfLines={1}>
          {item.destination}
        </Text>
        <View style={styles.tripMetaRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.brand.muted} />
          <Text style={styles.tripMetaText}>
            {formatDate(item.start_date)} ~ {formatDate(item.end_date)}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.brand.mutedSoft} />
    </Pressable>
  )

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
      ) : trips.length > 0 ? (
        <>
          <FlatList
            data={trips}
            keyExtractor={(t) => t.id}
            renderItem={renderTrip}
            contentContainerStyle={styles.listBody}
          />
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
    gap: spacing.md,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.canvas,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  tripCardThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripCardBody: { flex: 1 },
  tripTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  tripMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tripMetaText: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
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
