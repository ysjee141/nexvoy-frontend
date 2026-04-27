'use client'

import { useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { Download, Trash2, X, MapPin, Calendar, ExternalLink, CloudCheck } from 'lucide-react'
import { DownloadService, DownloadedTripMetadata } from '@/services/DownloadService'

interface DownloadedTripsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DownloadedTripsModal({ isOpen, onClose }: DownloadedTripsModalProps) {
    const [trips, setTrips] = useState<DownloadedTripMetadata[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchTrips = async () => {
        setIsLoading(true)
        const data = await DownloadService.getDownloadedTrips()
        setTrips(data)
        setIsLoading(false)
    }

    useEffect(() => {
        if (isOpen) {
            fetchTrips()
        }
    }, [isOpen])

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (confirm('이 여행 데이터를 삭제하시겠습니까? 오프라인에서는 더 이상 볼 수 없게 됩니다.')) {
            await DownloadService.removeDownloadedTrip(id)
            fetchTrips()
        }
    }

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            p: { base: '16px', sm: '24px' }
        })}>
            <div 
                className={css({ position: 'absolute', inset: 0, bg: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' })} 
                onClick={onClose} 
            />
            
            <div className={css({
                position: 'relative',
                w: '100%', maxW: '500px',
                bg: 'white', borderRadius: '32px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                display: 'flex', flexDirection: 'column',
                maxH: '80vh', overflow: 'hidden',
                animation: 'slideUp 0.3s ease-out'
            })}>
                {/* Header */}
                <div className={css({
                    p: '24px', borderBottom: '1px solid #F0F0F0',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                })}>
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '12px' })}>
                        <div className={css({ w: '40px', h: '40px', bg: 'rgba(37, 99, 235, 0.08)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'brand.primary' })}>
                            <Download size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className={css({ fontSize: '18px', fontWeight: '850', color: '#2C3A47' })}>오프라인 여행 관리</h3>
                            <p className={css({ fontSize: '13px', color: 'brand.muted', fontWeight: '600' })}>다운로드된 여행 목록</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className={css({ p: '8px', borderRadius: '12px', border: 'none', bg: 'bg.softCotton', color: 'brand.muted', cursor: 'pointer', _hover: { bg: '#FEE2E2', color: '#EF4444' } })}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className={css({ flex: 1, overflowY: 'auto', p: '12px' })}>
                    {isLoading ? (
                        <div className={css({ p: '40px', textAlign: 'center', color: 'brand.muted' })}>불러오는 중...</div>
                    ) : trips.length === 0 ? (
                        <div className={css({ p: '60px 20px', textAlign: 'center' })}>
                            <div className={css({ fontSize: '40px', mb: '16px' })}>📴</div>
                            <p className={css({ fontSize: '16px', fontWeight: '700', color: 'brand.secondary' })}>다운로드된 여행이 없어요.</p>
                            <p className={css({ fontSize: '13px', color: 'brand.muted', mt: '4px', fontWeight: '500' })}>여행 상세 페이지에서 다운로드할 수 있습니다.</p>
                        </div>
                    ) : (
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                            {trips.map(trip => (
                                <div 
                                    key={trip.id}
                                    className={css({
                                        p: '16px', borderRadius: '20px', border: '1px solid #F0F0F0',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        transition: 'all 0.2s', _hover: { bg: '#FAFAFA' }
                                    })}
                                >
                                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 })}>
                                        <h4 className={css({ fontSize: '15px', fontWeight: '750', color: 'brand.secondary', display: 'flex', alignItems: 'center', gap: '6px' })}>
                                            <CloudCheck size={14} className={css({ color: 'brand.primary' })} />
                                            {trip.destination}
                                        </h4>
                                        <div className={css({ display: 'flex', alignItems: 'center', gap: '10px', color: 'brand.muted', fontSize: '12px', fontWeight: '600' })}>
                                            <span className={css({ display: 'flex', alignItems: 'center', gap: '4px' })}>
                                                <Calendar size={12} /> {trip.start_date} ~ {trip.end_date}
                                            </span>
                                        </div>
                                        <span className={css({ fontSize: '11px', color: '#BBB', mt: '2px' })}>
                                            다운로드: {new Date(trip.downloadedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={(e) => handleDelete(e, trip.id)}
                                        className={css({ 
                                            p: '10px', borderRadius: '12px', border: 'none', 
                                            bg: 'rgba(244, 63, 94, 0.05)', color: '#F43F5E', 
                                            cursor: 'pointer', transition: 'all 0.2s',
                                            _hover: { bg: '#F43F5E', color: 'white' }
                                        })}
                                        title="삭제"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={css({ p: '16px', bg: '#F8F9FA', borderTop: '1px solid #F0F0F0' })}>
                    <p className={css({ fontSize: '12px', color: 'brand.muted', textAlign: 'center', fontWeight: '500' })}>
                        오프라인 데이터는 기기의 저장 공간을 사용합니다.<br/>더 이상 필요 없는 여행은 삭제해 주세요.
                    </p>
                </div>
            </div>
        </div>
    )
}
