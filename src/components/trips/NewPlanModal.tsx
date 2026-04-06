'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { X, MapPin, Clock, Calendar, Check, Search, ChevronRight, Loader2, Camera, Navigation, Map, Info, Compass } from 'lucide-react'
import { useLoadScript, Autocomplete } from '@react-google-maps/api'
import { LocationService } from '@/services/ExternalApiService'
import { useModalBackButton } from '@/hooks/useModalBackButton'

const libraries: ("places")[] = ["places"]

interface NewPlanModalProps {
    isOpen: boolean
    onClose: () => void
    tripId: string
    tripStartDate: string
    tripEndDate: string
}

// ── 핵심 타입 정의 ──
interface PlaceOption {
    name: string
    address: string
    lat: number
    lng: number
    photo?: string
    rating?: number
    type?: string
}

export default function NewPlanModal({ isOpen, onClose, tripId, tripStartDate, tripEndDate }: NewPlanModalProps) {
    const supabase = createClient()
    const [step, setStep] = useState(1) // 1: 장소검색, 2: 상세입력
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // ── 폼 상태 ──
    const [selectedPlace, setSelectedPlace] = useState<PlaceOption | null>(null)
    const [visitDate, setVisitDate] = useState(tripStartDate)
    const [visitTime, setVisitTime] = useState('12:00')
    const [duration, setDuration] = useState('1')
    const [cost, setCost] = useState('')
    const [memo, setMemo] = useState('')

    // ── 구글 맵 상태 ──
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

    useModalBackButton(isOpen, onClose, 'newPlanModal')

    const { isLoaded } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
        libraries,
        language: 'ko',
    })

    const onPlaceChanged = () => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace()
            if (!place.geometry || !place.geometry.location) return

            const photo = place.photos?.[0]?.getUrl({ maxWidth: 400 })

            setSelectedPlace({
                name: place.name || '',
                address: place.formatted_address || '',
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                photo,
                rating: place.rating,
                type: place.types?.[0]
            })
            setStep(2) // 다음 단계로 자동 이동
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedPlace) return

        setLoading(true)
        setError('')

        try {
            // 타임존 정보를 API로 조회 (Refactored to use LocationService)
            const tzData = await LocationService.getTimezone(selectedPlace.lat, selectedPlace.lng)

            const { error } = await supabase.from('plans').insert({
                trip_id: tripId,
                title: selectedPlace.name,
                location_name: selectedPlace.name,
                address: selectedPlace.address,
                lat: selectedPlace.lat,
                lng: selectedPlace.lng,
                visit_date: visitDate,
                visit_time: visitTime,
                duration_hours: parseFloat(duration),
                cost: cost ? parseFloat(cost) : 0,
                description: memo,
                image_url: selectedPlace.photo,
                timezone_string: tzData.timeZoneId || 'Asia/Seoul'
            })

            if (error) throw error

            onClose()
            // Reset 상태
            setStep(1)
            setSelectedPlace(null)
            setCost('')
            setMemo('')
        } catch (err: any) {
            setError(err.message || '일정을 저장하는 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed', inset: 0, zIndex: 100,
            bg: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: { base: 'flex-start', sm: 'center' },
            justifyContent: 'center', p: { base: '0', sm: '20px' },
            animation: 'fadeIn 0.3s ease-out'
        })}>
            <div className={css({
                bg: 'white', w: '100%', maxW: { base: '100%', sm: '520px' },
                h: { base: '100dvh', sm: 'auto' }, maxH: { base: '100dvh', sm: '90vh' },
                overflowY: 'auto', borderRadius: { base: '0', sm: '32px' },
                boxShadow: { base: 'none', sm: '0 25px 70px rgba(0,0,0,0.18)' },
                display: 'flex', flexDirection: 'column',
                pt: { base: 'env(safe-area-inset-top)', sm: '0' },
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)'
            })}>
                {/* 헤더 */}
                <div className={css({
                    p: '22px 24px', borderBottom: '1px solid #F5F5F5', display: 'flex',
                    justifyContent: step === 2 ? 'space-between' : 'center', alignItems: 'center', position: 'sticky', top: 0, bg: 'white', zIndex: 10
                })}>
                    {step === 2 && (
                        <button
                            onClick={() => setStep(1)}
                            className={css({ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '15px', fontWeight: '700', color: '#2EC4B6', bg: 'transparent', p: 0, border: 'none', cursor: 'pointer' })}
                        >
                            이전
                        </button>
                    )}
                    <h2 className={css({ fontSize: '18px', fontWeight: '700', color: '#2C3A47', letterSpacing: '-0.02em', position: 'absolute', left: '50%', transform: 'translateX(-50%)' })}>
                        {step === 1 ? '일정 장소 찾기' : '상세 일정 기록'}
                    </h2>
                    <button
                        onClick={onClose}
                        className={css({ ml: 'auto', p: '8px', borderRadius: '50%', bg: '#F8F9FA', color: '#9CA3AF', transition: 'all 0.2s', _hover: { bg: '#F1F3F5', color: '#2C3A47', transform: 'rotate(90deg)' } })}
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                <div className={css({ p: { base: '20px', sm: '32px' }, flex: 1 })}>
                    {step === 1 ? (
                        /* 단계 1: 구글 상소 검색 */
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '28px', animation: 'fadeIn 0.3s' })}>
                            <div className={css({ textAlign: 'center', py: '10px' })}>
                                <div className={css({ w: '64px', h: '64px', bg: 'rgba(46, 196, 182, 0.1)', borderRadius: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', m: '0 auto 16px' })}>
                                    <MapPin size={30} color="#2EC4B6" strokeWidth={2.2} />
                                </div>
                                <h3 className={css({ fontSize: '22px', fontWeight: '800', color: '#172554', mb: '8px', letterSpacing: '-0.03em' })}>어디로 떠나볼까요?</h3>
                                <p className={css({ color: '#6B7280', fontSize: '15px', fontWeight: '500' })}>구글 맵에서 정확한 위치 정보를 찾아드려요.</p>
                            </div>

                            <div className={css({ position: 'relative' })}>
                                <div className={css({ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', zIndex: 1 })}>
                                    <Search size={20} />
                                </div>
                                {isLoaded && (
                                    <Autocomplete onLoad={(a) => setAutocomplete(a)} onPlaceChanged={onPlaceChanged}>
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            placeholder="레스토랑, 명소, 공항 등을 검색하세요"
                                            className={css({
                                                w: '100%', p: '20px 20px 20px 52px', bg: '#F8F9FA', border: '2px solid #F1F3F5',
                                                borderRadius: '20px', fontSize: '16px', fontWeight: '600', outline: 'none',
                                                transition: 'all 0.3s', _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 5px rgba(46, 196, 182, 0.1)' }
                                            })}
                                            autoFocus
                                        />
                                    </Autocomplete>
                                )}
                            </div>

                            <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', mt: '10px' })}>
                                {[
                                    { icon: <Compass size={18} />, label: '관광 명소', color: '#FF9F87' },
                                    { icon: <Navigation size={18} />, label: '대중 교통', color: '#2EC4B6' },
                                    { icon: <Map size={18} />, label: '맛집/카페', color: '#FFD166' },
                                    { icon: <Camera size={18} />, label: '포토 스팟', color: '#3B82F6' }
                                ].map((item, idx) => (
                                    <div key={idx} className={css({ 
                                        p: '16px', bg: '#F8F9FA', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '10px',
                                        fontSize: '14px', fontWeight: '700', color: '#2C3A47', border: '1.5px solid #F1F3F5', cursor: 'pointer',
                                        transition: 'all 0.2s', _hover: { borderColor: item.color, bg: 'white', transform: 'translateY(-2px)' }
                                    })}>
                                        <div style={{ color: item.color }}>{item.icon}</div>
                                        {item.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* 단계 2: 상세 정보 입력 */
                        <form onSubmit={handleSubmit} className={css({ display: 'flex', flexDirection: 'column', gap: '22px', animation: 'slideRight 0.4s cubic-bezier(0.2, 0, 0, 1)' })}>
                            {/* 선택된 장소 카드 */}
                            {selectedPlace && (
                                <div className={css({ p: '18px', bg: 'white', borderRadius: '24px', border: '2px solid #F1F3F5', display: 'flex', gap: '14px', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' })}>
                                    <div className={css({ w: '70px', h: '70px', bg: '#F8F9FA', borderRadius: '16px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
                                        {selectedPlace.photo ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={selectedPlace.photo} alt={selectedPlace.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : <MapPin size={28} color="#D1D5DB" />}
                                    </div>
                                    <div className={css({ minW: 0 })}>
                                        <h4 className={css({ fontSize: '17px', fontWeight: '800', color: '#172554', mb: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>{selectedPlace.name}</h4>
                                        <p className={css({ fontSize: '13px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' })}>{selectedPlace.address}</p>
                                    </div>
                                </div>
                            )}

                            <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' })}>
                                <div>
                                    <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', mb: '8px', color: '#2C3A47' })}>
                                        <Calendar size={14} color="#2EC4B6" /> 방문 날짜
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        min={tripStartDate}
                                        max={tripEndDate}
                                        value={visitDate}
                                        onChange={e => setVisitDate(e.target.value)}
                                        className={css({ w: '100%', p: '14px', bg: '#F8F9FA', border: '1.5px solid #F1F3F5', borderRadius: '16px', outline: 'none', fontSize: '14px', fontWeight: '600' })}
                                    />
                                </div>
                                <div>
                                    <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', mb: '8px', color: '#2C3A47' })}>
                                        <Clock size={14} color="#2EC4B6" /> 방문 시간
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={visitTime}
                                        onChange={e => setVisitTime(e.target.value)}
                                        className={css({ w: '100%', p: '14px', bg: '#F8F9FA', border: '1.5px solid #F1F3F5', borderRadius: '16px', outline: 'none', fontSize: '14px', fontWeight: '600' })}
                                    />
                                </div>
                            </div>

                            <div className={css({ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' })}>
                                <div>
                                    <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', mb: '8px', color: '#2C3A47' })}>
                                        💰 예상 비용
                                    </label>
                                    <div className={css({ position: 'relative' })}>
                                        <input
                                            type="number"
                                            placeholder="금액을 입력하세요 (예: 500)"
                                            value={cost}
                                            onChange={e => setCost(e.target.value)}
                                            className={css({ w: '100%', p: '14px 14px 14px 14px', bg: '#F8F9FA', border: '1.5px solid #F1F3F5', borderRadius: '16px', outline: 'none', fontSize: '14px', fontWeight: '700' })}
                                        />
                                    </div>
                                    <p className={css({ fontSize: '11px', color: '#9CA3AF', mt: '4px', pl: '4px' })}>자세한 비용은 여정에서 관리됩니다.</p>
                                </div>
                                <div>
                                    <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', mb: '8px', color: '#2C3A47' })}>
                                        ⏳ 체류 시간
                                    </label>
                                    <select
                                        value={duration}
                                        onChange={e => setDuration(e.target.value)}
                                        className={css({ w: '100%', p: '14px', bg: '#F8F9FA', border: '1.5px solid #F1F3F5', borderRadius: '16px', outline: 'none', fontSize: '14px', fontWeight: '600' })}
                                    >
                                        <option value="0.5">30분 내외</option>
                                        <option value="1">1시간 내외</option>
                                        <option value="1.5">1시간 30분</option>
                                        <option value="2">2시간</option>
                                        <option value="3">3시간 이상</option>
                                        <option value="12">반나절 소요</option>
                                        <option value="24">숙박 및 전일</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={css({ display: 'block', fontSize: '13px', fontWeight: '700', mb: '8px', color: '#2C3A47' })}>📝 메모/남길 말</label>
                                <textarea
                                    placeholder="장소의 특징이나 미리 알아둘 것이 있다면 적어주세요!"
                                    value={memo}
                                    onChange={e => setMemo(e.target.value)}
                                    className={css({
                                        w: '100%', h: '90px', p: '16px', bg: '#F8F9FA', border: '1.5px solid #F1F3F5', borderRadius: '20px',
                                        fontSize: '14px', fontWeight: '500', outline: 'none', transition: 'all 0.2s', resize: 'none',
                                        _focus: { borderColor: '#2EC4B6', bg: 'white' }
                                    })}
                                />
                            </div>

                            {error && (
                                <div className={css({ p: '14px', bg: '#FFF5F5', color: '#FF5A5F', borderRadius: '14px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' })}>
                                    <Info size={16} /> {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={css({
                                    w: '100%', py: '18px', bg: '#2EC4B6', color: 'white', borderRadius: '20px', fontWeight: '800',
                                    fontSize: '17px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', gap: '8px', boxShadow: '0 10px 25px rgba(46, 196, 182, 0.25)',
                                    transition: 'all 0.3s', _disabled: { opacity: 0.6 },
                                    _hover: { bg: '#249E93', transform: 'translateY(-2px)' }, _active: { transform: 'scale(0.97)' }
                                })}
                            >
                                {loading ? <><Loader2 size={20} className={css({ animation: 'spin 1.5s linear infinite' })} /> 저장 중...</> : <><Check size={20} strokeWidth={3} /> 일정 추가하기</>}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes slideRight { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .pac-container { 
                    border-radius: 16px; 
                    border: none; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1); 
                    margin-top: 8px;
                    padding: 8px 0;
                    font-family: inherit;
                    z-index: 2100 !important;
                }
                .pac-item { 
                    padding: 10px 16px; 
                    cursor: pointer; 
                    display: flex;
                    align-items: center;
                }
                .pac-item:hover { background-color: #F8F9FA; }
                .pac-item-query { font-size: 14px; font-weight: 700; color: #2C3A47; }
                .pac-matched { color: #2EC4B6; }
                .pac-icon { display: none; }
            `}</style>
        </div>
    )
}
