'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { ChevronLeft, CalendarDays, MapPin, Sparkles, TrendingUp, Clock } from 'lucide-react'
import { formatDate } from '@/utils/date'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Skeleton from '@/components/ui/Skeleton'
import CommonListSkeleton from '@/components/common/CommonListSkeleton'

interface Trip {
    id: string
    destination: string
    start_date: string
    end_date: string
}

export default function TravelLogPage() {
    const supabase = createClient()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalDays: 0,
        completedCount: 0,
        longestTrip: 0,
        uniqueDestinations: 0,
        pastTrips: [] as Trip[],
        upcomingTrips: [] as Trip[]
    })

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
                    
                    const diffTime = end.getTime() - start.getTime()
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
                    
                    if (end < today) {
                        totalDays += diffDays
                        completedCount++
                        if (diffDays > longestDays) longestDays = diffDays
                        destinations.add(t.destination)
                    }
                })

                const pastTrips = trips.filter((t: any) => new Date(t.end_date) < today)
                const upcomingTrips = trips.filter((t: any) => new Date(t.end_date) >= today)
                    .sort((a: Trip, b: Trip) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

                setStats({
                    totalDays,
                    completedCount,
                    longestTrip: longestDays,
                    uniqueDestinations: destinations.size,
                    pastTrips: pastTrips as Trip[],
                    upcomingTrips: upcomingTrips as Trip[]
                })
            }
            setLoading(false)
        }

        fetchStats()
    }, [supabase])

    if (loading) return (
        <div className={css({ maxW: '800px', mx: 'auto', p: '24px' })}>
            <Skeleton width="150px" height="24px" className={css({ mb: '32px' })} />
            <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', mb: '40px' })}>
                <Skeleton height="100px" borderRadius="20px" />
                <Skeleton height="100px" borderRadius="20px" />
            </div>
            <Skeleton width="120px" height="20px" className={css({ mb: '16px' })} />
            <CommonListSkeleton count={3} height="80px" gap="12px" />
        </div>
    )

    return (
        <div className={css({ 
            // RootLayout의 maxW(1280px)와 패딩을 무시하고 브라우저 좌우 끝까지 배경색 확장 (Breakout 전략)
            position: 'relative',
            left: '50%',
            right: '50%',
            marginLeft: '-50vw',
            marginRight: '-50vw',
            width: '100vw',
            // 상단 Header와의 간격을 없애기 위해 부모의 pt 상쇄
            marginTop: { 
                base: '-calc(64px + env(safe-area-inset-top))', 
                md: '-calc(88px + env(safe-area-inset-top))' 
            },
            paddingTop: { 
                base: 'calc(64px + env(safe-area-inset-top))', 
                md: 'calc(88px + env(safe-area-inset-top))' 
            },
            minH: 'calc(100vh - 60px)', 
            bg: '#F9FAFB', 
            pb: '80px' 
        })}>
            {/* 실제 컨텐츠는 기존처럼 720px로 정렬 */}
            <div className={css({ maxW: '720px', mx: 'auto' })}>
                <main className={css({ px: '20px', pt: '32px' })}>
                    {/* Intro Section */}
                    <div className={css({ mb: '40px', textAlign: 'center' })}>
                        <div className={css({ 
                            display: 'inline-flex', p: '14px', bg: 'white', borderRadius: '28px', 
                            boxShadow: '0 12px 30px rgba(0,0,0,0.06)', mb: '24px' 
                        })}>
                            <Sparkles size={34} color="#F59E0B" />
                        </div>
                        <h2 className={css({ fontSize: '26px', fontWeight: '850', color: '#111', mb: '10px', letterSpacing: '-0.5px' })}>
                            당신이 보낸 {stats.totalDays}일의 시간들
                        </h2>
                        <p className={css({ fontSize: '16px', color: '#666', lineHeight: '1.6', fontWeight: '500' })}>
                            지나온 여정 하나하나가 소중한 추억이 되어<br />
                            당신의 인생이라는 지도를 채워가고 있습니다.
                        </p>
                    </div>

                    {/* Key Stats Grid */}
                    <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', mb: '48px' })}>
                        <div className={css({ bg: 'white', p: '24px', borderRadius: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #F3F4F6' })}>
                            <div className={css({ color: '#3B82F6', mb: '14px' })}><TrendingUp size={22} /></div>
                            <div className={css({ fontSize: '22px', fontWeight: '850', color: '#111' })}>{stats.completedCount}번</div>
                            <div className={css({ fontSize: '14px', color: '#888', mt: '4px', fontWeight: '500' })}>완료한 여정</div>
                        </div>
                        <div className={css({ bg: 'white', p: '24px', borderRadius: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #F3F4F6' })}>
                            <div className={css({ color: '#10B981', mb: '14px' })}><Clock size={22} /></div>
                            <div className={css({ fontSize: '22px', fontWeight: '850', color: '#111' })}>{stats.longestTrip}일</div>
                            <div className={css({ fontSize: '14px', color: '#888', mt: '4px', fontWeight: '500' })}>가장 길었던 여정</div>
                        </div>
                    </div>

                    {/* Memories Section */}
                    <section className={css({ mb: '48px' })}>
                        <h3 className={css({ 
                            fontSize: '19px', fontWeight: '700', mb: '20px', color: '#1A1A1A', 
                            display: 'flex', alignItems: 'center', gap: '10px' 
                        })}>
                            <CalendarDays size={22} color="#4B5563" /> 추억의 조각들
                        </h3>
                        
                        {stats.pastTrips.length === 0 ? (
                            <div className={css({ 
                                textAlign: 'center', py: '40px', bg: 'white', borderRadius: '20px', 
                                border: '1px dashed #DDD', color: '#999', fontSize: '14px' 
                            })}>
                                아직 완료된 여정이 없습니다.
                            </div>
                        ) : (
                            <div className={css({ display: 'flex', flexDirection: 'column', gap: '14px' })}>
                                {stats.pastTrips.map((trip, index) => {
                                    const start = formatDate(trip.start_date)
                                    const end = formatDate(trip.end_date)
                                    const isLast = index === stats.pastTrips.length - 1

                                    return (
                                        <Link 
                                            key={trip.id} 
                                            href={`/trips/detail?id=${trip.id}`}
                                            className={css({
                                                display: 'block', bg: 'white', p: '18px', borderRadius: '20px',
                                                border: '1px solid #E5E7EB', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                                position: 'relative',
                                                _hover: { borderColor: '#3B82F6', transform: 'translateY(-2px)', boxShadow: '0 8px 20px rgba(59, 130, 246, 0.08)' }
                                            })}
                                        >
                                            <div className={css({ display: 'flex', alignItems: 'flex-start', gap: '14px' })}>
                                                <div className={css({ 
                                                    w: '44px', h: '44px', bg: '#EFF6FF', borderRadius: '14px', 
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                                                })}>
                                                    <MapPin size={22} color="#3B82F6" />
                                                </div>
                                                <div className={css({ flex: 1, minW: 0 })}>
                                                    <div className={css({ fontSize: '17px', fontWeight: '750', color: '#111', mb: '4px', truncate: true })}>{trip.destination}</div>
                                                    <div className={css({ fontSize: '14px', color: '#6B7280', fontWeight: '500' })}>{start} ~ {end}</div>
                                                </div>
                                            </div>
                                            {!isLast && (
                                                <div className={css({ 
                                                    position: 'absolute', left: '42px', bottom: '-14px', 
                                                    w: '1px', h: '14px', bg: '#E5E7EB', zIndex: 0 
                                                })} />
                                            )}
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </section>

                    {/* Upcoming Section */}
                    <section>
                        <h3 className={css({ 
                            fontSize: '19px', fontWeight: '700', mb: '20px', color: '#1A1A1A', 
                            display: 'flex', alignItems: 'center', gap: '10px' 
                        })}>
                            <Sparkles size={22} color="#F59E0B" /> 아직 두근거리는 여행이 기다리고 있어요
                        </h3>

                        {stats.upcomingTrips.length === 0 ? (
                            <div className={css({ 
                                textAlign: 'center', py: '60px', bg: 'white', borderRadius: '24px', 
                                border: '1px dashed #D1D5DB', color: '#6B7280'
                            })}>
                                <p className={css({ mb: '16px', fontSize: '15px' })}>새로운 모험을 떠날 준비가 되셨나요?</p>
                                <Link 
                                    href="/trips" 
                                    className={css({ 
                                        display: 'inline-flex', px: '20px', py: '10px', bg: '#3B82F6', 
                                        color: 'white', borderRadius: '12px', fontWeight: '700', fontSize: '14px',
                                        _hover: { bg: '#2563EB', transform: 'scale(1.02)' },
                                        transition: 'all 0.2s'
                                    })}
                                >
                                    여행 계획하러 가기
                                </Link>
                            </div>
                        ) : (
                            <div className={css({ display: 'flex', flexDirection: 'column', gap: '14px' })}>
                                {stats.upcomingTrips.map((trip) => {
                                    const start = new Date(trip.start_date)
                                    const end = new Date(trip.end_date)
                                    const today = new Date()
                                    today.setHours(0, 0, 0, 0)
                                    
                                    const isOngoing = start <= today && today <= end
                                    const startDateStr = formatDate(trip.start_date)
                                    const endDateStr = formatDate(trip.end_date)

                                    return (
                                        <Link 
                                            key={trip.id} 
                                            href={`/trips/detail?id=${trip.id}`}
                                            className={css({
                                                display: 'block', bg: isOngoing ? '#FFFBEB' : 'white', p: '18px', borderRadius: '20px',
                                                border: '1px solid', borderColor: isOngoing ? '#FEF3C7' : '#E5E7EB', 
                                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                                _hover: { 
                                                    borderColor: isOngoing ? '#F59E0B' : '#3B82F6', 
                                                    transform: 'translateY(-2px)',
                                                    boxShadow: isOngoing ? '0 8px 20px rgba(245, 158, 11, 0.1)' : '0 8px 20px rgba(59, 130, 246, 0.08)'
                                                }
                                            })}
                                        >
                                            <div className={css({ display: 'flex', alignItems: 'center', gap: '14px' })}>
                                                <div className={css({ 
                                                    w: '44px', h: '44px', bg: isOngoing ? '#FEF3C7' : '#F3F4F6', borderRadius: '14px', 
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                                                })}>
                                                    <Sparkles size={22} color={isOngoing ? '#D97706' : '#6B7280'} />
                                                </div>
                                                <div className={css({ flex: 1, minW: 0 })}>
                                                    <div className={css({ display: 'flex', alignItems: 'center', gap: '8px', mb: '4px' })}>
                                                        <div className={css({ fontSize: '17px', fontWeight: '750', color: '#111', truncate: true })}>
                                                            {trip.destination}
                                                        </div>
                                                        {isOngoing && (
                                                            <span className={css({ 
                                                                px: '8px', py: '2px', bg: '#D97706', color: 'white', 
                                                                fontSize: '11px', fontWeight: '700', borderRadius: '6px',
                                                                animation: 'pulse 2s infinite'
                                                            })}>
                                                                여행 중
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className={css({ fontSize: '14px', color: '#6B7280', fontWeight: '500' })}>
                                                        {startDateStr} ~ {endDateStr}
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </div>
    )
}
