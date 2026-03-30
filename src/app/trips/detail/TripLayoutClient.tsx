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
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }
            if (!id) return;
            const { data } = await supabase
                .from('trips')
                .select('*')
                .eq('id', id)
                .single()

            if (!data) {
                router.replace('/404')
            } else {
                setTrip(data)
            }
            setLoading(false)
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
                mb: '24px',
                pb: '20px',
                borderBottom: '1px solid #eaeaea'
            })}>
                {/* 제목, 날짜·인원 표시 + 수정/삭제 아이콘 (통합 레이아웃) */}
                <TripHeaderActions trip={trip} />
            </div>

            {/* Tab Navigation (Instant React State Switch) */}
            <div
                className={css({
                    display: 'flex',
                    gap: { base: '8px', sm: '16px' },
                    borderBottom: '1px solid #EEEEEE',
                    mb: '24px',
                    position: 'sticky',
                    top: '0',
                    bg: 'white',
                    zIndex: 20,
                    px: { base: '4px', sm: 0 },
                    mx: { base: '-20px', sm: 0 },
                    justifyContent: { base: 'center', sm: 'flex-start' }
                })}
            >
                <button
                    onClick={() => handleTabChange('plans')}
                    className={css({
                        display: 'flex', alignItems: 'center', gap: '8px', px: '20px', py: '16px',
                        bg: 'transparent',
                        cursor: 'pointer', border: 'none',
                        color: activeTab === 'plans' ? '#222' : '#717171',
                        fontWeight: '700',
                        fontSize: '15px',
                        transition: 'all 0.1s ease',
                        borderBottom: activeTab === 'plans' ? '2px solid #222' : '2px solid transparent',
                        _active: { transform: 'scale(0.96)' },
                        _hover: { color: '#000' },
                    })}
                >
                    <Calendar size={18} /> 일정표
                </button>
                <button
                    onClick={() => handleTabChange('checklist')}
                    className={css({
                        display: 'flex', alignItems: 'center', gap: '8px', px: '20px', py: '16px',
                        bg: 'transparent',
                        cursor: 'pointer', border: 'none',
                        color: activeTab === 'checklist' ? '#222' : '#717171',
                        fontWeight: '700',
                        fontSize: '15px',
                        transition: 'all 0.1s ease',
                        borderBottom: activeTab === 'checklist' ? '2px solid #222' : '2px solid transparent',
                        _active: { transform: 'scale(0.96)' },
                        _hover: { color: '#000' },
                    })}
                >
                    <ListChecks size={18} /> 준비물
                </button>
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
