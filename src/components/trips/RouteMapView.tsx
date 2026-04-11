'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { css } from 'styled-system/css'
import { useLoadScript, GoogleMap, OverlayView } from '@react-google-maps/api'
import { WifiOff, MapPin, AlertCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useNetworkStore } from '@/stores/useNetworkStore'
import { collaboration } from '@/utils/collaboration'
import { getCurrencyFromTimezone } from '@/utils/currency'
import { ExchangeService } from '@/services/ExternalApiService'
import RouteMapInfoModal from '@/components/trips/RouteMapInfoModal'
import PlanDetailModal from '@/components/trips/PlanDetailModal'

const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places']

const MAP_STYLES: google.maps.MapTypeStyle[] = [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
]

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' }

interface Plan {
    id: string
    title: string
    location?: string
    address?: string
    start_datetime_local?: string
    end_datetime_local?: string
    memo?: string
    is_visited: boolean
    location_lat?: number
    location_lng?: number
    google_place_id?: string
    timezone_string?: string
}

interface RouteMapViewProps {
    tripStartDate: string
    tripEndDate: string
    isActive: boolean
}

function formatLocalTime(dateString: string): string {
    try {
        const localIso = dateString.replace(' ', 'T')
        const timePart = localIso.split('T')[1]
        if (!timePart) return ''
        const [h, m] = timePart.split(':')
        const hour = parseInt(h, 10)
        const ampm = hour < 12 ? '오전' : '오후'
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
        return `${ampm} ${String(displayHour).padStart(2, '0')}:${m}`
    } catch {
        return dateString
    }
}

function formatKstTime(dateString: string, localTimeZone: string): string {
    try {
        const localIso = dateString.replace(' ', 'T')
        const fakeUtc = new Date(localIso + 'Z')
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: localTimeZone,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        })
        const parts = fmt.formatToParts(fakeUtc)
        const get = (type: string) => parts.find(p => p.type === type)?.value?.padStart(2, '0') ?? '00'
        const inTzStr = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
        const fakeTzUtc = new Date(inTzStr + 'Z')
        const tzOffsetMs = fakeUtc.getTime() - fakeTzUtc.getTime()
        const actualUtc = new Date(fakeUtc.getTime() + tzOffsetMs)
        return new Intl.DateTimeFormat('ko-KR', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul'
        }).format(actualUtc)
    } catch {
        return ''
    }
}

function getDateLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    const month = d.getMonth() + 1
    const day = d.getDate()
    const weekDays = ['일', '월', '화', '수', '목', '금', '토']
    const weekDay = weekDays[d.getDay()]
    return `${month}/${day}(${weekDay})`
}

function generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = []
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    const current = new Date(start)
    while (current <= end) {
        const yyyy = current.getFullYear()
        const mm = String(current.getMonth() + 1).padStart(2, '0')
        const dd = String(current.getDate()).padStart(2, '0')
        dates.push(`${yyyy}-${mm}-${dd}`)
        current.setDate(current.getDate() + 1)
    }
    return dates
}

function getPlanDate(plan: Plan): string {
    if (!plan.start_datetime_local) return ''
    return plan.start_datetime_local.split('T')[0] || plan.start_datetime_local.split(' ')[0] || ''
}

export default function RouteMapView({
    tripStartDate,
    tripEndDate,
    isActive,
}: RouteMapViewProps) {
    const searchParams = useSearchParams()
    const tripId = searchParams.get('id')
    const supabase = createClient()
    const { isOnline } = useNetworkStore()

    const [plans, setPlans] = useState<Plan[]>([])
    const [userRole, setUserRole] = useState<'owner' | 'editor' | 'viewer' | null>(null)
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
    const [detailPlan, setDetailPlan] = useState<Plan | null>(null)
    const [selectedDate, setSelectedDate] = useState<string>('all')
    const [dataLoaded, setDataLoaded] = useState(false)
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})

    const mapRef = useRef<google.maps.Map | null>(null)
    const polylineRef = useRef<google.maps.Polyline | null>(null)
    const dateChipsRef = useRef<HTMLDivElement>(null)

    const { isLoaded } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
        libraries: GOOGLE_MAPS_LIBRARIES,
        language: 'ko',
    })

    // Fetch plans — tripId 변경 시 이전 데이터를 즉시 초기화 후 새 데이터 패칭
    // 단일 effect로 통합하여 cleanup과 fetch 사이의 race condition 방지
    useEffect(() => {
        // tripId가 변경되면 항상 기존 상태를 먼저 초기화
        setPlans([])
        setSelectedPlan(null)
        setSelectedDate('all')
        setDataLoaded(false)

        if (!isActive || !tripId || !isOnline) return
        let cancelled = false

        const fetchData = async () => {
            const [plansResult, roleResult] = await Promise.all([
                supabase
                    .from('plans')
                    .select('*')
                    .eq('trip_id', tripId)
                    .order('start_datetime_local', { ascending: true }),
                collaboration.getUserRole(tripId),
            ])

            if (cancelled) return

            if (plansResult.data) {
                setPlans(plansResult.data.map((p: any) => ({ ...p, is_visited: p.is_visited ?? false })) as Plan[])
            }
            if (roleResult.data) {
                setUserRole(roleResult.data as 'owner' | 'editor' | 'viewer')
            }
            setDataLoaded(true)
        }

        fetchData()
        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive, tripId, isOnline])

    // Fetch exchange rates for detail modal
    useEffect(() => {
        if (plans.length === 0) return
        const uniqueTimezones = Array.from(new Set(plans.map(p => p.timezone_string || 'Asia/Seoul')))
        uniqueTimezones.forEach(async (tz) => {
            const currency = getCurrencyFromTimezone(tz)
            if (currency.code !== 'KRW' && !exchangeRates[currency.code]) {
                try {
                    const data = await ExchangeService.getExchangeRate(currency.code)
                    if (data?.rate) {
                        setExchangeRates(prev => ({ ...prev, [currency.code]: data.rate }))
                    }
                } catch { /* ignore */ }
            }
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plans])

    // Date filter chips
    const dateChips = useMemo(() => {
        const dates = generateDateRange(tripStartDate, tripEndDate)
        return [
            { value: 'all', label: '전체' },
            ...dates.map((d, i) => ({
                value: d,
                label: `${i + 1}일차 ${getDateLabel(d)}`,
            })),
        ]
    }, [tripStartDate, tripEndDate])

    // Filter plans with valid coordinates
    const validPlans = useMemo(() => {
        return plans.filter(
            (p) =>
                p.location_lat != null &&
                p.location_lng != null &&
                (p.location_lat !== 0 || p.location_lng !== 0)
        )
    }, [plans])

    // Apply date filter
    const filteredPlans = useMemo(() => {
        if (selectedDate === 'all') return validPlans
        return validPlans.filter((p) => getPlanDate(p) === selectedDate)
    }, [validPlans, selectedDate])

    // Count of plans without coordinates
    const noLocationCount = useMemo(() => {
        return plans.filter(
            (p) =>
                p.location_lat == null ||
                p.location_lng == null ||
                (p.location_lat === 0 && p.location_lng === 0)
        ).length
    }, [plans])

    // Polyline path
    const polylinePath = useMemo(() => {
        return filteredPlans
            .filter((p) => p.location_lat && p.location_lng)
            .map((p) => ({
                lat: Number(p.location_lat),
                lng: Number(p.location_lng),
            }))
    }, [filteredPlans])

    // Fit bounds when map + filtered plans change
    const fitBoundsToMarkers = useCallback(() => {
        if (!mapRef.current || filteredPlans.length === 0) return
        const bounds = new google.maps.LatLngBounds()
        filteredPlans.forEach((p) => {
            if (p.location_lat && p.location_lng) {
                bounds.extend({ lat: Number(p.location_lat), lng: Number(p.location_lng) })
            }
        })
        mapRef.current.fitBounds(bounds, { top: 60, right: 40, bottom: 80, left: 40 })
    }, [filteredPlans])

    useEffect(() => {
        fitBoundsToMarkers()
    }, [fitBoundsToMarkers])

    // Polyline 직접 관리 — @react-google-maps/api의 <Polyline>은 언마운트 시 정리가 불안정하여
    // Google Maps API를 직접 사용하여 확실한 cleanup을 보장
    useEffect(() => {
        // 이전 polyline 확실히 제거
        if (polylineRef.current) {
            polylineRef.current.setMap(null)
            polylineRef.current = null
        }

        if (!mapRef.current || polylinePath.length < 2) return

        polylineRef.current = new google.maps.Polyline({
            path: polylinePath,
            map: mapRef.current,
            strokeColor: '#1D4ED8',
            strokeOpacity: 0.8,
            strokeWeight: 4,
        })

        return () => {
            if (polylineRef.current) {
                polylineRef.current.setMap(null)
                polylineRef.current = null
            }
        }
    }, [polylinePath])

    const onMapLoad = useCallback(
        (map: google.maps.Map) => {
            mapRef.current = map
            fitBoundsToMarkers()
        },
        [fitBoundsToMarkers]
    )

    const handleToggleVisit = useCallback(
        async (planId: string, isVisited: boolean) => {
            // Optimistic update
            setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, is_visited: isVisited } : p)))
            setSelectedPlan((prev) => (prev && prev.id === planId ? { ...prev, is_visited: isVisited } : prev))

            const { error } = await supabase.from('plans').update({ is_visited: isVisited }).eq('id', planId)
            if (error) {
                // Rollback
                setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, is_visited: !isVisited } : p)))
                setSelectedPlan((prev) => (prev && prev.id === planId ? { ...prev, is_visited: !isVisited } : prev))
            }
        },
        [supabase]
    )

    const handleDetail = useCallback(
        (plan: Plan) => {
            setSelectedPlan(null)
            // RouteMapInfoModal의 useModalBackButton cleanup이 10ms 후 history.back()을 호출하므로,
            // 그 이후에 PlanDetailModal을 마운트해야 popstate 충돌을 방지할 수 있음
            setTimeout(() => setDetailPlan(plan), 60)
        },
        []
    )

    const handleDeletePlan = useCallback(
        async (planId: string) => {
            if (!confirm('이 일정을 삭제하시겠습니까?')) return
            const { error } = await supabase.from('plans').delete().eq('id', planId)
            if (!error) {
                setPlans(prev => prev.filter(p => p.id !== planId))
                setDetailPlan(null)
            }
        },
        [supabase]
    )

    // Offline fallback
    if (!isOnline) {
        return (
            <div
                className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: '80px',
                    gap: '16px',
                    color: 'brand.muted',
                })}
            >
                <WifiOff size={48} strokeWidth={1.5} />
                <p className={css({ fontSize: '16px', fontWeight: '700', color: 'brand.secondary' })}>
                    인터넷 연결 필요
                </p>
                <p className={css({ fontSize: '14px', textAlign: 'center', lineHeight: '1.6' })}>
                    지도를 보려면 인터넷 연결이 필요합니다.
                </p>
            </div>
        )
    }

    if (!isLoaded) {
        return (
            <div
                className={css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: '80px',
                    color: 'brand.muted',
                    fontSize: '14px',
                })}
            >
                지도를 불러오는 중...
            </div>
        )
    }

    const defaultCenter = { lat: 37.5665, lng: 126.978 } // Seoul fallback

    return (
        <div className={css({ position: 'relative', bg: 'white' })}>
            {/* Date filter chips */}
            <div
                ref={dateChipsRef}
                className={css({
                    display: 'flex',
                    gap: '8px',
                    px: '16px',
                    py: '12px',
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                })}
            >
                {dateChips.map((chip) => (
                    <button
                        key={chip.value}
                        onClick={() => setSelectedDate(chip.value)}
                        className={css({
                            flexShrink: 0,
                            px: '14px',
                            h: '36px',
                            borderRadius: '18px',
                            fontSize: '13px',
                            fontWeight: '700',
                            border: '1px solid',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                            bg: selectedDate === chip.value ? 'brand.primary' : 'white',
                            color: selectedDate === chip.value ? 'white' : 'brand.secondary',
                            borderColor: selectedDate === chip.value ? 'brand.primary' : 'brand.border',
                            _active: { transform: 'scale(0.95)' },
                        })}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {/* Map container */}
            <div
                className={css({
                    position: 'relative',
                    h: { base: 'calc(100dvh - 260px)', sm: 'calc(100vh - 300px)' },
                    minH: '400px',
                })}
            >
                <GoogleMap
                    mapContainerStyle={MAP_CONTAINER_STYLE}
                    center={filteredPlans.length > 0 ? undefined : defaultCenter}
                    zoom={filteredPlans.length > 0 ? undefined : 12}
                    onLoad={onMapLoad}
                    options={{
                        disableDefaultUI: true,
                        zoomControl: true,
                        gestureHandling: 'greedy',
                        styles: MAP_STYLES,
                    }}
                >
                    {/* Custom numbered markers via OverlayView */}
                    {filteredPlans.map((plan, index) => {
                        if (!plan.location_lat || !plan.location_lng) return null
                        const position = {
                            lat: Number(plan.location_lat),
                            lng: Number(plan.location_lng),
                        }
                        return (
                            <OverlayView
                                key={plan.id}
                                position={position}
                                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                                getPixelPositionOffset={() => ({ x: -16, y: -40 })}
                            >
                                <div
                                    onClick={() => setSelectedPlan(plan)}
                                    className={css({
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        transition: 'transform 0.15s',
                                        _hover: { transform: 'scale(1.1)' },
                                    })}
                                >
                                    {/* Marker circle */}
                                    <div
                                        className={css({
                                            w: '32px',
                                            h: '32px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontSize: '13px',
                                            fontWeight: '800',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                                            border: '2px solid white',
                                            bg: plan.is_visited ? 'brand.muted' : 'brand.primary',
                                        })}
                                    >
                                        {index + 1}
                                    </div>
                                    {/* Tail triangle */}
                                    <div
                                        className={css({
                                            w: '0',
                                            h: '0',
                                            borderLeft: '6px solid transparent',
                                            borderRight: '6px solid transparent',
                                            borderTop: plan.is_visited ? '8px solid token(colors.brand.muted)' : '8px solid token(colors.brand.primary)',
                                            mt: '-1px',
                                        })}
                                    />
                                </div>
                            </OverlayView>
                        )
                    })}

                    {/* Polyline은 useEffect에서 직접 Google Maps API로 관리 (cleanup 안정성) */}
                </GoogleMap>

                {/* Info modal when marker is selected */}
                {selectedPlan && (
                    <RouteMapInfoModal
                        plan={selectedPlan}
                        onClose={() => setSelectedPlan(null)}
                        onToggleVisit={handleToggleVisit}
                        onDetail={handleDetail}
                        userRole={userRole}
                    />
                )}
            </div>

            {/* Plan detail modal — 지도 탭에서 직접 렌더링 */}
            {detailPlan && (
                <PlanDetailModal
                    plan={detailPlan}
                    exchangeRates={exchangeRates}
                    formatLocalTime={formatLocalTime}
                    formatKstTime={formatKstTime}
                    timeDisplayMode="both"
                    userRole={userRole}
                    onClose={() => setDetailPlan(null)}
                    onEdit={() => { /* 편집은 일정표 탭의 NewPlanModal 필요 — 모달 닫기만 */ setDetailPlan(null) }}
                    onDelete={handleDeletePlan}
                    onToggleVisit={handleToggleVisit}
                />
            )}

            {/* No location info notice */}
            {noLocationCount > 0 && dataLoaded && (
                <div
                    className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        px: '16px',
                        py: '10px',
                        bg: 'bg.softCotton',
                        borderTop: '1px solid',
                        borderColor: 'brand.border',
                    })}
                >
                    <AlertCircle size={16} className={css({ color: 'brand.muted', flexShrink: 0 })} />
                    <p className={css({ fontSize: '13px', color: 'brand.muted' })}>
                        위치 정보 없는 일정 {noLocationCount}개가 지도에 표시되지 않았습니다.
                    </p>
                </div>
            )}

            {/* Empty state */}
            {dataLoaded && validPlans.length === 0 && plans.length > 0 && (
                <div
                    className={css({
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        py: '40px',
                        gap: '12px',
                    })}
                >
                    <MapPin size={32} className={css({ color: 'brand.muted' })} />
                    <p className={css({ fontSize: '14px', color: 'brand.muted', textAlign: 'center', lineHeight: '1.6' })}>
                        위치 정보가 있는 일정이 없습니다.
                        <br />
                        일정 추가 시 장소를 검색하면 지도에 표시됩니다.
                    </p>
                </div>
            )}

            {dataLoaded && plans.length === 0 && (
                <div
                    className={css({
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        py: '40px',
                        gap: '12px',
                    })}
                >
                    <MapPin size={32} className={css({ color: 'brand.muted' })} />
                    <p className={css({ fontSize: '14px', color: 'brand.muted', textAlign: 'center', lineHeight: '1.6' })}>
                        등록된 일정이 없습니다.
                        <br />
                        일정을 추가하면 동선을 지도에서 확인할 수 있습니다.
                    </p>
                </div>
            )}
        </div>
    )
}
