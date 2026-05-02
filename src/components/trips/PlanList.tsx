'use client'

import { css } from 'styled-system/css'
import { Clock, CheckCircle2, Circle, Trash2, Edit3, Wallet, Bell, MapPin, FileText, Link2 } from 'lucide-react'
import { getCurrencyFromTimezone, formatCurrency } from '@/utils/currency'

interface Plan {
    id: string
    title: string
    location: string
    address: string
    lat: number
    lng: number
    visit_date?: string
    visit_time?: string
    start_datetime_local: string
    end_datetime_local: string
    alarm_minutes_before?: number
    cost: number
    memo: string
    image_url: string
    is_completed: boolean
    is_visited: boolean
    timezone_string: string
}

interface PlanListProps {
    plans: any[]
    exchangeRates: Record<string, number>
    activeDropdown: string | null
    setActiveDropdown: (id: string | null) => void
    userRole: 'owner' | 'editor' | 'viewer' | null
    timeDisplayMode: 'local' | 'kst' | 'both'
    formatLocalTime: (date: string) => string
    formatKstTime: (date: string, tz: string) => string
    onEdit: (plan: any) => void
    onDelete: (id: string) => void
    onDetail: (plan: any) => void
    onToggleVisit: (planId: string, isVisited: boolean) => void
}

export default function PlanList({
    plans,
    exchangeRates,
    activeDropdown,
    setActiveDropdown,
    userRole,
    timeDisplayMode,
    formatLocalTime,
    formatKstTime,
    onEdit,
    onDelete,
    onDetail,
    onToggleVisit
}: PlanListProps) {
    if (!plans || plans.length === 0) {
        return (
            <div className={css({ textAlign: 'center', py: '80px', bg: 'bg.softCotton', borderRadius: '12px', border: '2px dashed', borderColor: 'brand.hairline' })}>
                <div className={css({ fontSize: '48px', mb: '16px' })}>🗺️</div>
                <h3 className={css({ fontSize: '18px', fontWeight: '700', color: 'brand.ink', mb: '8px' })}>아직 일정이 없어요</h3>
                <p className={css({ color: 'brand.muted', fontSize: '14px' })}>상단의 + 버튼을 눌러 첫 일정을 추가해보세요!</p>
            </div>
        )
    }

    // 날짜별 그룹화 (start_datetime_local 기준)
    const groupedPlans = plans.reduce((groups: Record<string, any[]>, plan) => {
        const date = plan.start_datetime_local.split('T')[0]
        if (!groups[date]) groups[date] = []
        groups[date].push(plan)
        return groups
    }, {})

    return (
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '32px' })}>
            {Object.entries(groupedPlans).map(([date, datePlans], idx) => (
                <div key={date} className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '12px', mb: '4px' })}>
                        <div className={css({ bg: 'brand.primary', color: 'white', px: '10px', py: '3px', borderRadius: '8px', fontSize: '12px', fontWeight: '800' })}>
                            DAY {idx + 1}
                        </div>
                        <h3 className={css({ fontSize: '16px', fontWeight: '700', color: 'brand.ink' })}>
                            {new Date(date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                        </h3>
                    </div>

                    <div className={css({ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '24px',
                        position: 'relative',
                        pl: '24px',
                        _before: {
                            content: '""',
                            position: 'absolute',
                            top: '12px',
                            bottom: '12px',
                            left: '7px',
                            w: '1px',
                            bg: 'brand.hairline',
                            zIndex: 0
                        }
                    })}>
                        {datePlans.map((plan) => (
                            <div key={plan.id} className={css({ position: 'relative' })}>
                                <div className={css({
                                    position: 'absolute',
                                    left: '-21px',
                                    top: '26px',
                                    w: '9px',
                                    h: '9px',
                                    borderRadius: '50%',
                                    bg: 'brand.primary',
                                    border: '2px solid white',
                                    zIndex: 1,
                                    boxShadow: '0 0 0 1px brand.primary/30'
                                })} />
                                <PlanCard
                                    plan={plan}
                                    exchangeRates={exchangeRates}
                                    userRole={userRole}
                                    timeDisplayMode={timeDisplayMode}
                                    formatLocalTime={formatLocalTime}
                                    formatKstTime={formatKstTime}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onDetail={onDetail}
                                    onToggleVisit={onToggleVisit}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function PlanCard({
    plan,
    exchangeRates,
    userRole,
    timeDisplayMode,
    formatLocalTime,
    formatKstTime,
    onEdit,
    onDelete,
    onDetail,
    onToggleVisit
}: {
    plan: any
    exchangeRates: Record<string, number>
    userRole: 'owner' | 'editor' | 'viewer' | null
    timeDisplayMode: 'local' | 'kst' | 'both'
    formatLocalTime: (date: string) => string
    formatKstTime: (date: string, tz: string) => string
    onEdit: (plan: any) => void
    onDelete: (id: string) => void
    onDetail: (plan: any) => void
    onToggleVisit: (planId: string, isVisited: boolean) => void
}) {
    const currency = getCurrencyFromTimezone(plan.timezone_string || 'Asia/Seoul')
    const rate = exchangeRates[currency.code]
    const hasMemo = !!plan.memo
    const hasUrls = plan.plan_urls && plan.plan_urls.length > 0
    const canEdit = userRole === 'owner' || userRole === 'editor'

    return (
        <div
            onClick={() => onDetail(plan)}
            className={css({
                bg: 'white', borderRadius: '12px', border: '1px solid', borderColor: 'brand.hairline',
                display: 'flex', gap: '12px', p: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: plan.is_visited ? 0.65 : 1,
                _hover: { boxShadow: 'airbnbHover', borderColor: 'transparent', transform: 'translateY(-2px)' },
            })}
        >
            {/* 왼쪽: 라운드 썸네일 */}
            {plan.image_url && (
                <div
                    className={css({
                        w: '68px', flexShrink: 0, borderRadius: '12px',
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        alignSelf: 'stretch',
                    })}
                    style={{ backgroundImage: `url("${plan.image_url}")` }}
                />
            )}

            {/* 오른쪽: 콘텐츠 */}
            <div className={css({ flex: 1, minW: 0, display: 'flex', flexDirection: 'column', gap: '6px' })}>
                {/* 1행: 제목 + 힌트 아이콘 + 방문 체크 */}
                <div className={css({ display: 'flex', alignItems: 'center', gap: '6px' })}>
                    <h4 className={css({
                        fontSize: '15px', fontWeight: '700', color: 'brand.ink',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minW: 0,
                        textDecoration: plan.is_visited ? 'line-through' : 'none',
                    })}>{plan.title}</h4>
                    {plan.alarm_minutes_before > 0 && (
                        <Bell size={13} className={css({ color: 'orange.500', flexShrink: 0 })} fill="currentColor" />
                    )}
                    {hasMemo && <FileText size={13} className={css({ color: 'brand.muted', flexShrink: 0 })} />}
                    {hasUrls && <Link2 size={13} className={css({ color: 'brand.muted', flexShrink: 0 })} />}
                    {canEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleVisit(plan.id, !plan.is_visited) }}
                            className={css({ bg: 'transparent', border: 'none', cursor: 'pointer', p: '2px', display: 'flex', flexShrink: 0, transition: 'all 0.2s', _hover: { transform: 'scale(1.15)' } })}
                            aria-label={plan.is_visited ? '방문 취소' : '방문 완료'}
                        >
                            {plan.is_visited
                                ? <CheckCircle2 size={18} className={css({ color: 'brand.primary' })} />
                                : <Circle size={18} className={css({ color: 'brand.muted' })} />
                            }
                        </button>
                    )}
                </div>

                {/* 2행: 시간 / 장소 / 알림 */}
                <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'brand.muted', fontWeight: '600' })}>
                    <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0 })}>
                        <Clock size={12} />
                        {timeDisplayMode === 'local' && formatLocalTime(plan.start_datetime_local)}
                        {timeDisplayMode === 'kst' && formatKstTime(plan.start_datetime_local, plan.timezone_string)}
                        {timeDisplayMode === 'both' && (
                            <>
                                {formatLocalTime(plan.start_datetime_local)}
                                <span className={css({ color: 'brand.hairline', mx: '1px' })}>|</span>
                                <span className={css({ fontSize: '11px' })}>{formatKstTime(plan.start_datetime_local, plan.timezone_string)}</span>
                            </>
                        )}
                    </span>
                    {plan.location && (
                        <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minW: 0 })}>
                            <MapPin size={11} className={css({ flexShrink: 0 })} /> {plan.location}
                        </span>
                    )}
                </div>

                {/* 3행: 금액 + 수정/삭제 */}
                {(plan.cost > 0 || canEdit) && (
                    <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
                        <div>
                            {plan.cost > 0 && (
                                <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '700', color: 'brand.primary' })}>
                                    <Wallet size={12} /> {formatCurrency(plan.cost, currency)}
                                    {currency.code !== 'KRW' && rate && (
                                        <span className={css({ fontWeight: '500', color: 'brand.muted', fontSize: '11px' })}>
                                            ({Math.round(plan.cost * rate).toLocaleString()}원)
                                        </span>
                                    )}
                                </span>
                            )}
                        </div>
                        {canEdit && (
                            <div className={css({ display: 'flex', gap: '2px' })}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(plan) }}
                                    className={css({ p: '4px', color: 'brand.muted', bg: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', _hover: { color: 'brand.primary', bg: 'bg.softCotton' } })}
                                >
                                    <Edit3 size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(plan.id) }}
                                    className={css({ p: '4px', color: 'brand.muted', bg: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', _hover: { color: 'brand.error', bg: 'bg.softCotton' } })}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
