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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
// react-native-maps는 로컬 네이티브 빌드에서만 동작한다. Expo Go에서는 폴백 UI를 유지한다.
type NativeMapViewProps = {
  style?: unknown
  initialRegion?: {
    latitude: number
    longitude: number
    latitudeDelta: number
    longitudeDelta: number
  }
  children?: React.ReactNode
}
type NativeMarkerProps = {
  coordinate: { latitude: number; longitude: number }
  title?: string
  description?: string
}
let NativeMapView: React.ComponentType<NativeMapViewProps> | null = null
let NativeMarker: React.ComponentType<NativeMarkerProps> | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const maps = require('react-native-maps') as {
    default: React.ComponentType<NativeMapViewProps>
    Marker: React.ComponentType<NativeMarkerProps>
  }
  NativeMapView = maps.default
  NativeMarker = maps.Marker
} catch {
  // Expo Go: RNMapsAirModule 네이티브 모듈 없음 -> 폴백 UI 사용
}
import {
  getPlansWithUrls,
  getTripsByUser,
  getTripById,
  getChecklistByTrip,
  getTemplatesWithPreview,
  getUserTripRole,
  getTripMembers,
  inviteTripMember,
  updateTripMemberRole,
  removeTripMember,
  createInvitationLink,
  getOrCreateTripShareLink,
  updateTrip,
  createPlan,
  updatePlan,
  deletePlan,
  ensureChecklist,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  applyTemplateToChecklist,
  toggleChecklistItem,
  togglePlanVisited,
  formatDate,
  formatCurrency,
  getCurrencyFromTimezone,
} from '@nexvoy/core'
import type {
  Plan,
  PlanUrl,
  Trip,
  Checklist,
  ChecklistItem,
  TripMember,
  TripShare,
  TemplateWithPreview,
} from '@nexvoy/types'
import {
  AccordionCard,
  BottomSheet,
  ConfirmSheet,
  EmptyState,
  ProgressBar,
  SegmentedTabs,
  SwipeRow,
} from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import {
  colors,
  fontSizes,
  fontWeights,
  radii,
  spacing,
} from '@/theme'

type PlanWithUrls = Plan & { plan_urls: PlanUrl[] }
type PlanSheetStep = 'place' | 'details'
type TimeDisplayMode = 'local' | 'kst' | 'both'

type PlaceOption = {
  name: string
  address: string
  lat: number | null
  lng: number | null
  googlePlaceId: string | null
  photoReference: string | null
}

type GooglePlaceData = {
  description: string
  place_id?: string
  structured_formatting?: {
    main_text?: string
    secondary_text?: string
  }
}

type GooglePlaceDetail = {
  name?: string
  formatted_address?: string
  vicinity?: string
  place_id?: string
  geometry?: {
    location?: {
      lat?: number
      lng?: number
    }
  }
  location?: {
    lat?: number
    lng?: number
  }
  photos?: Array<{ photo_reference?: string }>
}

type GoogleAutocompleteResponse = {
  status?: string
  predictions?: GooglePlaceData[]
  error_message?: string
}

type GooglePlaceDetailsResponse = {
  status?: string
  result?: GooglePlaceDetail
  error_message?: string
}

type OGPreviewData = {
  title?: string
  description?: string
  image?: string
  favicon?: string
  hostname: string
  url: string
}

type PlanSaveInput = {
  title: string
  location: string
  address?: string | null
  location_lat?: number | null
  location_lng?: number | null
  google_place_id?: string | null
  image_url?: string | null
  photo_reference?: string | null
  start_datetime_local: string
  end_datetime_local: string
  cost: number
  memo: string
  alarm_minutes_before?: number | null
  timezone_string?: string
  urls: string[]
}

const PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ??
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
  ''
const WEB_APP_BASE = process.env.EXPO_PUBLIC_WEB_API_URL ?? 'https://app.onvoy.travel'
const PLACE_PHOTO_BUCKET = 'place-photos'
const PLACE_PHOTO_MAX_WIDTH = 800

// ─── 날짜/시간 파싱 유틸 (파일 로컬, new Date() 생성자 금지) ───────────────────

function normalizeTimeInput(time: string): string {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return '09:00'
  const hour = Math.min(23, Math.max(0, Number(match[1]) || 0))
  const minute = Math.min(59, Math.max(0, Number(match[2]) || 0))
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** "2024-06-19 14:30:00" / "2024-06-19T14:30:00" → "14:30" */
function parseTime(dt: string): string {
  const match = dt.trim().match(/[T\s](\d{1,2}):(\d{2})/)
  return match ? normalizeTimeInput(`${match[1]}:${match[2]}`) : ''
}

function formatClockLabel(time: string): string {
  const [hRaw, m = '00'] = time.split(':')
  const hour = Number(hRaw)
  if (!Number.isFinite(hour)) return time
  const period = hour >= 12 ? '오후' : '오전'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${period} ${String(displayHour).padStart(2, '0')}:${m}`
}

function formatLocalDateTime(dateTime: string): string {
  return formatClockLabel(parseTime(dateTime))
}

function formatKstDateTime(dateTime: string, localTimeZone = 'Asia/Seoul'): string {
  try {
    const localIso = dateTime.replace(' ', 'T')
    const fakeUtc = new Date(`${localIso}Z`)
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: localTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const parts = fmt.formatToParts(fakeUtc)
    const get = (type: string) => parts.find((p) => p.type === type)?.value?.padStart(2, '0') ?? '00'
    const inTzStr = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
    const fakeTzUtc = new Date(`${inTzStr}Z`)
    const tzOffsetMs = fakeUtc.getTime() - fakeTzUtc.getTime()
    const actualUtc = new Date(fakeUtc.getTime() + tzOffsetMs)
    const kst = new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
    }).format(actualUtc)
    return kst.replace(/\s+/g, ' ')
  } catch {
    return ''
  }
}

function formatPlanTimeLabel(plan: Plan, mode: TimeDisplayMode): string {
  const localTime = formatLocalDateTime(plan.start_datetime_local)
  const kstTime = formatKstDateTime(plan.start_datetime_local, plan.timezone_string || 'Asia/Seoul')
  if (mode === 'kst') return kstTime || localTime
  if (mode === 'both') return kstTime ? `${localTime} | ${kstTime}` : localTime
  return localTime
}

/** "2024-06-19 14:30:00" / "2024-06-19T14:30:00" → "2024-06-19" */
function parseDate(dt: string): string {
  return dt.trim().match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? ''
}

/** "2024-06-19" → "6월 19일" */
function formatSectionDate(dateStr: string): string {
  const safeDate = parseDate(dateStr)
  if (!safeDate) return '날짜 미정'
  const [, m, d] = safeDate.split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function normalizeDateTime(date: string, time: string): string {
  const safeDate = parseDate(date)
  const safeTime = normalizeTimeInput(time)
  return `${safeDate} ${safeTime}:00`
}

function addHoursToLocalDateTime(dateTime: string, hours: number): string {
  const [date, timePart = '09:00:00'] = dateTime.replace('T', ' ').split(' ')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = timePart.split(':').map(Number)
  const base = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 9, mm ?? 0, 0)
  base.setHours(base.getHours() + hours)
  return `${toDateString(base)} ${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}:00`
}

function placeIdHash8(placeId: string): string {
  let hash = 5381
  for (let i = 0; i < placeId.length; i += 1) {
    hash = ((hash << 5) + hash) + placeId.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8)
}

function decodeHtmlEntity(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function getMetaContent(html: string, key: string): string | undefined {
  const propertyFirst = html.match(
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i')
  )
  const contentFirst = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, 'i')
  )
  return propertyFirst?.[1] ?? contentFirst?.[1]
}

function absoluteUrl(url: string, base: URL): string {
  try {
    return new URL(url, base).toString()
  } catch {
    return url
  }
}

function naverPostViewUrl(parsed: URL): string {
  if (parsed.hostname !== 'blog.naver.com') return parsed.toString()
  const pathParts = parsed.pathname.split('/').filter(Boolean)
  if (pathParts.length >= 2) {
    return `https://blog.naver.com/PostView.naver?blogId=${pathParts[0]}&logNo=${pathParts[1]}`
  }
  if (pathParts.length === 1 && parsed.searchParams.has('logNo')) {
    return `https://blog.naver.com/PostView.naver?blogId=${pathParts[0]}&logNo=${parsed.searchParams.get('logNo')}`
  }
  return parsed.toString()
}

async function fetchOGPreview(url: string): Promise<OGPreviewData> {
  const parsed = new URL(url)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6500)
  try {
    const res = await fetch(naverPostViewUrl(parsed), {
      headers: {
        'User-Agent': 'Mozilla/5.0 OnVoy Mobile',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error('OG fetch failed')
    const html = await res.text()
    const title =
      getMetaContent(html, 'og:title') ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
    const description =
      getMetaContent(html, 'og:description') ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
    const image = getMetaContent(html, 'og:image')
    const faviconPath =
      html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
      '/favicon.ico'

    return {
      title: title ? decodeHtmlEntity(title).slice(0, 120) : undefined,
      description: description ? decodeHtmlEntity(description).slice(0, 200) : undefined,
      image: image ? absoluteUrl(decodeHtmlEntity(image), parsed) : undefined,
      favicon: absoluteUrl(decodeHtmlEntity(faviconPath), parsed),
      hostname: parsed.hostname,
      url,
    }
  } finally {
    clearTimeout(timer)
  }
}

async function storePlanPlacePhoto({
  planId,
  tripId,
  userId,
  placeId,
  photoReference,
}: {
  planId: string
  tripId: string
  userId: string
  placeId?: string | null
  photoReference?: string | null
}): Promise<string | null> {
  if (!PLACES_API_KEY || !placeId || !photoReference) return null

  const photoUrl =
    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${PLACE_PHOTO_MAX_WIDTH}` +
    `&photo_reference=${encodeURIComponent(photoReference)}` +
    `&key=${PLACES_API_KEY}`

  const photoRes = await fetch(photoUrl, { redirect: 'follow' })
  if (!photoRes.ok) return null

  const photoBuffer = await photoRes.arrayBuffer()
  if (photoBuffer.byteLength === 0) return null

  const storagePath = `${userId}/${tripId}/${planId}_${placeIdHash8(placeId)}.jpg`
  const { error: uploadError } = await supabase.storage
    .from(PLACE_PHOTO_BUCKET)
    .upload(storagePath, photoBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
      cacheControl: '31536000',
    })
  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from(PLACE_PHOTO_BUCKET)
    .getPublicUrl(storagePath)
  const publicUrl = data.publicUrl
  if (!publicUrl) return null

  const { error: updateError } = await supabase
    .from('plans')
    .update({ image_url: publicUrl, photo_reference: photoReference })
    .eq('id', planId)
  if (updateError) throw updateError

  return publicUrl
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

function planUrls(plan: PlanWithUrls): string[] {
  return (plan.plan_urls ?? [])
    .map((entry) => entry.url)
    .filter((url): url is string => Boolean(url))
}

function formatPlanCost(plan: Plan): string | null {
  if (!plan.cost || plan.cost <= 0) return null
  const currency = getCurrencyFromTimezone(plan.timezone_string || 'Asia/Seoul')
  return formatCurrency(plan.cost, currency)
}

function buildMapUrl(plan: Plan): string | null {
  const lat = planLat(plan)
  const lng = planLng(plan)
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  }
  if (plan.location) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.location)}`
  }
  return null
}

type TabKey = 'plans' | 'checklist' | 'map'

const TABS: {
  key: TabKey
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
}[] = [
  { key: 'plans', label: '일정표', icon: 'calendar-outline' },
  { key: 'checklist', label: '준비물', icon: 'list-outline' },
  { key: 'map', label: '지도', icon: 'map-outline' },
]

// ─── 화면 ─────────────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuth()
  const insets = useSafeAreaInsets()
  const isMounted = useRef(true)

  const [activeTab, setActiveTab] = useState<TabKey>('plans')

  // 공통 (trip + plans)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [plans, setPlans] = useState<PlanWithUrls[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  // 권한별 액션 노출 제어
  const canEditTrip = userRole === 'owner'
  const canEditContent = userRole === 'owner' || userRole === 'editor'

  // 체크리스트 (lazy)
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [checklistLoaded, setChecklistLoaded] = useState(false)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [isTripSheetOpen, setIsTripSheetOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlanWithUrls | null>(null)
  const [isPlanSheetOpen, setIsPlanSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null)
  const [isItemSheetOpen, setIsItemSheetOpen] = useState(false)
  const [isTemplateSheetOpen, setIsTemplateSheetOpen] = useState(false)
  const [isTripSwitcherOpen, setIsTripSwitcherOpen] = useState(false)
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false)
  const [isCollaboratorSheetOpen, setIsCollaboratorSheetOpen] = useState(false)
  const [allTrips, setAllTrips] = useState<Trip[]>([])
  const [members, setMembers] = useState<TripMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [timeDisplayMode, setTimeDisplayMode] = useState<TimeDisplayMode>('local')
  const [isTimeModeSheetOpen, setIsTimeModeSheetOpen] = useState(false)
  const [shareInfo, setShareInfo] = useState<TripShare | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const loadTripList = useCallback(async () => {
    if (!session?.user.id) return
    try {
      const data = await getTripsByUser(supabase, session.user.id)
      if (isMounted.current) setAllTrips(data)
    } catch {
      // 여행 스위처는 보조 기능이므로 상세 화면 로딩을 막지 않는다.
    }
  }, [session?.user.id])

  const loadMembers = useCallback(async () => {
    if (!id) return
    setMembersLoading(true)
    try {
      const data = await getTripMembers(supabase, id)
      if (isMounted.current) setMembers(data)
    } catch {
      if (isMounted.current) setMembers([])
    } finally {
      if (isMounted.current) setMembersLoading(false)
    }
  }, [id])

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
      void loadMembers()
      getUserTripRole(supabase, id)
        .then((role) => {
          if (isMounted.current) setUserRole(role)
        })
        .catch(() => {
          if (isMounted.current) setUserRole(null)
        })
    } catch {
      // 상세는 특정 trip 이 필수 → 에러를 명시(빈 목록 흡수 X)
      if (isMounted.current) setError(true)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [id, loadMembers])

  useEffect(() => {
    loadTrip()
  }, [loadTrip])

  useEffect(() => {
    loadTripList()
  }, [loadTripList])

  const loadChecklist = useCallback(async () => {
    if (!id) return
    setChecklistLoading(true)
    try {
      const result = await getChecklistByTrip(supabase, id)
      if (!isMounted.current) return
      if (result) {
        setChecklist(result.checklist)
        setItems(result.items)
      } else {
        setChecklist(null)
        setItems([])
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

  const handleSaveTrip = useCallback(
    async (input: {
      destination: string
      start_date: string
      end_date: string
      adults_count: number
      children_count: number
    }) => {
      if (!trip) return
      const saved = await updateTrip(supabase, trip.id, input)
      setTrip(saved)
      setIsTripSheetOpen(false)
    },
    [trip]
  )

  const handleSavePlan = useCallback(
    async (input: PlanSaveInput) => {
      if (!id) return
      let savedPlan: PlanWithUrls | null = null
      if (editingPlan) {
        savedPlan = await updatePlan(supabase, editingPlan.id, {
          ...input,
          trip_id: id,
          timezone_string: input.timezone_string || editingPlan.timezone_string || 'Asia/Seoul',
        })
      } else {
        savedPlan = await createPlan(supabase, {
          ...input,
          trip_id: id,
          timezone_string: input.timezone_string || 'Asia/Seoul',
        })
      }
      setEditingPlan(null)
      setIsPlanSheetOpen(false)
      await loadTrip()
      if (savedPlan && session?.user.id && input.google_place_id && input.photo_reference) {
        void storePlanPlacePhoto({
          planId: savedPlan.id,
          tripId: id,
          userId: session.user.id,
          placeId: input.google_place_id,
          photoReference: input.photo_reference,
        })
          .then((imageUrl) => {
            if (!imageUrl) return
            setPlans((prev) =>
              prev.map((plan) =>
                plan.id === savedPlan.id
                  ? { ...plan, image_url: imageUrl, photo_reference: input.photo_reference ?? plan.photo_reference }
                  : plan
              )
            )
          })
          .catch((error) => {
            console.warn('[PlanEditSheet] place photo storage failed', error)
          })
      }
    },
    [editingPlan, id, loadTrip, session?.user.id]
  )

  const handleDeletePlan = useCallback(
    async (plan: PlanWithUrls) => {
      await deletePlan(supabase, plan.id)
      setEditingPlan(null)
      setIsPlanSheetOpen(false)
      await loadTrip()
    },
    [loadTrip]
  )

  const handleSaveChecklistItem = useCallback(
    async (input: { item_name: string; category: string }) => {
      if (!id) return
      const currentChecklist = checklist ?? (await ensureChecklist(supabase, id))
      if (!checklist) setChecklist(currentChecklist)

      if (editingItem) {
        await updateChecklistItem(supabase, editingItem.id, {
          item_name: input.item_name,
          category: input.category,
          is_private: editingItem.is_private,
          assignment_type: editingItem.assignment_type,
          assigned_user_id: editingItem.assigned_user_id,
          source_template_name: editingItem.source_template_name,
        })
      } else {
        await createChecklistItem(supabase, currentChecklist.id, {
          item_name: input.item_name,
          category: input.category,
        })
      }
      setEditingItem(null)
      setIsItemSheetOpen(false)
      await loadChecklist()
    },
    [checklist, editingItem, id, loadChecklist]
  )

  const handleDeleteChecklistItem = useCallback(
    async (item: ChecklistItem) => {
      await deleteChecklistItem(supabase, item.id)
      setEditingItem(null)
      setIsItemSheetOpen(false)
      await loadChecklist()
    },
    [loadChecklist]
  )

  const handleApplyTemplate = useCallback(
    async (templateId: string) => {
      if (!id) return
      const currentChecklist = checklist ?? (await ensureChecklist(supabase, id))
      if (!checklist) setChecklist(currentChecklist)
      await applyTemplateToChecklist(supabase, currentChecklist.id, templateId)
      setIsTemplateSheetOpen(false)
      await loadChecklist()
    },
    [checklist, id, loadChecklist]
  )

  const totalPlanCost = useMemo(
    () => plans.reduce((sum, plan) => sum + (plan.cost || 0), 0),
    [plans]
  )

  const publicShareUrl = shareInfo
    ? `${WEB_APP_BASE.replace(/\/$/, '')}/share/detail?token=${shareInfo.share_token}`
    : ''

  const handleSwitchTrip = (tripId: string) => {
    setIsTripSwitcherOpen(false)
    if (tripId === id) return
    router.replace({ pathname: '/trip/[id]', params: { id: tripId } })
  }

  const handleCreateShare = async () => {
    if (!id || shareLoading) return
    setShareLoading(true)
    try {
      const data = await getOrCreateTripShareLink(supabase, id, 'public')
      setShareInfo(data)
    } catch {
      Alert.alert('오류', '공유 링크를 만들지 못했어요.')
    } finally {
      setShareLoading(false)
    }
  }

  const handleShareTrip = async () => {
    try {
      const data = shareInfo ?? (id ? await getOrCreateTripShareLink(supabase, id, 'public') : null)
      if (!data) return
      setShareInfo(data)
      const url = `${WEB_APP_BASE.replace(/\/$/, '')}/share/detail?token=${data.share_token}`
      await Share.share({
        title: `${trip?.destination ?? '여행'} 일정 공유`,
        message: `${trip?.destination ?? '여행'} 일정을 확인해 보세요.\n${url}`,
        url,
      })
    } catch {
      Alert.alert('오류', '공유를 시작하지 못했어요.')
    }
  }

  const handleInviteMember = async (email: string, role: 'editor' | 'viewer') => {
    if (!id || !trip) return
    setInviteLoading(true)
    try {
      await inviteTripMember(supabase, id, email.trim(), role)
      try {
        await fetch(`${WEB_APP_BASE.replace(/\/$/, '')}/api/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId: id, email: email.trim(), tripTitle: trip.destination }),
        })
      } catch {
        // 이메일 발송은 best-effort. 멤버 초대 생성이 성공했으면 사용자 흐름은 유지한다.
      }
      await loadMembers()
      Alert.alert('완료', `${email.trim()}님을 초대했어요.`)
    } catch (e) {
      Alert.alert('오류', e instanceof Error ? e.message : '초대에 실패했어요.')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleCreateInviteLink = async () => {
    if (!id || inviteLoading) return
    setInviteLoading(true)
    try {
      const token = await createInvitationLink(supabase, id)
      const url = `${WEB_APP_BASE.replace(/\/$/, '')}/join?token=${token}`
      await Share.share({
        title: `${trip?.destination ?? '여행'} 여정 초대`,
        message: `함께 여정을 계획해보세요.\n${url}`,
        url,
      })
    } catch {
      Alert.alert('오류', '초대 링크를 만들지 못했어요.')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleUpdateMemberRole = async (memberId: string, role: 'editor' | 'viewer') => {
    try {
      await updateTripMemberRole(supabase, memberId, role)
      await loadMembers()
    } catch {
      Alert.alert('오류', '권한 변경에 실패했어요.')
    }
  }

  const handleRemoveMember = async (member: TripMember) => {
    Alert.alert('동행자 삭제', `${member.profiles?.nickname || member.invited_email}님을 제외할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeTripMember(supabase, member.id)
            await loadMembers()
          } catch {
            Alert.alert('오류', '동행자 삭제에 실패했어요.')
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
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
          <View style={styles.detailTop}>
            <View style={styles.topNav}>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="뒤로"
                hitSlop={12}
                style={({ pressed }) => [styles.topNavButton, pressed && styles.pressedFade]}
              >
                <Ionicons name="chevron-back" size={24} color={colors.brand.ink} />
              </Pressable>
              <Pressable
                onPress={() => setIsTripSwitcherOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="여행 선택"
                style={({ pressed }) => [styles.tripSwitchButton, pressed && styles.pressedFade]}
              >
                <Text style={styles.tripSwitchTitle} numberOfLines={1}>
                  {trip.destination}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.brand.ink} />
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsCollaboratorSheetOpen(true)
                  void loadMembers()
                }}
                accessibilityRole="button"
                accessibilityLabel="동행자"
                hitSlop={12}
                style={({ pressed }) => [styles.topNavButton, styles.topNavButtonBadge, pressed && styles.pressedFade]}
              >
                <Ionicons name="chatbox-ellipses-outline" size={22} color={colors.brand.primary} />
                {members.length > 0 ? <View style={styles.navDot} /> : null}
              </Pressable>
            </View>

            <View style={styles.tripSummary}>
              <View style={styles.tripTitleRow}>
                <Text style={styles.tripTitle} numberOfLines={2}>
                  {trip.destination} 여행
                </Text>
                {canEditTrip ? (
                  <View style={styles.tripIconActions}>
                    <Pressable
                      onPress={() => setIsTripSheetOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel="여행 수정"
                      style={({ pressed }) => [styles.tripIconAction, pressed && styles.pressedFade]}
                    >
                      <Ionicons name="pencil-outline" size={18} color={colors.brand.muted} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
              <View style={styles.tripMetaGrid}>
                <View style={styles.tripMetaItem}>
                  <Ionicons name="calendar-outline" size={14} color={colors.brand.ink} />
                  <Text style={styles.tripMetaText} numberOfLines={1}>
                    {formatDate(trip.start_date)} ~ {formatDate(trip.end_date)}
                  </Text>
                </View>
                <View style={styles.tripMetaItem}>
                  <Ionicons name="people-outline" size={14} color={colors.brand.primary} />
                  <Text style={styles.tripMetaText} numberOfLines={1}>
                    성인 {trip.adults_count}명, 아이 {trip.children_count}명
                  </Text>
                </View>
                {totalPlanCost > 0 ? (
                  <View style={styles.tripMetaItem}>
                    <Ionicons name="wallet-outline" size={14} color={colors.brand.ink} />
                    <Text style={styles.tripMetaText} numberOfLines={1}>
                      약 {totalPlanCost.toLocaleString()}원
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.segmentWrap}>
            <SegmentedTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />
          </View>

          {activeTab === 'plans' ? (
            <TripActionBar
              timeDisplayMode={timeDisplayMode}
              onOpenTimeMode={() => setIsTimeModeSheetOpen(true)}
              onOpenMembers={() => {
                setIsCollaboratorSheetOpen(true)
                void loadMembers()
              }}
              onOpenShare={() => {
                setIsShareSheetOpen(true)
                if (!shareInfo) void handleCreateShare()
              }}
              canInvite={canEditContent}
              canShare={canEditTrip}
            />
          ) : null}

          {/* 탭 콘텐츠 */}
          {activeTab === 'plans' ? (
            <PlansTab
              plans={plans}
              onToggleVisited={handleToggleVisited}
              onEditPlan={(plan) => {
                setEditingPlan(plan)
                setIsPlanSheetOpen(true)
              }}
              onDeletePlan={handleDeletePlan}
              canEdit={canEditContent}
              timeDisplayMode={timeDisplayMode}
            />
          ) : activeTab === 'checklist' ? (
            <ChecklistTab
              loading={checklistLoading}
              loaded={checklistLoaded}
              checklist={checklist}
              items={items}
              onToggle={handleToggleItem}
              onCreateItem={() => {
                setEditingItem(null)
                setIsItemSheetOpen(true)
              }}
              onEditItem={(item) => {
                setEditingItem(item)
                setIsItemSheetOpen(true)
              }}
              onDeleteItem={handleDeleteChecklistItem}
              onOpenTemplates={() => setIsTemplateSheetOpen(true)}
              canEdit={canEditContent}
            />
          ) : (
            <MapTab plans={plans} />
          )}
          {activeTab === 'plans' && canEditContent ? (
            <Pressable
              onPress={() => {
                setEditingPlan(null)
                setIsPlanSheetOpen(true)
              }}
              accessibilityRole="button"
              accessibilityLabel="일정 추가"
              style={({ pressed }) => [
                styles.planFab,
                { bottom: Math.max(insets.bottom, spacing.md) + spacing.md },
                pressed && styles.pressedSoft,
              ]}
            >
              <Ionicons name="add" size={24} color={colors.bg.canvas} />
              <Text style={styles.planFabText}>일정 추가</Text>
            </Pressable>
          ) : null}
          <TripEditSheet
            visible={isTripSheetOpen}
            trip={trip}
            onClose={() => setIsTripSheetOpen(false)}
            onSave={handleSaveTrip}
          />
          <PlanEditSheet
            visible={isPlanSheetOpen}
            plan={editingPlan}
            trip={trip}
            onClose={() => {
              setEditingPlan(null)
              setIsPlanSheetOpen(false)
            }}
            onSave={handleSavePlan}
          />
          <ChecklistItemSheet
            visible={isItemSheetOpen}
            item={editingItem}
            onClose={() => {
              setEditingItem(null)
              setIsItemSheetOpen(false)
            }}
            onSave={handleSaveChecklistItem}
          />
          <TemplateApplySheet
            visible={isTemplateSheetOpen}
            userId={session?.user.id}
            onClose={() => setIsTemplateSheetOpen(false)}
            onApply={handleApplyTemplate}
          />
          <TimeModeSheet
            visible={isTimeModeSheetOpen}
            value={timeDisplayMode}
            onClose={() => setIsTimeModeSheetOpen(false)}
            onSelect={(mode) => {
              setTimeDisplayMode(mode)
              setIsTimeModeSheetOpen(false)
            }}
          />
          <TripSwitcherSheet
            visible={isTripSwitcherOpen}
            trips={allTrips}
            currentTripId={id}
            onClose={() => setIsTripSwitcherOpen(false)}
            onSelect={handleSwitchTrip}
          />
          <ShareTripSheet
            visible={isShareSheetOpen}
            trip={trip}
            shareUrl={publicShareUrl}
            loading={shareLoading}
            onCreateLink={handleCreateShare}
            onShare={handleShareTrip}
            onClose={() => setIsShareSheetOpen(false)}
          />
          <CollaboratorSheet
            visible={isCollaboratorSheetOpen}
            members={members}
            loading={membersLoading}
            inviteLoading={inviteLoading}
            currentUserId={session?.user.id ?? null}
            ownerId={trip.user_id}
            canManage={canEditTrip}
            canInvite={canEditContent}
            onInvite={handleInviteMember}
            onCreateInviteLink={handleCreateInviteLink}
            onUpdateRole={handleUpdateMemberRole}
            onRemove={handleRemoveMember}
            onClose={() => setIsCollaboratorSheetOpen(false)}
          />
        </>
      )}
    </SafeAreaView>
  )
}

const TIME_MODE_OPTIONS: Array<{ value: TimeDisplayMode; label: string }> = [
  { value: 'local', label: '현지 시간' },
  { value: 'kst', label: '한국 시간' },
  { value: 'both', label: '동시 표기' },
]

const ROLE_LABELS: Record<'owner' | 'editor' | 'viewer', string> = {
  owner: '관리자',
  editor: '편집자',
  viewer: '뷰어',
}

function TripActionBar({
  timeDisplayMode,
  onOpenTimeMode,
  onOpenMembers,
  onOpenShare,
  canInvite,
  canShare,
}: {
  timeDisplayMode: TimeDisplayMode
  onOpenTimeMode: () => void
  onOpenMembers: () => void
  onOpenShare: () => void
  canInvite: boolean
  canShare: boolean
}) {
  const currentLabel = TIME_MODE_OPTIONS.find((option) => option.value === timeDisplayMode)?.label ?? '현지 시간'
  return (
    <View style={styles.actionBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionBarScroll}>
        <Pressable
          onPress={onOpenTimeMode}
          accessibilityRole="button"
          accessibilityLabel="시간 표시 방식 선택"
          style={({ pressed }) => [styles.actionChip, styles.actionChipActive, pressed && styles.pressedFade]}
        >
          <Ionicons name="time-outline" size={15} color={colors.brand.primary} />
          <Text style={[styles.actionChipText, styles.actionChipTextActive]}>{currentLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.brand.primary} />
        </Pressable>
        {canInvite ? (
          <Pressable
            onPress={onOpenMembers}
            accessibilityRole="button"
            style={({ pressed }) => [styles.actionChip, pressed && styles.pressedFade]}
          >
            <Ionicons name="person-add-outline" size={15} color={colors.brand.ink} />
            <Text style={styles.actionChipText}>동행자</Text>
          </Pressable>
        ) : null}
        {canShare ? (
          <Pressable
            onPress={onOpenShare}
            accessibilityRole="button"
            style={({ pressed }) => [styles.actionChip, pressed && styles.pressedFade]}
          >
            <Ionicons name="share-social-outline" size={15} color={colors.brand.ink} />
            <Text style={styles.actionChipText}>공유</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  )
}

function TimeModeSheet({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean
  value: TimeDisplayMode
  onClose: () => void
  onSelect: (mode: TimeDisplayMode) => void
}) {
  return (
    <BottomSheet visible={visible} title="시간 표시 방식" onClose={onClose}>
      <View style={styles.sheetList}>
        {TIME_MODE_OPTIONS.map((option) => {
          const selected = option.value === value
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.timeModeRow,
                selected && styles.timeModeRowActive,
                pressed && styles.pressedFade,
              ]}
            >
              <View style={styles.timeModeIcon}>
                <Ionicons name="time-outline" size={18} color={colors.brand.primary} />
              </View>
              <View style={styles.timeModeBody}>
                <Text style={styles.timeModeTitle}>{option.label}</Text>
                <Text style={styles.timeModeDesc}>
                  {option.value === 'local'
                    ? '일정이 저장된 현지 시간을 보여줘요.'
                    : option.value === 'kst'
                      ? '한국 시간 기준으로 변환해 보여줘요.'
                      : '현지 시간과 한국 시간을 함께 보여줘요.'}
                </Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.brand.primary} /> : null}
            </Pressable>
          )
        })}
      </View>
    </BottomSheet>
  )
}

function TripSwitcherSheet({
  visible,
  trips,
  currentTripId,
  onClose,
  onSelect,
}: {
  visible: boolean
  trips: Trip[]
  currentTripId?: string
  onClose: () => void
  onSelect: (tripId: string) => void
}) {
  return (
    <BottomSheet visible={visible} title="여행 바꾸기" onClose={onClose}>
      <View style={styles.sheetList}>
        {trips.length > 0 ? (
          trips.map((item) => {
            const selected = item.id === currentTripId
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.switchTripRow,
                  selected && styles.switchTripRowActive,
                  pressed && styles.pressedFade,
                ]}
              >
                <View style={styles.switchTripIcon}>
                  <Ionicons name="airplane-outline" size={18} color={colors.brand.primary} />
                </View>
                <View style={styles.switchTripBody}>
                  <Text style={styles.switchTripTitle} numberOfLines={1}>
                    {item.destination}
                  </Text>
                  <Text style={styles.switchTripMeta} numberOfLines={1}>
                    {formatDate(item.start_date)} ~ {formatDate(item.end_date)}
                  </Text>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.brand.primary} /> : null}
              </Pressable>
            )
          })
        ) : (
          <EmptyState icon="airplane-outline" title="전환할 여행이 없어요" description="여행 목록을 불러오지 못했어요." />
        )}
      </View>
    </BottomSheet>
  )
}

function ShareTripSheet({
  visible,
  trip,
  shareUrl,
  loading,
  onCreateLink,
  onShare,
  onClose,
}: {
  visible: boolean
  trip: Trip
  shareUrl: string
  loading: boolean
  onCreateLink: () => void
  onShare: () => void
  onClose: () => void
}) {
  return (
    <BottomSheet visible={visible} title="여행 일정 공유하기" onClose={onClose}>
      <View style={styles.sheetHeroRow}>
        <View style={styles.shareSheetHeroIcon}>
          <Ionicons name="share-social-outline" size={22} color={colors.brand.primary} />
        </View>
        <View style={styles.sheetHeroBody}>
          <Text style={styles.sheetHeroTitle}>{trip.destination} 일정</Text>
          <Text style={styles.sheetHeroDesc}>읽기 전용 링크로 가족이나 친구에게 여행 일정을 공유해요.</Text>
        </View>
      </View>

      {shareUrl ? (
        <View style={styles.shareUrlBox}>
          <Text style={styles.shareUrlLabel}>공유 링크</Text>
          <Text style={styles.shareUrlText} numberOfLines={3}>
            {shareUrl}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={shareUrl ? onShare : onCreateLink}
        disabled={loading}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.sheetPrimaryButton,
          loading && styles.buttonDisabled,
          pressed && !loading && styles.pressedSoft,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.bg.canvas} />
        ) : (
          <Ionicons name={shareUrl ? 'share-outline' : 'link-outline'} size={18} color={colors.bg.canvas} />
        )}
        <Text style={styles.sheetPrimaryButtonText}>
          {loading ? '링크 생성 중...' : shareUrl ? '공유하기' : '공유 링크 만들기'}
        </Text>
      </Pressable>
    </BottomSheet>
  )
}

function CollaboratorSheet({
  visible,
  members,
  loading,
  inviteLoading,
  currentUserId,
  ownerId,
  canManage,
  canInvite,
  onInvite,
  onCreateInviteLink,
  onUpdateRole,
  onRemove,
  onClose,
}: {
  visible: boolean
  members: TripMember[]
  loading: boolean
  inviteLoading: boolean
  currentUserId: string | null
  ownerId: string
  canManage: boolean
  canInvite: boolean
  onInvite: (email: string, role: 'editor' | 'viewer') => void
  onCreateInviteLink: () => void
  onUpdateRole: (memberId: string, role: 'editor' | 'viewer') => void
  onRemove: (member: TripMember) => void
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')

  const submitInvite = () => {
    const value = email.trim()
    if (!value) return
    onInvite(value, role)
    setEmail('')
  }

  return (
    <BottomSheet visible={visible} title="함께하는 일행 관리" onClose={onClose}>
      {canInvite ? (
        <View style={styles.invitePanel}>
          <Text style={styles.sheetSectionTitle}>이메일로 초대하기</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="friend@example.com"
            placeholderTextColor={colors.brand.mutedSoft}
            style={styles.inviteInput}
          />
          <View style={styles.roleRow}>
            {(['editor', 'viewer'] as const).map((nextRole) => (
              <Pressable
                key={nextRole}
                onPress={() => setRole(nextRole)}
                accessibilityRole="button"
                accessibilityState={{ selected: role === nextRole }}
                style={({ pressed }) => [
                  styles.roleButton,
                  role === nextRole && styles.roleButtonActive,
                  pressed && styles.pressedFade,
                ]}
              >
                <Text style={[styles.roleButtonText, role === nextRole && styles.roleButtonTextActive]}>
                  {ROLE_LABELS[nextRole]}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.inviteButtonRow}>
            <Pressable
              onPress={submitInvite}
              disabled={inviteLoading || !email.trim()}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.sheetPrimaryButton,
                styles.inviteButton,
                (inviteLoading || !email.trim()) && styles.buttonDisabled,
                pressed && !inviteLoading && email.trim().length > 0 && styles.pressedSoft,
              ]}
            >
              {inviteLoading ? <ActivityIndicator color={colors.bg.canvas} /> : <Ionicons name="mail-outline" size={18} color={colors.bg.canvas} />}
              <Text style={styles.sheetPrimaryButtonText}>초대</Text>
            </Pressable>
            <Pressable
              onPress={onCreateInviteLink}
              disabled={inviteLoading}
              accessibilityRole="button"
              style={({ pressed }) => [styles.sheetSecondaryButton, inviteLoading && styles.buttonDisabled, pressed && styles.pressedFade]}
            >
              <Ionicons name="link-outline" size={18} color={colors.brand.primary} />
              <Text style={styles.sheetSecondaryButtonText}>링크</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.membersHeader}>
        <Text style={styles.sheetSectionTitle}>참여 중인 멤버</Text>
        <Text style={styles.memberCountText}>{members.length}명</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.brand.primary} />
      ) : members.length > 0 ? (
        <View style={styles.memberList}>
          {members.map((member) => {
            const label = member.profiles?.nickname || member.profiles?.email || member.invited_email || '초대됨'
            const canEditMember = canManage && member.role !== 'owner' && member.user_id !== ownerId
            const isSelf = currentUserId && member.user_id === currentUserId
            return (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{label.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.memberBody}>
                  <Text style={styles.memberName} numberOfLines={1}>{label}</Text>
                  <Text style={styles.memberMeta} numberOfLines={1}>
                    {ROLE_LABELS[member.role]} · {member.status === 'pending' ? '수락 대기' : '참여 중'}
                  </Text>
                </View>
                {canEditMember ? (
                  <View style={styles.memberActions}>
                    <Pressable
                      onPress={() => onUpdateRole(member.id, member.role === 'editor' ? 'viewer' : 'editor')}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.memberIconButton, pressed && styles.pressedFade]}
                    >
                      <Ionicons name="swap-horizontal-outline" size={16} color={colors.brand.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => onRemove(member)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.memberIconButton, pressed && styles.pressedFade]}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.brand.error} />
                    </Pressable>
                  </View>
                ) : isSelf && member.role !== 'owner' ? (
                  <Text style={styles.memberSelfText}>나</Text>
                ) : null}
              </View>
            )
          })}
        </View>
      ) : (
        <EmptyState icon="people-outline" title="아직 동행자가 없어요" description="이메일이나 링크로 함께할 사람을 초대하세요." />
      )}
    </BottomSheet>
  )
}

// ─── 일정표 탭 ────────────────────────────────────────────────────────────────

interface PlansTabProps {
  plans: PlanWithUrls[]
  onToggleVisited: (plan: PlanWithUrls) => void
  onEditPlan: (plan: PlanWithUrls) => void
  onDeletePlan: (plan: PlanWithUrls) => Promise<void>
  canEdit: boolean
  timeDisplayMode: TimeDisplayMode
}

function PlansTab({
  plans,
  onToggleVisited,
  onEditPlan,
  onDeletePlan,
  canEdit,
  timeDisplayMode,
}: PlansTabProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const groups = groupPlansByDate(plans)
  const selectedPlan = selectedPlanId
    ? plans.find((plan) => plan.id === selectedPlanId) ?? null
    : null

  return (
    <>
    <ScrollView contentContainerStyle={styles.body}>
      {/* 일정 타임라인 */}
      {groups.length > 0 ? (
        groups.map((group, groupIndex) => (
          <View key={group.date} style={styles.section}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayBadge}>DAY {groupIndex + 1}</Text>
              <Text style={styles.sectionHeader} accessibilityRole="header">
                {formatSectionDate(group.date)}
              </Text>
            </View>
            {group.plans.map((plan) => {
              const cost = formatPlanCost(plan)
              const urls = planUrls(plan)
              const hasMemo = Boolean(plan.memo)
              const hasAlarm = (plan.alarm_minutes_before ?? 0) > 0
              return (
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
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${plan.title} 일정 상세 보기`}
                      onPress={() => setSelectedPlanId(plan.id)}
                      style={({ pressed }) => [
                        styles.planCard,
                        plan.is_visited && styles.planCardVisited,
                        pressed && styles.pressedFade,
                      ]}
                    >
                      <View style={styles.planThumbnail}>
                        {plan.image_url ? (
                          <Image
                            source={{ uri: plan.image_url }}
                            alt={`${plan.title} 장소 사진`}
                            style={styles.planThumbnailImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.planThumbnailFallback}>
                            <Ionicons name="image-outline" size={22} color={colors.brand.mutedSoft} />
                          </View>
                        )}
                      </View>
                      <View style={styles.planCardBody}>
                        <View style={styles.planTitleRow}>
                          <Text
                            style={[styles.planTitle, plan.is_visited && styles.planTitleVisited]}
                            numberOfLines={1}
                          >
                            {plan.title}
                          </Text>
                          {hasAlarm ? (
                            <Ionicons name="notifications" size={13} color={colors.brand.error} />
                          ) : null}
                          {hasMemo ? (
                            <Ionicons name="document-text-outline" size={13} color={colors.brand.muted} />
                          ) : null}
                          {urls.length > 0 ? (
                            <Ionicons name="link-outline" size={13} color={colors.brand.muted} />
                          ) : null}
                          {canEdit ? (
                            <Pressable
                              onPress={() => onToggleVisited(plan)}
                              accessibilityRole="button"
                              accessibilityState={{ selected: plan.is_visited }}
                              accessibilityLabel={plan.is_visited ? '방문 취소' : '방문 완료로 표시'}
                              hitSlop={8}
                              style={({ pressed }) => pressed && styles.pressedFade}
                            >
                              <Ionicons
                                name={plan.is_visited ? 'checkmark-circle' : 'ellipse-outline'}
                                size={18}
                                color={plan.is_visited ? colors.brand.primary : colors.brand.muted}
                              />
                            </Pressable>
                          ) : null}
                        </View>
                        <View style={styles.planMetaLine}>
                          <View style={styles.planMetaItem}>
                            <Ionicons name="time-outline" size={12} color={colors.brand.muted} />
                            <Text style={styles.planMetaText}>
                              {formatPlanTimeLabel(plan, timeDisplayMode)}
                            </Text>
                          </View>
                          {plan.location ? (
                            <View style={[styles.planMetaItem, styles.planMetaLocation]}>
                              <Ionicons name="location-outline" size={11} color={colors.brand.muted} />
                              <Text style={styles.planMetaText} numberOfLines={1}>
                                {plan.location}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        {(cost || canEdit) ? (
                          <View style={styles.planCardFooter}>
                            {cost ? (
                              <View style={styles.planCostInline}>
                                <Ionicons name="wallet-outline" size={12} color={colors.brand.primary} />
                                <Text style={styles.planCostInlineText} numberOfLines={1}>
                                  {cost}
                                </Text>
                              </View>
                            ) : <View />}
                            {canEdit ? (
                              <Pressable
                                onPress={() => onEditPlan(plan)}
                                accessibilityRole="button"
                                accessibilityLabel="일정 수정"
                                hitSlop={8}
                                style={({ pressed }) => [styles.planInlineAction, pressed && styles.pressedFade]}
                              >
                                <Ionicons name="pencil-outline" size={14} color={colors.brand.muted} />
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  </View>
                </View>
              )
            })}
          </View>
        ))
      ) : (
        <EmptyState
          icon="calendar-outline"
          title="아직 등록된 일정이 없어요"
          description="첫 일정을 추가해 여정을 그려보세요."
          style={styles.emptyPanel}
        />
      )}
    </ScrollView>
    <PlanDetailSheet
      plan={selectedPlan}
      visible={selectedPlanId !== null}
      onClose={() => setSelectedPlanId(null)}
      onToggleVisited={onToggleVisited}
      onEdit={onEditPlan}
      onDelete={onDeletePlan}
      canEdit={canEdit}
      timeDisplayMode={timeDisplayMode}
    />
    </>
  )
}

function PlanDetailSheet({
  plan,
  visible,
  onClose,
  onToggleVisited,
  onEdit,
  onDelete,
  canEdit,
  timeDisplayMode,
}: {
  plan: PlanWithUrls | null
  visible: boolean
  onClose: () => void
  onToggleVisited: (plan: PlanWithUrls) => void
  onEdit: (plan: PlanWithUrls) => void
  onDelete: (plan: PlanWithUrls) => Promise<void>
  canEdit: boolean
  timeDisplayMode: TimeDisplayMode
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState<'info' | 'refs'>('info')
  const insets = useSafeAreaInsets()
  if (!plan) return null

  const cost = formatPlanCost(plan)
  const urls = planUrls(plan)
  const mapUrl = buildMapUrl(plan)
  const lat = planLat(plan)
  const lng = planLng(plan)
  const hasMap = lat != null && lng != null
  const displayTime = formatPlanTimeLabel(plan, timeDisplayMode)
  const localTime = formatLocalDateTime(plan.start_datetime_local)
  const kstTime = formatKstDateTime(plan.start_datetime_local, plan.timezone_string || 'Asia/Seoul')
  const timezone = plan.timezone_string || 'Asia/Seoul'
  const mapRegion = hasMap
    ? {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : null

  const openUrl = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: colors.brand.primary,
      })
    } catch {
      try {
        await Linking.openURL(url)
      } catch {
        Alert.alert('오류', '링크를 열 수 없어요.')
      }
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.planDetailScreen} edges={['bottom']}>
        <View style={styles.planDetailHero}>
          {plan.image_url ? (
            <Image
              source={{ uri: plan.image_url }}
              alt={plan.title}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.planDetailHeroFallback}>
              <Ionicons name="map-outline" size={52} color={colors.bg.canvas} />
            </View>
          )}
          <View style={styles.planDetailScrim} />

          <View style={[styles.planDetailTopBar, { top: insets.top + spacing.sm }]}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="뒤로"
              style={({ pressed }) => [styles.planDetailBackButton, pressed && styles.pressedFade]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.bg.canvas} />
              <Text style={styles.planDetailBackText}>뒤로</Text>
            </Pressable>
            {canEdit ? (
              <View style={styles.planDetailIconActions}>
                <Pressable
                  onPress={() => {
                    onClose()
                    onEdit(plan)
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="일정 수정"
                  style={({ pressed }) => [styles.planDetailIconButton, pressed && styles.pressedFade]}
                >
                  <Ionicons name="pencil-outline" size={18} color={colors.bg.canvas} />
                </Pressable>
                <Pressable
                  onPress={() => setConfirmDelete(true)}
                  accessibilityRole="button"
                  accessibilityLabel="일정 삭제"
                  style={({ pressed }) => [styles.planDetailIconButton, pressed && styles.pressedFade]}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.bg.canvas} />
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.planDetailHeroText}>
            {plan.location ? (
              <View style={styles.planDetailPlaceBadge}>
                <Text style={styles.planDetailPlaceBadgeText} numberOfLines={1}>
                  {plan.location}
                </Text>
              </View>
            ) : null}
            <Text style={styles.planDetailHeroTitle} numberOfLines={2}>
              {plan.title}
            </Text>
            {canEdit ? (
              <Pressable
                onPress={() => onToggleVisited(plan)}
                accessibilityRole="button"
                accessibilityState={{ selected: plan.is_visited }}
                style={({ pressed }) => [styles.planDetailVisitPill, pressed && styles.pressedFade]}
              >
                <Ionicons
                  name={plan.is_visited ? 'checkmark-circle' : 'ellipse-outline'}
                  size={15}
                  color={colors.bg.canvas}
                />
                <Text style={styles.planDetailVisitText}>
                  {plan.is_visited ? '방문 완료' : '방문 전'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.planDetailTabs}>
          <Pressable
            onPress={() => setTab('info')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'info' }}
            style={styles.planDetailTab}
          >
            <Ionicons
              name="globe-outline"
              size={15}
              color={tab === 'info' ? colors.brand.primary : colors.brand.muted}
            />
            <Text style={[styles.planDetailTabText, tab === 'info' && styles.planDetailTabTextActive]}>
              기본 정보
            </Text>
            {tab === 'info' ? <View style={styles.planDetailTabIndicator} /> : null}
          </Pressable>
          <Pressable
            onPress={() => setTab('refs')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'refs' }}
            style={styles.planDetailTab}
          >
            <Ionicons
              name="book-outline"
              size={15}
              color={tab === 'refs' ? colors.brand.primary : colors.brand.muted}
            />
            <Text style={[styles.planDetailTabText, tab === 'refs' && styles.planDetailTabTextActive]}>
              참고자료
            </Text>
            {urls.length > 0 ? (
              <View style={styles.planDetailRefCount}>
                <Text style={styles.planDetailRefCountText}>{urls.length}</Text>
              </View>
            ) : null}
            {tab === 'refs' ? <View style={styles.planDetailTabIndicator} /> : null}
          </Pressable>
        </View>

        {tab === 'info' ? (
          <ScrollView
            style={styles.planDetailBody}
            contentContainerStyle={styles.planDetailBodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.planDetailMapWrap}>
              {hasMap && NativeMapView && NativeMarker && mapRegion ? (
                <NativeMapView style={styles.planDetailMap} initialRegion={mapRegion}>
                  <NativeMarker
                    coordinate={{ latitude: lat, longitude: lng }}
                    title={plan.title}
                    description={plan.location ?? undefined}
                  />
                </NativeMapView>
              ) : (
                <View style={styles.planDetailMapFallback}>
                  <Ionicons name="map-outline" size={28} color={colors.brand.mutedSoft} />
                  <Text style={styles.planDetailMapFallbackText}>지도 미리보기 준비 중이에요</Text>
                </View>
              )}
              {mapUrl ? (
                <Pressable
                  onPress={() => openUrl(mapUrl)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.planDetailMapButton, pressed && styles.pressedFade]}
                >
                  <Ionicons name="navigate-outline" size={14} color={colors.brand.primary} />
                  <Text style={styles.planDetailMapButtonText}>지도에서 열기</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.planDetailInfoList}>
              <DetailInfo icon="location-outline" label="장소" value={plan.location || plan.title} subValue={plan.address ?? undefined} />
              <DetailInfo
                icon="time-outline"
                label="시간"
                value={displayTime}
                subValue={
                  timeDisplayMode === 'both'
                    ? `현지 ${localTime} · 한국 ${kstTime || localTime}`
                    : timeDisplayMode === 'kst'
                      ? `한국 시간 · 기준 타임존 ${timezone}`
                      : `현지 시간 · ${timezone}`
                }
              />
              {plan.alarm_minutes_before ? (
                <DetailInfo
                  icon="notifications-outline"
                  label="알림 설정"
                  value={`${plan.alarm_minutes_before}분 전`}
                />
              ) : null}
              <DetailInfo icon="globe-outline" label="타임존" value={timezone} />
              {cost ? <DetailInfo icon="card-outline" label="예상 금액" value={cost} /> : null}
            </View>

            {plan.memo ? (
              <View style={styles.planDetailMemo}>
                <Text style={styles.planDetailMemoTitle}>메모</Text>
                <Text style={styles.planDetailMemoText}>{plan.memo}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.planDetailBody}
            contentContainerStyle={styles.planDetailBodyContent}
            showsVerticalScrollIndicator={false}
          >
            {urls.length > 0 ? (
              <View style={styles.planDetailRefs}>
                <View style={styles.planDetailRefsHeader}>
                  <Ionicons name="link-outline" size={14} color={colors.brand.muted} />
                  <Text style={styles.planDetailRefsHeaderText}>
                    {urls.length}개의 참고자료가 있습니다
                  </Text>
                </View>
                {urls.map((url) => (
                  <UrlPreviewCard key={url} url={url} onOpen={openUrl} />
                ))}
              </View>
            ) : (
              <EmptyState
                icon="book-outline"
                title="참고자료가 없어요"
                description="일정 수정에서 참고 URL을 추가할 수 있어요."
              />
            )}
          </ScrollView>
        )}

        <ConfirmSheet
          visible={confirmDelete}
          title="일정 삭제"
          message={`'${plan.title}' 일정을 삭제할까요? 이 작업은 되돌릴 수 없어요.`}
          confirmLabel="삭제"
          destructive
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false)
            await onDelete(plan)
          }}
        />
      </SafeAreaView>
    </Modal>
  )
}

function DetailInfo({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  value: string
  subValue?: string
}) {
  return (
    <View style={styles.detailInfo}>
      <View style={styles.detailInfoIcon}>
        <Ionicons name={icon} size={17} color={colors.brand.primary} />
      </View>
      <View style={styles.detailInfoBody}>
        <Text style={styles.detailInfoLabel}>{label}</Text>
        <Text style={styles.detailInfoValue} numberOfLines={2}>
          {value}
        </Text>
        {subValue ? (
          <Text style={styles.detailInfoSubValue} numberOfLines={2}>
            {subValue}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

// ─── 준비물 탭 ────────────────────────────────────────────────────────────────

interface ChecklistTabProps {
  loading: boolean
  loaded: boolean
  checklist: Checklist | null
  items: ChecklistItem[]
  onToggle: (item: ChecklistItem) => void
  onCreateItem: () => void
  onEditItem: (item: ChecklistItem) => void
  onDeleteItem: (item: ChecklistItem) => Promise<void>
  onOpenTemplates: () => void
  canEdit: boolean
}

function ChecklistTab({
  loading,
  loaded,
  checklist,
  items,
  onToggle,
  onCreateItem,
  onEditItem,
  onDeleteItem,
  onOpenTemplates,
  canEdit,
}: ChecklistTabProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  if (loading || !loaded) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    )
  }

  if (checklist === null) {
    return (
      <View style={styles.emptyPanel}>
        <EmptyState
          icon="checkbox-outline"
          title="이 여정에 체크리스트가 없어요"
          description="준비물을 직접 추가하거나 템플릿을 적용해 시작하세요."
          actionLabel={canEdit ? '준비물 추가' : undefined}
          onAction={canEdit ? onCreateItem : undefined}
        />
      </View>
    )
  }

  const pendingItems = items.filter((i) => !i.is_checked)
  const doneItems = items.filter((i) => i.is_checked)
  const totalCount = items.length
  const doneCount = doneItems.length
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: prev[key] === false }))
  }

  const groupItems = (source: ChecklistItem[]) => {
    const groups = new Map<string, ChecklistItem[]>()
    source.forEach((item) => {
      const key = item.category?.trim() || '기타'
      groups.set(key, [...(groups.get(key) ?? []), item])
    })
    return Array.from(groups.entries())
  }

  return (
    <ScrollView
      style={styles.contentScroll}
      contentContainerStyle={styles.contentBody}
    >
      {/* 완료율 */}
      <View style={styles.progressSection}>
        <ProgressBar
          label={`${doneCount} / ${totalCount} 완료`}
          value={progressPct}
        />
      </View>
      {canEdit ? (
        <View style={styles.checklistActionRow}>
          <Pressable
            onPress={onCreateItem}
            accessibilityRole="button"
            style={({ pressed }) => [styles.inlinePrimaryButton, styles.actionFlex, pressed && styles.pressedFade]}
          >
            <Ionicons name="add" size={18} color={colors.bg.canvas} />
            <Text style={styles.inlinePrimaryButtonText}>준비물 추가</Text>
          </Pressable>
          <Pressable
            onPress={onOpenTemplates}
            accessibilityRole="button"
            style={({ pressed }) => [styles.inlineSecondaryButton, styles.actionFlex, pressed && styles.pressedFade]}
          >
            <Ionicons name="albums-outline" size={18} color={colors.brand.primary} />
            <Text style={styles.inlineSecondaryButtonText}>템플릿 적용</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 미완료 항목 */}
      {pendingItems.length > 0 && (
        <View style={styles.clSection}>
          <Text style={styles.sectionLabel}>남은 항목 ({pendingItems.length})</Text>
          {groupItems(pendingItems).map(([category, groupItems]) => {
            const key = `pending-${category}`
            const open = openGroups[key] !== false
            return (
              <AccordionCard
                key={key}
                title={category}
                count={groupItems.length}
                open={open}
                onToggle={() => toggleGroup(key)}
              >
                {groupItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={onToggle}
                    onEdit={onEditItem}
                    onDelete={onDeleteItem}
                    canEdit={canEdit}
                  />
                ))}
              </AccordionCard>
            )
          })}
        </View>
      )}

      {/* 완료 항목 */}
      {doneItems.length > 0 && (
        <View style={styles.clSection}>
          <Text style={styles.sectionLabel}>완료 ({doneItems.length})</Text>
          {groupItems(doneItems).map(([category, groupItems]) => {
            const key = `done-${category}`
            const open = openGroups[key] !== false
            return (
              <AccordionCard
                key={key}
                title={category}
                count={groupItems.length}
                open={open}
                onToggle={() => toggleGroup(key)}
              >
                {groupItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={onToggle}
                    onEdit={onEditItem}
                    onDelete={onDeleteItem}
                    canEdit={canEdit}
                    done
                  />
                ))}
              </AccordionCard>
            )
          })}
        </View>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon="checkbox-outline"
          title="등록된 준비물이 없어요"
          description="템플릿을 적용하거나 준비물을 추가해 보세요."
        />
      ) : null}
    </ScrollView>
  )
}

interface ItemRowProps {
  item: ChecklistItem
  onToggle: (item: ChecklistItem) => void
  onEdit: (item: ChecklistItem) => void
  onDelete: (item: ChecklistItem) => Promise<void>
  canEdit: boolean
  done?: boolean
}

function ItemRow({ item, onToggle, onEdit, onDelete, canEdit, done = false }: ItemRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const row = (
    <Pressable
      disabled={!canEdit}
      style={({ pressed }) => [
        styles.itemRow,
        !canEdit && styles.readonlyRow,
        pressed && canEdit && styles.pressedFade,
      ]}
      onPress={() => onToggle(item)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled: !canEdit }}
      accessibilityLabel={item.item_name}
    >
      <View style={[styles.checkbox, done && styles.checkboxChecked]}>
        {done && <Ionicons name="checkmark" size={12} color={colors.bg.canvas} />}
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemName, done && styles.itemNameDone]} numberOfLines={2}>
          {item.item_name}
        </Text>
        {item.category?.length > 0 ? (
          <Text style={styles.itemCategory} numberOfLines={1}>
            {item.category}
          </Text>
        ) : null}
        {item.source_template_name ? (
          <Text style={styles.itemSource} numberOfLines={1}>
            {item.source_template_name}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )

  if (!canEdit) return row

  return (
    <>
      <SwipeRow
        actions={[
          {
            label: '수정',
            icon: 'pencil-outline',
            onPress: () => onEdit(item),
          },
          {
            label: '삭제',
            icon: 'trash-outline',
            color: colors.brand.error,
            onPress: () => setConfirmDelete(true),
          },
        ]}
      >
        {row}
      </SwipeRow>
      <ConfirmSheet
        visible={confirmDelete}
        title="준비물 삭제"
        message={`'${item.item_name}' 항목을 삭제할까요?`}
        confirmLabel="삭제"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false)
          await onDelete(item)
        }}
      />
    </>
  )
}

function TripEditSheet({
  visible,
  trip,
  onClose,
  onSave,
}: {
  visible: boolean
  trip: Trip
  onClose: () => void
  onSave: (input: {
    destination: string
    start_date: string
    end_date: string
    adults_count: number
    children_count: number
  }) => Promise<void>
}) {
  const [destination, setDestination] = useState(trip.destination)
  const [startDate, setStartDate] = useState(trip.start_date)
  const [endDate, setEndDate] = useState(trip.end_date)
  const [adults, setAdults] = useState(String(trip.adults_count))
  const [children, setChildren] = useState(String(trip.children_count))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setDestination(trip.destination)
    setStartDate(trip.start_date)
    setEndDate(trip.end_date)
    setAdults(String(trip.adults_count))
    setChildren(String(trip.children_count))
    setError('')
  }, [trip, visible])

  const submit = async () => {
    if (!destination.trim()) {
      setError('여행지를 입력해 주세요.')
      return
    }
    if (endDate < startDate) {
      setError('도착일은 출발일과 같거나 이후여야 해요.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        destination: destination.trim(),
        start_date: startDate,
        end_date: endDate,
        adults_count: Math.max(0, Number(adults) || 0),
        children_count: Math.max(0, Number(children) || 0),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '여행 수정에 실패했어요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet visible={visible} title="여행 수정" onClose={onClose}>
      <FormField label="여행지" value={destination} onChangeText={setDestination} />
      <View style={styles.formTwoColumn}>
        <FormField label="출발일" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
        <FormField label="도착일" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
      </View>
      <View style={styles.formTwoColumn}>
        <FormField label="성인" value={adults} onChangeText={setAdults} keyboardType="number-pad" />
        <FormField label="아동" value={children} onChangeText={setChildren} keyboardType="number-pad" />
      </View>
      {error ? <Text style={styles.formError}>{error}</Text> : null}
      <Pressable
        onPress={submit}
        disabled={saving}
        accessibilityRole="button"
        style={({ pressed }) => [styles.sheetSubmitButton, pressed && !saving && styles.pressedFade, saving && styles.disabledButton]}
      >
        {saving ? <ActivityIndicator color={colors.bg.canvas} /> : <Text style={styles.sheetSubmitText}>저장하기</Text>}
      </Pressable>
    </BottomSheet>
  )
}

function PlanEditSheet({
  visible,
  plan,
  trip,
  onClose,
  onSave,
}: {
  visible: boolean
  plan: PlanWithUrls | null
  trip: Trip
  onClose: () => void
  onSave: (input: PlanSaveInput) => Promise<void>
}) {
  const defaultDate = trip.start_date || toDateString(new Date())
  const [step, setStep] = useState<PlanSheetStep>('place')
  const [selectedPlace, setSelectedPlace] = useState<PlaceOption | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [placeResults, setPlaceResults] = useState<GooglePlaceData[]>([])
  const [placeSearching, setPlaceSearching] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState('1')
  const [cost, setCost] = useState('')
  const [memo, setMemo] = useState('')
  const [urls, setUrls] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setStep(plan ? 'details' : 'place')
    setSelectedPlace(plan ? {
      name: plan.location ?? plan.title,
      address: plan.address ?? plan.location ?? '',
      lat: plan.location_lat ?? plan.lat ?? null,
      lng: plan.location_lng ?? plan.lng ?? null,
      googlePlaceId: plan.google_place_id ?? null,
      photoReference: plan.photo_reference ?? null,
    } : null)
    setSearchValue('')
    setPlaceResults([])
    setPlaceSearching(false)
    setTitle(plan?.title ?? '')
    setDate(plan ? parseDate(plan.start_datetime_local) : defaultDate)
    setTime(plan ? parseTime(plan.start_datetime_local) : '09:00')
    setDuration('1')
    setCost(plan?.cost ? String(plan.cost) : '')
    setMemo(plan?.memo ?? '')
    setUrls(plan ? planUrls(plan).join('\n') : '')
    setError('')
  }, [defaultDate, plan, visible])

  useEffect(() => {
    if (!visible || step !== 'place' || !PLACES_API_KEY) return

    const query = searchValue.trim()
    if (query.length < 2) {
      setPlaceResults([])
      setPlaceSearching(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setPlaceSearching(true)
      try {
        const params = new URLSearchParams({
          input: query,
          key: PLACES_API_KEY,
          language: 'ko',
        })
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
          { signal: controller.signal }
        )
        const json = (await res.json()) as GoogleAutocompleteResponse
        if (json.status === 'OK') {
          setPlaceResults(json.predictions ?? [])
          setError('')
        } else if (json.status === 'ZERO_RESULTS') {
          setPlaceResults([])
          setError('')
        } else {
          setPlaceResults([])
          setError(json.error_message || '장소 검색에 실패했어요.')
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
        setPlaceResults([])
        setError('장소 검색에 실패했어요.')
      } finally {
        setPlaceSearching(false)
      }
    }, 350)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [searchValue, step, visible])

  const selectPlace = (data: GooglePlaceData, detail: GooglePlaceDetail | null) => {
    const lat = detail?.geometry?.location?.lat ?? detail?.location?.lat ?? null
    const lng = detail?.geometry?.location?.lng ?? detail?.location?.lng ?? null
    const name =
      detail?.name ||
      data.structured_formatting?.main_text ||
      data.description
    const address =
      detail?.formatted_address ||
      detail?.vicinity ||
      data.structured_formatting?.secondary_text ||
      data.description

    setSelectedPlace({
      name,
      address,
      lat,
      lng,
      googlePlaceId: detail?.place_id ?? data.place_id ?? null,
      photoReference: detail?.photos?.[0]?.photo_reference ?? null,
    })
    setError('')
    setStep('details')
  }

  const fetchPlaceDetails = async (prediction: GooglePlaceData) => {
    if (!prediction.place_id) {
      selectPlace(prediction, null)
      return
    }

    setPlaceSearching(true)
    setError('')
    try {
      const params = new URLSearchParams({
        place_id: prediction.place_id,
        fields: 'place_id,name,formatted_address,geometry,photos,vicinity',
        key: PLACES_API_KEY,
        language: 'ko',
      })
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
      )
      const json = (await res.json()) as GooglePlaceDetailsResponse
      if (json.status !== 'OK' || !json.result) {
        throw new Error(json.error_message || '장소 상세 정보를 불러오지 못했어요.')
      }
      selectPlace(prediction, json.result)
    } catch (e) {
      setError(e instanceof Error ? e.message : '장소 상세 정보를 불러오지 못했어요.')
    } finally {
      setPlaceSearching(false)
    }
  }

  const continueManual = () => {
    const value = searchValue.trim()
    if (!value) {
      setError('장소를 검색하거나 직접 입력해 주세요.')
      return
    }
    setSelectedPlace({
      name: value,
      address: '',
      lat: null,
      lng: null,
      googlePlaceId: null,
      photoReference: null,
    })
    setError('')
    setStep('details')
  }

  const resolveTimezone = async (place: PlaceOption): Promise<string> => {
    if (!PLACES_API_KEY || place.lat == null || place.lng == null) {
      return plan?.timezone_string || 'Asia/Seoul'
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/timezone/json?location=${place.lat},${place.lng}&timestamp=${timestamp}&key=${PLACES_API_KEY}&language=ko`
      )
      const json = (await res.json()) as { status?: string; timeZoneId?: string }
      return json.status === 'OK' && json.timeZoneId
        ? json.timeZoneId
        : plan?.timezone_string || 'Asia/Seoul'
    } catch {
      return plan?.timezone_string || 'Asia/Seoul'
    }
  }

  const submit = async () => {
    if (!selectedPlace) {
      setError('먼저 장소를 선택해 주세요.')
      setStep('place')
      return
    }
    if (!parseDate(date)) {
      setError('날짜를 YYYY-MM-DD 형식으로 입력해 주세요.')
      return
    }
    const start = normalizeDateTime(date, time)
    setSaving(true)
    setError('')
    const timezone = await resolveTimezone(selectedPlace)
    const titleToSave = title.trim() || selectedPlace.name
    const locationToSave = title.trim()
      ? selectedPlace.name
      : selectedPlace.address || selectedPlace.name

    try {
      await onSave({
        title: titleToSave,
        location: locationToSave,
        address: selectedPlace.address || selectedPlace.name,
        location_lat: selectedPlace.lat,
        location_lng: selectedPlace.lng,
        google_place_id: selectedPlace.googlePlaceId,
        image_url: plan?.image_url ?? null,
        photo_reference: selectedPlace.photoReference,
        start_datetime_local: start,
        end_datetime_local: addHoursToLocalDateTime(start, Math.max(0.5, Number(duration) || 1)),
        cost: Number(cost) || 0,
        memo,
        alarm_minutes_before: plan?.alarm_minutes_before ?? 60,
        timezone_string: timezone,
        urls: urls.split('\n').map((url) => url.trim()).filter(Boolean),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정 저장에 실패했어요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet visible={visible} title={step === 'place' ? '일정 장소 찾기' : '상세 일정 기록'} onClose={onClose}>
      {step === 'place' ? (
        <View style={styles.placeStep}>
          <View style={styles.placeHero}>
            <View style={styles.placeHeroIcon}>
              <Ionicons name="location-outline" size={28} color={colors.brand.primary} />
            </View>
            <Text style={styles.placeHeroTitle}>어디로 떠나볼까요?</Text>
            <Text style={styles.placeHeroDesc}>장소 정보를 일정에 연결해 두면 나중에 지도 미리보기를 바로 붙일 수 있어요.</Text>
          </View>

          {PLACES_API_KEY ? (
            <View style={styles.placesContainer}>
              <View style={styles.placeSearchBox}>
                <Ionicons name="search-outline" size={18} color={colors.brand.muted} />
                <TextInput
                  value={searchValue}
                  onChangeText={setSearchValue}
                  placeholder="레스토랑, 명소, 공항 등을 검색하세요"
                  placeholderTextColor={colors.brand.mutedSoft}
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={continueManual}
                  style={styles.placeSearchInput}
                />
                {placeSearching ? (
                  <ActivityIndicator size="small" color={colors.brand.primary} />
                ) : null}
              </View>
              {placeResults.length > 0 ? (
                <View style={styles.placesList}>
                  {placeResults.map((result) => (
                    <Pressable
                      key={result.place_id ?? result.description}
                      onPress={() => {
                        void fetchPlaceDetails(result)
                      }}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.placesRow, pressed && styles.pressedFade]}
                    >
                      <Ionicons name="location-outline" size={17} color={colors.brand.primary} />
                      <View style={styles.placeResultBody}>
                        <Text style={styles.placeResultTitle} numberOfLines={1}>
                          {result.structured_formatting?.main_text ?? result.description}
                        </Text>
                        {result.structured_formatting?.secondary_text ? (
                          <Text style={styles.placesDescription} numberOfLines={1}>
                            {result.structured_formatting.secondary_text}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <FormField
              label="장소"
              value={searchValue}
              onChangeText={setSearchValue}
              placeholder="예) 하네다 공항, 루브르 박물관"
            />
          )}

          {searchValue.trim().length > 0 ? (
            <Pressable
              onPress={continueManual}
              accessibilityRole="button"
              style={({ pressed }) => [styles.manualPlaceButton, pressed && styles.pressedFade]}
            >
              <Ionicons name="create-outline" size={18} color={colors.brand.primary} />
              <Text style={styles.manualPlaceText}>{searchValue.trim()}(으)로 계속하기</Text>
            </Pressable>
          ) : null}

          <View style={styles.placeQuickGrid}>
            {['관광 명소', '대중 교통', '맛집/카페', '포토 스팟'].map((label) => (
              <Pressable
                key={label}
                onPress={() => setSearchValue(label)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.placeQuickButton, pressed && styles.pressedFade]}
              >
                <Ionicons name="compass-outline" size={16} color={colors.brand.primary} />
                <Text style={styles.placeQuickText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <>
          <Pressable
            onPress={() => setStep('place')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.selectedPlaceCard, pressed && styles.pressedFade]}
          >
            <View style={styles.selectedPlaceIcon}>
              <Ionicons name="location" size={18} color={colors.brand.primary} />
            </View>
            <View style={styles.selectedPlaceBody}>
              <Text style={styles.selectedPlaceTitle}>{selectedPlace?.name}</Text>
              {selectedPlace?.address ? (
                <Text style={styles.selectedPlaceAddress} numberOfLines={2}>
                  {selectedPlace.address}
                </Text>
              ) : null}
              {selectedPlace?.googlePlaceId ? (
                <Text style={styles.selectedPlaceMeta}>Google Place 연결됨</Text>
              ) : (
                <Text style={styles.selectedPlaceMeta}>수동 입력 장소</Text>
              )}
            </View>
            <Text style={styles.selectedPlaceChange}>변경</Text>
          </Pressable>

          <FormField label="일정 제목" value={title} onChangeText={setTitle} placeholder="비워두면 장소명이 제목이 돼요" />
          <View style={styles.formTwoColumn}>
            <FormField label="날짜" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
            <FormField label="시간" value={time} onChangeText={setTime} placeholder="HH:mm" />
          </View>
          <View style={styles.formTwoColumn}>
            <FormField label="소요 시간" value={duration} onChangeText={setDuration} keyboardType="decimal-pad" />
            <FormField label="예산" value={cost} onChangeText={setCost} keyboardType="decimal-pad" />
          </View>
          <FormField label="메모" value={memo} onChangeText={setMemo} multiline />
          <FormField label="참고 URL" value={urls} onChangeText={setUrls} placeholder="한 줄에 하나씩 입력" multiline />
        </>
      )}
      {error ? <Text style={styles.formError}>{error}</Text> : null}
      {step === 'details' ? (
        <Pressable
          onPress={submit}
          disabled={saving}
          accessibilityRole="button"
          style={({ pressed }) => [styles.sheetSubmitButton, pressed && !saving && styles.pressedFade, saving && styles.disabledButton]}
        >
          {saving ? <ActivityIndicator color={colors.bg.canvas} /> : <Text style={styles.sheetSubmitText}>저장하기</Text>}
        </Pressable>
      ) : null}
    </BottomSheet>
  )
}

function ChecklistItemSheet({
  visible,
  item,
  onClose,
  onSave,
}: {
  visible: boolean
  item: ChecklistItem | null
  onClose: () => void
  onSave: (input: { item_name: string; category: string }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('기타')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setName(item?.item_name ?? '')
    setCategory(item?.category || '기타')
    setError('')
  }, [item, visible])

  const submit = async () => {
    if (!name.trim()) {
      setError('준비물 이름을 입력해 주세요.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({ item_name: name.trim(), category: category.trim() || '기타' })
    } catch (e) {
      setError(e instanceof Error ? e.message : '준비물 저장에 실패했어요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet visible={visible} title={item ? '준비물 수정' : '준비물 추가'} onClose={onClose}>
      <FormField label="준비물" value={name} onChangeText={setName} placeholder="예) 여권" />
      <FormField label="카테고리" value={category} onChangeText={setCategory} placeholder="기타" />
      {error ? <Text style={styles.formError}>{error}</Text> : null}
      <Pressable
        onPress={submit}
        disabled={saving}
        accessibilityRole="button"
        style={({ pressed }) => [styles.sheetSubmitButton, pressed && !saving && styles.pressedFade, saving && styles.disabledButton]}
      >
        {saving ? <ActivityIndicator color={colors.bg.canvas} /> : <Text style={styles.sheetSubmitText}>저장하기</Text>}
      </Pressable>
    </BottomSheet>
  )
}

function TemplateApplySheet({
  visible,
  userId,
  onClose,
  onApply,
}: {
  visible: boolean
  userId?: string
  onClose: () => void
  onApply: (templateId: string) => Promise<void>
}) {
  const [templates, setTemplates] = useState<TemplateWithPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible || !userId) return
    setLoading(true)
    setError('')
    getTemplatesWithPreview(supabase, userId)
      .then(setTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : '템플릿을 불러오지 못했어요.'))
      .finally(() => setLoading(false))
  }, [userId, visible])

  const apply = async (templateId: string) => {
    setApplyingId(templateId)
    setError('')
    try {
      await onApply(templateId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '템플릿 적용에 실패했어요.')
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <BottomSheet visible={visible} title="템플릿 적용" onClose={onClose}>
      {loading ? (
        <View style={styles.sheetLoading}>
          <ActivityIndicator color={colors.brand.primary} />
        </View>
      ) : templates.length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title="사용 가능한 템플릿이 없어요"
          description="템플릿 탭에서 먼저 준비물 템플릿을 만들어 주세요."
        />
      ) : (
        <View style={styles.templateList}>
          {templates.map((template) => (
            <Pressable
              key={template.id}
              onPress={() => apply(template.id)}
              disabled={applyingId !== null}
              accessibilityRole="button"
              style={({ pressed }) => [styles.templateApplyCard, pressed && styles.pressedFade]}
            >
              <View style={styles.templateApplyIcon}>
                <Ionicons name="checkbox-outline" size={18} color={colors.brand.primary} />
              </View>
              <View style={styles.templateApplyBody}>
                <Text style={styles.templateApplyTitle}>{template.title}</Text>
                <Text style={styles.templateApplyMeta}>
                  항목 {template.item_count}개 · {template.preview_items.join(', ') || '미리보기 없음'}
                </Text>
              </View>
              {applyingId === template.id ? (
                <ActivityIndicator color={colors.brand.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.brand.mutedSoft} />
              )}
            </Pressable>
          ))}
        </View>
      )}
      {error ? <Text style={styles.formError}>{error}</Text> : null}
    </BottomSheet>
  )
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType']
  multiline?: boolean
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.brand.mutedSoft}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.formInput, multiline && styles.formInputMultiline]}
      />
    </View>
  )
}

function UrlPreviewCard({
  url,
  onOpen,
}: {
  url: string
  onOpen: (url: string) => Promise<void>
}) {
  const [preview, setPreview] = useState<OGPreviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchOGPreview(url)
      .then((data) => {
        if (!cancelled) setPreview(data)
      })
      .catch(() => {
        if (!cancelled) {
          try {
            const parsed = new URL(url)
            setPreview({ hostname: parsed.hostname, url })
          } catch {
            setPreview({ hostname: url, url })
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [url])

  const display = preview ?? { hostname: url, url }

  return (
    <Pressable
      onPress={() => {
        void onOpen(url)
      }}
      accessibilityRole="link"
      accessibilityLabel={`${display.title ?? display.hostname} 열기`}
      style={({ pressed }) => [styles.ogCard, pressed && styles.pressedFade]}
    >
      {preview?.image ? (
        <Image
          source={{ uri: preview.image }}
          alt=""
          style={styles.ogImage}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.ogBody}>
        <View style={styles.ogHostRow}>
          {preview?.favicon ? (
            <Image
              source={{ uri: preview.favicon }}
              alt=""
              style={styles.ogFavicon}
              resizeMode="contain"
            />
          ) : null}
          <Text style={styles.ogHost} numberOfLines={1}>
            {display.hostname}
          </Text>
          {loading ? <ActivityIndicator size="small" color={colors.brand.mutedSoft} /> : null}
        </View>
        <Text style={styles.ogTitle} numberOfLines={2}>
          {loading ? '미리보기를 불러오는 중...' : display.title || url}
        </Text>
        {preview?.description ? (
          <Text style={styles.ogDescription} numberOfLines={2}>
            {preview.description}
          </Text>
        ) : null}
        <View style={styles.ogUrlRow}>
          <Ionicons name="open-outline" size={12} color={colors.brand.mutedSoft} />
          <Text style={styles.ogUrl} numberOfLines={1}>
            {url}
          </Text>
        </View>
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
  detailTop: {
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.hairlineSoft,
    backgroundColor: colors.bg.canvas,
  },
  topNav: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  topNavButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
  },
  topNavButtonBadge: {
    position: 'relative',
  },
  navDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand.error,
  },
  tripSwitchButton: {
    flex: 1,
    minWidth: 0,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  tripSwitchTitle: {
    maxWidth: '82%',
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  tripSummary: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.base,
  },
  tripTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tripTitle: {
    flex: 1,
    color: colors.brand.ink,
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  tripIconActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tripIconAction: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.canvas,
  },
  tripMetaGrid: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  tripMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tripMetaText: {
    flex: 1,
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  actionBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.hairlineSoft,
    backgroundColor: colors.bg.canvas,
  },
  actionBarScroll: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  actionChip: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  actionChipActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.surfaceSoft,
  },
  actionChipText: {
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  actionChipTextActive: {
    color: colors.brand.primary,
  },
  timeModeRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  timeModeRowActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.surfaceSoft,
  },
  timeModeIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  timeModeBody: {
    flex: 1,
    minWidth: 0,
  },
  timeModeTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  timeModeDesc: {
    marginTop: spacing.xxs,
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    lineHeight: 19,
  },
  sheetList: {
    gap: spacing.sm,
  },
  switchTripRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  switchTripRowActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.surfaceSoft,
  },
  switchTripIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  switchTripBody: {
    flex: 1,
    minWidth: 0,
  },
  switchTripTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  switchTripMeta: {
    marginTop: spacing.xxs,
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
  },
  sheetHeroRow: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radii.lg,
    backgroundColor: colors.bg.surfaceSoft,
  },
  shareSheetHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.canvas,
  },
  sheetHeroBody: {
    flex: 1,
    minWidth: 0,
  },
  sheetHeroTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  sheetHeroDesc: {
    marginTop: spacing.xxs,
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  shareUrlBox: {
    marginTop: spacing.base,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  shareUrlLabel: {
    color: colors.brand.ink,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    marginBottom: spacing.xs,
  },
  shareUrlText: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  sheetPrimaryButton: {
    marginTop: spacing.base,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.brand.primary,
  },
  sheetPrimaryButtonText: {
    color: colors.bg.canvas,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
  },
  sheetSecondaryButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  sheetSecondaryButtonText: {
    color: colors.brand.primary,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  invitePanel: {
    padding: spacing.base,
    borderRadius: radii.lg,
    backgroundColor: colors.bg.surfaceSoft,
  },
  sheetSectionTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  inviteInput: {
    marginTop: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
    color: colors.brand.ink,
    fontSize: fontSizes.base,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  roleButton: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  roleButtonActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primary,
  },
  roleButtonText: {
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  roleButtonTextActive: {
    color: colors.bg.canvas,
  },
  inviteButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  inviteButton: {
    flex: 1,
    marginTop: 0,
  },
  membersHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberCountText: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  memberList: {
    gap: spacing.sm,
  },
  memberRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  memberAvatarText: {
    color: colors.brand.primary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  memberBody: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  memberMeta: {
    marginTop: spacing.xxs,
    color: colors.brand.muted,
    fontSize: fontSizes.xs,
  },
  memberActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  memberIconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.bg.surfaceSoft,
  },
  memberSelfText: {
    color: colors.brand.primary,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  headerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  segmentWrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.hairlineSoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
  headerTitleWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  headerTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  headerMetaText: {
    fontSize: fontSizes.xs,
    color: colors.brand.muted,
  },
  editButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedFade: { opacity: 0.7 },
  pressedSoft: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
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
  // 탭 네비게이션 (하단 인디케이터 스타일)
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
    paddingHorizontal: spacing.sm,
  },
  tabBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    // tabBar 하단 border 와 겹치지 않도록 1px 아래로 내림
    marginBottom: -1,
  },
  tabBtnActive: {
    borderBottomColor: colors.brand.primary,
  },
  tabText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.normal,
    color: colors.brand.muted,
  },
  tabTextActive: {
    color: colors.brand.primary,
    fontWeight: fontWeights.bold,
  },
  // 일정표 본문
  body: {
    paddingBottom: 112,
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
  inlinePrimaryButton: {
    minHeight: 48,
    marginHorizontal: spacing.lg,
    marginTop: spacing.base,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.brand.primary,
  },
  inlinePrimaryButtonText: {
    color: colors.bg.canvas,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  inlineSecondaryButton: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.canvas,
  },
  inlineSecondaryButtonText: {
    color: colors.brand.primary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  actionFlex: {
    flex: 1,
    marginHorizontal: 0,
    marginTop: 0,
  },
  planFab: {
    position: 'absolute',
    right: spacing.lg,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.brand.primary,
    shadowColor: colors.brand.primary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  planFabText: {
    color: colors.bg.canvas,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayBadge: {
    overflow: 'hidden',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    color: colors.bg.canvas,
    backgroundColor: colors.brand.primary,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  sectionHeader: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
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
    minHeight: 92,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    padding: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.bg.canvas,
    shadowColor: colors.bg.scrim,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  planCardVisited: {
    opacity: 0.65,
  },
  planThumbnail: {
    width: 68,
    height: 68,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: radii.sm,
    backgroundColor: colors.bg.surfaceSoft,
  },
  planThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  planThumbnailFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  planCardBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  planTitle: {
    flex: 1,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  planTitleVisited: {
    textDecorationLine: 'line-through',
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
  planMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  planMetaLocation: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  planMetaText: {
    color: colors.brand.muted,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
  },
  planCardFooter: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planCostInline: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  planCostInlineText: {
    flex: 1,
    color: colors.brand.primary,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  planInlineAction: {
    width: 26,
    height: 26,
    borderRadius: radii.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.canvas,
  },
  planHintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  infoChip: {
    minHeight: 26,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.bg.surfaceSoft,
  },
  infoChipText: {
    maxWidth: 120,
    color: colors.brand.muted,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
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
  emptyPanel: {
    margin: spacing.lg,
  },
  planDetailScreen: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  planDetailHero: {
    height: 260,
    overflow: 'hidden',
    backgroundColor: colors.bg.surfaceStrong,
  },
  planDetailHeroFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
  },
  planDetailScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
  },
  planDetailTopBar: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.base,
    right: spacing.base,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planDetailBackButton: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  planDetailBackText: {
    color: colors.bg.canvas,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  planDetailIconActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  planDetailIconButton: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  planDetailHeroText: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    bottom: spacing.lg,
    zIndex: 2,
    alignItems: 'flex-start',
  },
  planDetailPlaceBadge: {
    maxWidth: '78%',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.brand.primary,
  },
  planDetailPlaceBadgeText: {
    color: colors.bg.canvas,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  planDetailHeroTitle: {
    color: colors.bg.canvas,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: fontWeights.bold,
  },
  planDetailVisitPill: {
    marginTop: spacing.sm,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  planDetailVisitText: {
    color: colors.bg.canvas,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  planDetailTabs: {
    height: 54,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  planDetailTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  planDetailTabText: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  planDetailTabTextActive: {
    color: colors.brand.primary,
  },
  planDetailTabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 64,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: colors.brand.primary,
  },
  planDetailRefCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
  },
  planDetailRefCountText: {
    color: colors.bg.canvas,
    fontSize: 10,
    fontWeight: fontWeights.bold,
  },
  planDetailBody: {
    flex: 1,
  },
  planDetailBodyContent: {
    paddingBottom: spacing.xxl,
  },
  planDetailMapWrap: {
    height: 168,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.hairlineSoft,
    backgroundColor: colors.bg.surfaceSoft,
  },
  planDetailMap: {
    flex: 1,
  },
  planDetailMapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  planDetailMapFallbackText: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  planDetailMapButton: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.canvas,
  },
  planDetailMapButtonText: {
    color: colors.brand.primary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  planDetailInfoList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  planDetailMemo: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.base,
    borderRadius: radii.md,
    backgroundColor: colors.bg.surfaceSoft,
  },
  planDetailMemoTitle: {
    marginBottom: spacing.sm,
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  planDetailMemoText: {
    color: colors.brand.body,
    fontSize: fontSizes.md,
    lineHeight: 22,
  },
  planDetailRefs: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  planDetailRefsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  planDetailRefsHeaderText: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  ogCard: {
    overflow: 'hidden',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
    shadowColor: colors.bg.scrim,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  ogImage: {
    width: '100%',
    height: 154,
    backgroundColor: colors.bg.surfaceSoft,
  },
  ogBody: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  ogHostRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ogFavicon: {
    width: 14,
    height: 14,
    borderRadius: 2,
  },
  ogHost: {
    flex: 1,
    color: colors.brand.muted,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
  },
  ogTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    lineHeight: 21,
    fontWeight: fontWeights.bold,
  },
  ogDescription: {
    color: colors.brand.body,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  ogUrlRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ogUrl: {
    flex: 1,
    color: colors.brand.mutedSoft,
    fontSize: fontSizes.xs,
  },
  planDetailRefCard: {
    minHeight: 62,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.canvas,
  },
  planDetailRefIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  planDetailRefUrl: {
    flex: 1,
    color: colors.brand.body,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  sheetHero: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radii.lg,
    backgroundColor: colors.bg.surfaceSoft,
  },
  sheetHeroIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.canvas,
  },
  sheetHeroText: {
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
  },
  sheetSubtitle: {
    marginTop: spacing.xs,
    color: colors.brand.muted,
    fontSize: fontSizes.md,
    lineHeight: 21,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.base,
  },
  detailInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  detailInfoIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.canvas,
  },
  detailInfoBody: {
    flex: 1,
    paddingTop: 1,
  },
  detailInfoLabel: {
    color: colors.brand.muted,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
  },
  detailInfoValue: {
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  detailInfoSubValue: {
    marginTop: spacing.xxs,
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    lineHeight: 19,
  },
  detailBlock: {
    marginTop: spacing.base,
    gap: spacing.sm,
  },
  detailBlockTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  detailBlockText: {
    color: colors.brand.body,
    fontSize: fontSizes.md,
    lineHeight: 22,
  },
  urlRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bg.surfaceSoft,
  },
  urlText: {
    flex: 1,
    color: colors.brand.body,
    fontSize: fontSizes.sm,
  },
  sheetActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  sheetAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.canvas,
  },
  sheetActionText: {
    color: colors.brand.primary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  sheetActionDanger: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.canvas,
  },
  sheetActionDangerText: {
    color: colors.brand.error,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  placeStep: {
    gap: spacing.base,
  },
  placeHero: {
    alignItems: 'center',
    paddingVertical: spacing.base,
    gap: spacing.sm,
  },
  placeHeroIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  placeHeroTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.4,
  },
  placeHeroDesc: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    textAlign: 'center',
    lineHeight: 20,
  },
  placesContainer: {
    gap: spacing.sm,
  },
  placeSearchBox: {
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.surfaceSoft,
  },
  placeSearchInput: {
    flex: 1,
    minHeight: 52,
    color: colors.brand.ink,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
  },
  placesList: {
    overflow: 'hidden',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  placesRow: {
    minHeight: 56,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  placeResultBody: {
    flex: 1,
  },
  placeResultTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  placesDescription: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
  },
  manualPlaceButton: {
    minHeight: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.surfaceSoft,
  },
  manualPlaceText: {
    flexShrink: 1,
    color: colors.brand.primary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  placeQuickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  placeQuickButton: {
    width: '48%',
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairlineSoft,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.surfaceSoft,
  },
  placeQuickText: {
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  selectedPlaceCard: {
    marginBottom: spacing.base,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.canvas,
  },
  selectedPlaceIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  selectedPlaceBody: {
    flex: 1,
    gap: 3,
  },
  selectedPlaceTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  selectedPlaceAddress: {
    color: colors.brand.body,
    fontSize: fontSizes.sm,
    lineHeight: 19,
  },
  selectedPlaceMeta: {
    color: colors.brand.muted,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
  },
  selectedPlaceChange: {
    color: colors.brand.primary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  formField: {
    flex: 1,
    gap: spacing.xs,
    marginBottom: spacing.base,
  },
  formLabel: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  formInput: {
    minHeight: 52,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    paddingHorizontal: spacing.md,
    color: colors.brand.ink,
    fontSize: fontSizes.base,
    backgroundColor: colors.bg.canvas,
  },
  formInputMultiline: {
    minHeight: 92,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  formTwoColumn: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formError: {
    marginTop: spacing.xs,
    color: colors.brand.error,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  sheetSubmitButton: {
    minHeight: 50,
    marginTop: spacing.base,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
  },
  sheetSubmitText: {
    color: colors.bg.canvas,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
  },
  disabledButton: {
    opacity: 0.55,
  },
  sheetLoading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateList: {
    gap: spacing.sm,
  },
  templateApplyCard: {
    minHeight: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg.canvas,
  },
  templateApplyIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  templateApplyBody: {
    flex: 1,
    minWidth: 0,
  },
  templateApplyTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  templateApplyMeta: {
    marginTop: spacing.xxs,
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
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
  checklistActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
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
  readonlyRow: {
    opacity: 0.78,
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
  itemSource: {
    fontSize: fontSizes.xs,
    color: colors.brand.primary,
    fontWeight: fontWeights.semibold,
  },
  // 지도
  map: { flex: 1 },
})
