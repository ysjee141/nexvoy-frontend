'use client'

import { useEffect, useState, Suspense } from 'react'
import { css } from 'styled-system/css'
import { Calendar, ListChecks, MapPin, Wifi } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import TripHeaderActions from '@/components/trips/TripHeaderActions'
import dynamic from 'next/dynamic'
import TripClient from '@/app/trips/detail/TripClient'
import ChecklistClient from '@/app/trips/checklist/ChecklistClient'
import { DownloadService, TripBundle } from '@/services/DownloadService'
import { useUIStore } from '@/stores/useUIStore'
import { useNetworkStore } from '@/stores/useNetworkStore'

const RouteMapView = dynamic(() => import('@/components/trips/RouteMapView'), { ssr: false })

function OfflineTripContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const id = searchParams.get('id')
    const { setMobileTitle } = useUIStore()
    const { isOnline, setOfflineMode } = useNetworkStore()
    
    const [bundle, setBundle] = useState<TripBundle | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'plans' | 'checklist' | 'map'>((searchParams.get('tab') as any) || 'plans')

    useEffect(() => {
        async function loadBundle() {
            if (!id) {
                setLoading(false)
                return
            }
            const data = await DownloadService.getBundle(id)
            if (data) {
                setBundle(data)
                if (data.trip?.destination) {
                    setMobileTitle(data.trip.destination)
                }
            } else {
                alert('해당 여행의 오프라인 데이터가 없습니다.')
                router.replace('/')
            }
            setLoading(false)
        }
        loadBundle()
        return () => setMobileTitle(null)
    }, [id, router, setMobileTitle])

    if (loading) {
        return <div className={css({ w: '100%', py: '40px', textAlign: 'center', color: '#888' })}>오프라인 데이터를 불러오는 중...</div>
    }

    if (!id || !bundle) return null

    const handleTabChange = (tab: 'plans' | 'checklist' | 'map') => {
        setActiveTab(tab)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    return (
        <div className={css({ w: '100%', py: '16px' })}>
            {/* 오프라인 모드 안내 */}
            <div className={css({
                mb: '16px', p: '12px', bg: 'rgba(37, 99, 235, 0.05)', borderRadius: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            })}>
                <span className={css({ fontSize: '13px', fontWeight: '700', color: 'brand.primary' })}>
                    📴 오프라인 모드에서 열람 중입니다.
                </span>
                {isOnline && (
                    <button 
                        onClick={() => {
                            setOfflineMode(false)
                            router.push(`/trips/detail/?id=${id}`)
                        }}
                        className={css({
                            bg: 'brand.primary', color: 'white', border: 'none', px: '12px', py: '6px',
                            borderRadius: '12px', fontSize: '11px', fontWeight: '800', cursor: 'pointer'
                        })}
                    >
                        온라인 복귀
                    </button>
                )}
            </div>

            <div className={css({ mb: '8px', pb: '16px', borderBottom: '1px solid #EEEEEE' })}>
                <TripHeaderActions
                    trip={bundle.trip}
                    isOffline={true}
                    onUpdate={() => {}} // 오프라인에서는 수정 불가
                />
            </div>

            {/* Tab Navigation */}
            <div className={css({
                display: 'flex', justifyContent: 'center', mb: '0', position: 'sticky',
                top: { base: 'calc(56px + max(env(safe-area-inset-top), var(--safe-area-inset-top)))', sm: '64px' },
                bg: 'white', borderBottom: '1px solid', borderColor: 'brand.border', zIndex: 100, pt: '4px'
            })}>
                <div className={css({ display: 'flex', gap: '32px', px: '16px' })}>
                    <button onClick={() => handleTabChange('plans')} className={getTabStyle(activeTab === 'plans')}>
                        <Calendar size={18} strokeWidth={activeTab === 'plans' ? 2.5 : 2} /> 일정표
                    </button>
                    <button onClick={() => handleTabChange('checklist')} className={getTabStyle(activeTab === 'checklist')}>
                        <ListChecks size={18} strokeWidth={activeTab === 'checklist' ? 2.5 : 2} /> 준비물
                    </button>
                    <button onClick={() => handleTabChange('map')} className={getTabStyle(activeTab === 'map')}>
                        <MapPin size={18} strokeWidth={activeTab === 'map' ? 2.5 : 2} /> 지도
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div>
                <div style={{ display: activeTab === 'plans' ? 'block' : 'none' }}>
                    <TripClient tripId={id} isActive={activeTab === 'plans'} isOffline={true} />
                </div>
                <div style={{ display: activeTab === 'checklist' ? 'block' : 'none' }}>
                    <ChecklistClient tripId={id} isActive={activeTab === 'checklist'} isOffline={true} />
                </div>
                <div style={{ display: activeTab === 'map' ? 'block' : 'none' }}>
                    <RouteMapView
                        tripStartDate={bundle.trip?.start_date || ''}
                        tripEndDate={bundle.trip?.end_date || ''}
                        isActive={activeTab === 'map'}
                        externalPlans={bundle.plans} // 오프라인용 데이터 직접 주입
                    />
                </div>
            </div>
        </div>
    )
}

export default function OfflineTripPage() {
    return (
        <Suspense fallback={<div className={css({ w: '100%', py: '40px', textAlign: 'center', color: '#888' })}>로딩 중...</div>}>
            <OfflineTripContent />
        </Suspense>
    )
}

function getTabStyle(isActive: boolean) {
    return css({
        display: 'flex', alignItems: 'center', gap: '8px', px: '4px', h: '48px',
        cursor: 'pointer', border: 'none', bg: 'transparent',
        color: isActive ? 'brand.primary' : 'brand.muted',
        fontWeight: '700', fontSize: '15px', position: 'relative',
        _after: {
            content: '""', position: 'absolute', bottom: '0', left: '0', right: '0', h: '3px',
            bg: isActive ? 'brand.primary' : 'transparent', borderRadius: '3px 3px 0 0'
        }
    })
}
