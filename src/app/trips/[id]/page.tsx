'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import NewPlanModal from '@/components/trips/NewPlanModal'

export default function TripPlansPage(props: {
    params: Promise<{ id: string }>
}) {
    const params = use(props.params)
    const tripId = params.id

    // Supabase client instance (stable across renders if used carefully, but better kept inside useCallback or useMemo if it's deeply depending on renders, though createClient maps to same client mostly)
    const supabase = createClient()
    const [plans, setPlans] = useState<any[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [timeDisplayMode, setTimeDisplayMode] = useState<'local' | 'kst' | 'both'>('local')

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

    const fetchPlans = useCallback(async () => {
        if (!tripId) return

        const { data } = await supabase
            .from('plans')
            .select('*')
            .eq('trip_id', tripId)
            .order('start_datetime_local', { ascending: true })

        if (data) setPlans(data)
    }, [tripId, supabase])

    useEffect(() => {
        fetchPlans()
    }, [fetchPlans])

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

    return (
        <div className={css({ bg: 'white', p: { base: '16px', sm: '24px' }, borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' })}>
            <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: { base: 'stretch', sm: 'flex-start' }, mb: '24px', flexDirection: { base: 'column', sm: 'row' }, gap: '16px' })}>
                <div>
                    <h2 className={css({ fontSize: { base: '18px', sm: '20px' }, fontWeight: 'bold', mb: '12px' })}>일정표 (주간 캘린더)</h2>

                    {/* 시간 표시 옵션 토글 */}
                    <div className={css({ display: 'inline-flex', bg: '#f1f3f4', p: '4px', borderRadius: '8px', gap: '2px', w: { base: '100%', sm: 'auto' } })}>
                        <button
                            onClick={() => setTimeDisplayMode('local')}
                            className={css({ flex: { base: 1, sm: 'none' }, px: '12px', py: '6px', fontSize: '12px', fontWeight: timeDisplayMode === 'local' ? 'bold' : 'normal', bg: timeDisplayMode === 'local' ? 'white' : 'transparent', borderRadius: '6px', border: 'none', cursor: 'pointer', boxShadow: timeDisplayMode === 'local' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: '#333', whiteSpace: 'nowrap' })}
                        >
                            현지 시간
                        </button>
                        <button
                            onClick={() => setTimeDisplayMode('kst')}
                            className={css({ flex: { base: 1, sm: 'none' }, px: '12px', py: '6px', fontSize: '12px', fontWeight: timeDisplayMode === 'kst' ? 'bold' : 'normal', bg: timeDisplayMode === 'kst' ? 'white' : 'transparent', borderRadius: '6px', border: 'none', cursor: 'pointer', boxShadow: timeDisplayMode === 'kst' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: '#333', whiteSpace: 'nowrap' })}
                        >
                            한국 시간
                        </button>
                        <button
                            onClick={() => setTimeDisplayMode('both')}
                            className={css({ flex: { base: 1, sm: 'none' }, px: '12px', py: '6px', fontSize: '12px', fontWeight: timeDisplayMode === 'both' ? 'bold' : 'normal', bg: timeDisplayMode === 'both' ? 'white' : 'transparent', borderRadius: '6px', border: 'none', cursor: 'pointer', boxShadow: timeDisplayMode === 'both' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: '#333', whiteSpace: 'nowrap' })}
                        >
                            동시 표기
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => {
                        setEditingPlan(null) // 신규 생성 모드
                        setIsModalOpen(true)
                    }}
                    className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        bg: '#4285F4',
                        color: 'white',
                        px: '16px',
                        py: '10px',
                        borderRadius: '8px',
                        fontWeight: '600',
                        fontSize: '14px',
                        cursor: 'pointer',
                        border: 'none',
                        w: { base: '100%', sm: 'auto' },
                        _hover: { bg: '#3367d6', transform: 'translateY(-1px)' },
                        _active: { transform: 'translateY(0)' }
                    })}
                >
                    <Plus size={16} /> 일정 추가
                </button>
            </div>

            {(!plans || plans.length === 0) ? (
                <div className={css({ textAlign: 'center', py: '60px', color: '#888' })}>
                    <p className={css({ fontSize: '16px', mb: '8px' })}>등록된 세부 일정이 없습니다.</p>
                    <p className={css({ fontSize: '14px' })}>일정 추가 버튼을 눌러 여정을 채워보세요.</p>
                </div>
            ) : (
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '32px' })}>
                    {Object.entries(
                        plans.reduce((acc, plan) => {
                            // start_datetime_local은 현지 시간 문자열이므로 'Z' 없이 날짜 키만 추출
                            const localIso = plan.start_datetime_local.replace(' ', 'T')
                            const datePart = localIso.split('T')[0] // YYYY-MM-DD
                            const [year, month, day] = datePart.split('-')
                            const localDateString = `${year}년 ${month}월 ${day}일`

                            if (!acc[localDateString]) acc[localDateString] = [];
                            acc[localDateString].push(plan);
                            return acc;
                        }, {} as Record<string, any[]>)
                    ).map(([dateStr, dayPlans]: [string, any]) => (
                        <div key={dateStr} className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
                            <h3 className={css({
                                fontSize: '18px',
                                fontWeight: 'bold',
                                color: '#111',
                                pb: '8px',
                                borderBottom: '2px solid #eee',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            })}>
                                <span className={css({ w: '8px', h: '8px', borderRadius: '50%', bg: '#4285F4' })} />
                                {dateStr}
                            </h3>
                            <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                                {dayPlans.map((plan: any) => (
                                    <div
                                        key={plan.id}
                                        className={css({
                                            p: '16px',
                                            bg: 'white',
                                            border: '1px solid #eaeaea',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px',
                                            position: 'relative',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                                            transition: 'transform 0.2s',
                                            _hover: { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }
                                        })}
                                    >
                                        {/* 더보기 메뉴 토글 버튼 */}
                                        <div className={css({ position: 'absolute', top: '16px', right: '16px' })}>
                                            <button
                                                onClick={() => setActiveDropdown(activeDropdown === plan.id ? null : plan.id)}
                                                className={css({ bg: 'transparent', border: 'none', cursor: 'pointer', p: '4px', borderRadius: '4px', color: '#888', _hover: { bg: '#f1f1f1', color: '#111' } })}
                                            >
                                                <MoreVertical size={18} />
                                            </button>

                                            {/* 드롭다운 메뉴 (열렸을 때) */}
                                            {activeDropdown === plan.id && (
                                                <div
                                                    className={css({ position: 'absolute', right: 0, top: '28px', bg: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', w: '120px', zIndex: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' })}
                                                    onMouseLeave={() => setActiveDropdown(null)}
                                                >
                                                    <button onClick={() => handleEditPlan(plan)} className={css({ display: 'flex', alignItems: 'center', gap: '8px', px: '12px', py: '10px', bg: 'transparent', border: 'none', borderBottom: '1px solid #f0f0f0', w: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#333', _hover: { bg: '#f9f9f9' } })}>
                                                        <Pencil size={14} /> 수정
                                                    </button>
                                                    <button onClick={() => handleDeletePlan(plan.id)} className={css({ display: 'flex', alignItems: 'center', gap: '8px', px: '12px', py: '10px', bg: 'transparent', border: 'none', w: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#dc2626', _hover: { bg: '#fee2e2' } })}>
                                                        <Trash2 size={14} /> 삭제
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: { base: 'column', md: 'row' }, gap: '12px', pr: { base: '0', md: '32px' } })}>
                                            <div className={css({ flex: 1, w: '100%' })}>
                                                <h4 className={css({ fontWeight: 'bold', fontSize: '16px', color: '#222', mb: '4px' })}>{plan.title}</h4>
                                                {plan.location && (
                                                    <p className={css({ fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' })}>
                                                        📍 {plan.location}
                                                    </p>
                                                )}
                                                {plan.memo && (
                                                    <p className={css({ fontSize: '13px', color: '#888', mt: '8px', bg: '#f9f9f9', p: '8px', borderRadius: '6px' })}>
                                                        📝 {plan.memo}
                                                    </p>
                                                )}
                                            </div>
                                            <div className={css({ display: 'flex', flexDirection: { base: 'row', md: 'column' }, alignItems: { base: 'center', md: 'flex-end' }, gap: '12px', ml: { base: '0', md: 'auto' }, w: { base: '100%', md: 'auto' }, pt: { base: '8px', md: '0' }, borderTop: { base: '1px solid #f0f0f0', md: 'none' } })}>
                                                {(timeDisplayMode === 'local' || timeDisplayMode === 'both') && (
                                                    <div className={css({ display: 'flex', flexDirection: 'column', alignItems: { base: 'flex-start', md: 'flex-end' }, flex: 1 })}>
                                                        <span className={css({ fontSize: '10px', color: '#888', mb: '2px' })}>현지 타임존</span>
                                                        <span className={css({ fontSize: '13px', color: '#111', bg: '#f1f3f4', px: '8px', py: '3px', borderRadius: '6px', fontWeight: timeDisplayMode === 'local' ? 'bold' : 'normal', whiteSpace: 'nowrap' })}>
                                                            {formatLocalTime(plan.start_datetime_local)}
                                                        </span>
                                                    </div>
                                                )}
                                                {(timeDisplayMode === 'kst' || timeDisplayMode === 'both') && (
                                                    <div className={css({ display: 'flex', flexDirection: 'column', alignItems: { base: 'flex-start', md: 'flex-end' }, flex: 1 })}>
                                                        <span className={css({ fontSize: '10px', color: '#1a73e8', mb: '2px' })}>한국 기준</span>
                                                        <span className={css({ fontSize: '13px', color: '#1a73e8', bg: '#e8f0fe', px: '8px', py: '3px', borderRadius: '6px', fontWeight: timeDisplayMode === 'kst' ? 'bold' : 'normal', whiteSpace: 'nowrap' })}>
                                                            {formatKstTime(plan.start_datetime_local, plan.timezone_string || 'Asia/Seoul')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 예산/금액 정보 영역 */}
                                        {plan.cost > 0 && (
                                            <div className={css({ borderTop: '1px dashed #eee', pt: '10px', mt: '4px' })}>
                                                <span className={css({ fontSize: '14px', fontWeight: '600', color: '#34A853' })}>
                                                    💰 예산: {plan.cost.toLocaleString()}원
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
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
        </div>
    )
}
