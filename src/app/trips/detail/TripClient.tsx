'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Plus, UserPlus, Share2, ChevronDown, Check } from 'lucide-react'
import NewPlanModal from '@/components/trips/NewPlanModal'
import CollaboratorModal from '@/components/trips/CollaboratorModal'
import ShareModal from '@/components/trips/ShareModal'
import { collaboration } from '@/utils/collaboration'
import PlanList from '@/components/trips/PlanList'
import { useNetworkStore } from '@/stores/useNetworkStore'
import { Preferences } from '@capacitor/preferences'
import { NotificationService } from '@/services/NotificationService'
const CustomTimeDropdown = ({ timeDisplayMode, setTimeDisplayMode }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = [
        { value: 'local', label: '현지 시간' },
        { value: 'kst', label: '한국 시간' },
        { value: 'both', label: '동시 표기' }
    ];
    const currentLabel = options.find(o => o.value === timeDisplayMode)?.label || '현지 시간';

    return (
        <div className={css({ position: 'relative', display: { base: 'block', sm: 'none' } })}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={css({
                    display: 'flex', alignItems: 'center', gap: '4px',
                    bg: 'white', border: '1px solid #10B981', borderRadius: '16px',
                    px: '12px', py: '6px', fontSize: '12px', fontWeight: '700', color: '#10B981', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)'
                })}
            >
                {currentLabel}
                <ChevronDown size={14} />
            </button>
            {isOpen && (
                <>
                    <div className={css({ position: 'fixed', inset: 0, zIndex: 10 })} onClick={() => setIsOpen(false)} />
                    <div className={css({
                        position: 'absolute', top: '100%', right: 0, mt: '4px',
                        bg: 'white', border: '1px solid #eee', borderRadius: '12px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 11, minW: '110px',
                        overflow: 'hidden'
                    })}>
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { setTimeDisplayMode(opt.value); setIsOpen(false); }}
                                className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', w: '100%', textAlign: 'left', px: '14px', py: '10px', fontSize: '13px',
                                    bg: timeDisplayMode === opt.value ? '#ECFDF5' : 'transparent',
                                    color: timeDisplayMode === opt.value ? '#10B981' : '#555',
                                    fontWeight: timeDisplayMode === opt.value ? '700' : '500',
                                    border: 'none', cursor: 'pointer', _hover: { bg: '#f9f9f9' }
                                })}
                            >
                                {opt.label}
                                {timeDisplayMode === opt.value && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export default function TripPlansPage() {
    const searchParams = useSearchParams()
    const tripId = searchParams.get('id')

    // Supabase client instance (stable across renders if used carefully, but better kept inside useCallback or useMemo if it's deeply depending on renders, though createClient maps to same client mostly)
    const supabase = createClient()
    const [plans, setPlans] = useState<any[]>([])
    const [trip, setTrip] = useState<any>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false)
    const [isShareModalOpen, setIsShareModalOpen] = useState(false)
    const [timeDisplayMode, setTimeDisplayMode] = useState<'local' | 'kst' | 'both'>('local')
    const [userRole, setUserRole] = useState<'owner' | 'editor' | 'viewer' | null>(null)
    const { isOnline } = useNetworkStore()

    const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
    const [editingPlan, setEditingPlan] = useState<any>(null)

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
            const { data, error } = await supabase
                .from('plans')
                .select('*, plan_urls(*)')
                .eq('trip_id', tripId)
                .order('start_datetime_local', { ascending: true })

            if (data && !error) {
                setPlans(data)
                // 성공적으로 받아왔다면 캐싱 및 알림 스케줄러 동기화
                await Preferences.set({ key: `offline_plans_${tripId}`, value: JSON.stringify(data) })
                NotificationService.scheduleOfflineReminders(data)
            } else {
                throw new Error("Failed to fetch")
            }
        } catch {
            // 오프라인이거나 에러 시 로컬 캐시에서 불러오기
            const { value } = await Preferences.get({ key: `offline_plans_${tripId}` })
            if (value) {
                setPlans(JSON.parse(value))
            }
        }
    }, [tripId, supabase])

    const fetchUserRole = useCallback(async () => {
        if (!tripId) return
        const { data } = await collaboration.getUserRole(tripId)
        setUserRole(data as any)
    }, [tripId])

    useEffect(() => {
        fetchTrip()
        fetchPlans()
        fetchUserRole()
    }, [fetchTrip, fetchPlans, fetchUserRole])

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
        const { data: urlsData } = await supabase.from('plan_urls').select('url').eq('plan.id', plan.id)

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

    return (
        <div className={css({ bg: 'white', p: { base: '12px', sm: '24px' }, borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' })}>
            <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: { base: 'center', sm: 'flex-start' }, mb: { base: '16px', sm: '24px' }, flexDirection: { base: 'column', sm: 'row' }, gap: '16px' })}>
                {/* 1. 타이틀 & 시간 필터 */}
                <div className={css({ display: 'flex', w: { base: '100%', sm: 'auto' }, justifyContent: 'space-between', alignItems: { base: 'center', sm: 'flex-start' }, flexDirection: { base: 'row', sm: 'column' } })}>
                    <h2 className={css({ fontSize: { base: '18px', sm: '20px' }, fontWeight: 'bold', mb: { base: 0, sm: '12px' } })}>일정표 (주간 캘린더)</h2>

                    {/* PC 전용 시간 표시 옵션 토글 */}
                    <div className={css({ display: { base: 'none', sm: 'inline-flex' }, bg: '#f1f3f4', p: '2px', borderRadius: '8px', gap: '2px', w: 'auto' })}>
                        <button
                            onClick={() => setTimeDisplayMode('local')}
                            className={css({ flex: 'none', px: '12px', py: '6px', fontSize: '12px', fontWeight: timeDisplayMode === 'local' ? 'bold' : 'normal', bg: timeDisplayMode === 'local' ? 'white' : 'transparent', borderRadius: '6px', border: 'none', cursor: 'pointer', boxShadow: timeDisplayMode === 'local' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: '#022C22', whiteSpace: 'nowrap' })}
                        >
                            현지 시간
                        </button>
                        <button
                            onClick={() => setTimeDisplayMode('kst')}
                            className={css({ flex: 'none', px: '12px', py: '6px', fontSize: '12px', fontWeight: timeDisplayMode === 'kst' ? 'bold' : 'normal', bg: timeDisplayMode === 'kst' ? 'white' : 'transparent', borderRadius: '6px', border: 'none', cursor: 'pointer', boxShadow: timeDisplayMode === 'kst' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: '#022C22', whiteSpace: 'nowrap' })}
                        >
                            한국 시간
                        </button>
                        <button
                            onClick={() => setTimeDisplayMode('both')}
                            className={css({ flex: 'none', px: '12px', py: '6px', fontSize: '12px', fontWeight: timeDisplayMode === 'both' ? 'bold' : 'normal', bg: timeDisplayMode === 'both' ? 'white' : 'transparent', borderRadius: '6px', border: 'none', cursor: 'pointer', boxShadow: timeDisplayMode === 'both' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: '#022C22', whiteSpace: 'nowrap' })}
                        >
                            동시 표기
                        </button>
                    </div>

                    {/* 모바일 전용 시간 표시 드롭다운 */}
                    <CustomTimeDropdown timeDisplayMode={timeDisplayMode} setTimeDisplayMode={setTimeDisplayMode} />
                </div>

                {/* 2. 버튼 영역: 모바일 1줄(flex/order), PC 다단구조 */}
                <div className={css({ 
                    display: 'flex', flexDirection: { base: 'row', sm: 'column' }, alignItems: { base: 'center', sm: 'flex-start' },
                    gap: '8px', w: { base: '100%', sm: 'auto' } 
                })}>
                    <div className={css({ 
                        display: 'flex', gap: '8px', flexShrink: 0, w: { base: 'auto', sm: '100%' },
                        order: { base: 1, sm: -1 } 
                    })}>
                        <button
                            onClick={() => setIsCollaboratorModalOpen(true)}
                            className={css({
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                bg: 'white', color: '#022C22',
                                px: { base: '0', sm: '12px' }, w: { base: '44px', sm: 'auto' }, h: '44px',
                                borderRadius: '8px', fontWeight: '600', fontSize: '13px',
                                border: '1px solid #ddd', whiteSpace: 'nowrap',
                                _hover: { bg: '#f9f9f9', transform: 'translateY(-1px)' }, _active: { transform: 'translateY(0)' },
                                opacity: !isOnline ? 0.5 : 1, cursor: !isOnline ? 'not-allowed' : 'pointer',
                                flex: { base: 'none', sm: 1 }
                            })}
                            disabled={!isOnline}
                        >
                            <UserPlus size={16} /> <span className={css({ display: { base: 'none', sm: 'inline' } })}>협업</span>
                        </button>
                        {userRole === 'owner' && (
                            <button
                                onClick={() => setIsShareModalOpen(true)}
                                className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    bg: 'white', color: '#022C22',
                                    px: { base: '0', sm: '12px' }, w: { base: '44px', sm: 'auto' }, h: '44px',
                                    borderRadius: '8px', fontWeight: '600', fontSize: '13px',
                                    border: '1px solid #ddd', whiteSpace: 'nowrap',
                                    _hover: { bg: '#f9f9f9', transform: 'translateY(-1px)' }, _active: { transform: 'translateY(0)' },
                                    opacity: !isOnline ? 0.5 : 1, cursor: !isOnline ? 'not-allowed' : 'pointer',
                                    flex: { base: 'none', sm: 1 }
                                })}
                                disabled={!isOnline}
                            >
                                <Share2 size={16} /> <span className={css({ display: { base: 'none', sm: 'inline' } })}>공유</span>
                            </button>
                        )}
                    </div>
                    {/* 편집 권한이 있을 때만 일정 추가 버튼 노출 */}
                    {(userRole === 'owner' || userRole === 'editor') && (
                        <button
                            onClick={() => { setEditingPlan(null); setIsModalOpen(true) }}
                            className={css({
                                order: { base: -1, sm: 1 },
                                flex: { base: 1, sm: 'none' }, w: { base: 'auto', sm: '100%' }, h: '44px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                bg: '#10B981', color: 'white', px: '16px', borderRadius: '8px',
                                fontWeight: '600', fontSize: '15px', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
                                _hover: { bg: '#059669', transform: 'translateY(-1px)' }, _active: { transform: 'translateY(0)' }
                            })}
                        >
                            <Plus size={18} /> 일정 추가
                        </button>
                    )}
                </div>
            </div>

            {(!plans || plans.length === 0) ? (
                <div className={css({ textAlign: 'center', py: '60px', color: '#888' })}>
                    <p className={css({ fontSize: '16px', mb: '8px' })}>등록된 세부 일정이 없습니다.</p>
                    {(userRole === 'owner' || userRole === 'editor') && (
                        <p className={css({ fontSize: '14px' })}>일정 추가 버튼을 눌러 여정을 채워보세요.</p>
                    )}
                </div>
            ) : (
                <PlanList
                    plans={plans}
                    activeDropdown={activeDropdown}
                    setActiveDropdown={setActiveDropdown}
                    userRole={userRole}
                    timeDisplayMode={timeDisplayMode}
                    formatLocalTime={formatLocalTime}
                    formatKstTime={formatKstTime}
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
        </div>
    )
}
