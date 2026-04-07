'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Plus, UserPlus, Share2, ChevronDown, Check, Clock } from 'lucide-react'
import NewPlanModal from '@/components/trips/NewPlanModal'
import CollaboratorModal from '@/components/trips/CollaboratorModal'
import ShareModal from '@/components/trips/ShareModal'
import PlanDetailModal from '@/components/trips/PlanDetailModal'
import { collaboration } from '@/utils/collaboration'
import PlanList from '@/components/trips/PlanList'
import { useNetworkStore } from '@/stores/useNetworkStore'
import { getCurrencyFromTimezone } from '@/utils/currency'
import { ExchangeService } from '@/services/ExternalApiService'
import { CacheUtil } from '@/utils/cache'
import { NotificationService } from '@/services/NotificationService'
import TripDetailSkeleton from './TripDetailSkeleton'
const CustomTimeDropdown = ({ timeDisplayMode, setTimeDisplayMode }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = [
        { value: 'local', label: '현지 시간' },
        { value: 'kst', label: '한국 시간' },
        { value: 'both', label: '동시 표기' }
    ];
    const currentLabel = options.find(o => o.value === timeDisplayMode)?.label || '현지 시간';

    return (
        <div className={css({ position: 'relative' })}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={css({
                    display: 'flex', alignItems: 'center', gap: '4px',
                    bg: 'white', border: '1px solid', borderColor: 'brand.border', borderRadius: '12px',
                    px: '12px', h: '42px', fontSize: '13px', fontWeight: '700', color: 'brand.secondary', cursor: 'pointer',
                    transition: 'all 0.2s', _active: { transform: 'scale(0.95)' },
                    _hover: { borderColor: 'brand.primary', bg: 'bg.softCotton' }
                })}
            >
                <Clock size={14} className={css({ color: 'brand.primary' })} />
                <span className={css({ whiteSpace: 'nowrap' })}>{currentLabel}</span>
                <ChevronDown size={14} className={css({ color: 'brand.muted', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' })} />
            </button>
            {isOpen && (
                <>
                    <div className={css({ position: 'fixed', inset: 0, zIndex: 10 })} onClick={() => setIsOpen(false)} />
                    <div className={css({
                        position: 'absolute', top: '100%', left: 0, mt: '4px',
                        bg: 'white', border: '1px solid', borderColor: 'brand.border', borderRadius: '12px',
                        boxShadow: 'floating', zIndex: 11, minW: '120px',
                        overflow: 'hidden'
                    })}>
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { setTimeDisplayMode(opt.value); setIsOpen(false); }}
                                className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', w: '100%', textAlign: 'left', px: '14px', py: '12px', fontSize: '13px',
                                    bg: timeDisplayMode === opt.value ? 'bg.softCotton' : 'transparent',
                                    color: timeDisplayMode === opt.value ? 'brand.primary' : 'brand.secondary',
                                    fontWeight: timeDisplayMode === opt.value ? '800' : '600',
                                    border: 'none', cursor: 'pointer', _hover: { bg: 'bg.softCotton', color: 'brand.primary' },
                                    transition: 'all 0.2s'
                                })}
                            >
                                {opt.label}
                                {timeDisplayMode === opt.value && <Check size={14} strokeWidth={3} />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export default function TripPlansPage({ isActive = true }: { isActive?: boolean }) {
    const searchParams = useSearchParams()
    const tripId = searchParams.get('id')

    // Supabase client instance (stable across renders if used carefully, but better kept inside useCallback or useMemo if it's deeply depending on renders, though createClient maps to same client mostly)
    const supabase = createClient()
    const [plans, setPlans] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [trip, setTrip] = useState<any>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false)
    const [isShareModalOpen, setIsShareModalOpen] = useState(false)
    const [timeDisplayMode, setTimeDisplayMode] = useState<'local' | 'kst' | 'both'>('local')
    const [userRole, setUserRole] = useState<'owner' | 'editor' | 'viewer' | null>(null)
    const { isOnline } = useNetworkStore()

    const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
    const [editingPlan, setEditingPlan] = useState<any>(null)
    const [selectedPlanForDetail, setSelectedPlanForDetail] = useState<any>(null)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})

    // Fetch exchange rates when plans change
    useEffect(() => {
        if (plans && plans.length > 0) {
            const uniqueTimezones = Array.from(new Set(plans.map((p: any) => p.timezone_string || 'Asia/Seoul')))
            uniqueTimezones.forEach(async (tz) => {
                const currency = getCurrencyFromTimezone(tz)
                if (currency.code !== 'KRW' && !exchangeRates[currency.code]) {
                    try {
                        const data = await ExchangeService.getExchangeRate(currency.code)
                        if (data && data.rate) {
                            setExchangeRates(prev => ({ ...prev, [currency.code]: data.rate }))
                        }
                    } catch (e) {
                        console.error('Failed to pre-fetch rate:', e)
                    }
                }
            })
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plans])

    // 현지 시간 문자열을 'Z' 없이 그대로 표시 (타임존 오해석 없음)
    const formatLocalTime = (dateString: string): string => {
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

    // 현지 시간 + 현지 타임존 → KST 시간으로 정확하게 변환
    // 방법: "가짜 UTC" 기법 - 타임존 오프셋을 Intl로 역산하여 실제 UTC를 구한 뒤 KST로 변환
    const formatKstTime = (dateString: string, localTimeZone: string): string => {
        try {
            const localIso = dateString.replace(' ', 'T')

            // Step 1: 현지 시간 문자열을 "잘못된 UTC"로 파싱 (07:10 Seoul → 07:10 UTC로 잘못 읽음)
            const fakeUtc = new Date(localIso + 'Z')

            // Step 2: 이 가짜 UTC를 현지 타임존으로 표시 (Asia/Seoul이면 16:10이 나옴)
            const fmt = new Intl.DateTimeFormat('en-US', {
                timeZone: localTimeZone,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            })
            const parts = fmt.formatToParts(fakeUtc)
            const get = (type: string) => parts.find(p => p.type === type)?.value?.padStart(2, '0') ?? '00'
            const inTzStr = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`

            // Step 3: 위 결과를 다시 "잘못된 UTC"로 파싱 (16:10 → 16:10 UTC)
            const fakeTzUtc = new Date(inTzStr + 'Z')

            // Step 4: 두 "잘못된" 값의 차이 = 실제 타임존 오프셋
            // (07:10 UTC) - (16:10 UTC) = -9h → Seoul이 UTC보다 9시간 빠름
            const tzOffsetMs = fakeUtc.getTime() - fakeTzUtc.getTime()

            // Step 5: 가짜 UTC에 오프셋을 더하면 실제 UTC
            // 07:10 (가짜UTC) + (-9h) = 22:10 UTC (전날) → KST로 표시하면 07:10 ✅
            const actualUtc = new Date(fakeUtc.getTime() + tzOffsetMs)

            return new Intl.DateTimeFormat('ko-KR', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul'
            }).format(actualUtc)
        } catch {
            return ''
        }
    }

    const fetchTrip = useCallback(async () => {
        if (!tripId) return
        const { data } = await supabase.from('trips').select('*').eq('id', tripId).single()
        if (data) setTrip(data)
    }, [tripId, supabase])

    const fetchPlans = useCallback(async () => {
        if (!tripId) return

        try {
            // 1. Load from cache first
            const cachedPlans = await CacheUtil.get<any[]>(`offline_plans_${tripId}`)
            if (cachedPlans) {
                setPlans(cachedPlans)
                setIsLoading(false)
            }

            // 2. Network check
            if (!isOnline) {
                setIsLoading(false)
                return
            }

            const { data, error } = await supabase
                .from('plans')
                .select('*, plan_urls(*)')
                .eq('trip_id', tripId)
                .order('start_datetime_local', { ascending: true })

            if (data && !error) {
                setPlans(data)
                await CacheUtil.set(`offline_plans_${tripId}`, data)
                NotificationService.scheduleOfflineReminders(data)
            } else {
                throw new Error("Failed to fetch")
            }
        } catch (err) {
            console.error('fetchPlans Error:', err)
        } finally {
            setIsLoading(false)
        }
    }, [tripId, supabase, isOnline])

    const fetchUserRole = useCallback(async () => {
        if (!tripId) return
        const { data } = await collaboration.getUserRole(tripId)
        setUserRole(data as any)
    }, [tripId])

    useEffect(() => {
        if (isActive) {
            fetchTrip()
            fetchPlans()
            fetchUserRole()
        }
    }, [isActive, fetchTrip, fetchPlans, fetchUserRole])

    // 드롭다운 외부 클릭 감지를 위한 이벤트 리스너 (심플 버전으로 대체)

    const handleDeletePlan = async (planId: string) => {
        if (!confirm('이 일정을 삭제하시겠습니까? (연결된 정보도 함께 삭제됩니다)')) return

        const { error } = await supabase.from('plans').delete().eq('id', planId)
        if (error) {
            alert('삭제에 실패했습니다.')
        } else {
            setActiveDropdown(null)
            fetchPlans() // 목록 리프레시
        }
    }

    const handleEditPlan = async (plan: any) => {
        // 편집을 위해, 해당 Plan에 연결된 url들도 같이 가져옵니다
        const { data: urlsData } = await supabase.from('plan_urls').select('url').eq('plan_id', plan.id)

        setEditingPlan({
            ...plan,
            plan_urls: urlsData || []
        })
        setActiveDropdown(null)
        setIsModalOpen(true) // Edit 모드로 모달 열기
    }

    const handleModalClose = () => {
        setIsModalOpen(false)
        setEditingPlan(null)
    }

    const handleModalSuccess = () => {
        fetchPlans()
    }

    const handlePlanDetail = (plan: any) => {
        setSelectedPlanForDetail(plan)
        setIsDetailModalOpen(true)
    }

    // 24시간 이내 가장 가까운 일정 계산
    const nextPlanInfo = useMemo(() => {
        const now = new Date()
        const upcoming = plans
            .map(p => ({ ...p, startTime: new Date(p.start_datetime_local) }))
            .filter(p => p.startTime > now)
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

        if (upcoming.length > 0) {
            const diffMs = upcoming[0].startTime.getTime() - now.getTime()
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
            const diffMinutes = Math.floor(diffMs / (1000 * 60))

            if (diffHours < 24) {
                if (diffHours >= 1) return `다음 일정까지 ${diffHours}시간 전`
                return `다음 일정까지 ${diffMinutes}분 전`
            }
        }
        return null
    }, [plans])

    return (
        <div className={css({ bg: 'white', p: { base: '12px', sm: '24px' }, pb: { base: '80px', sm: '24px' }, borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' })}>
            <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: { base: 'center', sm: 'flex-start' }, mb: { base: '16px', sm: '24px' }, flexDirection: { base: 'column', sm: 'row' }, gap: '16px' })}>
                {/* 1. 요약 정보 영역 (PC/모바일 공통) */}
                <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                    <h2 className={css({ fontSize: { base: '18px', sm: '20px' }, fontWeight: 'bold', color: 'brand.secondary' })}>
                        {nextPlanInfo ? (
                            <>
                                <span className={css({ color: 'brand.error' })}>●</span> {nextPlanInfo}
                            </>
                        ) : (
                            <>
                                전체 일정 <span className={css({ color: 'brand.muted', fontWeight: 'normal', ml: '4px' })}>{plans.length}개</span>
                            </>
                        )}
                    </h2>
                </div>

                {/* 2. 컨트롤 영역 (PC 시간 토글 & 모바일 액션 버튼 그룹) */}
                <div className={css({ 
                    display: 'flex', flexDirection: { base: 'column', sm: 'row' }, alignItems: { base: 'flex-start', sm: 'center' },
                    gap: '12px', w: { base: '100%', sm: 'auto' } 
                })}>
                    {/* PC 전용 시간 표시 옵션 토글 */}
                    <div className={css({ display: { base: 'none', sm: 'inline-flex' }, bg: 'bg.softCotton', p: '4px', borderRadius: '16px', gap: '4px', w: 'auto', h: '46px', alignItems: 'center' })}>
                        <button
                            onClick={() => setTimeDisplayMode('local')}
                            className={css({ h: '38px', px: '16px', fontSize: '13px', fontWeight: timeDisplayMode === 'local' ? '800' : '600', bg: timeDisplayMode === 'local' ? 'white' : 'transparent', borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: timeDisplayMode === 'local' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', color: timeDisplayMode === 'local' ? 'brand.primary' : 'brand.secondary', whiteSpace: 'nowrap', transition: 'all 0.2s' })}
                        >
                            현지 시간
                        </button>
                        <button
                            onClick={() => setTimeDisplayMode('kst')}
                            className={css({ h: '38px', px: '16px', fontSize: '13px', fontWeight: timeDisplayMode === 'kst' ? '800' : '600', bg: timeDisplayMode === 'kst' ? 'white' : 'transparent', borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: timeDisplayMode === 'kst' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', color: timeDisplayMode === 'kst' ? 'brand.primary' : 'brand.secondary', whiteSpace: 'nowrap', transition: 'all 0.2s' })}
                        >
                            한국 시간
                        </button>
                        <button
                            onClick={() => setTimeDisplayMode('both')}
                            className={css({ h: '38px', px: '16px', fontSize: '13px', fontWeight: timeDisplayMode === 'both' ? '800' : '600', bg: timeDisplayMode === 'both' ? 'white' : 'transparent', borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: timeDisplayMode === 'both' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', color: timeDisplayMode === 'both' ? 'brand.primary' : 'brand.secondary', whiteSpace: 'nowrap', transition: 'all 0.2s' })}
                        >
                            동시 표기
                        </button>
                    </div>

                    <div className={css({ 
                        display: 'flex', gap: '8px', w: '100%', alignItems: 'center'
                    })}>
                        {/* 모바일 전용 시간 드롭다운 (고정 너비) */}
                        <div className={css({ display: { base: 'block', sm: 'none' }, flexShrink: 0, w: '115px' })}>
                            <CustomTimeDropdown timeDisplayMode={timeDisplayMode} setTimeDisplayMode={setTimeDisplayMode} />
                        </div>

                        <button
                            onClick={() => setIsCollaboratorModalOpen(true)}
                             className={css({
                                 display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                 bg: 'white', color: 'brand.secondary',
                                 px: '12px', h: '42px',
                                 borderRadius: '16px', fontWeight: '700', fontSize: '13px',
                                 border: '1px solid', borderColor: 'brand.border', whiteSpace: 'nowrap',
                                 transition: 'all 0.2s',
                                 _hover: { bg: 'bg.softCotton', borderColor: 'brand.primary' }, _active: { transform: 'scale(0.92)' },
                                 opacity: !isOnline ? 0.5 : 1, cursor: !isOnline ? 'not-allowed' : 'pointer',
                                 flex: 1
                             })}
                            disabled={!isOnline}
                        >
                            <UserPlus size={16} /> <span>동행자</span>
                        </button>
                        {userRole === 'owner' && (
                            <button
                                onClick={() => setIsShareModalOpen(true)}
                                 className={css({
                                     display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                     bg: 'white', color: 'brand.secondary',
                                     px: '12px', h: '42px',
                                     borderRadius: '16px', fontWeight: '700', fontSize: '13px',
                                     border: '1px solid', borderColor: 'brand.border', whiteSpace: 'nowrap',
                                     transition: 'all 0.2s',
                                     _hover: { bg: 'bg.softCotton', borderColor: 'brand.primary' }, _active: { transform: 'scale(0.92)' },
                                     opacity: !isOnline ? 0.5 : 1, cursor: !isOnline ? 'not-allowed' : 'pointer',
                                     flex: 1
                                 })}
                                disabled={!isOnline}
                            >
                                <Share2 size={16} /> <span>공유</span>
                            </button>
                        )}

                    </div>
                    
                    {/* PC 전용 일정 추가 버튼 */}
                    {(userRole === 'owner' || userRole === 'editor') && isOnline && (
                        <button
                            onClick={() => { setEditingPlan(null); setIsModalOpen(true) }}
                             className={css({
                                 display: { base: 'none', sm: 'flex' },
                                 w: '100%', h: '42px',
                                 alignItems: 'center', justifyContent: 'center', gap: '6px',
                                 bg: 'brand.primary', color: 'white', px: '16px', borderRadius: '16px',
                                 fontWeight: '700', fontSize: '15px', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
                                 transition: 'all 0.2s',
                                 _hover: { bg: 'brand.primaryDark', boxShadow: '0 4px 12px rgba(46,196,182,0.2)' }, _active: { transform: 'scale(0.96)' }
                             })}
                        >
                            <Plus size={18} /> 일정 추가
                        </button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <TripDetailSkeleton />
            ) : (!plans || plans.length === 0) ? (
                <div className={css({ textAlign: 'center', py: '80px', color: 'brand.muted' })}>
                    <p className={css({ fontSize: '18px', fontWeight: '700', mb: '12px', color: 'brand.secondary' })}>아직 등록된 여정이 없어요. 🗺️</p>
                    {(userRole === 'owner' || userRole === 'editor') && isOnline && (
                        <p className={css({ fontSize: '15px', color: 'brand.muted', lineHeight: '1.6' })}>새로운 일정을 추가해서 설레는 여정을 완성해 볼까요?</p>
                    )}
                </div>
            ) : (
                <PlanList
                    plans={plans}
                    exchangeRates={exchangeRates}
                    activeDropdown={activeDropdown}
                    setActiveDropdown={setActiveDropdown}
                    userRole={userRole}
                    timeDisplayMode={timeDisplayMode}
                    formatLocalTime={formatLocalTime}
                    formatKstTime={formatKstTime}
                    onEdit={handleEditPlan}
                    onDelete={handleDeletePlan}
                    onDetail={handlePlanDetail}
                />
            )}

            {isDetailModalOpen && selectedPlanForDetail && (
                <PlanDetailModal
                    plan={selectedPlanForDetail}
                    exchangeRates={exchangeRates}
                    formatLocalTime={formatLocalTime}
                    formatKstTime={formatKstTime}
                    timeDisplayMode={timeDisplayMode}
                    userRole={userRole}
                    onClose={() => setIsDetailModalOpen(false)}
                    onEdit={handleEditPlan}
                    onDelete={handleDeletePlan}
                />
            )}

            {tripId && (
                <NewPlanModal
                    tripId={tripId}
                    isOpen={isModalOpen}
                    onClose={handleModalClose}
                    onSuccess={handleModalSuccess}
                    editData={editingPlan}
                    tripStartDate={trip?.start_date}
                    tripEndDate={trip?.end_date}
                />
            )}
            {tripId && (
                <CollaboratorModal
                    tripId={tripId}
                    isOpen={isCollaboratorModalOpen}
                    onClose={() => setIsCollaboratorModalOpen(false)}
                    tripTitle={trip?.destination || '여행'}
                    ownerId={trip?.user_id}
                />
            )}
            {tripId && (
                <ShareModal
                    tripId={tripId}
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                    tripTitle={trip?.destination || '여행'}
                />
            )}
            {/* 모바일 전용 Sticky CTA (편집 권한 있을 때만) */}
            {(userRole === 'owner' || userRole === 'editor') && isActive && !isModalOpen && isOnline && (
                <button
                    onClick={() => { setEditingPlan(null); setIsModalOpen(true) }}
                    className={css({
                        position: 'fixed',
                        bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))', 
                        right: '24px',
                        w: '54px',
                        h: '54px',
                        bg: 'brand.primary',
                        color: 'white',
                        borderRadius: '18px',
                        display: { base: 'flex', sm: 'none' },
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 32px rgba(46,196,182,0.3)',
                        zIndex: 40,
                        transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
                        _hover: { bg: 'brand.primaryDark', transform: 'translateY(-2px)' },
                        _active: { transform: 'scale(0.9)' }
                    })}
                    aria-label="일정 추가"
                >
                    <Plus size={28} strokeWidth={3} />
                </button>
            )}
        </div>
    )
}
