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
                    mb: '0',
                    position: 'sticky',
                    top: { 
                        base: 'calc(56px + max(env(safe-area-inset-top), var(--safe-area-inset-top)))',
                        sm: '64px' 
                    },
                    bg: 'white',
                    borderBottom: '1px solid',
                    borderColor: 'brand.border',
                    zIndex: 100,
                    pt: '4px',
                    transition: 'all 0.3s ease',
                })}
            >
                <div className={css({ 
                    display: 'flex', 
                    gap: '32px',
                    px: { base: '16px', sm: '0' }
                })}>
                    <button
                        onClick={() => handleTabChange('plans')}
                        className={css({
                            display: 'flex', alignItems: 'center', gap: '8px', px: '4px', h: '48px',
                            cursor: 'pointer', border: 'none', bg: 'transparent',
                            color: activeTab === 'plans' ? 'brand.primary' : 'brand.muted',
                            fontWeight: '700',
                            fontSize: '15px',
                            position: 'relative',
                            transition: 'all 0.2s',
                            _after: {
                                content: '""',
                                position: 'absolute',
                                bottom: '0',
                                left: '0',
                                right: '0',
                                h: '3px',
                                bg: activeTab === 'plans' ? 'brand.primary' : 'transparent',
                                borderRadius: '3px 3px 0 0'
                            },
                            _active: { transform: 'scale(0.96)' },
                        })}
                    >
                        <Calendar size={18} strokeWidth={activeTab === 'plans' ? 2.5 : 2} /> 일정표
                    </button>
                    <button
                        onClick={() => handleTabChange('checklist')}
                        className={css({
                            display: 'flex', alignItems: 'center', gap: '8px', px: '4px', h: '48px',
                            cursor: 'pointer', border: 'none', bg: 'transparent',
                            color: activeTab === 'checklist' ? 'brand.primary' : 'brand.muted',
                            fontWeight: '700',
                            fontSize: '15px',
                            position: 'relative',
                            transition: 'all 0.2s',
                            _after: {
                                content: '""',
                                position: 'absolute',
                                bottom: '0',
                                left: '0',
                                right: '0',
                                h: '3px',
                                bg: activeTab === 'checklist' ? 'brand.primary' : 'transparent',
                                borderRadius: '3px 3px 0 0'
                            },
                            _active: { transform: 'scale(0.96)' },
                        })}
                    >
                        <ListChecks size={18} strokeWidth={activeTab === 'checklist' ? 2.5 : 2} /> 준비물
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
