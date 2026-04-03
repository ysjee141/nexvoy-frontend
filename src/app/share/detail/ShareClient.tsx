'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Globe, Lock, Calendar, MapPin, Clock, BadgeCheck, ChevronDown, ChevronUp } from 'lucide-react'
import LocationTooltip from '@/components/common/LocationTooltip'
import UrlPreviewCard from '@/components/common/UrlPreviewCard'

function SharePlanCard({ plan, formatLocalTime, formatDate }: any) {
    const [isRefsOpen, setIsRefsOpen] = useState(false)
    const hasRefs = plan.plan_urls && Array.isArray(plan.plan_urls) && plan.plan_urls.length > 0

    return (
        <div className={css({ 
            py: '20px', 
            borderBottom: '1px solid #EEEEEE',
            display: 'flex',
            flexDirection: { base: 'column', sm: 'row' },
            gap: { base: '12px', sm: '24px' }
        })}>
            <div className={css({ minW: '100px', pt: '4px' })}>
                <span className={css({ 
                    fontSize: '15px', fontWeight: '700', color: '#222', bg: '#F7F7F7', 
                    px: '10px', py: '4px', borderRadius: '6px',
                    display: 'inline-flex', alignItems: 'center', gap: '6px'
                })}>
                    <Clock size={16} /> {formatLocalTime(plan.start_datetime_local)}
                </span>
            </div>
            
            <div className={css({ flex: 1, minW: 0 })}>
                <h3 className={css({ fontSize: '20px', fontWeight: '700', mb: '8px', color: '#222' })}>{plan.title}</h3>
                <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '12px', mb: '12px' })}>
                    <span className={css({ fontSize: '14px', color: '#717171', display: 'flex', alignItems: 'center', gap: '4px' })}>
                        <Calendar size={14} /> {formatDate(plan.start_datetime_local)}
                    </span>
                    {plan.location && (
                        <LocationTooltip 
                            locationName={plan.location} 
                            lat={plan.location_lat} 
                            lng={plan.location_lng} 
                        />
                    )}
                </div>
                {plan.memo && (
                    <div className={css({ 
                        fontSize: '15px', color: '#484848', lineHeight: 1.6, p: '16px', bg: '#F7F7F7',
                        borderRadius: '12px', border: '1px solid #EEEEEE', whiteSpace: 'pre-wrap'
                    })}>
                        {plan.memo}
                    </div>
                )}
                {hasRefs && (
                    <div className={css({ mt: '12px', display: 'flex', flexDirection: 'column', gap: '8px' })}>
                        <button
                            onClick={() => setIsRefsOpen(!isRefsOpen)}
                            className={css({
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                w: '100%', p: '12px 16px', bg: '#ffffff', border: '1px solid #E5E7EB',
                                borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s',
                                _hover: { bg: '#F9FAFB', borderColor: '#D1D5DB' }
                            })}
                        >
                            <span className={css({ fontSize: '14px', fontWeight: '700', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '6px' })}>
                                <Globe size={16} color="#2EC4B6" /> 참고자료 {plan.plan_urls.length}건 확인하기
                            </span>
                            {isRefsOpen ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
                        </button>
                        
                        {isRefsOpen && (
                            <div className={css({ display: 'flex', flexDirection: 'column', gap: '10px', mt: '4px', minW: 0 })}>
                                {plan.plan_urls.map((pu: any, i: number) => {
                                    const url = typeof pu === 'string' ? pu : pu.url
                                    if (!url) return null
                                    return <UrlPreviewCard key={i} url={url} />
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default function SharePage() {
    const searchParams = useSearchParams()
    const shareToken = searchParams.get('token')
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [trip, setTrip] = useState<any>(null)
    const [plans, setPlans] = useState<any[]>([])
    const [shareInfo, setShareInfo] = useState<any>(null)
    const [passwordInput, setPasswordInput] = useState('')
    const [isAuthorized, setIsAuthorized] = useState(false)

    const fetchShareInfo = useCallback(async () => {
        setLoading(true)
        // 1. 공유 토큰으로 정보 조회
        const { data: shareData, error: shareError } = await supabase
            .from('trip_shares')
            .select('*, trips(*)')
            .eq('share_token', shareToken)
            .single()

        if (shareError || !shareData) {
            setError('유효하지 않거나 만료된 공유 링크입니다.')
            setLoading(false)
            return
        }

        setShareInfo(shareData)

        let currentTrip = shareData.trips
        if (!currentTrip) {
            const { data: tripData } = await supabase.from('trips').select('*').eq('id', shareData.trip_id).single()
            currentTrip = tripData
        }
        setTrip(currentTrip)

        // 2. 공개 타입이면 바로 일정 조회
        if (shareData.share_type === 'public' || isAuthorized) {
            setIsAuthorized(true)
            await fetchPlans(shareData.trip_id)
        }
        setLoading(false)
    }, [shareToken, supabase])

    const fetchPlans = async (tripId: string) => {
        const { data } = await supabase
            .from('plans')
            .select('*, plan_urls(*)')
            .eq('trip_id', tripId)
            .order('start_datetime_local', { ascending: true })

        if (data) setPlans(data)
    }

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (passwordInput === shareInfo?.password_hash) { // 실제는 해시 검증 필요하나 현재는 단순 비교
            setIsAuthorized(true)
            await fetchPlans(shareInfo.trip_id)
        } else {
            alert('비밀번호가 일치하지 않습니다.')
        }
    }

    useEffect(() => {
        fetchShareInfo()
    }, [fetchShareInfo])

    const formatLocalTime = (dateString: string): string => {
        try {
            const timePart = dateString.split(' ')[1] || dateString.split('T')[1]
            if (!timePart) return ''
            const [h, m] = timePart.split(':')
            const hour = parseInt(h, 10)
            const ampm = hour < 12 ? '오전' : '오후'
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
            return `${ampm} ${String(displayHour).padStart(2, '0')}:${m}`
        } catch { return dateString }
    }

    const formatDate = (dateString: string): string => {
        try {
            const datePart = dateString.split(' ')[0] || dateString.split('T')[0]
            const [y, m, d] = datePart.split('-')
            return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`
        } catch { return dateString }
    }

    if (loading) return <div className={css({ display: 'flex', h: '100vh', alignItems: 'center', justifyContent: 'center' })}>불러오는 중...</div>
    if (error) return <div className={css({ display: 'flex', h: '100vh', alignItems: 'center', justifyContent: 'center', color: 'red' })}>{error}</div>

    if (shareInfo?.share_type === 'password' && !isAuthorized) {
        return (
            <div className={css({ display: 'flex', h: '100vh', alignItems: 'center', justifyContent: 'center', bg: '#f8f9fa' })}>
                <div className={css({ bg: 'white', p: '40px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', w: '100%', maxW: '400px', textAlign: 'center' })}>
                    <Lock size={48} className={css({ mx: 'auto', mb: '20px', color: '#2EC4B6' })} />
                    <h1 className={css({ fontSize: '20px', fontWeight: '700', mb: '8px' })}>비밀번호 보호됨</h1>
                    <p className={css({ fontSize: '14px', color: '#666', mb: '24px' })}>이 일정을 보려면 비밀번호를 입력해주세요.</p>
                    <form onSubmit={handlePasswordSubmit}>
                        <input
                            type="password"
                            value={passwordInput}
                            onChange={e => setPasswordInput(e.target.value)}
                            placeholder="비밀번호 입력"
                            className={css({ w: '100%', p: '14px', bg: '#f1f3f4', border: 'none', borderRadius: '16px', mb: '16px', outline: 'none' })}
                        />
                        <button className={css({ w: '100%', p: '14px', bg: '#2EC4B6', color: 'white', borderRadius: '16px', fontWeight: 'bold', boxShadow: '0 8px 20px rgba(46, 196, 182, 0.2)' })}>확인</button>
                    </form>
                </div>
            </div>
        )
    }

    const groupedPlans: Record<string, { label: string; dateStr: string; plans: any[] }> = {}
    plans.forEach(plan => {
        const rawDate = plan.start_datetime_local.replace(' ', 'T').split('T')[0]
        const [y, m, d] = rawDate.split('-')
        const label = `${y}년 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일`
        if (!groupedPlans[rawDate]) groupedPlans[rawDate] = { label, dateStr: rawDate, plans: [] }
        groupedPlans[rawDate].plans.push(plan)
    })
    const sortedDays = Object.values(groupedPlans).sort((a, b) => a.dateStr.localeCompare(b.dateStr))

    return (
        <div className={css({ maxW: '800px', mx: 'auto', p: { base: '24px 20px', sm: '40px 24px' }, bg: 'white', minH: '100vh' })}>
            <div className={css({ mb: '48px', textAlign: 'left', borderBottom: '1px solid #EEEEEE', pb: '32px' })}>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '8px', mb: '20px' })}>
                    <div className={css({ w: '32px', h: '32px', bg: 'brand.primary', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '18px' })}>O</div>
                    <span className={css({ fontSize: '16px', fontWeight: '700', color: '#222', letterSpacing: '-0.5px' })}>온여정</span>
                </div>
                
                <h1 className={css({ 
                    fontSize: { base: '30px', sm: '40px' }, 
                    fontWeight: '700', 
                    mb: '16px', 
                    color: '#222',
                    lineHeight: 1.1,
                    letterSpacing: '-1.5px'
                })}>
                    {trip?.destination ? `${trip.destination} 여행 일정` : '공유된 여행 일정'}
                </h1>

                <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '16px', color: '#717171', fontSize: '15px', fontWeight: '500' })}>
                    {trip?.start_date && (
                        <span className={css({ display: 'flex', alignItems: 'center', gap: '6px' })}>
                            <Calendar size={18} /> {formatDate(trip.start_date)} ~ {formatDate(trip.end_date)}
                        </span>
                    )}
                    {trip?.destination && (
                        <span className={css({ display: 'flex', alignItems: 'center', gap: '6px' })}>
                            <MapPin size={18} /> {trip.destination}
                        </span>
                    )}
                </div>
            </div>

            <div className={css({ display: 'flex', flexDirection: 'column', gap: '32px' })}>
                {plans.length === 0 ? (
                    <div className={css({ textAlign: 'center', py: '60px', color: '#717171' })}>등록된 일정이 없습니다.</div>
                ) : (
                    sortedDays.map(dayGroup => (
                        <div key={dayGroup.dateStr} className={css({ display: 'flex', flexDirection: 'column' })}>
                            <div className={css({
                                display: 'flex', alignItems: 'center', gap: '8px', 
                                pb: '12px', mb: '4px', 
                                borderBottom: '2px solid #2EC4B6',
                                color: '#2EC4B6', fontWeight: '700', fontSize: '18px'
                            })}>
                                <Calendar size={20} />
                                {dayGroup.label}
                            </div>
                            
                            {dayGroup.plans.map((plan) => (
                                <SharePlanCard key={plan.id} plan={plan} formatLocalTime={formatLocalTime} formatDate={formatDate} />
                            ))}
                        </div>
                    ))
                )}
            </div>

            <div className={css({ mt: '80px', pt: '40px', borderTop: '1px solid #EEEEEE', textAlign: 'center' })}>
                <p className={css({ color: '#717171', fontSize: '15px', mb: '20px', fontWeight: '500' })}>나만의 멋진 여행 계획을 세우고 싶다면?</p>
                <a href="/" className={css({ 
                    px: '32px', py: '16px', bg: 'brand.primary', color: 'white', borderRadius: '16px', 
                    fontWeight: '700', textDecoration: 'none', display: 'inline-block',
                    boxShadow: '0 8px 16px rgba(46, 196, 182, 0.2)',
                    transition: 'all 0.2s',
                    _active: { transform: 'scale(0.96)' }
                })}>온여정 시작하기</a>
            </div>
        </div>
    )
}
