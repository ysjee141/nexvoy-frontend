'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Globe, Lock, Calendar, MapPin, Clock, BadgeCheck } from 'lucide-react'

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
            .select('*')
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
                    <Lock size={48} className={css({ mx: 'auto', mb: '20px', color: '#4285F4' })} />
                    <h1 className={css({ fontSize: '20px', fontWeight: '800', mb: '8px' })}>비밀번호 보호됨</h1>
                    <p className={css({ fontSize: '14px', color: '#666', mb: '24px' })}>이 일정을 보려면 비밀번호를 입력해주세요.</p>
                    <form onSubmit={handlePasswordSubmit}>
                        <input
                            type="password"
                            value={passwordInput}
                            onChange={e => setPasswordInput(e.target.value)}
                            placeholder="비밀번호 입력"
                            className={css({ w: '100%', p: '14px', bg: '#f1f3f4', border: 'none', borderRadius: '12px', mb: '16px', outline: 'none' })}
                        />
                        <button className={css({ w: '100%', p: '14px', bg: '#111', color: 'white', borderRadius: '12px', fontWeight: 'bold' })}>확인</button>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <div className={css({ maxW: '800px', mx: 'auto', p: '24px', bg: 'white', minH: '100vh' })}>
            <div className={css({ mb: '40px', textAlign: 'center' })}>
                <span className={css({ px: '12px', py: '6px', bg: '#e8f0fe', color: '#1a73e8', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', mb: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' })}>
                    <BadgeCheck size={14} /> Next Voyage 인증 공유 일정
                </span>
                <h1 className={css({ fontSize: '32px', fontWeight: '900', mb: '12px', color: '#111' })}>
                    {trip?.destination ? `${trip.destination} 여행` : '여행 일정'}
                </h1>
                <div className={css({ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '16px', color: '#666', fontSize: '14px' })}>
                    {trip?.start_date && (
                        <span className={css({ display: 'flex', alignItems: 'center', gap: '4px' })}>
                            <Calendar size={16} /> {formatDate(trip.start_date)} ~ {formatDate(trip.end_date)}
                        </span>
                    )}
                    {trip?.destination && (
                        <span className={css({ display: 'flex', alignItems: 'center', gap: '4px' })}>
                            <MapPin size={16} /> {trip.destination}
                        </span>
                    )}
                </div>
            </div>

            <div className={css({ display: 'flex', flexDirection: 'column', gap: '20px' })}>
                {plans.length === 0 ? (
                    <div className={css({ textAlign: 'center', py: '60px', color: '#999' })}>등록된 일정이 없습니다.</div>
                ) : (
                    plans.map((plan) => (
                        <div key={plan.id} className={css({ p: '20px', border: '1px solid #eee', borderRadius: '16px', _hover: { borderColor: '#4285F4' } })}>
                            <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '12px' })}>
                                <div>
                                    <h3 className={css({ fontSize: '18px', fontWeight: '700', mb: '4px' })}>{plan.title}</h3>
                                    <div className={css({ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' })}>
                                        <Calendar size={12} /> {formatDate(plan.start_datetime_local)}
                                    </div>
                                </div>
                                <span className={css({ fontSize: '14px', fontWeight: 'bold', color: '#4285F4', bg: '#e8f0fe', px: '10px', py: '4px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 })}>
                                    <Clock size={14} /> {formatLocalTime(plan.start_datetime_local)}
                                </span>
                            </div>
                            {plan.location && <p className={css({ fontSize: '14px', color: '#666', mb: '8px', display: 'flex', alignItems: 'center', gap: '4px' })}><MapPin size={14} /> {plan.location}</p>}
                            {plan.memo && <p className={css({ fontSize: '14px', color: '#444', bg: '#f8f9fa', p: '12px', borderRadius: '8px' })}>📝 {plan.memo}</p>}
                        </div>
                    ))
                )}
            </div>

            <div className={css({ mt: '60px', pt: '40px', borderTop: '1px solid #eee', textAlign: 'center' })}>
                <p className={css({ color: '#888', fontSize: '14px', mb: '16px' })}>나만의 멋진 여행 계획을 세우고 싶다면?</p>
                <a href="/" className={css({ px: '24px', py: '12px', bg: '#111', color: 'white', borderRadius: '12px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block' })}>Next Voyage 시작하기</a>
            </div>
        </div>
    )
}
