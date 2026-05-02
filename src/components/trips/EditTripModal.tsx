'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { X, MapPin, Calendar, Users, Minus, Plus, Loader2, Check, Sparkles } from 'lucide-react'
import { useLoadScript, Autocomplete } from '@react-google-maps/api'
import { useModalBackButton } from '@/hooks/useModalBackButton'
import { useScrollLock } from '@/hooks/useScrollLock'
import { analytics } from '@/services/AnalyticsService'

const libraries: ("places")[] = ["places"]

interface EditTripModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: (updatedFields: {
        destination: string
        start_date: string
        end_date: string
        adults_count: number
        children_count: number
    }) => void
    trip: any
}

export default function EditTripModal({ isOpen, onClose, onSuccess, trip }: EditTripModalProps) {
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // ── 폼 상태 ──
    const [destination, setDestination] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [adults, setAdults] = useState(1)
    const [childrenCount, setChildren] = useState(0)

    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)

    const resetForm = useCallback(() => {
        if (trip) {
            setDestination(trip.destination || '')
            setStartDate(trip.start_date || '')
            setEndDate(trip.end_date || '')
            setAdults(trip.adults_count || 1)
            setChildren(trip.children_count || 0)
        }
        setError('')
    }, [trip])

    useEffect(() => {
        if (isOpen && trip) {
            resetForm()
        }
    }, [isOpen, trip, resetForm])

    const isDirty = useCallback(() => {
        if (!trip) return false
        return (
            destination !== (trip.destination || '') ||
            startDate !== (trip.start_date || '') ||
            endDate !== (trip.end_date || '') ||
            adults !== (trip.adults_count || 1) ||
            childrenCount !== (trip.children_count || 0)
        )
    }, [trip, destination, startDate, endDate, adults, childrenCount])

    const handleClose = useCallback(() => {
        if (isDirty()) {
            if (!window.confirm('수정 중인 내용이 사라집니다. 그래도 닫으시겠습니까?')) {
                return
            }
        }
        onClose()
    }, [isDirty, onClose])

    useModalBackButton(isOpen, handleClose, 'editTripModal')
    useScrollLock(isOpen)

    const { isLoaded } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
        libraries,
        language: 'ko',
    })

    const onPlaceChanged = () => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace()
            setDestination(place.name || place.formatted_address || '')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!destination) {
            setError('여행지를 입력해주세요.')
            return
        }

        if (new Date(startDate) > new Date(endDate)) {
            setError('종료일이 시작일보다 빠를 수 없습니다.')
            return
        }

        setLoading(true)
        setError('')

        try {
            const { error: updateError } = await supabase
                .from('trips')
                .update({
                    destination,
                    start_date: startDate,
                    end_date: endDate,
                    adults_count: adults,
                    children_count: childrenCount,
                })
                .eq('id', trip.id)

            if (updateError) throw updateError

            onSuccess({
                destination,
                start_date: startDate,
                end_date: endDate,
                adults_count: adults,
                children_count: childrenCount,
            })
            onClose()
        } catch (err: any) {
            setError(err.message || '여행 정보를 수정하는 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen || !trip) return null

    return (
        <div className={css({
            position: 'fixed', inset: 0, zIndex: 3000,
            bg: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: { base: 'flex-start', sm: 'center' },
            justifyContent: 'center', p: { base: '0', sm: '20px' },
            animation: 'fadeIn 0.3s ease-out'
        })}>
            <div className={css({
                bg: 'white', w: '100%', maxW: { base: '100%', sm: '520px' },
                h: { base: '100dvh', sm: 'auto' }, maxH: { base: '100dvh', sm: '90vh' },
                overflowY: 'auto', borderRadius: { base: '0', sm: '16px' },
                boxShadow: { base: 'none', sm: 'airbnbHover' },
                display: 'flex', flexDirection: 'column',
                pb: { base: 'max(env(safe-area-inset-bottom), var(--safe-area-inset-bottom))', sm: '0' },
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)'
            })}>
                {/* 헤더 */}
                <div className={css({
                    p: '22px 24px',
                    pt: { base: 'calc(22px + max(env(safe-area-inset-top), var(--safe-area-inset-top)))', sm: '22px' },
                    borderBottom: '1px solid', borderBottomColor: 'brand.hairline', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, bg: 'white', zIndex: 10
                })}>
                    <div style={{ width: '40px' }} />
                    <h2 className={css({ fontSize: '18px', fontWeight: '700', color: 'brand.ink', letterSpacing: '-0.02em', position: 'absolute', left: '50%', transform: 'translateX(-50%)' })}>
                        여행 정보 수정
                    </h2>
                    <button
                        onClick={handleClose}
                        className={css({ p: '8px', borderRadius: '50%', bg: 'bg.softCotton', color: 'brand.muted', transition: 'all 0.2s', _hover: { bg: 'rgba(0,0,0,0.05)', color: 'brand.ink', transform: 'rotate(90deg)' } })}
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                <div className={css({ p: { base: '20px', sm: '32px' }, flex: 1 })}>
                    <form onSubmit={handleSubmit} className={css({ display: 'flex', flexDirection: 'column', gap: '28px' })}>
                        
                        <div className={css({ textAlign: 'center', mb: '4px' })}>
                            <div className={css({ w: '60px', h: '60px', bg: 'brand.primary/10', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', m: '0 auto 16px' })}>
                                <Sparkles size={28} className={css({ color: 'brand.primary' })} strokeWidth={2.2} />
                            </div>
                            <h3 className={css({ fontSize: '22px', fontWeight: '800', color: 'brand.ink', mb: '6px', letterSpacing: '-0.03em' })}>기존 계획을 수정할까요?</h3>
                            <p className={css({ color: 'brand.muted', fontSize: '15px', fontWeight: '500' })}>변경된 일정이나 인원을 업데이트하세요.</p>
                        </div>

                        {/* 목적지 */}
                        <div>
                            <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '700', mb: '10px', color: 'brand.ink' })}>
                                <MapPin size={16} className={css({ color: 'brand.primary' })} /> 여행지 (국가/도시) *
                            </label>
                            {isLoaded ? (
                                <Autocomplete onLoad={(a) => setAutocomplete(a)} onPlaceChanged={onPlaceChanged}>
                                    <input
                                        type="text"
                                        required
                                        value={destination}
                                        onChange={e => setDestination(e.target.value)}
                                        placeholder="공항, 도시, 또는 명소를 검색하세요"
                                        className={css({
                                            w: '100%', p: '18px 20px', bg: 'white', border: '1px solid', borderColor: 'brand.hairline',
                                            borderRadius: '8px', fontSize: '16px', fontWeight: '600', outline: 'none',
                                            transition: 'all 0.3s', _focus: { borderColor: 'brand.primary', boxShadow: '0 0 0 5px rgba(var(--colors-brand-primary-rgb), 0.1)' }
                                        })}
                                    />
                                </Autocomplete>
                            ) : (
                                <div className={css({ w: '100%', p: '18px 20px', bg: 'white', borderRadius: '8px', border: '1px solid', borderColor: 'brand.hairline', color: 'brand.muted', display: 'flex', alignItems: 'center', gap: '10px' })}>
                                    <Loader2 size={18} className={css({ animation: 'spin 1.5s linear infinite' })} /> 지도 정보를 불러오는 중...
                                </div>
                            )}
                        </div>

                        {/* 날짜 */}
                        <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' })}>
                            <div>
                                <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '700', mb: '10px', color: 'brand.ink' })}>
                                    <Calendar size={16} className={css({ color: 'brand.primary' })} /> 시작일 *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className={css({ w: '100%', p: '16px', bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', outline: 'none', fontSize: '15px', fontWeight: '600', transition: 'all 0.2s', _focus: { borderColor: 'brand.primary' } })}
                                />
                            </div>
                            <div>
                                <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '700', mb: '10px', color: 'brand.ink' })}>
                                    <Calendar size={16} className={css({ color: 'brand.primary' })} /> 종료일 *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className={css({ w: '100%', p: '16px', bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', outline: 'none', fontSize: '15px', fontWeight: '600', transition: 'all 0.2s', _focus: { borderColor: 'brand.primary' } })}
                                />
                            </div>
                        </div>

                        {/* 인원 */}
                        <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' })}>
                            <div>
                                <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '700', mb: '10px', color: 'brand.ink' })}>
                                    <Users size={16} className={css({ color: 'brand.primary' })} /> 성인
                                </label>
                                <div className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    p: '8px', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', bg: 'white'
                                })}>
                                    <button
                                        type="button"
                                        disabled={adults <= 1}
                                        onClick={() => setAdults(v => v - 1)}
                                        className={css({
                                            w: '36px', h: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            bg: adults <= 1 ? 'rgba(0,0,0,0.05)' : 'brand.primary/10', color: adults <= 1 ? 'brand.muted' : 'brand.primary',
                                            cursor: adults <= 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s', _hover: { bg: adults <= 1 ? 'rgba(0,0,0,0.05)' : 'brand.primary/20' }
                                        })}
                                    >
                                        <Minus size={18} strokeWidth={3} />
                                    </button>
                                    <span className={css({ fontSize: '16px', fontWeight: '700', color: 'brand.ink' })}>{adults}</span>
                                    <button
                                        type="button"
                                        onClick={() => setAdults(v => v + 1)}
                                        className={css({
                                            w: '36px', h: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            bg: 'brand.primary', color: 'white', cursor: 'pointer', transition: 'all 0.2s',
                                            _hover: { bg: 'brand.primaryActive', boxShadow: 'airbnbHover' }
                                        })}
                                    >
                                        <Plus size={18} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '700', mb: '10px', color: 'brand.ink' })}>
                                    <Users size={16} className={css({ color: 'brand.primary' })} /> 아이
                                </label>
                                <div className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    p: '8px', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', bg: 'white'
                                })}>
                                    <button
                                        type="button"
                                        disabled={childrenCount <= 0}
                                        onClick={() => setChildren(v => v - 1)}
                                        className={css({
                                            w: '36px', h: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            bg: childrenCount <= 0 ? 'rgba(0,0,0,0.05)' : 'brand.primary/10', color: childrenCount <= 0 ? 'brand.muted' : 'brand.primary',
                                            cursor: childrenCount <= 0 ? 'not-allowed' : 'pointer', transition: 'all 0.2s', _hover: { bg: childrenCount <= 0 ? 'rgba(0,0,0,0.05)' : 'brand.primary/20' }
                                        })}
                                    >
                                        <Minus size={18} strokeWidth={3} />
                                    </button>
                                    <span className={css({ fontSize: '16px', fontWeight: '700', color: 'brand.ink' })}>{childrenCount}</span>
                                    <button
                                        type="button"
                                        onClick={() => setChildren(v => v + 1)}
                                        className={css({
                                            w: '36px', h: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            bg: 'brand.primary', color: 'white', cursor: 'pointer', transition: 'all 0.2s',
                                            _hover: { bg: 'brand.primaryActive', boxShadow: 'airbnbHover' }
                                        })}
                                    >
                                        <Plus size={18} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className={css({ p: '14px', bg: 'brand.error/10', color: 'brand.error', borderRadius: '16px', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' })}>
                                ⚠️ {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={css({
                                w: '100%', py: '18px', bg: 'brand.primary', color: 'white', borderRadius: '8px', fontWeight: '800',
                                fontSize: '16px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', gap: '10px',
                                transition: 'all 0.3s', _disabled: { opacity: 0.6 },
                                _hover: { bg: 'brand.primaryActive', boxShadow: 'airbnbHover' }, 
                                _active: { transform: 'scale(0.97)' }
                            })}
                        >
                            {loading ? <><Loader2 size={20} className={css({ animation: 'spin 1.5s linear infinite' })} /> 저장 중...</> : <><Check size={20} strokeWidth={3} /> 수정 완료</>}
                        </button>
                    </form>
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
