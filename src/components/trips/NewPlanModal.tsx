'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { X, MapPin, Clock, Link as LinkIcon, AlignLeft, ChevronLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useLoadScript, Autocomplete } from '@react-google-maps/api'
import { getCurrencyFromTimezone } from '@/utils/currency'

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

    // 폼 상태
    const [title, setTitle] = useState('')
    const [localDate, setLocalDate] = useState('')
    const [localTime, setLocalTime] = useState('')
    const [locationName, setLocationName] = useState('')
    const [timezoneString, setTimezoneString] = useState('Asia/Seoul')
    const [cost, setCost] = useState<number | ''>('')
    const [memo, setMemo] = useState('')
    const [urls, setUrls] = useState<string[]>([''])
    const [alarmMinutesBefore, setAlarmMinutesBefore] = useState<number | null>(null)

    // 수정 모드 데이터 초기화
    useEffect(() => {
        if (isOpen && editData) {
            setTitle(editData.title || '')
            setLocationName(editData.location || '')
            setTimezoneString(editData.timezone_string || 'Asia/Seoul')
            setCost(editData.cost || '')
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
            setTimezoneString('Asia/Seoul')
            setCost('')
            setMemo('')
            setUrls([''])
            setAlarmMinutesBefore(null)
        }
    }, [isOpen, editData])

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

                try {
                    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || '';
                    const res = await fetch(`${apiUrl}/api/timezone?lat=${lat}&lng=${lng}`)
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
            cost: cost === '' ? 0 : cost,
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

        setLoading(false)
        onSuccess?.()
        onClose()
    }

    if (!isOpen) return null

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
                            color: '#4285F4',
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
                        {editData ? '일정 수정' : '새 일정 추가'}
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
                            _hover: { color: '#111' }
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
                            placeholder="예: 에펠탑 방문"
                            className={css({ w: '100%', p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', _focus: { borderColor: '#4285F4' } })}
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
                                    onChange={e => setLocationName(e.target.value)}
                                    placeholder="어디에 가시나요? 장소 자동완성"
                                    className={css({ w: '100%', p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', _focus: { borderColor: '#4285F4' }, bg: '#f9f9f9' })}
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
                                    className={css({ w: '100%', maxW: '100%', boxSizing: 'border-box', p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', fontSize: '14px', _focus: { borderColor: '#4285F4' } })}
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
                                    className={css({ w: '100%', maxW: '100%', boxSizing: 'border-box', p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', fontSize: '14px', _focus: { borderColor: '#4285F4' } })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={css({ bg: '#f8f9fa', p: '12px', borderRadius: '8px', border: '1px solid #eee' })}>
                        <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '4px' })}>
                            <span className={css({ fontSize: '13px', fontWeight: 'bold', color: '#444' })}>✈️ 현재 설정된 타임존</span>
                            <span className={css({ fontSize: '12px', bg: '#e8f0fe', color: '#1a73e8', px: '8px', py: '2px', borderRadius: '4px', fontWeight: 'bold' })}>
                                {timezoneString}
                            </span>
                        </div>
                        <p className={css({ fontSize: '12px', color: '#666', lineHeight: 1.4 })}>
                            입력하신 시간은 현지 타임존 기준입니다. 장소를 검색하면 타임존이 현지에 맞게 자동 변경됩니다.
                        </p>
                    </div>

                    <div>
                        {/* 통화 심볼은 타임존 기반으로 자동 결정 */}
                        {(() => {
                            const currency = getCurrencyFromTimezone(timezoneString)
                            return (
                                <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', mb: '6px' })}>
                                    <span className={css({ fontSize: '15px', fontWeight: '700', color: '#4285F4', minW: '20px' })}>
                                        {currency.symbol}
                                    </span>
                                    예상 금액
                                    <span className={css({ fontSize: '12px', color: '#999', fontWeight: '400' })}>({currency.code})</span>
                                </label>
                            )
                        })()}
                        <input
                            type="number"
                            value={cost}
                            onChange={e => setCost(Number(e.target.value) || '')}
                            placeholder="숫자만 입력"
                            className={css({ w: '100%', p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', _focus: { borderColor: '#4285F4' } })}
                        />
                    </div>

                    <div>
                        <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', mb: '6px' })}>
                            <LinkIcon size={16} /> 참조 URL 목록
                        </label>
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                            {urls.map((url, i) => (
                                <div key={i} className={css({ display: 'flex', gap: '8px' })}>
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={e => handleUrlChange(i, e.target.value)}
                                        placeholder="https://..."
                                        className={css({ flex: 1, p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', _focus: { borderColor: '#4285F4' } })}
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
                            🔔 알림 설정
                        </label>
                        <select
                            value={alarmMinutesBefore ?? ''}
                            onChange={e => setAlarmMinutesBefore(e.target.value === '' ? null : Number(e.target.value))}
                            className={css({ w: '100%', p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', bg: 'white', _focus: { borderColor: '#4285F4' } })}
                        >
                            <option value="">알림 없음</option>
                            <option value="10">출발 10분 전</option>
                            <option value="30">출발 30분 전</option>
                            <option value="60">출발 1시간 전</option>
                            <option value="180">출발 3시간 전</option>
                            <option value="1440">하루 전</option>
                        </select>
                        {alarmMinutesBefore !== null && (
                            <p className={css({ fontSize: '12px', color: '#666', mt: '6px' })}>
                                💡 브라우저 알림 권한이 허용되어 있어야 알림이 동작합니다.
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
                            placeholder="일정에 필요한 메모를 남겨주세요"
                            rows={3}
                            className={css({ w: '100%', p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', resize: 'vertical', _focus: { borderColor: '#4285F4' } })}
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
                            {loading ? '저장 중...' : editData ? '수정 완료' : '일정 추가하기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
