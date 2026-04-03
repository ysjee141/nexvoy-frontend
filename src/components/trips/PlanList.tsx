'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { ChevronDown, ChevronUp, MapPin, Clock, Wallet, BookOpen } from 'lucide-react'
import { getCurrencyFromTimezone, formatCurrency, formatKRW } from '@/utils/currency'
import PlanDetailModal from './PlanDetailModal'

// ── PlanCard: 필수 정보만 표시 (클릭 → 상세 팝업) ──
interface PlanCardProps {
    plan: any
    isToday: boolean
    activeDropdown: string | null           // 드롭다운 호환성 유지 (사용 안 함)
    setActiveDropdown: (id: string | null) => void
    userRole: 'owner' | 'editor' | 'viewer' | null
    timeDisplayMode: 'local' | 'kst' | 'both'
    exchangeRates: Record<string, number>
    formatLocalTime: (d: string) => string
    formatKstTime: (d: string, tz: string) => string
    onEdit: (plan: any) => void
    onDelete: (id: string) => void
}

function PlanCard({
    plan, isToday, userRole,
    timeDisplayMode, exchangeRates, formatLocalTime, formatKstTime,
    onEdit, onDelete,
}: PlanCardProps) {
    const now = new Date()
    const localIso = plan.start_datetime_local.replace(' ', 'T')
    const planStart = new Date(localIso)
    const isOngoing = isToday && planStart <= now

    const [showDetail, setShowDetail] = useState(false)

    // 금액 처리
    const currency = getCurrencyFromTimezone(plan.timezone_string || 'Asia/Seoul')
    const localAmount = plan.cost > 0 ? formatCurrency(plan.cost, currency) : null
    const rate = exchangeRates[currency.code]
    const krwAmount = localAmount && rate ? Math.round(plan.cost * rate) : null

    // 시간 포맷
    const primaryTime = (timeDisplayMode === 'both' || timeDisplayMode === 'local')
        ? formatLocalTime(plan.start_datetime_local)
        : formatKstTime(plan.start_datetime_local, plan.timezone_string || 'Asia/Seoul')
    const timeLabel = timeDisplayMode === 'kst' ? '한국' : '현지'

    return (
        <div 
            className={css({ 
                display: 'flex', 
                gap: { base: '12px', sm: '20px' }, 
                position: 'relative',
                mb: '4px'
            })}
        >
            {/* 왼쪽: 시간 영역 (수직 스택) */}
            <div className={css({ 
                w: { base: '80px', sm: '95px' }, 
                flexShrink: 0, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'flex-end',
                pt: '14px',
                whiteSpace: 'nowrap'
            })}>
                {/* 현지 시간 (우선순위) */}
                {(timeDisplayMode === 'both' || timeDisplayMode === 'local') && (
                    <span className={css({ 
                        fontSize: { base: '13px', sm: '14px' }, 
                        fontWeight: '700', 
                        color: isOngoing ? '#2EC4B6' : '#222',
                        lineHeight: 1
                    })}>
                        {formatLocalTime(plan.start_datetime_local)}
                    </span>
                )}
                {/* 한국 시간 (보조) */}
                {(timeDisplayMode === 'both' || timeDisplayMode === 'kst') && (
                    <span className={css({ 
                        fontSize: { base: '13px', sm: '14px' }, 
                        fontWeight: '700', 
                        color: isOngoing ? '#249E93' : '#999',
                        mt: '6px',
                        lineHeight: 1,
                        opacity: timeDisplayMode === 'both' ? 0.8 : 1
                    })}>
                        {timeDisplayMode === 'both' ? '한국 ' : ''}
                        {formatKstTime(plan.start_datetime_local, plan.timezone_string || 'Asia/Seoul')}
                    </span>
                )}
            </div>

            {/* 중앙: 타임라인 도트 및 라인 슬롯 */}
            <div className={css({ 
                position: 'relative', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                flexShrink: 0,
                w: '20px'
            })}>
                {/* 도트 */}
                <div className={css({ 
                    w: '12px', h: '12px', 
                    borderRadius: '50%', 
                    bg: isOngoing ? '#2EC4B6' : isToday ? '#EAF9F7' : '#EEEEEE',
                    border: '2px solid white',
                    boxShadow: isOngoing ? '0 0 0 3px rgba(46, 196, 182, 0.2)' : 'none',
                    zIndex: 2,
                    mt: '17px',
                    transition: 'all 0.3s'
                })} />
            </div>

            {/* 오른쪽: 일정 카드 내용 */}
            <div
                role="button"
                tabIndex={0}
                onClick={() => setShowDetail(true)}
                onKeyDown={(e) => { if (e.key === 'Enter') setShowDetail(true) }}
                className={css({
                    flex: 1,
                    p: { base: '14px', sm: '16px 20px' },
                    bg: 'white',
                    border: isOngoing ? '2px solid #2EC4B6' : isToday ? '1px solid #EAF9F7' : '1px solid #EEEEEE',
                    borderRadius: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    position: 'relative',
                    cursor: 'pointer',
                    boxShadow: isOngoing
                        ? '0 8px 24px rgba(46, 196, 182, 0.12)'
                        : '0 2px 8px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
                    _hover: {
                        transform: 'translateX(4px)',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.06)',
                        borderColor: isOngoing ? '#2EC4B6' : '#CCC',
                    },
                    _active: { transform: 'scale(0.98) translateX(4px)' }
                })}
                style={isToday ? {
                    background: isOngoing
                        ? 'linear-gradient(135deg, #F0F7FF 0%, #FFFFFF 100%)'
                        : '#FCFDFF',
                } : {}}
            >
                {/* 진행 중 뱃지 */}
                {isOngoing && (
                    <span style={{
                        position: 'absolute', top: -10, right: 20,
                        background: '#2EC4B6', color: 'white', fontSize: 10, fontWeight: 900,
                        padding: '2px 8px', borderRadius: 20,
                        display: 'flex', alignItems: 'center', gap: 4,
                        boxShadow: '0 4px 12px rgba(46,196,182,0.3)',
                    }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'white', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                        ON
                    </span>
                )}

                {/* 일정명 */}
                <h4 className={css({
                    fontWeight: '700',
                    fontSize: { base: '15px', sm: '16px' },
                    color: isOngoing ? '#249E93' : '#222',
                    lineHeight: 1.4,
                })}>
                    {plan.title}
                </h4>

                {/* 하단: 장소 / 금액 */}
                <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' })}>
                    {/* 장소 */}
                    {plan.location && (
                        <span className={css({
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontSize: '12px',
                            color: isOngoing ? '#249E93' : '#666',
                            bg: isOngoing ? 'white' : '#FFF5F2', /* accent-peach light */
                            px: '10px', py: '5px', borderRadius: '12px',
                            maxW: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            boxShadow: isOngoing ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
                            fontWeight: '600'
                        })}>
                            <MapPin size={12} color={isOngoing ? '#2EC4B6' : '#FF9F87'} />
                            {plan.location}
                        </span>
                    )}

                    {/* 참고자료 개수 */}
                    {plan.plan_urls && Array.isArray(plan.plan_urls) && plan.plan_urls.length > 0 && (
                        <span className={css({
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontSize: '12px',
                            color: isOngoing ? '#249E93' : '#666',
                            bg: isOngoing ? 'white' : '#EAF9F7', /* primary-mint light */
                            px: '10px', py: '5px', borderRadius: '12px',
                            boxShadow: isOngoing ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
                            fontWeight: '600'
                        })}>
                            <BookOpen size={12} color={isOngoing ? '#2EC4B6' : '#828D99'} />
                            참고자료 {plan.plan_urls.length}건
                        </span>
                    )}

                    {/* 예상 금액 */}
                    {localAmount && (
                        <span className={css({
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontSize: '13px', fontWeight: '700', color: '#2563EB',
                            ml: 'auto',
                        })}>
                            <Wallet size={12} />
                            {localAmount}
                            {currency.code !== 'KRW' && krwAmount !== null && (
                                <span className={css({ fontSize: '11px', color: '#999', fontWeight: '500' })}>
                                    ≈{formatKRW(krwAmount)}
                                </span>
                            )}
                        </span>
                    )}
                </div>
            </div>

            {/* 상세 팝업 */}
            {showDetail && (
                <PlanDetailModal
                    plan={plan}
                    exchangeRates={exchangeRates}
                    formatLocalTime={formatLocalTime}
                    formatKstTime={formatKstTime}
                    timeDisplayMode={timeDisplayMode}
                    userRole={userRole}
                    onClose={() => setShowDetail(false)}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            )}
        </div>
    )
}

// ── PlanList 컴포넌트 ──
interface PlanListProps {
    plans: any[]
    activeDropdown: string | null
    setActiveDropdown: (id: string | null) => void
    userRole: 'owner' | 'editor' | 'viewer' | null
    timeDisplayMode: 'local' | 'kst' | 'both'
    formatLocalTime: (d: string) => string
    formatKstTime: (d: string, tz: string) => string
    onEdit: (plan: any) => void
    onDelete: (id: string) => void
}

export default function PlanList({
    plans, activeDropdown, setActiveDropdown, userRole,
    timeDisplayMode, formatLocalTime, formatKstTime,
    onEdit, onDelete,
}: PlanListProps) {
    const [pastOpen, setPastOpen] = useState(false)
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})

    // plans 변경 시 환율 fetch
    useEffect(() => {
        const uniqueNonKrw = new Set<string>()
        plans.forEach(p => {
            const currency = getCurrencyFromTimezone(p.timezone_string || 'Asia/Seoul')
            if (currency.code !== 'KRW') uniqueNonKrw.add(currency.code)
        })
        uniqueNonKrw.forEach(async (code) => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_APP_URL || '';
                const res = await fetch(`${apiUrl}/api/exchange/?from=${code}`)
                if (res.ok) {
                    const json = await res.json()
                    setExchangeRates(prev => ({ ...prev, [code]: json.rate }))
                }
            } catch { /* 무시 */ }
        })
    }, [plans])

    const todayStr = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD

    // 날짜별 그룹 생성
    const grouped: Record<string, { label: string; rawDate: string; plans: any[] }> = {}
    plans.forEach(plan => {
        const rawDate = plan.start_datetime_local.replace(' ', 'T').split('T')[0]
        const [y, m, d] = rawDate.split('-')
        const label = `${y}년 ${m}월 ${d}일`
        if (!grouped[rawDate]) grouped[rawDate] = { label, rawDate, plans: [] }
        grouped[rawDate].plans.push(plan)
    })

    const sortedDays = Object.values(grouped).sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    const remainingDays = sortedDays.filter((d: any) => d.rawDate >= todayStr)
    const pastDays = sortedDays.filter((d: any) => d.rawDate < todayStr)

    const commonProps = { activeDropdown, setActiveDropdown, userRole, timeDisplayMode, exchangeRates, formatLocalTime, formatKstTime, onEdit, onDelete }

    const renderDayGroup = (day: typeof sortedDays[0]) => {
        const isToday = day.rawDate === todayStr
        // 중심축 계산: 시간 영역(80/95) + 간격(12/20) + 도트 컬럼 절반(10) = 102px / 125px
        const timelineCenter = { base: '102px', sm: '125px' } 
        // 헤더 패딩: 중심축 - 헤더 도트 절반(3.5) = 98.5px / 121.5px
        const headerPadding = { base: '98.5px', sm: '121.5px' }

        return (
            <div key={day.rawDate} className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
                <h3 className={css({
                    fontSize: { base: '14px', sm: '16px' }, fontWeight: '700',
                    color: isToday ? '#2EC4B6' : '#444',
                    pb: '8px', borderBottom: isToday ? '2px solid #2EC4B6' : '1px solid #eee',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    pl: headerPadding
                })}>
                    <span className={css({ w: '7px', h: '7px', borderRadius: '50%', bg: isToday ? '#2EC4B6' : '#ccc', flexShrink: 0 })} />
                    {day.label}
                    {isToday && (
                        <span className={css({ fontSize: '11px', fontWeight: '700', bg: '#EAF9F7', color: '#2EC4B6', px: '7px', py: '2px', borderRadius: '6px' })}>
                            오늘
                        </span>
                    )}
                </h3>
                <div className={css({ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    position: 'relative'
                })}>
                    {/* 타임라인 세로선 */}
                    <div className={css({ 
                        position: 'absolute', 
                        left: timelineCenter, 
                        top: '0', 
                        bottom: '0', 
                        w: '2px', 
                        bg: isToday ? '#EAF9F7' : '#EEEEEE',
                        zIndex: 1,
                        ml: '-1px' // 중앙 정렬 보정
                    })} />

                    {day.plans.map((plan: any) => (
                        <PlanCard key={plan.id} plan={plan} isToday={isToday} {...commonProps} />
                    ))}
                </div>
            </div>
        )
    }

    if (plans.length === 0) return null

    return (
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '24px' })}>

            {/* ① 남은 일정 (오늘 포함) — 기본 펼침 */}
            {remainingDays.length > 0 && (
                <section>
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '10px', mb: '16px', pb: '10px', borderBottom: '2px solid #EAF9F7' })}>
                        <span className={css({ fontSize: '18px' })}>🗺️</span>
                        <h2 className={css({ fontSize: { base: '15px', sm: '17px' }, fontWeight: '700', color: '#2EC4B6' })}>다가올 여정</h2>
                        <span className={css({ fontSize: '12px', color: '#888', bg: '#f1f3f4', px: '8px', py: '2px', borderRadius: '10px' })}>
                            {remainingDays.reduce((s, d) => s + d.plans.length, 0)}개
                        </span>
                    </div>
                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '28px' })}>
                        {remainingDays.map(renderDayGroup)}
                    </div>
                </section>
            )}

            {/* ② 지나간 일정 — 기본 접힘 */}
            {pastDays.length > 0 && (
                <section>
                    <button
                        onClick={() => setPastOpen(v => !v)}
                        className={css({
                            w: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            p: '12px 16px', bg: 'white', border: '1px solid #eee', borderRadius: '10px',
                            cursor: 'pointer', mb: pastOpen ? '16px' : '0',
                            _hover: { bg: '#fafafa', borderColor: '#ddd' },
                        })}
                    >
                        <span className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                            <span className={css({ fontSize: '16px' })}>📸</span>
                            <span className={css({ fontWeight: '700', fontSize: '15px', color: '#555' })}>추억으로 남은 여정</span>
                            <span className={css({ fontSize: '12px', color: '#aaa', bg: '#f5f5f5', px: '8px', py: '2px', borderRadius: '10px' })}>
                                {pastDays.reduce((s, d) => s + d.plans.length, 0)}개
                            </span>
                        </span>
                        {pastOpen
                            ? <ChevronUp size={18} color="#aaa" />
                            : <ChevronDown size={18} color="#aaa" />
                        }
                    </button>

                    {pastOpen && (
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '28px' })}>
                            {pastDays.map(renderDayGroup)}
                        </div>
                    )}
                </section>
            )}
        </div>
    )
}
