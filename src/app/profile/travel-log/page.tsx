'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { ChevronLeft, CalendarDays, MapPin, Sparkles, TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/stores/useUIStore'

interface Trip {
    id: string
    destination: string
    start_date: string
    end_date: string
}

export default function TravelLogPage() {
    const supabase = createClient()
    const router = useRouter()
    const { setMobileTitle } = useUIStore()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalDays: 0,
        completedCount: 0,
        longestTrip: 0,
        uniqueDestinations: 0,
        trips: [] as Trip[]
    })

    useEffect(() => {
        setMobileTitle('나의 여정 기록')
    }, [setMobileTitle])

    useEffect(() => {
        const fetchStats = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: trips } = await supabase
                .from('trips')
                .select('id, destination, start_date, end_date')
                .eq('user_id', user.id)
                .order('start_date', { ascending: false })

            if (trips) {
                const today = new Date()
                today.setHours(0, 0, 0, 0)

                let totalDays = 0
                let completedCount = 0
                let longestDays = 0
                const destinations = new Set<string>()

                trips.forEach((t: any) => {
                    const start = new Date(t.start_date)
                    const end = new Date(t.end_date)
                    
                    // 일수 계산 (시작/종료일 포함)
                    const diffTime = end.getTime() - start.getTime()
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
                    totalDays += diffDays
                    
                    if (diffDays > longestDays) longestDays = diffDays
                    if (new Date(t.end_date) < today) completedCount++
                    destinations.add(t.destination)
                })

                setStats({
                    totalDays,
                    completedCount,
                    longestTrip: longestDays,
                    uniqueDestinations: destinations.size,
                    trips: trips as Trip[]
                })
            }
            setLoading(false)
        }

        fetchStats()
    }, [supabase])

    if (loading) return (
        <div className={css({ minH: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
            <div className={css({ animation: 'pulse 1.5s infinite', fontSize: '14px', color: '#888' })}>추억을 불러오는 중...</div>
        </div>
    )

    return (
        <div className={css({ maxW: '720px', mx: 'auto', minH: 'calc(100vh - 60px)', bg: '#F9FAFB', pb: '60px' })}>
            <main className={css({ px: '20px', pt: '24px' })}>
                {/* Intro Section */}
                <div className={css({ mb: '32px', textAlign: 'center' })}>
                    <div className={css({ 
                        display: 'inline-flex', p: '12px', bg: 'white', borderRadius: '24px', 
                        boxShadow: '0 10px 25px rgba(0,0,0,0.05)', mb: '20px' 
                    })}>
                        <Sparkles size={32} color="#F59E0B" />
                    </div>
                    <h2 className={css({ fontSize: '24px', fontWeight: '800', color: '#111', mb: '8px' })}>
                        당신이 보낸 {stats.totalDays}일의 시간들
                    </h2>
                    <p className={css({ fontSize: '15px', color: '#666', lineHeight: '1.6' })}>
                        지나온 여정 하나하나가 소중한 추억이 되어<br />
                        당신의 인생이라는 지도를 채워가고 있습니다.
                    </p>
                </div>

                {/* Key Stats Grid */}
                <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', mb: '40px' })}>
                    <div className={css({ bg: 'white', p: '20px', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', border: '1px solid #F0F0F0' })}>
                        <div className={css({ color: '#3B82F6', mb: '12px' })}><TrendingUp size={20} /></div>
                        <div className={css({ fontSize: '20px', fontWeight: '800', color: '#222' })}>{stats.completedCount}번</div>
                        <div className={css({ fontSize: '13px', color: '#999', mt: '4px' })}>완료한 여정</div>
                    </div>
                    <div className={css({ bg: 'white', p: '20px', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', border: '1px solid #F0F0F0' })}>
                        <div className={css({ color: '#10B981', mb: '12px' })}><Clock size={20} /></div>
                        <div className={css({ fontSize: '20px', fontWeight: '800', color: '#222' })}>{stats.longestTrip}일</div>
                        <div className={css({ fontSize: '13px', color: '#999', mt: '4px' })}>가장 길었던 여정</div>
                    </div>
                </div>

                {/* Timeline / Journey History */}
                <section>
                    <h3 className={css({ fontSize: '18px', fontWeight: '700', mb: '16px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' })}>
                        <CalendarDays size={20} color="#666" /> 추억의 조각들
                    </h3>
                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                        {stats.trips.map((trip, index) => {
                            const start = new Date(trip.start_date).toLocaleDateString()
                            const end = new Date(trip.end_date).toLocaleDateString()
                            const isLast = index === stats.trips.length - 1

                            return (
                                <Link 
                                    key={trip.id} 
                                    href={`/trips/detail?id=${trip.id}`}
                                    className={css({
                                        display: 'block', bg: 'white', p: '16px', borderRadius: '16px',
                                        border: '1px solid #EEE', transition: 'all 0.2s',
                                        position: 'relative',
                                        _hover: { borderColor: '#3B82F6', transform: 'translateX(4px)' }
                                    })}
                                >
                                    <div className={css({ display: 'flex', alignItems: 'flex-start', gap: '12px' })}>
                                        <div className={css({ 
                                            w: '40px', h: '40px', bg: '#EFF6FF', borderRadius: '12px', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                                        })}>
                                            <MapPin size={20} color="#3B82F6" />
                                        </div>
                                        <div className={css({ flex: 1 })}>
                                            <div className={css({ fontSize: '16px', fontWeight: '700', color: '#222', mb: '4px' })}>{trip.destination}</div>
                                            <div className={css({ fontSize: '13px', color: '#888' })}>{start} ~ {end}</div>
                                        </div>
                                    </div>
                                    {/* Timeline line */}
                                    {!isLast && (
                                        <div className={css({ 
                                            position: 'absolute', left: '40px', bottom: '-12px', 
                                            w: '1px', h: '12px', bg: '#EEE', zIndex: 0 
                                        })} />
                                    )}
                                </Link>
                            )
                        })}
                    </div>
                </section>
            </main>
        </div>
    )
}
