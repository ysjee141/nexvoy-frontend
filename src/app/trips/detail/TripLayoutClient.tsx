'use client'

import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { ArrowLeft, Calendar, ListChecks } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import TripHeaderActions from '@/components/trips/TripHeaderActions'
import { useEffect, useState } from 'react'
import { analytics } from '@/services/AnalyticsService'
import TripClient from './TripClient'
import ChecklistClient from '../checklist/ChecklistClient'
import { useUIStore } from '@/stores/useUIStore'
import { CacheUtil } from '@/utils/cache'

export default function TripLayoutClient() {
    const searchParams = useSearchParams()
    const id = searchParams.get('id')
    const initialTab = searchParams.get('tab') === 'checklist' ? 'checklist' : 'plans'
    const router = useRouter()
    const supabase = createClient()

    const [trip, setTrip] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'plans' | 'checklist'>(initialTab)
    const { setMobileTitle } = useUIStore()

    useEffect(() => {
        const urlTab = searchParams.get('tab')
        if (urlTab === 'checklist' || urlTab === 'plans') {
            setActiveTab(urlTab)
        }
    }, [searchParams])

    const handleTabChange = (tab: 'plans' | 'checklist') => {
        if (tab !== activeTab) {
            analytics.logTabSwitch(activeTab, tab)
            // 탭 전환 시 페이지 최상단으로 부드럽게 스크롤
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
        setActiveTab(tab)
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', tab)
        window.history.replaceState(null, '', `?${params.toString()}`)
    }

    useEffect(() => {
        if (trip?.destination) {
            setMobileTitle(trip.destination)
        }
        return () => setMobileTitle(null)
    }, [trip, setMobileTitle])

    useEffect(() => {
        async function fetchTrip() {
            if (!id) return;
            
            try {
                // 1. 캐시에서 먼저 로드 (화면 깜빡임 방지용)
                const cachedTrip = await CacheUtil.get<any>(`trip_${id}`)
                if (cachedTrip) {
                    setTrip(cachedTrip)
                    setLoading(false)
                }

                // 2. 인증 세션 확인 (오프라인 대응)
                const { data: { session } } = await supabase.auth.getSession()
                let currentUser = session?.user

                if (!currentUser) {
                    currentUser = await CacheUtil.getAuthUser()
                }

                if (!currentUser) {
                    router.push('/login')
                    return
                }
                
                // 3. 서버에서 최신 데이터 가져오기
                const { data, error } = await supabase
                    .from('trips')
                    .select('*')
                    .eq('id', id)
                    .single()

                if (error) throw error

                if (!data) {
                    router.replace('/404')
                } else {
                    setTrip(data)
                    await CacheUtil.set(`trip_${id}`, data) // 캐시 업데이트
                }
            } catch (err) {
                console.error('Failed to fetch trip:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchTrip()
    }, [id, supabase, router])

    if (loading) {
        return <div className={css({ w: '100%', py: '40px', textAlign: 'center', color: '#888' })}>여행 정보를 불러오는 중...</div>
    }

    if (!trip || !id) return null;

    return (
        <div className={css({ w: '100%', py: '16px' })}>

            {/* 여행 정보 헤더 (온여정 스타일) */}
            <div className={css({
                mb: '8px',
                pb: '16px',
                borderBottom: '1px solid #EEEEEE'
            })}>
                {/* 제목, 날짜·인원 표시 + 수정/삭제 아이콘 (통합 레이아웃) */}
                <TripHeaderActions
                    trip={trip}
                    onUpdate={(updated) => setTrip((prev: any) => ({ ...prev, ...updated }))}
                />
            </div>

            {/* Tab Navigation (Segmented Pill Style) */}
            <div
                className={css({
                    display: 'flex',
                    justifyContent: { base: 'center', sm: 'flex-start' },
                    mb: '-12px',
                    position: 'sticky',
                    top: { 
                        base: 'calc(56px + env(safe-area-inset-top))', // Accounting for safe area on Android/iOS
                        sm: '64px' 
                    },
                    bg: 'linear-gradient(to bottom, #FBFBF9 0%, #FBFBF9 80%, rgba(251, 251, 249, 0) 100%)', // Smoother transition
                    backdropFilter: 'blur(8px)', // Slightly reduced blur for better mobile performance and soft look
                    zIndex: 100,
                    pt: '12px',
                    pb: '24px', // Extra bottom padding for the gradient fade
                    mx: '0', 
                    px: '0',
                    transition: 'all 0.3s ease',
                })}
            >
                <div className={css({ 
                    display: 'flex', 
                    bg: '#EEEEEE', 
                    p: '4px', 
                    borderRadius: '20px', 
                    gap: '4px',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
                })}>
                    <button
                        onClick={() => handleTabChange('plans')}
                        className={css({
                            display: 'flex', alignItems: 'center', gap: '8px', px: '24px', h: '42px',
                            bg: activeTab === 'plans' ? 'white' : 'transparent',
                            cursor: 'pointer', border: 'none',
                            color: activeTab === 'plans' ? 'brand.secondary' : '#717171',
                            fontWeight: '700',
                            fontSize: '14px',
                            borderRadius: '16px',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: activeTab === 'plans' ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                            _active: { transform: 'scale(0.96)' },
                            _hover: { color: activeTab === 'plans' ? 'brand.secondary' : '#333' },
                        })}
                    >
                        <Calendar size={18} strokeWidth={activeTab === 'plans' ? 2.5 : 2} /> <span className={css({ mt: '1px' })}>일정표</span>
                    </button>
                    <button
                        onClick={() => handleTabChange('checklist')}
                        className={css({
                            display: 'flex', alignItems: 'center', gap: '8px', px: '24px', h: '42px',
                            bg: activeTab === 'checklist' ? 'white' : 'transparent',
                            cursor: 'pointer', border: 'none',
                            color: activeTab === 'checklist' ? 'brand.secondary' : '#717171',
                            fontWeight: '700',
                            fontSize: '14px',
                            borderRadius: '16px',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: activeTab === 'checklist' ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                            _active: { transform: 'scale(0.96)' },
                            _hover: { color: activeTab === 'checklist' ? 'brand.secondary' : '#333' },
                        })}
                    >
                        <ListChecks size={18} strokeWidth={activeTab === 'checklist' ? 2.5 : 2} /> <span className={css({ mt: '1px' })}>준비물</span>
                    </button>
                </div>
            </div>

            {/* 하위 컨텐츠 전환 영역 (언마운트 하지 않고 display none으로 유지하여 상태 보존 및 즉각 전환) */}
            <div>
                <div style={{ display: activeTab === 'plans' ? 'block' : 'none' }}>
                    <TripClient isActive={activeTab === 'plans'} />
                </div>
                <div style={{ display: activeTab === 'checklist' ? 'block' : 'none' }}>
                    <ChecklistClient isActive={activeTab === 'checklist'} />
                </div>
            </div>
        </div>
    )
}
