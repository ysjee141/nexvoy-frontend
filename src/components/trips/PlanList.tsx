'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Clock, MapPin, ChevronRight, CheckCircle2, Circle, Trash2, Edit3, MessageSquare, ExternalLink, Info, Loader2, Wallet } from 'lucide-react'
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
    visit_date: string
    visit_time: string
    duration_hours: number
    cost: number
    description: string
    image_url: string
    is_completed: boolean
    timezone_string: string
}

interface PlanListProps {
    tripId: string
}

export default function PlanList({ tripId }: PlanListProps) {
    const supabase = createClient()
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})

    useEffect(() => {
        fetchPlans()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tripId])

    const fetchPlans = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('plans')
            .select('*')
            .eq('trip_id', tripId)
            .order('visit_date', { ascending: true })
            .order('visit_time', { ascending: true })

        if (error) {
            console.error('Error fetching plans:', error)
        } else {
            setPlans(data || [])
            // 통화별 환율 미리 로드 (Refactored to use ExchangeService)
            const uniqueTimezones = Array.from(new Set((data || []).map((p: any) => p.timezone_string || 'Asia/Seoul')))
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
        setLoading(false)
    }

    const toggleComplete = async (planId: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('plans')
            .update({ is_completed: !currentStatus })
            .eq('id', planId)

        if (!error) {
            setPlans(plans.map(p => p.id === planId ? { ...p, is_completed: !currentStatus } : p))
        }
    }

    const deletePlan = async (planId: string) => {
        if (!confirm('일정을 삭제하시겠습니까?')) return

        const { error } = await supabase
            .from('plans')
            .delete()
            .eq('id', planId)

        if (!error) {
            setPlans(plans.filter(p => p.id !== planId))
        }
    }

    if (loading) {
        return (
            <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: '60px', color: '#9CA3AF', gap: '12px' })}>
                <Loader2 size={32} className={css({ animation: 'spin 1.5s linear infinite' })} />
                <span className={css({ fontWeight: '600', fontSize: '15px' })}>여정을 불러오는 중...</span>
            </div>
        )
    }

    if (plans.length === 0) {
        return (
            <div className={css({ textAlign: 'center', py: '80px', bg: '#F8F9FA', borderRadius: '24px', border: '2px dashed #E5E7EB' })}>
                <div className={css({ fontSize: '48px', mb: '16px' })}>🗺️</div>
                <h3 className={css({ fontSize: '18px', fontWeight: '700', color: '#2C3A47', mb: '8px' })}>아직 일정이 없어요</h3>
                <p className={css({ color: '#9CA3AF', fontSize: '14px' })}>오른쪽 상단의 + 버튼을 눌러 첫 일정을 추가해보세요!</p>
            </div>
        )
    }

    // 날짜별 그룹화
    const groupedPlans = plans.reduce((groups: Record<string, Plan[]>, plan) => {
        const date = plan.visit_date
        if (!groups[date]) groups[date] = []
        groups[date].push(plan)
        return groups
    }, {})

    return (
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '32px' })}>
            {Object.entries(groupedPlans).map(([date, datePlans], idx) => (
                <div key={date} className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '12px', mb: '4px' })}>
                        <div className={css({ bg: '#2EC4B6', color: 'white', px: '12px', py: '4px', borderRadius: '10px', fontSize: '13px', fontWeight: '800' })}>
                            DAY {idx + 1}
                        </div>
                        <h3 className={css({ fontSize: '16px', fontWeight: '700', color: '#172554' })}>
                            {new Date(date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                        </h3>
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px', pl: '10px', borderLeft: '2px solid #F1F3F5' })}>
                        {datePlans.map((plan) => {
                            const currency = getCurrencyFromTimezone(plan.timezone_string || 'Asia/Seoul')
                            const rate = exchangeRates[currency.code]
                            
                            return (
                                <div key={plan.id} className={css({
                                    bg: 'white', p: '20px', borderRadius: '20px', border: '1.5px solid #F1F3F5',
                                    display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative',
                                    transition: 'all 0.2s', _hover: { boxShadow: '0 8px 30px rgba(0,0,0,0.04)', borderColor: '#2EC4B6' },
                                    opacity: plan.is_completed ? 0.7 : 1
                                })}>
                                    <div className={css({ display: 'flex', gap: '14px' })}>
                                        {/* 체크 버튼 */}
                                        <button 
                                            onClick={() => toggleComplete(plan.id, plan.is_completed)}
                                            className={css({ mt: '2px', bg: 'transparent', border: 'none', cursor: 'pointer', p: 0, color: plan.is_completed ? '#2EC4B6' : '#D1D5DB', transition: 'all 0.2s' })}
                                        >
                                            {plan.is_completed ? <CheckCircle2 size={22} fill="currentColor" color="white" /> : <Circle size={22} />}
                                        </button>

                                        <div className={css({ flex: 1, minW: 0 })}>
                                            <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '4px' })}>
                                                <h4 className={css({ fontSize: '17px', fontWeight: '700', color: '#2C3A47', textDecoration: plan.is_completed ? 'line-through' : 'none' })}>{plan.title}</h4>
                                                <div className={css({ display: 'flex', gap: '4px' })}>
                                                    <button onClick={() => deletePlan(plan.id)} className={css({ p: '4px', color: '#9CA3AF', _hover: { color: '#FF5A5F' }, bg: 'transparent', border: 'none', cursor: 'pointer' })}><Trash2 size={16} /></button>
                                                </div>
                                            </div>

                                            <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '10px', mb: '10px' })}>
                                                <div className={css({ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#2EC4B6', fontWeight: '700' })}>
                                                    <Clock size={13} /> {plan.visit_time}
                                                </div>
                                                <LocationTooltip 
                                                    locationName={plan.location_name} 
                                                    lat={plan.lat} 
                                                    lng={plan.lng} 
                                                    className={css({ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#6B7280', fontWeight: '500', bg: 'transparent', border: 'none', cursor: 'pointer', p: 0 })}
                                                />
                                            </div>

                                            {plan.description && (
                                                <div className={css({ p: '12px 14px', bg: '#F8F9FA', borderRadius: '12px', mb: '12px', fontSize: '13px', color: '#4B5563', lineHeight: 1.6, borderLeft: '3px solid #E5E7EB' })}>
                                                    {plan.description}
                                                </div>
                                            )}

                                            {/* 비용 정보 */}
                                            {plan.cost > 0 && (
                                                <div className={css({ display: 'flex', alignItems: 'center', gap: '8px', mb: '12px' })}>
                                                    <div className={css({ display: 'flex', alignItems: 'center', gap: '4px', bg: 'rgba(255, 209, 102, 0.1)', color: '#F59E0B', px: '8px', py: '4px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' })}>
                                                        <Wallet size={12} /> {formatCurrency(plan.cost, currency.code)}
                                                    </div>
                                                    {currency.code !== 'KRW' && rate && (
                                                        <span className={css({ fontSize: '11px', color: '#9CA3AF', fontWeight: '500' })}>
                                                            (약 {Math.round(plan.cost * rate).toLocaleString()}원)
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* URL 미리보기 (메모 내용 기반) */}
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
