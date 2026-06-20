/**
 * 여행 상세 화면 — 상단 세그먼트 탭(일정표 / 준비물 / 지도) + 탭별 콘텐츠.
 * @nexvoy/core 의 getPlansWithUrls / getTripById / getChecklistByTrip /
 * toggleChecklistItem / togglePlanVisited 를 supabase client 주입하여 사용(ADR-010).
 *
 * - 마운트 시 trip + plans(plan_urls 포함) 로드.
 * - 체크리스트는 준비물 탭 최초 진입 시 lazy load(1회).
 * - isMounted ref 로 언마운트 후 setState 방지.
 *
 * 날짜/시간 표기는 `new Date()` 생성자 파싱 금지(TZ 왜곡 방지) — 문자열 슬라이싱으로 처리.
 * 단, "N박 M일" 일수 계산은 자정 고정 date 문자열 차이라 안전하게 Date 연산 사용.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
// react-native-maps는 EAS Build(dev client)에서만 동작 — Expo Go에서는 null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NativeMapView: React.ComponentType<any> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NativeMarker: React.ComponentType<any> | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const maps = require('react-native-maps') as {
    default: React.ComponentType<any>
    Marker: React.ComponentType<any>
  }
  NativeMapView = maps.default
  NativeMarker = maps.Marker
} catch {
  // Expo Go: RNMapsAirModule 네이티브 모듈 없음 → 폴백 UI 사용
}
import {
  getPlansWithUrls,
  getTripById,
  getChecklistByTrip,
  toggleChecklistItem,
  togglePlanVisited,
  formatDate,
} from '@nexvoy/core'
import type { Plan, PlanUrl, Trip, Checklist, ChecklistItem } from '@nexvoy/types'
import { Card } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import {
  colors,
  fontSizes,
  fontWeights,
  radii,
  spacing,
} from '@/theme'

type PlanWithUrls = Plan & { plan_urls: PlanUrl[] }

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
  plans: PlanWithUrls[]
}

/** plans 는 start_datetime_local 오름차순(쿼리 보장) → 순회하며 날짜 파트로 그룹화. */
function groupPlansByDate(plans: PlanWithUrls[]): PlanGroup[] {
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

// ─── 좌표 추출 유틸 ───────────────────────────────────────────────────────────

/** plan 의 위경도 — location_lat/lng 우선, 없으면 lat/lng fallback. */
function planLat(plan: Plan): number | null {
  return plan.location_lat ?? plan.lat ?? null
}
function planLng(plan: Plan): number | null {
  return plan.location_lng ?? plan.lng ?? null
}

type TabKey = 'plans' | 'checklist' | 'map'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'plans', label: '일정표' },
  { key: 'checklist', label: '준비물' },
  { key: 'map', label: '지도' },
]

// ─── 화면 ─────────────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const isMounted = useRef(true)

  const [activeTab, setActiveTab] = useState<TabKey>('plans')

  // 공통 (trip + plans)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [plans, setPlans] = useState<PlanWithUrls[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // 체크리스트 (lazy)
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [checklistLoaded, setChecklistLoaded] = useState(false)
  const [checklistLoading, setChecklistLoading] = useState(false)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const loadTrip = useCallback(async () => {
    if (!id) {
      setError(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    try {
      const [tripData, plansData] = await Promise.all([
        getTripById(supabase, id),
        getPlansWithUrls(supabase, id),
      ])
      if (!isMounted.current) return
      if (!tripData) {
        setError(true)
        return
      }
      setTrip(tripData)
      setPlans(plansData)
    } catch {
      // 상세는 특정 trip 이 필수 → 에러를 명시(빈 목록 흡수 X)
      if (isMounted.current) setError(true)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadTrip()
  }, [loadTrip])

  const loadChecklist = useCallback(async () => {
    if (!id) return
    setChecklistLoading(true)
    try {
      const result = await getChecklistByTrip(supabase, id)
      if (!isMounted.current) return
      if (result) {
        setChecklist(result.checklist)
        setItems(result.items)
      }
    } catch {
      // 빈 상태 유지
    } finally {
      if (isMounted.current) {
        setChecklistLoading(false)
        setChecklistLoaded(true)
      }
    }
  }, [id])

  // 준비물 탭 최초 진입 시 1회 lazy load
  useEffect(() => {
    if (activeTab === 'checklist' && !checklistLoaded && !checklistLoading) {
      loadChecklist()
    }
  }, [activeTab, checklistLoaded, checklistLoading, loadChecklist])

  // 방문 여부 토글 (낙관적 업데이트 + 롤백)
  const handleToggleVisited = useCallback(async (plan: PlanWithUrls) => {
    const next = !plan.is_visited
    setPlans((prev) =>
      prev.map((p) => (p.id === plan.id ? { ...p, is_visited: next } : p))
    )
    try {
      await togglePlanVisited(supabase, plan.id, next)
    } catch {
      if (isMounted.current) {
        setPlans((prev) =>
          prev.map((p) =>
            p.id === plan.id ? { ...p, is_visited: plan.is_visited } : p
          )
        )
      }
      Alert.alert('오류', '저장에 실패했어요. 다시 시도해 주세요.')
    }
  }, [])

  // 체크리스트 항목 토글 (낙관적 업데이트 + 롤백)
  const handleToggleItem = useCallback(async (item: ChecklistItem) => {
    const next = !item.is_checked
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_checked: next } : i))
    )
    try {
      await toggleChecklistItem(supabase, item.id, next)
    } catch {
      if (isMounted.current) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, is_checked: item.is_checked } : i
          )
        )
      }
      Alert.alert('오류', '저장에 실패했어요. 다시 시도해 주세요.')
    }
  }, [])

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
        <>
          {/* 세그먼트 탭 (고정) */}
          <View style={styles.segmentContainer}>
            {TABS.map((tab) => {
              const selected = activeTab === tab.key
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[styles.segmentBtn, selected && styles.segmentBtnActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={tab.label}
                >
                  <Text
                    style={[styles.segmentText, selected && styles.segmentTextActive]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {/* 탭 콘텐츠 */}
          {activeTab === 'plans' ? (
            <PlansTab trip={trip} plans={plans} onToggleVisited={handleToggleVisited} />
          ) : activeTab === 'checklist' ? (
            <ChecklistTab
              loading={checklistLoading}
              loaded={checklistLoaded}
              checklist={checklist}
              items={items}
              onToggle={handleToggleItem}
            />
          ) : (
            <MapTab plans={plans} />
          )}
        </>
      )}
    </SafeAreaView>
  )
}

// ─── 일정표 탭 ────────────────────────────────────────────────────────────────

interface PlansTabProps {
  trip: Trip
  plans: PlanWithUrls[]
  onToggleVisited: (plan: PlanWithUrls) => void
}

function PlansTab({ trip, plans, onToggleVisited }: PlansTabProps) {
  const groups = groupPlansByDate(plans)

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {/* 메타 섹션 (평면형) */}
      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.brand.muted} />
          <Text style={styles.metaText}>
            {formatDate(trip.start_date)} ~ {formatDate(trip.end_date)} ·{' '}
            {formatDuration(trip.start_date, trip.end_date)}
          </Text>
        </View>
        {trip.adults_count > 0 || trip.children_count > 0 ? (
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color={colors.brand.muted} />
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
                  <View
                    style={[styles.dot, plan.is_visited && styles.dotVisited]}
                  />
                </View>
                {/* 시간 + Plan Card */}
                <View style={styles.timelineContent}>
                  <Text style={styles.timeLabel}>
                    {parseTime(plan.start_datetime_local)}
                  </Text>
                  <Card elevated padding="md" style={styles.planCard}>
                    <View style={styles.planTitleRow}>
                      <Text style={styles.planTitle} numberOfLines={2}>
                        {plan.title}
                      </Text>
                      {plan.is_visited ? (
                        <View style={styles.visitedBadge}>
                          <Ionicons
                            name="checkmark-circle"
                            size={13}
                            color={colors.brand.success}
                          />
                          <Text style={styles.visitedBadgeText}>방문 완료</Text>
                        </View>
                      ) : null}
                    </View>
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
                    <Pressable
                      onPress={() => onToggleVisited(plan)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: plan.is_visited }}
                      accessibilityLabel={
                        plan.is_visited ? '방문 취소' : '방문 완료로 표시'
                      }
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.visitToggle,
                        pressed && styles.pressedFade,
                      ]}
                    >
                      <Ionicons
                        name={plan.is_visited ? 'checkbox' : 'square-outline'}
                        size={16}
                        color={
                          plan.is_visited ? colors.brand.primary : colors.brand.muted
                        }
                      />
                      <Text
                        style={[
                          styles.visitToggleText,
                          plan.is_visited && styles.visitToggleTextActive,
                        ]}
                      >
                        {plan.is_visited ? '방문함' : '방문 표시'}
                      </Text>
                    </Pressable>
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
              color={colors.brand.muted}
            />
          </View>
          <Text style={styles.emptyTitle}>아직 등록된 일정이 없어요</Text>
          <Text style={styles.emptyDesc}>첫 일정을 추가해 여정을 그려보세요.</Text>
        </View>
      )}
    </ScrollView>
  )
}

// ─── 준비물 탭 ────────────────────────────────────────────────────────────────

interface ChecklistTabProps {
  loading: boolean
  loaded: boolean
  checklist: Checklist | null
  items: ChecklistItem[]
  onToggle: (item: ChecklistItem) => void
}

function ChecklistTab({ loading, loaded, checklist, items, onToggle }: ChecklistTabProps) {
  if (loading || !loaded) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    )
  }

  if (checklist === null) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIllust}>
          <Ionicons
            name="checkbox-outline"
            size={40}
            color={colors.brand.mutedSoft}
          />
        </View>
        <Text style={styles.emptyTitle}>이 여정에 체크리스트가 없어요</Text>
        <Text style={styles.emptyDesc}>
          체크리스트를 추가하면 준비물을 관리할 수 있어요.
        </Text>
      </View>
    )
  }

  const pendingItems = items.filter((i) => !i.is_checked)
  const doneItems = items.filter((i) => i.is_checked)
  const totalCount = items.length
  const doneCount = doneItems.length
  const progressPct = totalCount > 0 ? doneCount / totalCount : 0

  return (
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
        <View style={styles.clSection}>
          <Text style={styles.sectionLabel}>남은 항목 ({pendingItems.length})</Text>
          {pendingItems.map((item) => (
            <ItemRow key={item.id} item={item} onToggle={onToggle} />
          ))}
        </View>
      )}

      {/* 완료 항목 */}
      {doneItems.length > 0 && (
        <View style={styles.clSection}>
          <Text style={styles.sectionLabel}>완료 ({doneItems.length})</Text>
          {doneItems.map((item) => (
            <ItemRow key={item.id} item={item} onToggle={onToggle} done />
          ))}
        </View>
      )}
    </ScrollView>
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
      style={({ pressed }) => [styles.itemRow, pressed && styles.pressedFade]}
      onPress={() => onToggle(item)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={item.item_name}
    >
      <View style={[styles.checkbox, done && styles.checkboxChecked]}>
        {done && <Ionicons name="checkmark" size={12} color={colors.bg.canvas} />}
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemName, done && styles.itemNameDone]} numberOfLines={2}>
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

// ─── 지도 탭 ──────────────────────────────────────────────────────────────────

function MapTab({ plans }: { plans: PlanWithUrls[] }) {
  const mapMarkers = plans.filter(
    (p) => planLat(p) != null && planLng(p) != null
  )

  if (mapMarkers.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIllust}>
          <Ionicons name="map-outline" size={40} color={colors.brand.mutedSoft} />
        </View>
        <Text style={styles.emptyTitle}>표시할 장소가 없어요</Text>
        <Text style={styles.emptyDesc}>
          이 여정에는 지도에 표시할 장소가 없어요.
        </Text>
      </View>
    )
  }

  const MapViewCmp = NativeMapView
  const MarkerCmp = NativeMarker

  if (!MapViewCmp || !MarkerCmp) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIllust}>
          <Ionicons name="map-outline" size={40} color={colors.brand.mutedSoft} />
        </View>
        <Text style={styles.emptyTitle}>지도는 개발 빌드에서 사용 가능해요</Text>
        <Text style={styles.emptyDesc}>
          EAS Build 또는 개발 클라이언트에서 실행하면 지도를 볼 수 있어요.
        </Text>
      </View>
    )
  }

  const avgLat =
    mapMarkers.reduce((sum, p) => sum + planLat(p)!, 0) / mapMarkers.length
  const avgLng =
    mapMarkers.reduce((sum, p) => sum + planLng(p)!, 0) / mapMarkers.length

  const region = {
    latitude: avgLat,
    longitude: avgLng,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }

  return (
    <MapViewCmp style={styles.map} initialRegion={region}>
      {mapMarkers.map((p) => (
        <MarkerCmp
          key={p.id}
          coordinate={{ latitude: planLat(p)!, longitude: planLng(p)! }}
          title={p.title}
          description={p.location ?? undefined}
        />
      ))}
    </MapViewCmp>
  )
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

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
  // 세그먼트 탭
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.bg.surfaceSoft,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    borderRadius: radii.sm,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm - 2,
  },
  segmentBtnActive: {
    backgroundColor: colors.bg.canvas,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.brand.muted,
  },
  segmentTextActive: {
    color: colors.brand.primary,
    fontWeight: fontWeights.semibold,
  },
  // 일정표 본문
  body: {
    paddingBottom: spacing.xxxl,
  },
  meta: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.base,
    gap: spacing.xs,
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
  dotVisited: {
    backgroundColor: colors.brand.success,
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
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planTitle: {
    flex: 1,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  visitedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  visitedBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.brand.success,
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
  visitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  visitToggleText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.brand.muted,
  },
  visitToggleTextActive: {
    color: colors.brand.primary,
  },
  // 빈 상태
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
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: fontSizes.md,
    color: colors.brand.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  // 준비물 콘텐츠
  contentScroll: { flex: 1 },
  contentBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  progressSection: { gap: spacing.sm },
  progressLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.brand.muted,
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.bg.surfaceStrong,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.full,
    backgroundColor: colors.brand.primary,
  },
  clSection: { gap: spacing.sm },
  sectionLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.brand.muted,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
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
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.brand.hairline,
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
  // 지도
  map: { flex: 1 },
})
