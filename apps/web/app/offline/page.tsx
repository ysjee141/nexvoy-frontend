'use client'

import { useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { Download, Trash2, Calendar, CloudCheck, WifiOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DownloadService, DownloadedTripMetadata } from '@/services/DownloadService'
import { useNetworkStore } from '@/stores/useNetworkStore'
import { useUIStore } from '@/stores/useUIStore'

export default function OfflineHomePage() {
    const router = useRouter()
    const { setMobileTitle } = useUIStore()
    const { isOnline, setOfflineMode } = useNetworkStore()
    
    const [trips, setTrips] = useState<DownloadedTripMetadata[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        setMobileTitle('오프라인 모드')
        return () => setMobileTitle(null)
    }, [setMobileTitle])

    useEffect(() => {
        const fetchTrips = async () => {
            setIsLoading(true)
            const data = await DownloadService.getDownloadedTrips()
            setTrips(data)
            setIsLoading(false)
        }
        fetchTrips()
    }, [])

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (confirm('이 여행 데이터를 삭제하시겠습니까? 오프라인에서는 더 이상 볼 수 없게 됩니다.')) {
            await DownloadService.removeDownloadedTrip(id)
            const data = await DownloadService.getDownloadedTrips()
            setTrips(data)
        }
    }

    return (
        <div className={css({ 
            display: 'flex', 
            flexDirection: 'column', 
            minH: '100vh',
            bg: '#F8F9FA',
            pb: '80px' // 하단 네비게이션 여백
        })}>
            {/* Header Area */}
            <div className={css({
                p: '24px', 
                bg: 'white',
                borderBottom: '1px solid #F0F0F0',
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px'
            })}>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '12px' })}>
                    <div className={css({ 
                        w: '40px', h: '40px', 
                        bg: 'rgba(37, 99, 235, 0.08)', 
                        borderRadius: '12px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        color: 'brand.primary' 
                    })}>
                        <WifiOff size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className={css({ fontSize: '18px', fontWeight: '850', color: '#2C3A47' })}>오프라인 여행 관리</h3>
                        <p className={css({ fontSize: '13px', color: 'brand.muted', fontWeight: '600' })}>다운로드된 여행 목록</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className={css({ flex: 1, overflowY: 'auto', p: '16px' })}>
                {isLoading ? (
                    <div className={css({ p: '40px', textAlign: 'center', color: 'brand.muted' })}>불러오는 중...</div>
                ) : trips.length === 0 ? (
                    <div className={css({ 
                        bg: 'white', p: '60px 20px', textAlign: 'center', 
                        borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' 
                    })}>
                        <div className={css({ fontSize: '40px', mb: '16px' })}>📴</div>
                        <p className={css({ fontSize: '16px', fontWeight: '700', color: 'brand.secondary' })}>다운로드된 여행이 없어요.</p>
                        <p className={css({ fontSize: '13px', color: 'brand.muted', mt: '4px', fontWeight: '500' })}>
                            온라인 상태일 때 여행 상세 페이지에서<br/>다운로드할 수 있습니다.
                        </p>
                    </div>
                ) : (
                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                        {trips.map(trip => (
                            <div 
                                key={trip.id}
                                onClick={() => {
                                    router.push(`/offline/trips/detail?id=${trip.id}&tab=plans`)
                                }}
                                className={css({
                                    p: '20px', 
                                    bg: 'white',
                                    borderRadius: '24px', 
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s', 
                                    _hover: { transform: 'translateY(-2px)', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' },
                                    _active: { transform: 'scale(0.98)' }
                                })}
                            >
                                <div className={css({ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 })}>
                                    <h4 className={css({ fontSize: '16px', fontWeight: '750', color: 'brand.secondary', display: 'flex', alignItems: 'center', gap: '6px' })}>
                                        <CloudCheck size={16} className={css({ color: 'brand.primary' })} />
                                        {trip.destination}
                                    </h4>
                                    <div className={css({ display: 'flex', alignItems: 'center', gap: '10px', color: 'brand.muted', fontSize: '13px', fontWeight: '600' })}>
                                        <span className={css({ display: 'flex', alignItems: 'center', gap: '4px' })}>
                                            <Calendar size={13} /> {trip.start_date} ~ {trip.end_date}
                                        </span>
                                    </div>
                                    <span className={css({ fontSize: '11px', color: '#BBB', mt: '4px' })}>
                                        다운로드: {new Date(trip.downloadedAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <button 
                                    onClick={(e) => handleDelete(e, trip.id)}
                                    className={css({ 
                                        p: '12px', borderRadius: '16px', border: 'none', 
                                        bg: 'rgba(244, 63, 94, 0.05)', color: '#F43F5E', 
                                        cursor: 'pointer', transition: 'all 0.2s',
                                        _hover: { bg: '#F43F5E', color: 'white' }
                                    })}
                                    title="삭제"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className={css({ p: '24px 16px', mt: '12px' })}>
                    <p className={css({ fontSize: '12px', color: 'brand.muted', textAlign: 'center', fontWeight: '500', lineHeight: 1.5 })}>
                        오프라인 데이터는 기기의 저장 공간을 사용합니다.<br/>더 이상 필요 없는 여행은 주기적으로 삭제해 주세요.
                    </p>
                </div>
            </div>
        </div>
    )
}
