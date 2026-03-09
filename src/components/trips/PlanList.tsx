'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { ChevronDown, ChevronUp, MapPin, Clock, Wallet } from 'lucide-react'
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
        <>
            <div
                role="button"
                tabIndex={0}
                onClick={() => setShowDetail(true)}
                onKeyDown={(e) => { if (e.key === 'Enter') setShowDetail(true) }}
                className={css({
                    p: { base: '12px 14px', sm: '14px 18px' },
                    bg: 'white',
                    border: isOngoing ? '2px solid #4285F4' : isToday ? '1px solid #bbdefb' : '1px solid #e8eaed',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    position: 'relative',
                    cursor: 'pointer',
                    boxShadow: isOngoing
                        ? '0 4px 20px rgba(66,133,244,0.18)'
                        : isToday
                            ? '0 2px 10px rgba(66,133,244,0.07)'
                            : '0 1px 4px rgba(0,0,0,0.04)',
                    transition: 'transform 0.18s, box-shadow 0.18s',
                    _hover: {
                        transform: 'translateY(-2px)',
                        boxShadow: isOngoing
                            ? '0 8px 28px rgba(66,133,244,0.25)'
                            : '0 4px 14px rgba(0,0,0,0.09)',
                    },
                })}
                style={isToday ? {
                    background: isOngoing
                        ? 'linear-gradient(135deg,#e8f0fe 0%,#f0fdf4 100%)'
                        : '#fafcff',
                } : {}}
            >
                {/* 진행 중 뱃지 */}
                {isOngoing && (
                    <span style={{
                        position: 'absolute', top: -11, left: 12,
                        background: '#4285F4', color: 'white', fontSize: 11, fontWeight: 800,
                        padding: '3px 10px', borderRadius: 20,
                        display: 'flex', alignItems: 'center', gap: 5,
                        boxShadow: '0 2px 8px rgba(66,133,244,0.5)',
                    }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'inline-block' }} />
                        진행 중
                    </span>
                )}

                {/* 상단: 일정명 */}
                <h4 className={css({
                    fontWeight: '700',
                    fontSize: { base: '14px', sm: '15px' },
                    color: isOngoing ? '#1a56db' : '#111',
                    lineHeight: 1.3,
                })}>
                    {plan.title}
                </h4>

                {/* 하단: 장소 / 시간 / 금액 */}
                <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' })}>

                    {/* 장소 */}
                    {plan.location && (
                        <span className={css({
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            fontSize: '12px', color: '#666',
                            bg: '#f5f5f5', px: '7px', py: '3px', borderRadius: '6px',
                            maxW: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        })}>
                            <MapPin size={11} color="#F4511E" />
                            {plan.location}
                        </span>
                    )}

                    {/* 시간 */}
                    <span className={css({
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        fontSize: '12px',
                        color: isOngoing ? '#1a56db' : '#555',
                        bg: isOngoing ? 'rgba(66,133,244,0.12)' : '#f1f3f4',
                        px: '7px', py: '3px', borderRadius: '6px', whiteSpace: 'nowrap',
                        fontWeight: '600',
                    })}>
                        <Clock size={11} color={isOngoing ? '#4285F4' : '#666'} />
                        {primaryTime}
                        {timeDisplayMode === 'both' && (
                            <small style={{ fontSize: 10, opacity: 0.65, fontWeight: 'normal' }}>({timeLabel})</small>
                        )}
                    </span>

                    {/* KST 시간 (both 모드일 때 추가) */}
                    {timeDisplayMode === 'both' && (
                        <span className={css({
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            fontSize: '12px', color: '#1a73e8',
                            bg: '#e8f0fe', px: '7px', py: '3px', borderRadius: '6px',
                            whiteSpace: 'nowrap', fontWeight: '600',
                        })}>
                            <Clock size={11} color="#1a73e8" />
                            {formatKstTime(plan.start_datetime_local, plan.timezone_string || 'Asia/Seoul')}
                            <small style={{ fontSize: 10, opacity: 0.8, fontWeight: 'normal' }}>(한국)</small>
                        </span>
                    )}

                    {/* 예상 금액 */}
                    {localAmount && (
                        <span className={css({
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontSize: '12px', fontWeight: '700', color: '#34A853',
                            ml: 'auto',
                        })}>
                            <Wallet size={11} />
                            {localAmount}
                            {currency.code !== 'KRW' && krwAmount !== null && (
                                <span className={css({ fontSize: '11px', color: '#999', fontWeight: '400' })}>
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
        </>
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
                const res = await fetch(`/api/exchange?from=${code}`)
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
    const remainingDays = sortedDays.filter(d => d.rawDate >= todayStr)
    const pastDays = sortedDays.filter(d => d.rawDate < todayStr)

    const commonProps = { activeDropdown, setActiveDropdown, userRole, timeDisplayMode, exchangeRates, formatLocalTime, formatKstTime, onEdit, onDelete }

    const renderDayGroup = (day: typeof sortedDays[0]) => {
        const isToday = day.rawDate === todayStr
        return (
            <div key={day.rawDate} className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
                <h3 className={css({
                    fontSize: { base: '14px', sm: '16px' }, fontWeight: '700',
                    color: isToday ? '#1a56db' : '#444',
                    pb: '8px', borderBottom: isToday ? '2px solid #4285F4' : '1px solid #eee',
                    display: 'flex', alignItems: 'center', gap: '8px'
                })}>
                    <span className={css({ w: '7px', h: '7px', borderRadius: '50%', bg: isToday ? '#4285F4' : '#ccc', flexShrink: 0 })} />
                    {day.label}
                    {isToday && (
                        <span className={css({ fontSize: '11px', fontWeight: '700', bg: '#e8f0fe', color: '#1a56db', px: '7px', py: '2px', borderRadius: '6px' })}>
                            오늘
                        </span>
                    )}
                </h3>
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '10px' })}>
                    {day.plans.map(plan => (
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
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '10px', mb: '16px', pb: '10px', borderBottom: '2px solid #e8f0fe' })}>
                        <span className={css({ fontSize: '18px' })}>🗺️</span>
                        <h2 className={css({ fontSize: { base: '15px', sm: '17px' }, fontWeight: '800', color: '#1a56db' })}>남은 일정</h2>
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
                            <span className={css({ fontWeight: '700', fontSize: '15px', color: '#555' })}>지나간 일정</span>
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
