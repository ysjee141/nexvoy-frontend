/**
 * 체크리스트 탭 — 여행 선택 + 준비물 목록 + 체크 토글.
 * @nexvoy/core 의 getTripsByUser / getChecklistByTrip / toggleChecklistItem 사용(ADR-010).
 * 여행 칩 선택 → 체크리스트 로드. 낙관적 업데이트 + 실패 시 롤백.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { getTripsByUser, getChecklistByTrip, toggleChecklistItem } from '@nexvoy/core'
import type { Trip, Checklist, ChecklistItem } from '@nexvoy/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

export default function ChecklistScreen() {
  const { session } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [checklistLoading, setChecklistLoading] = useState(false)

  const loadTrips = useCallback(async () => {
    if (!session?.user) return
    setTripsLoading(true)
    try {
      const data = await getTripsByUser(supabase, session.user.id)
      setTrips(data)
      if (data.length > 0) {
        setSelectedTripId((prev) => prev ?? data[0].id)
      }
    } catch {
      setTrips([])
    } finally {
      setTripsLoading(false)
    }
  }, [session?.user])

  const loadChecklist = useCallback(async (tripId: string) => {
    setChecklistLoading(true)
    setChecklist(null)
    setItems([])
    try {
      const result = await getChecklistByTrip(supabase, tripId)
      if (result) {
        setChecklist(result.checklist)
        setItems(result.items)
      }
    } catch {
      // 빈 상태 유지
    } finally {
      setChecklistLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  useEffect(() => {
    if (selectedTripId) {
      loadChecklist(selectedTripId)
    }
  }, [selectedTripId, loadChecklist])

  const handleToggle = useCallback(async (item: ChecklistItem) => {
    const next = !item.is_checked
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_checked: next } : i))
    )
    try {
      await toggleChecklistItem(supabase, item.id, next)
    } catch {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_checked: item.is_checked } : i
        )
      )
      Alert.alert('오류', '저장에 실패했어요. 다시 시도해 주세요.')
    }
  }, [])

  if (tripsLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenHeader />
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (trips.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenHeader />
        <View style={styles.emptyState}>
          <View style={styles.emptyIllust}>
            <Ionicons name="map-outline" size={36} color={colors.brand.mutedSoft} />
          </View>
          <Text style={styles.emptyTitle}>여행을 먼저 만들어보세요</Text>
          <Text style={styles.emptyDesc}>
            여행을 만들면 준비물 체크리스트를 관리할 수 있어요.
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const pendingItems = items.filter((i) => !i.is_checked)
  const doneItems = items.filter((i) => i.is_checked)
  const totalCount = items.length
  const doneCount = doneItems.length
  const progressPct = totalCount > 0 ? doneCount / totalCount : 0

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader />

      {/* 여행 선택 칩 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipList}
        style={styles.chipScroll}
      >
        {trips.map((trip) => {
          const selected = trip.id === selectedTripId
          return (
            <Pressable
              key={trip.id}
              onPress={() => setSelectedTripId(trip.id)}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={trip.destination}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
                numberOfLines={1}
              >
                {trip.destination}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {checklistLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : checklist === null ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIllust}>
            <Ionicons
              name="checkbox-outline"
              size={36}
              color={colors.brand.mutedSoft}
            />
          </View>
          <Text style={styles.emptyTitle}>이 여행에 체크리스트가 없어요</Text>
          <Text style={styles.emptyDesc}>
            체크리스트를 추가하면 준비물을 관리할 수 있어요.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentBody}
        >
          {/* 완료율 */}
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>
              {doneCount} / {totalCount} 완료
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progressPct * 100)}%` },
                ]}
              />
            </View>
          </View>

          {/* 미완료 항목 */}
          {pendingItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                남은 항목 ({pendingItems.length})
              </Text>
              {pendingItems.map((item) => (
                <ItemRow key={item.id} item={item} onToggle={handleToggle} />
              ))}
            </View>
          )}

          {/* 완료 항목 */}
          {doneItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>완료 ({doneItems.length})</Text>
              {doneItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={handleToggle}
                  done
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function ScreenHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>체크리스트</Text>
    </View>
  )
}

interface ItemRowProps {
  item: ChecklistItem
  onToggle: (item: ChecklistItem) => void
  done?: boolean
}

function ItemRow({ item, onToggle, done = false }: ItemRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.itemRow, pressed && { opacity: 0.7 }]}
      onPress={() => onToggle(item)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={item.item_name}
    >
      <View style={[styles.checkbox, done && styles.checkboxChecked]}>
        {done && (
          <Ionicons name="checkmark" size={12} color={colors.bg.canvas} />
        )}
      </View>
      <View style={styles.itemContent}>
        <Text
          style={[styles.itemName, done && styles.itemNameDone]}
          numberOfLines={2}
        >
          {item.item_name}
        </Text>
        {item.category.length > 0 ? (
          <Text style={styles.itemCategory} numberOfLines={1}>
            {item.category}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.canvas },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand.border,
  },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    letterSpacing: -0.5,
  },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // 여행 칩
  chipScroll: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand.border,
  },
  chipList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.brand.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bg.canvas,
  },
  chipSelected: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  chipText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.brand.muted,
    maxWidth: 120,
  },
  chipTextSelected: { color: colors.bg.canvas },
  // 빈 상태
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.base,
  },
  emptyIllust: {
    width: 80,
    height: 80,
    borderRadius: radii.full,
    backgroundColor: colors.bg.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  // 콘텐츠
  contentScroll: { flex: 1 },
  contentBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  // 완료율
  progressSection: { gap: spacing.sm },
  progressLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.brand.muted,
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.bg.surfaceSoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.full,
    backgroundColor: colors.brand.primary,
  },
  // 섹션
  section: { gap: spacing.sm },
  sectionLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.brand.muted,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  // 아이템 행
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.canvas,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.xs,
    borderWidth: 2,
    borderColor: colors.brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  itemContent: { flex: 1, gap: spacing.xxs },
  itemName: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.brand.ink,
  },
  itemNameDone: {
    color: colors.brand.muted,
    textDecorationLine: 'line-through',
  },
  itemCategory: {
    fontSize: fontSizes.xs,
    color: colors.brand.mutedSoft,
  },
})
