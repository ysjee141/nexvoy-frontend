'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { Clock, CheckCircle2, Circle, Trash2, Edit3, Wallet } from 'lucide-react'
import { getCurrencyFromTimezone, formatCurrency } from '@/utils/currency'
import LocationTooltip from '../common/LocationTooltip'
import UrlPreviewCard from '../common/UrlPreviewCard'
import { ExchangeService } from '@/services/ExternalApiService'

interface Plan {
    id: string
    title: string
    location_name: string
    address: string
    lat: number
    lng: number
    visit_date?: string
    visit_time?: string
    start_datetime_local: string
    duration_hours: number
    cost: number
    description: string
    image_url: string
    is_completed: boolean
    timezone_string: string
}

interface PlanListProps {
    plans: any[]
    activeDropdown: string | null
    setActiveDropdown: (id: string | null) => void
    userRole: 'owner' | 'editor' | 'viewer' | null
    timeDisplayMode: 'local' | 'kst' | 'both'
    formatLocalTime: (date: string) => string
    formatKstTime: (date: string, tz: string) => string
    onEdit: (plan: any) => void
    onDelete: (id: string) => void
}

export default function PlanList({ 
    plans, 
    activeDropdown, 
    setActiveDropdown, 
    userRole, 
    timeDisplayMode, 
    formatLocalTime, 
    formatKstTime, 
    onEdit, 
    onDelete 
}: PlanListProps) {
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})

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
                        <div className={css({ bg: 'brand.primary', color: 'white', px: '12px', py: '4px', borderRadius: '10px', fontSize: '13px', fontWeight: '800' })}>
                            DAY {idx + 1}
                        </div>
                        <h3 className={css({ fontSize: '16px', fontWeight: '700', color: 'brand.secondary' })}>
                            {new Date(date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                        </h3>
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px', pl: '10px', borderLeft: '2px solid', borderColor: 'brand.border' })}>
                        {datePlans.map((plan) => {
                            const currency = getCurrencyFromTimezone(plan.timezone_string || 'Asia/Seoul')
                            const rate = exchangeRates[currency.code]
                            
                            return (
                                <div key={plan.id} className={css({
                                    bg: 'white', p: '20px', borderRadius: '20px', border: '1.5px solid', borderColor: 'brand.border',
                                    display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative',
                                    transition: 'all 0.2s', _hover: { boxShadow: 'floating', borderColor: 'brand.primary' },
                                    opacity: plan.is_completed ? 0.7 : 1
                                })}>
                                    <div className={css({ display: 'flex', gap: '14px' })}>
                                        {/* 체크 버튼 */}
                                        <div className={css({ mt: '2px', color: plan.is_completed ? 'brand.primary' : 'brand.muted' })}>
                                            {plan.is_completed ? <CheckCircle2 size={22} fill="currentColor" color="white" /> : <Circle size={22} />}
                                        </div>

                                        <div className={css({ flex: 1, minW: 0 })}>
                                            <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '4px' })}>
                                                <h4 className={css({ fontSize: '17px', fontWeight: '700', color: 'brand.secondary', textDecoration: plan.is_completed ? 'line-through' : 'none' })}>{plan.title}</h4>
                                                {(userRole === 'owner' || userRole === 'editor') && (
                                                    <div className={css({ display: 'flex', gap: '4px' })}>
                                                        <button onClick={() => onEdit(plan)} className={css({ p: '4px', color: 'brand.muted', _hover: { color: 'brand.primary' }, bg: 'transparent', border: 'none', cursor: 'pointer' })}><Edit3 size={16} /></button>
                                                        <button onClick={() => onDelete(plan.id)} className={css({ p: '4px', color: 'brand.muted', _hover: { color: 'brand.accent' }, bg: 'transparent', border: 'none', cursor: 'pointer' })}><Trash2 size={16} /></button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '10px', mb: '10px' })}>
                                                <div className={css({ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'brand.primary', fontWeight: '700' })}>
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
                                                </div>
                                                <LocationTooltip 
                                                    locationName={plan.location_name} 
                                                    lat={plan.lat} 
                                                    lng={plan.lng} 
                                                    className={css({ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'brand.muted', fontWeight: '500', bg: 'transparent', border: 'none', cursor: 'pointer', p: 0 })}
                                                />
                                            </div>

                                            {plan.description && (
                                                <div className={css({ p: '12px 14px', bg: 'bg.softCotton', borderRadius: '12px', mb: '12px', fontSize: '13px', color: 'brand.secondary', lineHeight: 1.6, borderLeft: '3px solid', borderColor: 'brand.border' })}>
                                                    {plan.description}
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
                                                const urls = plan.description?.match(urlRegex)
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
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}
