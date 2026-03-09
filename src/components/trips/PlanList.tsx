'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { MoreVertical, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { getCurrencyFromTimezone, formatCurrency, formatKRW } from '@/utils/currency'

interface PlanCardProps {
    plan: any
    isToday: boolean
    activeDropdown: string | null
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
    plan, isToday, activeDropdown, setActiveDropdown, userRole,
    timeDisplayMode, exchangeRates, formatLocalTime, formatKstTime,
    onEdit, onDelete
}: PlanCardProps) {
    const now = new Date()
    // 현지 시간 기준으로 시작 시각 파싱 (타임존 무관한 로컬 비교)
    const localIso = plan.start_datetime_local.replace(' ', 'T')
    const planStart = new Date(localIso)
    const isOngoing = isToday && planStart <= now

    return (
        <div
            className={css({
                p: { base: '12px', sm: '16px' },
                bg: 'white',
                border: isOngoing ? '2px solid #4285F4' : isToday ? '1px solid #bbdefb' : '1px solid #eaeaea',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'relative',
                zIndex: activeDropdown === plan.id ? 20 : 1,
                boxShadow: isOngoing
                    ? '0 4px 20px rgba(66,133,244,0.2)'
                    : isToday
                        ? '0 2px 10px rgba(66,133,244,0.07)'
                        : '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                _hover: {
                    transform: 'translateY(-2px)',
                    boxShadow: isOngoing ? '0 8px 28px rgba(66,133,244,0.25)' : '0 4px 12px rgba(0,0,0,0.06)'
                },
            })}
            style={isToday ? { background: isOngoing ? 'linear-gradient(135deg,#e8f0fe 0%,#f0fdf4 100%)' : '#fafcff' } : {}}
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
                    <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.9)',
                        display: 'inline-block',
                    }} />
                    진행 중
                </span>
            )}

            {/* 드롭다운 */}
            {(userRole === 'owner' || userRole === 'editor') && (
                <div className={css({ position: 'absolute', top: '16px', right: '16px' })}>
                    <button
                        onClick={() => setActiveDropdown(activeDropdown === plan.id ? null : plan.id)}
                        className={css({ bg: 'transparent', border: 'none', cursor: 'pointer', p: '4px', borderRadius: '4px', color: '#888', _hover: { bg: '#f1f1f1', color: '#111' } })}
                    >
                        <MoreVertical size={18} />
                    </button>
                    {activeDropdown === plan.id && (
                        <div
                            className={css({ position: 'absolute', right: 0, top: '28px', bg: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', w: '120px', zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden' })}
                            onMouseLeave={() => setActiveDropdown(null)}
                        >
                            <button onClick={() => onEdit(plan)} className={css({ display: 'flex', alignItems: 'center', gap: '8px', px: '12px', py: '10px', bg: 'transparent', border: 'none', borderBottom: '1px solid #f0f0f0', w: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#333', _hover: { bg: '#f9f9f9' } })}>
                                <Pencil size={14} /> 수정
                            </button>
                            <button onClick={() => onDelete(plan.id)} className={css({ display: 'flex', alignItems: 'center', gap: '8px', px: '12px', py: '10px', bg: 'transparent', border: 'none', w: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#dc2626', _hover: { bg: '#fee2e2' } })}>
                                <Trash2 size={14} /> 삭제
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 내용 */}
            <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: { base: 'column', md: 'row' }, gap: '12px', pr: { base: '0', md: '32px' } })}>
                <div className={css({ flex: 1, w: '100%' })}>
                    <h4 className={css({ fontWeight: 'bold', fontSize: { base: '15px', sm: '16px' }, color: isOngoing ? '#1a56db' : '#222', mb: '4px' })}>
                        {plan.title}
                    </h4>
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
                <div className={css({ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', ml: { base: '0', md: 'auto' }, w: { base: '100%', md: 'auto' }, pt: { base: '8px', md: '0' }, borderTop: { base: '1px solid #f0f0f0', md: 'none' }, justifyContent: { base: 'flex-start', md: 'flex-end' }, flexWrap: 'wrap' })}>
                    {(timeDisplayMode === 'local' || timeDisplayMode === 'both') && (
                        <span className={css({ fontSize: '13px', color: '#111', bg: isOngoing ? 'rgba(66,133,244,0.12)' : '#f1f3f4', px: '8px', py: '4px', borderRadius: '6px', fontWeight: timeDisplayMode === 'local' ? 'bold' : '500', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' })}>
                            {formatLocalTime(plan.start_datetime_local)}
                            {timeDisplayMode === 'both' && <small className={css({ fontSize: '10px', opacity: 0.6, fontWeight: 'normal' })}>(현지)</small>}
                        </span>
                    )}
                    {timeDisplayMode === 'both' && <span className={css({ color: '#ccc', fontSize: '12px', display: { base: 'none', sm: 'inline' } })}>·</span>}
                    {(timeDisplayMode === 'kst' || timeDisplayMode === 'both') && (
                        <span className={css({ fontSize: '13px', color: '#1a73e8', bg: '#e8f0fe', px: '8px', py: '4px', borderRadius: '6px', fontWeight: timeDisplayMode === 'kst' ? 'bold' : '500', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' })}>
                            {formatKstTime(plan.start_datetime_local, plan.timezone_string || 'Asia/Seoul')}
                            {timeDisplayMode === 'both' && <small className={css({ fontSize: '10px', opacity: 0.8, fontWeight: 'normal' })}>(한국)</small>}
                        </span>
                    )}
                </div>
            </div>

            {/* 금액 */}
            {plan.cost > 0 && (() => {
                const currency = getCurrencyFromTimezone(plan.timezone_string || 'Asia/Seoul')
                const localAmount = formatCurrency(plan.cost, currency)
                const rate = exchangeRates[currency.code]
                const krwAmount = rate ? Math.round(plan.cost * rate) : null
                return (
                    <div className={css({ borderTop: '1px dashed #eee', pt: '10px', mt: '4px' })}>
                        <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' })}>
                            <span className={css({ fontSize: '13px', color: '#666' })}>💰 예상 금액</span>
                            <span className={css({ fontSize: '14px', fontWeight: '700', color: '#34A853' })}>{localAmount}</span>
                            {currency.code !== 'KRW' && krwAmount !== null && (
                                <span className={css({ fontSize: '12px', color: '#888', bg: '#f1f3f4', px: '6px', py: '1px', borderRadius: '4px' })}>
                                    ≈ {formatKRW(krwAmount)}
                                </span>
                            )}
                            {currency.code !== 'KRW' && !krwAmount && (
                                <span className={css({ fontSize: '12px', color: '#bbb' })}>환율 로딩 중...</span>
                            )}
                        </span>
                    </div>
                )
            })()}
        </div>
    )
}

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
                    fontSize: { base: '15px', sm: '17px' }, fontWeight: 'bold',
                    color: isToday ? '#1a56db' : '#111',
                    pb: '8px', borderBottom: isToday ? '2px solid #4285F4' : '2px solid #eee',
                    display: 'flex', alignItems: 'center', gap: '8px'
                })}>
                    <span className={css({ w: '8px', h: '8px', borderRadius: '50%', bg: isToday ? '#4285F4' : '#bbb', flexShrink: 0 })} />
                    {day.label}
                    {isToday && (
                        <span className={css({ fontSize: '11px', fontWeight: '700', bg: '#e8f0fe', color: '#1a56db', px: '7px', py: '2px', borderRadius: '6px' })}>
                            오늘
                        </span>
                    )}
                </h3>
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '20px' })}>
                    {day.plans.map(plan => (
                        <PlanCard key={plan.id} plan={plan} isToday={isToday} {...commonProps} />
                    ))}
                </div>
            </div>
        )
    }

    const totalPlans = plans.length

    if (totalPlans === 0) return null

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
