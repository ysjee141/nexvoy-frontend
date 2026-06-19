/**
 * 방문한 곳 화면 (nexvoy-app)
 *
 * getVisitedPlacesByUser(@nexvoy/core)로 plans.location 기준 집계된
 * 방문 목적지 목록을 표시한다. 각 카드는 장소명 + 방문 횟수 + 연관 여정 목적지.
 * 집계 로직은 core 쿼리에 위임하고 화면은 표시/로딩/에러만 담당.
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
import { getVisitedPlacesByUser } from '@nexvoy/core'
import type { VisitedPlace } from '@nexvoy/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

export default function PlacesVisitedScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const [places, setPlaces] = useState<VisitedPlace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)
  useEffect(() => () => { isMounted.current = false }, [])

  const load = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    setError(null)
    try {
      const data = await getVisitedPlacesByUser(supabase, session.user.id)
      if (isMounted.current) setPlaces(data)
    } catch {
      if (isMounted.current) {
        setError('방문 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    load()
  }, [load])

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
          방문한 곳
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
      ) : places.length === 0 ? (
        <View style={styles.centerFill}>
          <Ionicons
            name="map-outline"
            size={36}
            color={colors.brand.mutedSoft}
          />
          <Text style={styles.emptyText}>방문 기록이 없어요</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {places.map((place) => (
            <PlaceCard key={place.location} place={place} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function PlaceCard({ place }: { place: VisitedPlace }) {
  const destinations = [
    ...new Set(place.trips.map((t) => t.destination).filter(Boolean)),
  ]
  return (
    <View style={styles.placeCard}>
      <View style={styles.placeHeader}>
        <Ionicons name="location" size={18} color={colors.brand.primary} />
        <Text style={styles.placeName} numberOfLines={1}>
          {place.location}
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{place.trip_count}번 방문</Text>
        </View>
      </View>
      {destinations.length > 0 && (
        <Text style={styles.placeTrips} numberOfLines={2}>
          {destinations.join(' · ')}
        </Text>
      )}
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
    gap: spacing.sm,
  },
  // 장소 카드
  placeCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    backgroundColor: colors.bg.canvas,
    padding: spacing.base,
    gap: spacing.xs,
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  placeName: {
    flex: 1,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  countBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.full,
    backgroundColor: colors.bg.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.brand.border,
  },
  countText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.brand.muted,
  },
  placeTrips: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
    paddingLeft: 26,
  },
  // 빈 상태
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
