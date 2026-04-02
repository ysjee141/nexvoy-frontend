'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { X, MapPin, CalendarDays, ChevronRight, Plus, Check } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useUIStore } from '@/stores/useUIStore'
import { CacheUtil } from '@/utils/cache'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface Trip {
    id: string
    destination: string
    start_date: string
    end_date: string
    user_id: string
}

export default function TripSwitcherModal() {
    const { isTripSwitcherOpen, setIsTripSwitcherOpen, setMobileTitle } = useUIStore()
    const searchParams = useSearchParams()
    const currentTripId = searchParams.get('id')
    
    const [ongoing, setOngoing] = useState<Trip[]>([])
    const [upcoming, setUpcoming] = useState<Trip[]>([])
    const [completed, setCompleted] = useState<Trip[]>([])
    const [activeTab, setActiveTab] = useState<'ongoing' | 'upcoming' | 'completed'>('ongoing')
    const [loading, setLoading] = useState(true)
    
    // 드래그 제스처 상태
    const [dragY, setDragY] = useState(0)
    const [startY, setStartY] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [closing, setClosing] = useState(false)
    const [scrollTop, setScrollTop] = useState(0)

    const handleClose = () => {
        setClosing(true)
        // 애니메이션 완료 후 스토어 상태 변경 (200ms 후)
        setTimeout(() => {
            setIsTripSwitcherOpen(false)
            setClosing(false)
            setDragY(0)
        }, 200)
    }

    useEffect(() => {
        if (isTripSwitcherOpen) {
            setClosing(false)
            setDragY(0)
            const timer = setTimeout(() => setMounted(true), 10)
            return () => clearTimeout(timer)
        } else {
            setMounted(false)
        }
    }, [isTripSwitcherOpen])

    useEffect(() => {
        if (!isTripSwitcherOpen) return

        const processTrips = (allTrips: Trip[]) => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            const ong = allTrips.filter((t) => {
                const start = new Date(t.start_date)
                const end = new Date(t.end_date)
                start.setHours(0, 0, 0, 0)
                end.setHours(23, 59, 59, 999)
                return start <= today && today <= end
            })

            const upc = allTrips.filter((t) => {
                const start = new Date(t.start_date)
                start.setHours(0, 0, 0, 0)
                return start > today
            })

            const com = allTrips.filter((t) => {
                const end = new Date(t.end_date)
                end.setHours(23, 59, 59, 999)
                return end < today
            })

            setOngoing(ong)
            setUpcoming(upc)
            setCompleted(com)

            // 데이터가 있는 탭으로 자동 이동 (우선순위: 진행 > 예정 > 완료)
            if (ong.length > 0) setActiveTab('ongoing')
            else if (upc.length > 0) setActiveTab('upcoming')
            else if (com.length > 0) setActiveTab('completed')
        }

        async function fetchTrips() {
            setLoading(true)
            const supabase = createClient()
            
            // 1. 캐시 시도
            try {
                const cached = await CacheUtil.get<Trip[]>('offline_home_all_trips')
                if (cached) {
                    processTrips(cached)
                }
            } catch (e) {
                console.warn('Cache load failed', e)
            }

            // 2. 네트워크 페칭
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setLoading(false)
                return
            }

            const { data: memberTripData } = await supabase
                .from('trip_members')
                .select('trip_id')
                .eq('user_id', user.id)
                .eq('status', 'accepted')

            const memberTripIds = memberTripData?.map((m: { trip_id: string }) => m.trip_id) || []

            let query = supabase
                .from('trips')
                .select('*')

            if (memberTripIds.length > 0) {
                query = query.or(`user_id.eq.${user.id},id.in.(${memberTripIds.join(',')})`)
            } else {
                query = query.eq('user_id', user.id)
            }

            const { data: trips } = await query.order('start_date', { ascending: true })
            if (trips) {
                processTrips(trips as Trip[])
                await CacheUtil.set('offline_home_all_trips', trips)
            }
            setLoading(false)
        }

        fetchTrips()
    }, [isTripSwitcherOpen])

    if (!isTripSwitcherOpen) return null

    const tabs = [
        { id: 'ongoing', label: '진행 중', count: ongoing.length },
        { id: 'upcoming', label: '예정된', count: upcoming.length },
        { id: 'completed', label: '지난 여행', count: completed.length },
    ] as const

    const currentList = activeTab === 'ongoing' ? ongoing : activeTab === 'upcoming' ? upcoming : completed

    const handleTouchStart = (e: React.TouchEvent) => {
        // 드래그 시작 시점 기록
        setStartY(e.touches[0].clientY)
        setIsDragging(true)
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return
        const deltaY = e.touches[0].clientY - startY
        
        // 스크롤 가드: 리스트가 맨 위가 아니거나, 위로 드래그하는 경우 무시
        if (scrollTop > 5 && deltaY > 0) return
        
        if (deltaY > 0) {
            // 드래그 중인 경우 기본 스크롤 방지
            if (e.cancelable) e.preventDefault()
            setDragY(deltaY)
        }
    }

    const handleTouchEnd = () => {
        if (!isDragging) return
        setIsDragging(false)
        
        if (dragY > 100) {
            handleClose()
        } else {
            setDragY(0)
        }
    }

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop)
    }

    return (
        <div className={css({
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            top: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            animation: closing ? 'fadeOut 0.2s ease-in forwards' : 'fadeIn 0.2s ease-out',
        })}>
            <div 
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={css({
                    bg: 'white',
                    w: '100%',
                    maxW: '500px',
                    h: '85vh',
                    borderTopRadius: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.1)',
                    position: 'relative',
                    // 진입/퇴장/드래그 상태에 따른 애니메이션 처리
                    animation: closing ? 'slideDown 0.2s cubic-bezier(0.2, 0, 0, 1) forwards' : 
                              !mounted ? 'slideUp 0.3s cubic-bezier(0.2, 0, 0, 1)' : 'none',
                    overflow: 'hidden',
                    pb: 'calc(20px + env(safe-area-inset-bottom))',
                    transform: `translateY(${dragY}px)`,
                    transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
                })}
            >
                {/* 상단 드래그 핸들 영역 */}
                <div className={css({ 
                    w: '100%', py: '14px', display: 'flex', justifyContent: 'center', 
                    cursor: 'ns-resize',
                    touchAction: 'none' // 핸들바는 즉시 반응하도록
                })}>
                    <div className={css({ 
                        w: '40px', h: '5px', bg: '#ddd', borderRadius: '5px'
                    })} />
                </div>
                {/* 헤더 */}
                <div className={css({ 
                    p: '20px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderBottom: '1px solid #f0f0f0'
                })}>
                    <h3 className={css({ fontSize: '18px', fontWeight: '800', color: '#111' })}>여정 전환하기</h3>
                    <button 
                        onClick={handleClose}
                        className={css({ p: '8px', borderRadius: '50%', bg: '#f5f5f5', color: '#555' })}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 탭 네비게이션 */}
                <div className={css({ 
                    px: '20px', 
                    pt: '16px', 
                    display: 'flex', 
                    gap: '8px',
                    borderBottom: '1px solid #f0f0f0',
                    bg: 'white'
                })}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={css({
                                pb: '12px',
                                px: '4px',
                                fontSize: '15px',
                                fontWeight: activeTab === tab.id ? '800' : '500',
                                color: activeTab === tab.id ? 'brand.primary' : '#888',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'color 0.2s',
                                _after: {
                                    content: '""',
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    h: '3px',
                                    bg: 'brand.primary',
                                    borderRadius: '3px 3px 0 0',
                                    transform: activeTab === tab.id ? 'scaleX(1)' : 'scaleX(0)',
                                    transition: 'transform 0.2s ease-out'
                                }
                            })}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={css({ 
                                    ml: '4px', 
                                    fontSize: '12px', 
                                    opacity: 0.8,
                                    color: activeTab === tab.id ? 'brand.primary' : '#aaa'
                                })}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* 리스트 영역 */}
                <div 
                    onScroll={handleScroll}
                    className={css({ 
                        flex: 1, 
                        overflowY: 'auto', 
                        px: '20px', 
                        py: '10px',
                        // 스크롤 최상단일 때만 터치 이벤트 전파 방지
                        touchAction: scrollTop === 0 ? 'pan-x' : 'auto'
                    })}
                >
                    {loading ? (
                        <div className={css({ py: '40px', textAlign: 'center', color: '#999' })}>
                            여정을 불러오는 중이에요... ✈️
                        </div>
                    ) : currentList.length === 0 ? (
                        <div className={css({ 
                            py: '60px', 
                            textAlign: 'center', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            gap: '12px' 
                        })}>
                            <div className={css({ fontSize: '40px' })}>🏜️</div>
                            <p className={css({ fontSize: '15px', color: '#666', fontWeight: '500' })}>
                                해당되는 여정이 없네요!
                            </p>
                        </div>
                    ) : (
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                            {currentList.map((trip) => {
                                const isActive = currentTripId === trip.id
                                const start = new Date(trip.start_date).toLocaleDateString()
                                const end = new Date(trip.end_date).toLocaleDateString()

                                return (
                                    <Link
                                        key={trip.id}
                                        href={`/trips/detail?id=${trip.id}`}
                                        onClick={() => {
                                            setMobileTitle(trip.destination)
                                            handleClose()
                                        }}
                                        className={css({
                                            display: 'flex',
                                            alignItems: 'center',
                                            p: '16px',
                                            bg: isActive ? '#f0f7ff' : 'white',
                                            borderRadius: '16px',
                                            border: '1px solid',
                                            borderColor: isActive ? '#3B82F6' : '#eee',
                                            transition: 'all 0.2s',
                                            _active: { transform: 'scale(0.98)' },
                                        })}
                                    >
                                        <div className={css({ 
                                            w: '40px', h: '40px', borderRadius: '12px', 
                                            bg: isActive ? 'brand.primary' : '#f5f5f5',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            mr: '12px', flexShrink: 0
                                        })}>
                                            <MapPin size={20} color={isActive ? 'white' : '#888'} />
                                        </div>
                                        <div className={css({ flex: 1, minW: 0 })}>
                                            <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', mb: '4px' })}>
                                                <h4 className={css({ 
                                                    fontSize: '16px', fontWeight: '700', color: '#111',
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                })}>
                                                    {trip.destination}
                                                </h4>
                                                {isActive && (
                                                    <span className={css({ 
                                                        bg: 'brand.primary', color: 'white', fontSize: '10px', 
                                                        px: '6px', py: '2px', borderRadius: '4px', fontWeight: '800'
                                                    })}>현재</span>
                                                )}
                                            </div>
                                            <p className={css({ fontSize: '13px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' })}>
                                                <CalendarDays size={13} /> {start} ~ {end}
                                            </p>
                                        </div>
                                        {isActive ? (
                                            <Check size={20} color="#3B82F6" className={css({ ml: '12px' })} />
                                        ) : (
                                            <ChevronRight size={20} color="#ccc" className={css({ ml: '12px' })} />
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* 하단 버튼 */}
                <div className={css({ 
                    p: '20px', 
                    pb: 'calc(24px + env(safe-area-inset-bottom))',
                    borderTop: '1px solid #f0f0f0', 
                    bg: 'white' 
                })}>
                    <Link
                        href="/trips/new"
                        onClick={handleClose}
                        className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            w: '100%',
                            py: '16px',
                            bg: '#111',
                            color: 'white',
                            borderRadius: '16px',
                            fontWeight: '800',
                            fontSize: '16px',
                            textDecoration: 'none',
                        })}
                    >
                        <Plus size={20} /> 새 여정 만들기
                    </Link>
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}

// 애니메이션 스타일 정의
const injectStyles = () => {
    if (typeof document === 'undefined') return
    const styleId = 'trip-switcher-animations'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.innerHTML = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }
        @keyframes slideDown {
            from { transform: translateY(0); }
            to { transform: translateY(100%); }
        }
    `
    document.head.appendChild(style)
}

injectStyles()
