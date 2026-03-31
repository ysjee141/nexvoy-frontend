'use client'

import { analytics } from '@/services/AnalyticsService'
import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { X, MapPin, Clock, Link as LinkIcon, AlignLeft, ChevronLeft, ChevronDown } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useLoadScript, Autocomplete } from '@react-google-maps/api'
import { getCurrencyFromTimezone } from '@/utils/currency'
import { useModalBackButton } from '@/hooks/useModalBackButton'

const libraries: ("places")[] = ["places"]

interface NewPlanModalProps {
    tripId: string
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
    editData?: any // 수정 모드 시 주입되는 데이터
}

export default function NewPlanModal({ tripId, isOpen, onClose, onSuccess, editData }: NewPlanModalProps) {
    const { isLoaded } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
        libraries,
        language: 'ko',
    })

    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)
    const [loading, setLoading] = useState(false)

    useModalBackButton(isOpen, onClose, editData ? `editPlanModal_${editData.id}` : 'newPlanModal')

    // 폼 상태
    const [title, setTitle] = useState('')
    const [localDate, setLocalDate] = useState('')
    const [localTime, setLocalTime] = useState('')
    const [locationName, setLocationName] = useState('')
    const [locationLat, setLocationLat] = useState<number | null>(null)
    const [locationLng, setLocationLng] = useState<number | null>(null)
    const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null)
    const [timezoneString, setTimezoneString] = useState('Asia/Seoul')
    const [cost, setCost] = useState<number>(0)
    const [memo, setMemo] = useState('')
    const [urls, setUrls] = useState<string[]>([''])
    const [alarmMinutesBefore, setAlarmMinutesBefore] = useState<number | null>(null)

    // 수정 모드 데이터 초기화
    useEffect(() => {
        if (isOpen && editData) {
            setTitle(editData.title || '')
            setLocationName(editData.location || '')
            setLocationLat(editData.location_lat ?? null)
            setLocationLng(editData.location_lng ?? null)
            setGooglePlaceId(editData.google_place_id ?? null)
            setTimezoneString(editData.timezone_string || 'Asia/Seoul')
            setCost(editData.cost || 0)
            setMemo(editData.memo || '')

            // YYYY-MM-DDTHH:mm:ss 포맷에서 날짜/시간 분리 (문자열 파싱)
            if (editData.start_datetime_local) {
                const parts = editData.start_datetime_local.split('T')
                if (parts.length === 2) {
                    setLocalDate(parts[0])
                    setLocalTime(parts[1].substring(0, 5)) // HH:mm
                }
            }

            setAlarmMinutesBefore(editData.alarm_minutes_before ?? null)

            // editData.plan_urls (URL 목록)이 있다면 세팅
            if (editData.plan_urls && Array.isArray(editData.plan_urls) && editData.plan_urls.length > 0) {
                setUrls(editData.plan_urls.map((pu: any) => pu.url))
            } else {
                setUrls([''])
            }
        } else if (isOpen && !editData) {
            // 초기화
            setTitle('')
            setLocalDate('')
            setLocalTime('')
            setLocationName('')
            setLocationLat(null)
            setLocationLng(null)
            setGooglePlaceId(null)
            setTimezoneString('Asia/Seoul')
            setCost(0)
            setUrls([''])
            setAlarmMinutesBefore(null)
        }
    }, [isOpen, editData])

    // 통화별 퀵 버튼 설정
    const getQuickAddButtons = (currencyCode: string) => {
        const highVal = ['KRW', 'VND', 'IDR'] // +1만, +5만, +10만
        const midVal = ['JPY', 'THB', 'TWD', 'PHP'] // +1천, +5천, +1만
        
        if (highVal.includes(currencyCode)) {
            return [
                { label: '+1만', value: 10000 },
                { label: '+5만', value: 50000 },
                { label: '+10만', value: 100000 },
            ]
        }
        if (midVal.includes(currencyCode)) {
            return [
                { label: '+1천', value: 1000 },
                { label: '+5천', value: 5000 },
                { label: '+1만', value: 10000 },
            ]
        }
        // 기본 (USD, EUR 등)
        return [
            { label: '+10', value: 10 },
            { label: '+50', value: 50 },
            { label: '+100', value: 100 },
        ]
    }

    const handleUrlChange = (index: number, value: string) => {
        const newUrls = [...urls]
        newUrls[index] = value
        setUrls(newUrls)
    }

    const addUrlField = () => setUrls([...urls, ''])

    const removeUrlField = (index: number) => {
        if (urls.length > 1) {
            setUrls(urls.filter((_, i) => i !== index))
        }
    }

    const onLoad = (autoC: google.maps.places.Autocomplete) => setAutocomplete(autoC)

    const onPlaceChanged = async () => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace()
            if (place.geometry?.location) {
                const lat = place.geometry.location.lat()
                const lng = place.geometry.location.lng()
                setLocationName(place.name || place.formatted_address || '')
                setLocationLat(lat)
                setLocationLng(lng)
                setGooglePlaceId(place.place_id || null)

                try {
                    const res = await fetch(`/api/timezone?lat=${lat}&lng=${lng}`)
                    const data = await res.json()
                    if (data.timeZoneId) {
                        setTimezoneString(data.timeZoneId)
                    }
                } catch (e) {
                    console.error("Timezone fetch error", e)
                }
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const supabase = createClient()

        // 시간 포맷 생성 (임시로 종료 시간은 시작 시간과 동일하게 설정)
        const startDatetime = `${localDate}T${localTime}:00`
        const endDatetime = startDatetime // 추후 종료 시간 필드 추가 시 변경

        const payload = {
            trip_id: tripId,
            title,
            location: locationName,
            location_lat: locationLat,
            location_lng: locationLng,
            google_place_id: googlePlaceId,
            cost: cost,
            memo,
            start_datetime_local: startDatetime,
            end_datetime_local: endDatetime,
            timezone_string: timezoneString,
            alarm_minutes_before: alarmMinutesBefore
        }

        let planId = editData?.id
        let planError = null

        // 1. plans 테이블 처리 (Update or Insert)
        if (editData) {
            const { error } = await supabase.from('plans').update(payload).eq('id', planId)
            planError = error
        } else {
            const { data: plan, error } = await supabase.from('plans').insert(payload).select().single()
            planError = error
            if (plan) planId = plan.id
        }

        if (planError || !planId) {
            console.error('Plan save error:', planError)
            alert('일정 저장에 실패했습니다. 다시 시도해주세요.')
            setLoading(false)
            return
        }

        // 2. URL 변경 처리 (수정 시 기존 URL 모두 지우고 통으로 새로 Insert 하는 전략 채택)
        if (editData) {
            await supabase.from('plan_urls').delete().eq('plan_id', planId)
        }

        const validUrls = urls.filter((u: any) => u.trim() !== '')
        if (validUrls.length > 0) {
            const urlInserts = validUrls.map((url: any) => ({
                plan_id: planId,
                url: url
            }))

            const { error: urlError } = await supabase
                .from('plan_urls')
                .insert(urlInserts)

            if (urlError) {
                console.error('URL save error:', urlError)
            }
        }

        // 애널리틱스 기록
        analytics.logPlanAdd('일정', locationName, alarmMinutesBefore !== null)
        
        setLoading(false)
        onSuccess?.()
        onClose()
    }

    if (!isOpen) return null

    const currency = getCurrencyFromTimezone(timezoneString)
    const quickButtons = getQuickAddButtons(currency.code)

    return (
        // sm 미만(모바일): 전체 화면 표시 / sm 이상(데스크탑): dim 오버레이 위에 모달
        <div
            className={css({
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                backgroundColor: { base: 'white', sm: 'rgba(0,0,0,0.4)' },
                display: 'flex',
                alignItems: { base: 'flex-start', sm: 'center' },
                justifyContent: 'center',
                p: { base: '0', sm: '20px' },
            })}
        >
            <div
                className={css({
                    bg: 'white',
                    w: '100%',
                    maxW: { base: '100%', sm: '500px' },
                    h: { base: '100%', sm: 'auto' },
                    maxH: { base: '100dvh', sm: '90vh' },
                    overflowY: 'auto',
                    borderRadius: { base: '0', sm: '16px' },
                    boxShadow: { base: 'none', sm: '0 10px 40px rgba(0,0,0,0.1)' },
                    display: 'flex',
                    flexDirection: 'column',
                    pt: { base: 'env(safe-area-inset-top)', sm: '0' },
                })}
            >
                {/* 헤더: 모바일은 iOS 스타일 ← 뒤로가기, 데스크탑은 X 닫기 */}
                <div className={css({ p: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, bg: 'white', zIndex: 10 })}>
                    {/* 모바일: 뒤로가기 버튼 위치 */}
                    <button
                        onClick={onClose}
                        className={css({
                            display: { base: 'flex', sm: 'none' },
                            alignItems: 'center',
                            bg: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#3B82F6',
                            p: '0',
                            zIndex: 1,
                        })}
                    >
                        <ChevronLeft size={26} />
                    </button>
                    {/* 타이틀: 모바일에서 absolute로 완전 중앙 고정 */}
                    <h2 className={css({
                        fontSize: '17px',
                        fontWeight: 'bold',
                        position: { base: 'absolute', sm: 'static' },
                        left: { base: '50%', sm: 'auto' },
                        transform: { base: 'translateX(-50%)', sm: 'none' },
                        textAlign: { base: 'center', sm: 'left' },
                        flex: { base: 'none', sm: 1 },
                        whiteSpace: 'nowrap',
                    })}>
                        {editData ? '일정 수정하기' : '새 일정 추가하기'}
                    </h2>
                    {/* 데스크탑: X 닫기 버튼 */}
                    <button
                        onClick={onClose}
                        className={css({
                            display: { base: 'none', sm: 'flex' },
                            bg: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#666',
                            _hover: { color: '#172554' }
                        })}
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={css({ p: { base: '16px', sm: '24px' }, display: 'flex', flexDirection: 'column', gap: '20px', overflowX: 'hidden' })}>
                    <div>
                        <label className={css({ display: 'block', fontSize: '14px', fontWeight: '600', mb: '6px' })}>일정 제목 *</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="예: 에펠탑 방문 🗼"
                            className={css({ w: '100%', p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', _focus: { borderColor: '#3B82F6' } })}
                        />
                    </div>

                    <div>
                        <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', mb: '6px' })}>
                            <MapPin size={16} /> 장소 검색
                        </label>
                        {isLoaded ? (
                            <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
                                <input
                                    type="text"
                                    value={locationName}
                                    onChange={e => {
                                        setLocationName(e.target.value)
                                        setLocationLat(null)
                                        setLocationLng(null)
                                        setGooglePlaceId(null)
                                    }}
                                    placeholder="어디로 떠나시나요? 🗺️"
                                    className={css({ w: '100%', p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', _focus: { borderColor: '#3B82F6' }, bg: '#f9f9f9' })}
                                />
                            </Autocomplete>
                        ) : (
                            <input
                                type="text"
                                value={locationName}
                                onChange={e => setLocationName(e.target.value)}
                                placeholder="지도 로딩 중..."
                                disabled
                                className={css({ w: '100%', p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', bg: '#f1f1f1' })}
                            />
                        )}
                    </div>

                    <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' }, gap: '12px' })}>
                        <div>
                            <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', mb: '6px' })}>
                                <Clock size={16} /> 현지 날짜 *
                            </label>
                            <div style={{ overflow: 'hidden', width: '100%' }}>
                                <input
                                    type="date"
                                    required
                                    value={localDate}
                                    onChange={e => setLocalDate(e.target.value)}
                                    style={{ minWidth: 0 }}
                                    className={css({ w: '100%', maxW: '100%', boxSizing: 'border-box', p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', fontSize: '14px', _focus: { borderColor: '#3B82F6' } })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', mb: '6px' })}>
                                <Clock size={16} /> 현지 시작 시간 *
                            </label>
                            <div style={{ overflow: 'hidden', width: '100%' }}>
                                <input
                                    type="time"
                                    required
                                    value={localTime}
                                    onChange={e => setLocalTime(e.target.value)}
                                    style={{ minWidth: 0 }}
                                    className={css({ w: '100%', maxW: '100%', boxSizing: 'border-box', p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', fontSize: '14px', _focus: { borderColor: '#3B82F6' } })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={css({ bg: '#f8f9fa', p: '12px', borderRadius: '8px', border: '1px solid #eee' })}>
                        <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '4px' })}>
                            <span className={css({ fontSize: '13px', fontWeight: 'bold', color: '#444' })}>✈️ 지금 이 일정의 시간 기준</span>
                            <span className={css({ fontSize: '12px', bg: '#EFF6FF', color: '#3B82F6', px: '8px', py: '2px', borderRadius: '4px', fontWeight: 'bold' })}>
                                {timezoneString}
                            </span>
                        </div>
                        <p className={css({ fontSize: '12px', color: '#666', lineHeight: 1.4 })}>
                            입력하신 시간은 현지 타임존을 기준으로 표시돼요. 장소를 검색하시면 그곳의 시간에 맞춰 자동으로 변경해 드릴게요! ✨
                        </p>
                    </div>

                    <div>
                        {/* 통화 심볼은 타임존 기반으로 자동 결정 */}
                        {(() => {
                            const currency = getCurrencyFromTimezone(timezoneString)
                            return (
                                <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', mb: '6px' })}>
                                    <span className={css({ fontSize: '15px', fontWeight: '700', color: '#3B82F6', minW: '20px' })}>
                                        {currency.symbol}
                                    </span>
                                    예상 금액
                                    <span className={css({ fontSize: '12px', color: '#999', fontWeight: '400' })}>({currency.code})</span>
                                </label>
                            )
                        })()}
                        <div className={css({ 
                            position: 'relative', 
                            display: 'flex', 
                            alignItems: 'center',
                            border: '1px solid #ddd', 
                            borderRadius: '12px',
                            bg: 'white',
                            _focusWithin: { borderColor: '#3B82F6', ring: '2px solid rgba(59, 130, 246, 0.1)' },
                            transition: 'all 0.2s'
                        })}>
                            {/* 좌측 고정 통화 기호 */}
                            <span className={css({ 
                                paddingLeft: '16px',
                                fontSize: '16px',
                                fontWeight: '700',
                                color: '#3B82F6',
                                userSelect: 'none',
                                pointerEvents: 'none'
                            })}>
                                {currency.symbol}
                            </span>
                            
                            <input
                                type="text"
                                value={cost === 0 ? '' : cost.toLocaleString()}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^0-9]/g, '')
                                    setCost(val === '' ? 0 : Number(val))
                                }}
                                placeholder="0"
                                className={css({ 
                                    flex: 1,
                                    p: '14px 16px', 
                                    paddingLeft: '8px',
                                    paddingRight: '44px',
                                    border: 'none', 
                                    bg: 'transparent',
                                    outline: 'none', 
                                    fontSize: '18px', 
                                    fontWeight: '700',
                                    textAlign: 'right',
                                    color: '#222',
                                    _placeholder: { color: '#ccc' }
                                })}
                            />
                            
                            {cost > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setCost(0)}
                                    className={css({ 
                                        position: 'absolute', 
                                        right: '12px', 
                                        border: 'none', 
                                        bg: '#f1f3f4', 
                                        color: '#666', 
                                        cursor: 'pointer', 
                                        w: '24px',
                                        h: '24px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        _hover: { bg: '#e8eaed', color: '#222' }
                                    })}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        {/* 퀵 버튼 도구 */}
                        <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '8px', mt: '10px' })}>
                            {quickButtons.map((btn, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setCost(prev => (typeof prev === 'number' ? prev : 0) + btn.value)}
                                    className={css({
                                        px: '12px', py: '6px', fontSize: '12px', fontWeight: '700',
                                        bg: '#f1f3f4', color: '#555', border: '1px solid #eee', borderRadius: '20px',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                        _hover: { bg: '#e8eaed', borderColor: '#ddd', color: '#222' },
                                        _active: { transform: 'scale(0.95)', bg: '#3B82F6', color: 'white', borderColor: '#3B82F6' }
                                    })}
                                >
                                    {btn.label}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setCost(0)}
                                className={css({
                                    px: '10px', py: '6px', fontSize: '12px', fontWeight: 'bold',
                                    bg: 'white', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '20px',
                                    cursor: 'pointer', _hover: { bg: '#fef2f2' }
                                })}
                            >
                                초기화
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', mb: '6px' })}>
                            <LinkIcon size={16} /> 참고할 링크 (URL)
                        </label>
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                            {urls.map((url, i) => (
                                <div key={i} className={css({ display: 'flex', gap: '8px' })}>
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={e => handleUrlChange(i, e.target.value)}
                                        placeholder="https://..."
                                        className={css({ flex: 1, p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', _focus: { borderColor: '#3B82F6' } })}
                                    />
                                    {urls.length > 1 && (
                                        <button type="button" onClick={() => removeUrlField(i)} className={css({ px: '12px', color: '#dc2626', bg: '#fee2e2', borderRadius: '8px', border: 'none', cursor: 'pointer' })}>
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button type="button" onClick={addUrlField} className={css({ p: '10px', bg: '#f8f9fa', color: '#555', borderRadius: '8px', border: '1px dashed #ccc', cursor: 'pointer', fontSize: '14px', _hover: { bg: '#f1f3f4' } })}>
                                + URL 추가
                            </button>
                        </div>
                    </div>

                    {/* 알림 설정 */}
                    <div>
                        <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', mb: '6px' })}>
                            🔔 언제 알려드릴까요?
                        </label>
                        <div className={css({ position: 'relative', w: '100%' })}>
                            <select
                                value={alarmMinutesBefore ?? ''}
                                onChange={e => setAlarmMinutesBefore(e.target.value === '' ? null : Number(e.target.value))}
                                className={css({ w: '100%', p: '14px 40px 14px 16px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', bg: 'white', color: '#1E3A8A', fontSize: '14px', fontWeight: '500', cursor: 'pointer', appearance: 'none', _focus: { borderColor: '#3B82F6' } })}
                            >
                                <option value="">알림 없음</option>
                                <option value="10">출발 10분 전</option>
                                <option value="30">출발 30분 전</option>
                                <option value="60">출발 1시간 전</option>
                                <option value="180">출발 3시간 전</option>
                                <option value="1440">하루 전</option>
                            </select>
                            <div className={css({ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#888' })}>
                                <ChevronDown size={18} />
                            </div>
                        </div>
                        {alarmMinutesBefore !== null && (
                            <p className={css({ fontSize: '12px', color: '#666', mt: '6px' })}>
                                💡 알림 권한을 허용해 주시면 제때 알려드릴 수 있어요!
                            </p>
                        )}
                    </div>

                    <div>
                        <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', mb: '6px' })}>
                            <AlignLeft size={16} /> 메모
                        </label>
                        <textarea
                            value={memo}
                            onChange={e => setMemo(e.target.value)}
                            placeholder="함께 적어둘 내용이 있나요? ✍️"
                            rows={3}
                            className={css({ w: '100%', p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', resize: 'vertical', _focus: { borderColor: '#3B82F6' } })}
                        />
                    </div>

                    <div className={css({ display: 'flex', justifyContent: 'flex-end', gap: '12px', mt: '8px', pt: '20px', borderTop: '1px solid #eee', flexDirection: { base: 'column-reverse', sm: 'row' } })}>
                        <button
                            type="button"
                            onClick={onClose}
                            className={css({ px: '16px', py: '12px', color: '#555', bg: 'white', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' })}
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={css({ px: '24px', py: '12px', bg: '#111', color: 'white', borderRadius: '8px', fontWeight: '800', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontSize: '14px', _hover: { bg: '#333' } })}
                        >
                            {loading ? '저장 중...' : editData ? '수정할게요' : '일정 추가하기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
