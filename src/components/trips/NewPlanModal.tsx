'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { X, MapPin, Clock, Calendar, Check, Search, ChevronRight, Loader2, Camera, Navigation, Map, Info, Compass, Bell } from 'lucide-react'
import { useLoadScript, Autocomplete } from '@react-google-maps/api'
import { LocationService, PlacePhotoService } from '@/services/ExternalApiService'
import { useModalBackButton } from '@/hooks/useModalBackButton'
import { useScrollLock } from '@/hooks/useScrollLock'

const libraries: ("places")[] = ["places"]

interface NewPlanModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    tripId: string
    tripStartDate?: string
    tripEndDate?: string
    editData?: any
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
    googlePlaceId?: string
}

export default function NewPlanModal({ 
    isOpen, 
    onClose, 
    onSuccess, 
    tripId, 
    tripStartDate = '', 
    tripEndDate = '', 
    editData 
}: NewPlanModalProps) {
    const supabase = createClient()
    const [step, setStep] = useState(1) // 1: 장소검색, 2: 상세입력
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // ── 폼 상태 ──
    const [selectedPlace, setSelectedPlace] = useState<PlaceOption | null>(null)
    const [customTitle, setCustomTitle] = useState('')
    const [visitDate, setVisitDate] = useState('')
    const [visitTime, setVisitTime] = useState('12:00')
    const [duration, setDuration] = useState('1')
    const [alarmMinutes, setAlarmMinutes] = useState(60)
    const [cost, setCost] = useState('')
    const [memo, setMemo] = useState('')

    // ── 구글 맵 상태 ──
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)
    const [detailAutocomplete, setDetailAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)
    const [inputValue, setInputValue] = useState('')
    const searchInputRef = useRef<HTMLInputElement>(null)

    const resetForm = useCallback(() => {
        setStep(1)
        setCustomTitle('')
        setSelectedPlace(null)
        setVisitDate(tripStartDate || '')
        setVisitTime('12:00')
        setDuration('1')
        setAlarmMinutes(60)
        setCost('')
        setMemo('')
        setInputValue('')
    }, [tripStartDate])

    const isDirty = useCallback(() => {
        if (editData) {
            return (
                customTitle !== (editData.title || '') ||
                selectedPlace?.name !== (editData.location || '') ||
                memo !== (editData.memo || '') ||
                cost !== String(editData.cost || '')
            );
        }
        return step > 1 || customTitle !== '' || memo !== '' || cost !== '' || (selectedPlace !== null && step === 1);
    }, [editData, step, customTitle, selectedPlace, memo, cost]);

    const handleClose = useCallback(() => {
        if (isDirty()) {
            if (!window.confirm('작성 중인 내용이 사라집니다. 그래도 닫으시겠습니까?')) {
                return;
            }
        }
        resetForm();
        onClose();
    }, [isDirty, onClose, resetForm]);

    useModalBackButton(isOpen, handleClose, 'newPlanModal')
    useScrollLock(isOpen)

    const { isLoaded } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
        libraries,
        language: 'ko',
    })

    // Edit 모드일 때 초기값 설정
    useEffect(() => {
        if (editData && isOpen) {
            setStep(2)
            setCustomTitle(editData.title || '')
            setSelectedPlace({
                name: editData.location || '',
                address: editData.address || editData.location || '',
                lat: editData.location_lat || 0,
                lng: editData.location_lng || 0,
                photo: editData.image_url || undefined,
                googlePlaceId: editData.google_place_id || undefined,
            })
            
            if (editData.start_datetime_local) {
                const [date, timePart] = editData.start_datetime_local.split('T')
                setVisitDate(date)
                setVisitTime(timePart?.substring(0, 5) || '12:00')
            } else {
                setVisitDate(tripStartDate)
                setVisitTime('12:00')
            }
            
            const start = editData.start_datetime_local
            const end = editData.end_datetime_local
            if (start && end) {
                const s = new Date(start).getTime()
                const e = new Date(end).getTime()
                const diff = (e - s) / (1000 * 60 * 60)
                setDuration(String(Math.max(0.5, Math.min(diff, 24))))
            } else {
                setDuration('1')
            }

            setAlarmMinutes(editData.alarm_minutes_before || 0)
            setCost(String(editData.cost || ''))
            setMemo(editData.memo || '')
        } else if (isOpen) {
            resetForm()
        }
    }, [editData, isOpen, tripStartDate, resetForm])

    const onPlaceChanged = () => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace()
            if (!place.geometry || !place.geometry.location) {
                if (inputValue) handleContinueManual()
                return
            }

            const name = place.name || ''
            const address = place.formatted_address || ''
            const placeId = place.place_id

            setSelectedPlace({
                name,
                address,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                photo: undefined,
                rating: place.rating,
                type: place.types?.[0],
                googlePlaceId: placeId
            })
            setStep(2)

            // 서버사이드 API로 영구 사진 URL 비동기 조회
            if (placeId) {
                PlacePhotoService.getPhotoUrl(placeId).then(url => {
                    if (url) {
                        setSelectedPlace(prev => prev ? { ...prev, photo: url } : prev)
                    }
                })
            }
        }
    }

    const onDetailPlaceChanged = () => {
        if (detailAutocomplete !== null) {
            const place = detailAutocomplete.getPlace()
            if (!place.geometry || !place.geometry.location) return

            const name = place.name || ''
            const address = place.formatted_address || ''
            const placeId = place.place_id

            setSelectedPlace({
                name,
                address,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                photo: undefined,
                rating: place.rating,
                type: place.types?.[0],
                googlePlaceId: placeId
            })

            // 서버사이드 API로 영구 사진 URL 비동기 조회
            if (placeId) {
                PlacePhotoService.getPhotoUrl(placeId).then(url => {
                    if (url) {
                        setSelectedPlace(prev => prev ? { ...prev, photo: url } : prev)
                    }
                })
            }
        }
    }

    const handleContinueManual = () => {
        if (!inputValue.trim()) return
        setSelectedPlace({
            name: inputValue,
            address: '',
            lat: 0,
            lng: 0,
            photo: undefined,
            googlePlaceId: undefined
        })
        setStep(2)
    }

    const handleCategoryClick = (label: string) => {
        setInputValue(label)
        if (searchInputRef.current) {
            searchInputRef.current.value = label
            searchInputRef.current.focus()
            const event = new Event('input', { bubbles: true })
            searchInputRef.current.dispatchEvent(event)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedPlace) return

        setLoading(true)
        setError('')

        try {
            const tzData = await LocationService.getTimezone(selectedPlace.lat, selectedPlace.lng)

            const startStr = `${visitDate}T${visitTime}:00`
            const startDateObj = new Date(startStr)
            const endDateObj = new Date(startDateObj.getTime() + parseFloat(duration) * 60 * 60 * 1000)
            const endStr = endDateObj.toISOString().slice(0, 19).replace('Z', '')

            // 제목과 장소 매핑 로직 반영
            const titleToSave = customTitle.trim() || selectedPlace.name;
            const locationToSave = customTitle.trim() ? selectedPlace.name : selectedPlace.address;
            const addressToSave = selectedPlace.address;

            const planData = {
                trip_id: tripId,
                title: titleToSave,
                location: locationToSave,
                address: addressToSave,
                location_lat: selectedPlace.lat || 0,
                location_lng: selectedPlace.lng || 0,
                google_place_id: selectedPlace.googlePlaceId,
                image_url: selectedPlace.photo,
                start_datetime_local: startStr,
                end_datetime_local: endStr,
                cost: cost ? parseFloat(cost) : 0,
                memo: memo,
                alarm_minutes_before: alarmMinutes,
                timezone_string: tzData.timeZoneId || 'Asia/Seoul'
            }

            let result;
            if (editData?.id) {
                result = await supabase.from('plans').update(planData).eq('id', editData.id)
            } else {
                result = await supabase.from('plans').insert(planData)
            }

            if (result.error) throw result.error

            onSuccess()
            onClose()
        } catch (err: any) {
            setError(err.message || '일정을 저장하는 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed', inset: 0, zIndex: 3000,
            bg: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: { base: 'flex-start', sm: 'center' },
            justifyContent: 'center', p: { base: '0', sm: '20px' },
            animation: 'fadeIn 0.3s ease-out',
            overscrollBehavior: 'none',
            touchAction: 'none',
        })}>
            <div className={css({
                bg: 'white', w: '100%', maxW: { base: '100%', sm: '520px' },
                h: { base: '100dvh', sm: 'auto' }, maxH: { base: '100dvh', sm: '90vh' },
                overflowY: 'auto', borderRadius: { base: '0', sm: '16px' },
                boxShadow: { base: 'none', sm: 'airbnbHover' },
                display: 'flex', flexDirection: 'column',
                pb: { base: 'max(env(safe-area-inset-bottom), var(--safe-area-inset-bottom))', sm: '0' },
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
            })}>
                {/* 헤더 */}
                <div className={css({
                    p: '22px 24px',
                    pt: { base: 'calc(22px + max(env(safe-area-inset-top), var(--safe-area-inset-top)))', sm: '22px' },
                    borderBottom: '1px solid', borderBottomColor: 'brand.hairlineSoft', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, bg: 'white', zIndex: 10
                })}>
                    {step === 2 ? (
                        <button
                            onClick={() => setStep(1)}
                            className={css({ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '15px', fontWeight: '700', color: 'brand.primary', bg: 'transparent', p: 0, border: 'none', cursor: 'pointer' })}
                        >
                            이전
                        </button>
                    ) : <div style={{ width: '40px' }} />}
                    
                    <h2 className={css({ fontSize: '18px', fontWeight: '700', color: 'brand.ink', letterSpacing: '-0.02em', position: 'absolute', left: '50%', transform: 'translateX(-50%)' })}>
                        {step === 1 ? '일정 장소 찾기' : '상세 일정 기록'}
                    </h2>
                    
                    <button
                        onClick={handleClose}
                        className={css({ p: '8px', borderRadius: '50%', bg: 'bg.softCotton', color: 'brand.muted', transition: 'all 0.2s', _hover: { bg: 'rgba(0,0,0,0.05)', color: 'brand.ink', transform: 'rotate(90deg)' } })}
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                <div className={css({ p: { base: '20px', sm: '32px' }, flex: 1 })}>
                    {step === 1 ? (
                        /* 단계 1: 구글 장소 검색 */
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '28px', animation: 'fadeIn 0.3s' })}>
                            <div className={css({ textAlign: 'center', py: '10px' })}>
                                <div className={css({ w: '64px', h: '64px', bg: 'brand.primary/10', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', m: '0 auto 16px' })}>
                                    <MapPin size={30} className={css({ color: 'brand.primary' })} strokeWidth={2.2} />
                                </div>
                                <h3 className={css({ fontSize: '22px', fontWeight: '800', color: 'brand.ink', mb: '8px', letterSpacing: '-0.03em' })}>어디로 떠나볼까요?</h3>
                                <p className={css({ color: 'brand.muted', fontSize: '15px', fontWeight: '500' })}>구글 맵에서 정확한 위치 정보를 찾아드려요.</p>
                            </div>

                            <div className={css({ position: 'relative' })}>
                                {isLoaded && (
                                    <Autocomplete onLoad={(a) => setAutocomplete(a)} onPlaceChanged={onPlaceChanged}>
                                            <div className={css({ position: 'relative', width: '100%' })}>
                                                <div className={css({ 
                                                    position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', 
                                                    color: 'brand.muted', zIndex: 10, pointerEvents: 'none',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                })}>
                                                    <Search size={20} />
                                                </div>
                                                <input
                                                    ref={searchInputRef}
                                                    type="text"
                                                    placeholder="레스토랑, 명소, 공항 등을 검색하세요"
                                                    value={inputValue}
                                                    onChange={(e) => setInputValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && inputValue && !autocomplete?.getPlace()?.geometry) {
                                                            handleContinueManual()
                                                        }
                                                    }}
                                                    className={css({
                                                        w: '100%', p: '18px 20px 18px 52px', bg: 'bg.softCotton', border: '1px solid', borderColor: 'brand.hairlineSoft',
                                                        borderRadius: '16px', fontSize: '16px', fontWeight: '600', outline: 'none',
                                                        transition: 'all 0.3s', _focus: { borderColor: 'brand.primary', bg: 'white', boxShadow: '0 0 0 5px rgba(var(--colors-brand-primary-rgb), 0.1)' }
                                                    })}
                                                    autoFocus
                                                />
                                            </div>
                                    </Autocomplete>
                                )}

                                {inputValue.trim().length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleContinueManual}
                                        className={css({
                                            mt: '12px', w: '100%', py: '14px', bg: 'brand.primary/10', color: 'brand.primary',
                                            borderRadius: '8px', fontWeight: '700', fontSize: '14px', border: '1.5px dashed', borderColor: 'brand.primary',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer',
                                            transition: 'all 0.2s', _hover: { bg: 'brand.primary/20', transform: 'translateY(-2px)' }
                                        })}
                                    >
                                        <ChevronRight size={18} /> &quot;{inputValue}&quot;(으)로 계속하기 (수동 입력)
                                    </button>
                                )}
                            </div>

                            <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', mt: '10px' })}>
                                {[
                                    { icon: <Compass size={18} />, label: '관광 명소', color: 'token(colors.brand.secondary)' },
                                    { icon: <Navigation size={18} />, label: '대중 교통', color: 'token(colors.brand.primary)' },
                                    { icon: <Map size={18} />, label: '맛집/카페', color: 'token(colors.brand.primary)' },
                                    { icon: <Camera size={18} />, label: '포토 스팟', color: 'token(colors.brand.secondary)' }
                                ].map((item, idx) => (
                                    <div key={idx} 
                                        onClick={() => handleCategoryClick(item.label)}
                                        className={css({ 
                                            p: '16px', bg: 'bg.softCotton', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px',
                                            fontSize: '14px', fontWeight: '700', color: 'brand.ink', border: '1px solid', borderColor: 'brand.hairlineSoft', cursor: 'pointer',
                                            transition: 'all 0.2s', _hover: { borderColor: item.color, bg: 'white', transform: 'translateY(-2px)' }
                                        })}>
                                        <div className={css({ color: item.color })}>{item.icon}</div>
                                        {item.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* 단계 2: 상세 정보 입력 */
                        <form onSubmit={handleSubmit} className={css({ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.4s ease-out' })}>

                            {/* 선택된 장소 편집 필드 */}
                            {selectedPlace && (
                                <div className={css({ 
                                    display: 'flex', flexDirection: 'column', gap: '16px', p: '24px', bg: 'white', borderRadius: '12px', 
                                    border: '1px solid', borderColor: 'brand.hairlineSoft'
                                })}>
                                    <div className={css({ display: 'flex', gap: '14px', alignItems: 'center', mb: '4px' })}>
                                        <div className={css({ 
                                            w: '54px', h: '54px', bg: 'bg.softCotton', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                        })}>
                                            {selectedPlace.photo ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={selectedPlace.photo} alt={selectedPlace.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : <MapPin size={24} className={css({ color: 'brand.hairlineSoft' })} />}
                                        </div>
                                        <div className={css({ flex: 1, minW: 0 })}>
                                            <label className={css({ display: 'block', fontSize: '12px', fontWeight: '700', color: 'brand.muted', mb: '4px' })}>장소 이름</label>
                                            <Autocomplete 
                                                onLoad={(a) => setDetailAutocomplete(a)} 
                                                onPlaceChanged={onDetailPlaceChanged}
                                            >
                                                <input
                                                    type="text"
                                                    value={selectedPlace.name}
                                                    onChange={e => setSelectedPlace({ ...selectedPlace, name: e.target.value })}
                                                    placeholder="장소 이름을 입력하세요"
                                                    className={css({ 
                                                        w: '100%', fontSize: '16px', fontWeight: '800', color: 'brand.ink', 
                                                        border: 'none', bg: 'transparent', outline: 'none', p: 0, 
                                                        borderBottom: '1.5px solid transparent',
                                                        transition: 'all 0.2s',
                                                        _focus: { borderBottomColor: 'brand.primary' } 
                                                    })}
                                                />
                                            </Autocomplete>
                                        </div>
                                    </div>
                                    <div className={css({ borderTop: '1px solid', borderColor: 'brand.hairlineSoft', pt: '12px' })}>
                                        <label className={css({ display: 'block', fontSize: '12px', fontWeight: '700', color: 'brand.muted', mb: '4px' })}>상세 주소</label>
                                        <input
                                            type="text"
                                            value={selectedPlace.address}
                                            onChange={e => setSelectedPlace({ ...selectedPlace, address: e.target.value })}
                                            placeholder="주소를 입력하세요"
                                            className={css({ w: '100%', fontSize: '13px', fontWeight: '500', color: 'brand.ink', border: 'none', bg: 'transparent', outline: 'none', p: 0, _focus: { borderBottom: '1.5px solid', borderColor: 'brand.primary' } })}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 일정 제목 입력 (선택 사항) - 장소 카드 하단에 배치 */}
                            <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                                <label className={css({ fontSize: '13px', fontWeight: '700', color: 'brand.ink', display: 'flex', alignItems: 'center', gap: '6px' })}>
                                    일정 제목 <span className={css({ fontSize: '11px', fontWeight: '500', color: 'brand.muted' })}>(선택 입력)</span>
                                </label>
                                <input 
                                    type="text"
                                    placeholder="예: 근사한 저녁 식사, 박물관 투어"
                                    value={customTitle}
                                    onChange={(e) => setCustomTitle(e.target.value)}
                                    className={css({ 
                                        w: '100%', p: '16px 20px', bg: 'bg.softCotton', borderRadius: '12px', border: '1px solid', borderColor: 'brand.hairlineSoft', 
                                        fontSize: '15px', fontWeight: '600', transition: 'all 0.2s', color: 'brand.ink',
                                        _focus: { bg: 'white', borderColor: 'brand.primary', outline: 'none', boxShadow: '0 0 0 4px rgba(var(--colors-brand-primary-rgb), 0.1)' } 
                                    })}
                                />
                            </div>

                             <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' })}>
                                <div>
                                    <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', mb: '8px', color: 'brand.ink' })}>
                                        <Calendar size={14} className={css({ color: 'brand.primary' })} /> 방문 날짜
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        min={tripStartDate}
                                        max={tripEndDate}
                                        value={visitDate}
                                        onChange={e => setVisitDate(e.target.value)}
                                        className={css({ w: '100%', p: '14px', bg: 'bg.softCotton', border: '1px solid', borderColor: 'brand.hairlineSoft', borderRadius: '12px', outline: 'none', fontSize: '14px', fontWeight: '600', color: 'brand.ink' })}
                                    />
                                </div>
                                <div>
                                    <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', mb: '8px', color: 'brand.ink' })}>
                                        <Clock size={14} className={css({ color: 'brand.primary' })} /> 방문 시간
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={visitTime}
                                        onChange={e => setVisitTime(e.target.value)}
                                        className={css({ w: '100%', p: '14px', bg: 'bg.softCotton', border: '1px solid', borderColor: 'brand.hairlineSoft', borderRadius: '12px', outline: 'none', fontSize: '14px', fontWeight: '600', color: 'brand.ink' })}
                                    />
                                </div>
                            </div>

                            <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' })}>
                                <div>
                                    <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', mb: '8px', color: 'brand.ink' })}>
                                        ⏳ 체류 시간
                                    </label>
                                    <select
                                        value={duration}
                                        onChange={e => setDuration(e.target.value)}
                                        className={css({ w: '100%', p: '14px', bg: 'bg.softCotton', border: '1px solid', borderColor: 'brand.hairlineSoft', borderRadius: '12px', outline: 'none', fontSize: '14px', fontWeight: '600', color: 'brand.ink' })}
                                    >
                                        <option value="0.5">30분 내외</option>
                                        <option value="1">1시간 내외</option>
                                        <option value="2">2시간 내외</option>
                                        <option value="3">3시간 이상</option>
                                        <option value="5">5시간 이상</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', mb: '8px', color: 'brand.ink' })}>
                                        <Bell size={14} className={css({ color: 'brand.primary' })} /> 알림 설정
                                    </label>
                                    <select
                                        value={alarmMinutes}
                                        onChange={e => setAlarmMinutes(parseInt(e.target.value))}
                                        className={css({ w: '100%', p: '14px', bg: 'bg.softCotton', border: '1px solid', borderColor: 'brand.hairlineSoft', borderRadius: '12px', outline: 'none', fontSize: '14px', fontWeight: '600', color: 'brand.ink' })}
                                    >
                                        <option value="0">알림 없음</option>
                                        <option value="10">10분 전</option>
                                        <option value="30">30분 전</option>
                                        <option value="60">1시간 전</option>
                                        <option value="120">2시간 전</option>
                                        <option value="1440">1일 전</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', mb: '8px', color: 'brand.ink' })}>
                                    💰 예상 비용
                                </label>
                                <input
                                    type="number"
                                    placeholder="금액을 입력하세요 (예: 500)"
                                    value={cost}
                                    onChange={e => setCost(e.target.value)}
                                    className={css({ w: '100%', p: '14px', bg: 'white', border: '1px solid', borderColor: 'brand.hairlineSoft', borderRadius: '8px', outline: 'none', fontSize: '14px', fontWeight: '700', color: 'brand.ink' })}
                                />
                            </div>

                            <div>
                                <label className={css({ display: 'block', fontSize: '13px', fontWeight: '700', mb: '8px', color: 'brand.ink' })}>📝 메모/남길 말</label>
                                <textarea
                                    placeholder="장소의 특징이나 미리 알아둘 것이 있다면 적어주세요!"
                                    value={memo}
                                    onChange={e => setMemo(e.target.value)}
                                    className={css({
                                        w: '100%', h: '90px', p: '16px', bg: 'white', border: '1px solid', borderColor: 'brand.hairlineSoft', borderRadius: '8px',
                                        fontSize: '14px', fontWeight: '500', outline: 'none', transition: 'all 0.2s', resize: 'none', color: 'brand.ink',
                                        _focus: { borderColor: 'brand.primary', boxShadow: '0 0 0 4px rgba(var(--colors-brand-primary-rgb), 0.1)' }
                                    })}
                                />
                            </div>

                            {error && (
                                <div className={css({ p: '14px', bg: 'bg.softCotton', color: 'brand.error', borderRadius: '12px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' })}>
                                    <Info size={16} /> {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={css({
                                    w: '100%', py: '18px', bg: 'brand.primary', color: 'white', borderRadius: '12px', fontWeight: '800',
                                    fontSize: '17px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', gap: '8px',
                                    transition: 'all 0.3s', _disabled: { opacity: 0.6 },
                                    _hover: { bg: 'brand.primary', transform: 'translateY(-2px)', boxShadow: 'airbnbHover' }, 
                                    _active: { transform: 'scale(0.97)' }
                                })}
                            >
                                {loading ? <><Loader2 size={20} className={css({ animation: 'spin 1.5s linear infinite' })} /> 저장 중...</> : <><Check size={20} strokeWidth={3} /> {editData ? '수정 완료' : '일정 추가하기'}</>}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .pac-container { 
                    border-radius: 16px; 
                    border: none; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1); 
                    margin-top: 8px;
                    padding: 8px 0;
                    font-family: inherit;
                    z-index: 4000 !important;
                }
                .pac-item { 
                    padding: 10px 16px; 
                    cursor: pointer; 
                    display: flex;
                    align-items: center;
                }
                .pac-item:hover { background-color: token(colors.bg.softCotton); }
                .pac-item-query { font-size: 14px; font-weight: 700; color: token(colors.brand.ink); }
                .pac-matched { color: token(colors.brand.primary); }
                .pac-icon { display: none; }
            `}</style>
        </div>
    )
}
