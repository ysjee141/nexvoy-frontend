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

export default function TripLayoutClient() {
    const searchParams = useSearchParams()
    const id = searchParams.get('id')
    const initialTab = searchParams.get('tab') === 'checklist' ? 'checklist' : 'plans'
    const router = useRouter()
    const supabase = createClient()

    const [trip, setTrip] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'plans' | 'checklist'>(initialTab)

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
        async function fetchTrip() {
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
            {/* 뒤로 가기 링크 (모바일용) */}
            <Link
                href="/"
                className={css({
                    display: { base: 'inline-flex', sm: 'none' },
                    alignItems: 'center',
                    gap: '4px',
                    color: '#666',
                    fontSize: '14px',
                    mb: '12px',
                    _hover: { color: '#022C22' },
                })}
            >
                <ArrowLeft size={16} /> 목록으로
            </Link>

            {/* Trip Info Header (Airbnb Style) */}
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
                    gap: '16px',
                    borderBottom: '1px solid #ddd',
                    mb: '24px',
                })}
            >
                <button
                    onClick={() => handleTabChange('plans')}
                    className={css({
                        display: 'flex', alignItems: 'center', gap: '8px', px: '16px', py: '12px',
                        bg: 'transparent', cursor: 'pointer', border: 'none',
                        color: activeTab === 'plans' ? '#111' : '#666',
                        fontWeight: activeTab === 'plans' ? '600' : '500',
                        borderBottom: activeTab === 'plans' ? '2px solid #111' : '2px solid transparent',
                        _hover: { bg: '#f9fafb' },
                    })}
                >
                    <Calendar size={18} /> 일정표
                </button>
                <button
                    onClick={() => handleTabChange('checklist')}
                    className={css({
                        display: 'flex', alignItems: 'center', gap: '8px', px: '16px', py: '12px',
                        bg: 'transparent', cursor: 'pointer', border: 'none',
                        color: activeTab === 'checklist' ? '#111' : '#666',
                        fontWeight: activeTab === 'checklist' ? '600' : '500',
                        borderBottom: activeTab === 'checklist' ? '2px solid #111' : '2px solid transparent',
                        _hover: { bg: '#f9fafb' },
                    })}
                >
                    <ListChecks size={18} /> 준비물 체크리스트
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
