'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { Clock, CheckCircle2, Circle, Trash2, Edit3, Wallet, Bell } from 'lucide-react'
import { getCurrencyFromTimezone, formatCurrency } from '@/utils/currency'
import LocationTooltip from '../common/LocationTooltip'
import UrlPreviewCard from '../common/UrlPreviewCard'
import { ExchangeService } from '@/services/ExternalApiService'

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
            <div className={css({ textAlign: 'center', py: '80px', bg: 'bg.softCotton', borderRadius: '24px', border: '2px dashed', borderColor: 'brand.border' })}>
                <div className={css({ fontSize: '48px', mb: '16px' })}>🗺️</div>
                <h3 className={css({ fontSize: '18px', fontWeight: '700', color: 'brand.secondary', mb: '8px' })}>아직 일정이 없어요</h3>
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
                        <h3 className={css({ fontSize: '16px', fontWeight: '700', color: 'brand.secondary' })}>
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
                            bg: 'brand.border',
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
    const [isTooltipOpen, setIsTooltipOpen] = useState(false)
    const currency = getCurrencyFromTimezone(plan.timezone_string || 'Asia/Seoul')
    const rate = exchangeRates[currency.code]

    return (
        <div 
            onClick={() => onDetail(plan)}
            style={{ 
                '--plan-image': plan.image_url ? `url("${plan.image_url}")` : 'none'
            } as any}
            className={css({
            bg: 'white', p: '20px', borderRadius: '20px', border: '1px solid', borderColor: 'brand.border',
            display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            _hover: !isTooltipOpen ? { 
                boxShadow: '0 12px 24px rgba(0,0,0,0.08)', 
                borderColor: 'brand.primary/50', 
                transform: 'translateY(-2px)',
                _before: plan.image_url ? {
                    transform: 'scale(1.05)',
                    opacity: 0.95
                } : {}
            } : {},
            opacity: plan.is_completed ? 0.7 : plan.is_visited ? 0.6 : 1,
            cursor: 'pointer',
            // background 처리
            _before: plan.image_url ? {
                content: '""',
                display: 'block',
                position: 'absolute',
                inset: 0,
                backgroundImage: 'var(--plan-image)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.8,
                filter: 'brightness(0.9) contrast(1.1)',
                zIndex: 0,
                transition: 'all 0.5s ease',
                borderRadius: '24px',
            } : {},
            _after: plan.image_url ? {
                content: '""',
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to right, white 15%, rgba(255,255,255,0.9) 40%, rgba(255,255,255,0.4) 100%)',
                zIndex: 1,
                borderRadius: '24px',
            } : {}
        })}>
            <div className={css({ display: 'flex', gap: '14px', position: 'relative', zIndex: 2 })}>
                <div className={css({ flex: 1, minW: 0 })}>
                    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '4px' })}>
                        <div className={css({ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minW: 0 })}>
                            {(userRole === 'owner' || userRole === 'editor') && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onToggleVisit(plan.id, !plan.is_visited)
                                    }}
                                    className={css({
                                        bg: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        p: '2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        transition: 'all 0.2s',
                                        _hover: { transform: 'scale(1.15)' }
                                    })}
                                    aria-label={plan.is_visited ? '방문 취소' : '방문 완료'}
                                >
                                    {plan.is_visited
                                        ? <CheckCircle2 size={20} className={css({ color: 'brand.primary' })} />
                                        : <Circle size={20} className={css({ color: 'brand.muted' })} />
                                    }
                                </button>
                            )}
                            <h4 className={css({
                                fontSize: '17px',
                                fontWeight: '700',
                                color: 'brand.secondary',
                                textDecoration: plan.is_completed ? 'line-through' : plan.is_visited ? 'line-through' : 'none'
                            })}>{plan.title}</h4>
                        </div>
                        {(userRole === 'owner' || userRole === 'editor') && (
                            <div className={css({ display: 'flex', gap: '4px' })}>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onEdit(plan)
                                    }} 
                                    className={css({ p: '6px', color: 'brand.secondary', _hover: { color: 'brand.primary', bg: 'white/80' }, bg: 'white/40', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' })}
                                >
                                    <Edit3 size={16} />
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onDelete(plan.id)
                                    }} 
                                    className={css({ p: '6px', color: 'brand.secondary', _hover: { color: 'brand.accent', bg: 'white/80' }, bg: 'white/40', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' })}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '10px', mb: '10px' })}>
                        <div className={css({ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'brand.secondary', fontWeight: '700' })}>
                            <Clock size={13} />
                            {timeDisplayMode === 'local' && formatLocalTime(plan.start_datetime_local)}
                            {timeDisplayMode === 'kst' && `한국 ${formatKstTime(plan.start_datetime_local, plan.timezone_string)}`}
                            {timeDisplayMode === 'both' && (
                                <>
                                    {formatLocalTime(plan.start_datetime_local)}
                                    <span className={css({ color: 'brand.border', fontWeight: 'normal' })}>|</span>
                                    <span className={css({ fontSize: '11px', fontWeight: '500' })}>{formatKstTime(plan.start_datetime_local, plan.timezone_string)}(KST)</span>
                                </>
                            )}
                            {plan.alarm_minutes_before > 0 && (
                                <span className={css({ display: 'inline-flex', alignItems: 'center', ml: '4px' })}>
                                    <Bell size={13} className={css({ color: 'orange.500' })} fill="currentColor" />
                                </span>
                            )}
                        </div>
                        <LocationTooltip 
                            locationName={plan.location} 
                            lat={plan.location_lat || plan.lat} 
                            lng={plan.location_lng || plan.lng} 
                            address={plan.address}
                            onOpenChange={setIsTooltipOpen}
                            className={css({ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'brand.secondary', fontWeight: '600', bg: 'transparent', border: 'none', cursor: 'pointer', p: 0 })}
                        />
                    </div>

                    {plan.memo && (
                        <div className={css({ p: '12px 14px', bg: 'bg.softCotton', borderRadius: '12px', mb: '12px', fontSize: '13px', color: 'brand.secondary', lineHeight: 1.6, borderLeft: '3px solid', borderColor: 'brand.border' })}>
                            {plan.memo}
                        </div>
                    )}

                    {plan.cost > 0 && (
                        <div className={css({ display: 'flex', alignItems: 'center', gap: '8px', mb: '12px' })}>
                            <div className={css({ display: 'flex', alignItems: 'center', gap: '4px', bg: 'brand.primary/10', color: 'brand.primary', px: '8px', py: '4px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' })}>
                                <Wallet size={12} /> {formatCurrency(plan.cost, currency)}
                            </div>
                            {currency.code !== 'KRW' && rate && (
                                <span className={css({ fontSize: '11px', color: 'brand.muted', fontWeight: '500' })}>
                                    (약 {Math.round(plan.cost * rate).toLocaleString()}원)
                                </span>
                            )}
                        </div>
                    )}

                    {/* URL 미리보기 */}
                    {(() => {
                        const urlRegex = /(https?:\/\/[^\s]+)/g
                        const urls = plan.memo?.match(urlRegex)
                        if (urls && urls.length > 0) {
                            return (
                                <div className={css({ mt: '8px' })}>
                                    <UrlPreviewCard url={urls[0]} />
                                </div>
                            )
                        }
                        return null
                    })()}
                </div>
            </div>
        </div>
    )
}
