'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Calendar, Users, Pencil, Trash2, X, ChevronLeft, Save, Loader2, Wallet, Minus, Plus } from 'lucide-react'
import { useLoadScript, Autocomplete } from '@react-google-maps/api'
import { getCurrencyFromTimezone, formatCurrency, formatKRW } from '@/utils/currency'
import { useModalBackButton } from '@/hooks/useModalBackButton'
import { formatDate } from '@/utils/date'

const libraries: ("places")[] = ["places"]

interface TripHeaderActionsProps {
    trip: {
        id: string
        destination: string
        start_date: string
        end_date: string
        adults_count: number
        children_count: number
        user_id: string
    }
    onUpdate?: (updatedFields: Partial<TripHeaderActionsProps['trip']>) => void
}

export default function TripHeaderActions({ trip, onUpdate }: TripHeaderActionsProps) {
    const router = useRouter()
    const supabase = createClient()

    const [isOwner, setIsOwner] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)

    useModalBackButton(showEditModal, () => setShowEditModal(false), 'tripEditModal')

    // 수정 폼 상태
    const [destination, setDestination] = useState(trip.destination)
    const [startDate, setStartDate] = useState(trip.start_date)
    const [endDate, setEndDate] = useState(trip.end_date)
    const [adults, setAdults] = useState(trip.adults_count)
    const [children, setChildren] = useState(trip.children_count)
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    // 총 비용 요약
    interface CostSummary {
        totalKrw: number | null        // 전체 KRW 환산 합 (환율 로드 완료 시)
        byCurrency: { code: string; symbol: string; total: number }[]  // 통화별 소계
        loading: boolean
    }
    const [costSummary, setCostSummary] = useState<CostSummary>({ totalKrw: null, byCurrency: [], loading: true })

    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)

    const { isLoaded } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
        libraries,
        language: 'ko',
    })

    const start = formatDate(trip.start_date)
    const end = formatDate(trip.end_date)

    useEffect(() => {
        const checkOwner = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user && user.id === trip.user_id) {
                setIsOwner(true)
            }
        }
        checkOwner()
    }, [supabase, trip.user_id])

    // 플랜 비용 합산
    useEffect(() => {
        const fetchCostSummary = async () => {
            const { data: plans } = await supabase
                .from('plans')
                .select('cost, timezone_string')
                .eq('trip_id', trip.id)
                .gt('cost', 0)

            if (!plans || plans.length === 0) {
                setCostSummary({ totalKrw: 0, byCurrency: [], loading: false })
                return
            }

            // 통화별 소계 집계
            const byCode: Record<string, { code: string; symbol: string; total: number }> = {}
            const uniqueNonKrw = new Set<string>()

            plans.forEach((p: any) => {
                const currency = getCurrencyFromTimezone(p.timezone_string || 'Asia/Seoul')
                if (!byCode[currency.code]) {
                    byCode[currency.code] = { code: currency.code, symbol: currency.symbol, total: 0 }
                }
                byCode[currency.code].total += p.cost
                if (currency.code !== 'KRW') uniqueNonKrw.add(currency.code)
            })

            const byCurrency = Object.values(byCode)

            // 환율 fetch (병렬)
            const rates: Record<string, number> = {}
            await Promise.all(
                Array.from(uniqueNonKrw).map(async (code) => {
                    try {
                        const apiUrl = process.env.NEXT_PUBLIC_APP_URL || '';
                        const res = await fetch(`${apiUrl}/api/exchange/?from=${code}`)
                        if (res.ok) {
                            const json = await res.json()
                            rates[code] = json.rate
                        }
                    } catch { /* 환율 실패시 무시 */ }
                })
            )

            // KRW 총합 계산
            let totalKrw = 0
            let allRatesAvailable = true
            byCurrency.forEach(({ code, total }) => {
                if (code === 'KRW') {
                    totalKrw += total
                } else if (rates[code]) {
                    totalKrw += Math.round(total * rates[code])
                } else {
                    allRatesAvailable = false
                }
            })

            setCostSummary({
                totalKrw: allRatesAvailable ? totalKrw : null,
                byCurrency,
                loading: false,
            })
        }
        fetchCostSummary()
    }, [supabase, trip.id])

    const onPlaceChanged = () => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace()
            setDestination(place.name || place.formatted_address || '')
        }
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMsg('')

        if (new Date(startDate) > new Date(endDate)) {
            setErrorMsg('종료일이 시작일보다 빠를 수 없습니다.')
            return
        }

        setSaving(true)
        const { error } = await supabase
            .from('trips')
            .update({
                destination,
                start_date: startDate,
                end_date: endDate,
                adults_count: adults,
                children_count: children,
            })
            .eq('id', trip.id)

        setSaving(false)
        if (error) {
            setErrorMsg(error.message)
        } else {
            setShowEditModal(false)
            if (onUpdate) {
                onUpdate({
                    destination,
                    start_date: startDate,
                    end_date: endDate,
                    adults_count: adults,
                    children_count: children,
                })
            }
            router.refresh()
        }
    }

    const handleDelete = async () => {
        setDeleting(true)
        const { error } = await supabase
            .from('trips')
            .delete()
            .eq('id', trip.id)

        if (!error) {
            router.push('/')
        } else {
            setDeleting(false)
        }
    }

    return (
        <>
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '14px' })}>
                {/* 첫 번째 줄: 여행 타이틀 + (오너인 경우) 수정/삭제 버튼 */}
                <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' })}>
                    <h1 className={css({
                        fontSize: { base: '26px', sm: '32px' },
                        fontWeight: '700',
                        color: '#222',
                        wordBreak: 'keep-all',
                        lineHeight: 1.2,
                        letterSpacing: '-1px',
                        flex: 1,
                        mt: '4px'
                    })}>
                        {trip.destination} 여행
                    </h1>

                    {/* 오너만 수정/삭제 아이콘 표시 */}
                    {isOwner && (
                        <div className={css({ display: 'flex', gap: '8px', flexShrink: 0 })}>
                            <button
                                onClick={() => {
                                    setDestination(trip.destination)
                                    setStartDate(trip.start_date)
                                    setEndDate(trip.end_date)
                                    setAdults(trip.adults_count)
                                    setChildren(trip.children_count)
                                    setErrorMsg('')
                                    setShowEditModal(true)
                                }}
                                className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    p: '8px', bg: 'transparent', color: '#222', border: '1px solid #DDDDDD', borderRadius: '50%', cursor: 'pointer', transition: 'all 0.2s', _hover: { bg: '#F7F7F7' }, _active: { transform: 'scale(0.92)' }
                                })}
                                title="여행 수정"
                            >
                                <Pencil size={18} />
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    p: '8px', bg: 'transparent', color: '#222', border: '1px solid #DDDDDD', borderRadius: '50%', cursor: 'pointer', transition: 'all 0.2s', _hover: { bg: '#F7F7F7' }, _active: { transform: 'scale(0.92)' }
                                })}
                                title="여행 삭제"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    )}
                </div>

                {/* 두 번째 줄: 날짜/인원/비용 요약 (아이콘 부활 및 인라인 1줄 배치) */}
                <div className={css({ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    alignItems: 'center', 
                    gap: '8px', 
                    color: '#555', 
                    fontSize: { base: '14px', sm: '15px' },
                    fontWeight: '500'
                })}>
                    {/* 날짜 */}
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '5px' })}>
                        <Calendar size={15} color="#FF9F87" strokeWidth={2.5} />
                        <span>{start} ~ {end}</span>
                    </div>

                    <span className={css({ color: '#DDDDDD', px: '2px' })}>•</span>
                    
                    {/* 인원 */}
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '5px' })}>
                        <Users size={15} color="#2EC4B6" strokeWidth={2.5} />
                        <span>성인 {trip.adults_count}명{trip.children_count > 0 ? `, 아이 ${trip.children_count}명` : ''}</span>
                    </div>
                    
                    {/* 총 예상 비용 */}
                    {!costSummary.loading && costSummary.byCurrency.length > 0 && (
                        <>
                            <span className={css({ color: '#DDDDDD', px: '2px' })}>•</span>
                            <div className={css({ display: 'flex', alignItems: 'center', gap: '5px' })}>
                                <Wallet size={15} color="#FFD166" strokeWidth={2.5} />
                                <span className={css({ fontWeight: '700', color: '#2C3A47' })}>
                                    {costSummary.totalKrw !== null ? `약 ${formatKRW(costSummary.totalKrw)}` : '비용 합산 중'}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── 수정 모달 ── */}
            {showEditModal && (
                <div className={css({
                    position: 'fixed', inset: 0, zIndex: 200,
                    bg: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: { base: 'flex-start', sm: 'center' },
                    justifyContent: 'center', p: { base: '0', sm: '20px' },
                    animation: 'fadeIn 0.3s ease-out'
                })}>
                    <div className={css({
                        bg: 'white', w: '100%', maxW: { base: '100%', sm: '520px' },
                        h: { base: '100%', sm: 'auto' }, maxH: { base: '100dvh', sm: '90vh' },
                        overflowY: 'auto', borderRadius: { base: '0', sm: '24px' },
                        boxShadow: { base: 'none', sm: '0 25px 70px rgba(0,0,0,0.18)' },
                        display: 'flex', flexDirection: 'column',
                        pt: { base: 'env(safe-area-inset-top)', sm: '0' },
                        animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)'
                    })}>
                        {/* 헤더 */}
                        <div className={css({ p: '20px 24px', borderBottom: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, bg: 'white', zIndex: 10 })}>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className={css({ display: { base: 'flex', sm: 'none' }, alignItems: 'center', bg: 'transparent', border: 'none', cursor: 'pointer', color: '#2EC4B6', p: '0', zIndex: 1 })}
                            >
                                <ChevronLeft size={26} />
                            </button>
                            <h2 className={css({ fontSize: '18px', fontWeight: '700', position: { base: 'absolute', sm: 'static' }, left: { base: '50%', sm: 'auto' }, transform: { base: 'translateX(-50%)', sm: 'none' }, whiteSpace: 'nowrap', color: '#2C3A47', letterSpacing: '-0.02em' })}>
                                여행 정보 수정
                            </h2>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className={css({ 
                                    display: { base: 'none', sm: 'flex' }, 
                                    p: '6px', borderRadius: '50%', bg: '#F8F9FA', color: '#9CA3AF',
                                    transition: 'all 0.2s', _hover: { bg: '#F1F3F5', color: '#2C3A47', transform: 'rotate(90deg)' }
                                })}
                            >
                                <X size={20} strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* 폼 */}
                        <form onSubmit={handleEdit} className={css({ p: { base: '16px', sm: '24px' }, display: 'flex', flexDirection: 'column', gap: '20px', overflowX: 'hidden' })}>
                            <div>
                                <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#2C3A47' })}>
                                    여행지 (국가/도시)
                                </label>
                                {isLoaded ? (
                                    <Autocomplete onLoad={(a) => setAutocomplete(a)} onPlaceChanged={onPlaceChanged}>
                                        <input
                                            type="text"
                                            required
                                            value={destination}
                                            onChange={e => setDestination(e.target.value)}
                                            placeholder="예: 일본 도쿄, 프랑스 파리"
                                            className={css({ w: '100%', p: '15px', bg: '#F8F9FA', border: '1.5px solid #F1F3F5', borderRadius: '16px', outline: 'none', fontSize: '15px', fontWeight: '600', color: '#2C3A47', transition: 'all 0.25s', _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 4px rgba(46, 196, 182, 0.1)' } })}
                                        />
                                    </Autocomplete>
                                ) : (
                                    <input
                                        type="text"
                                        required
                                        value={destination}
                                        onChange={e => setDestination(e.target.value)}
                                        className={css({ w: '100%', p: '15px', bg: '#F8F9FA', border: '1.5px solid #F1F3F5', borderRadius: '16px', outline: 'none', fontSize: '15px', fontWeight: '600', color: '#2C3A47', transition: 'all 0.25s', _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 4px rgba(46, 196, 182, 0.1)' } })}
                                    />
                                )}
                            </div>

                            <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' }, gap: '16px' })}>
                                <div>
                                    <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#2C3A47' })}>가는 날 (시작일)</label>
                                    <div style={{ overflow: 'hidden', width: '100%' }}>
                                        <input
                                            type="date"
                                            required
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            style={{ minWidth: 0 }}
                                            className={css({ w: '100%', maxW: '100%', boxSizing: 'border-box', p: '13px', border: '1px solid #ddd', borderRadius: '12px', outline: 'none', _focus: { borderColor: '#2EC4B6', boxShadow: '0 0 0 2px rgba(46, 196, 182, 0.1)' } })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#2C3A47' })}>오는 날 (종료일)</label>
                                    <div style={{ overflow: 'hidden', width: '100%' }}>
                                        <input
                                            type="date"
                                            required
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                            style={{ minWidth: 0 }}
                                            className={css({ w: '100%', maxW: '100%', boxSizing: 'border-box', p: '13px', border: '1px solid #ddd', borderRadius: '12px', outline: 'none', _focus: { borderColor: '#2EC4B6', boxShadow: '0 0 0 2px rgba(46, 196, 182, 0.1)' } })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' }, gap: '16px' })}>
                                <div>
                                    <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#2C3A47' })}>성인 인원</label>
                                    <div className={css({
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        w: '100%',
                                        p: '8px 12px',
                                        border: '1px solid #eaeaea',
                                        borderRadius: '16px',
                                        bg: 'white',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.015)'
                                    })}>
                                        <button 
                                            type="button" 
                                            disabled={adults <= 1}
                                            onClick={() => setAdults(adults - 1)}
                                            className={css({ 
                                                w: '40px', h: '40px', flexShrink: 0,
                                                bg: adults <= 1 ? '#F5F5F5' : '#EAF9F7', color: adults <= 1 ? '#CCC' : '#2EC4B6',
                                                border: 'none', borderRadius: '14px', 
                                                cursor: adults <= 1 ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)', 
                                                _hover: { bg: adults <= 1 ? '#F5F5F5' : '#D1F2ED' },
                                                _active: { transform: adults <= 1 ? 'none' : 'scale(0.92)' }
                                            })}
                                        >
                                            <Minus size={18} strokeWidth={3} />
                                        </button>
                                        <span className={css({ fontSize: '18px', fontWeight: '700', w: '40px', textAlign: 'center', color: '#2C3A47' })}>{adults}</span>
                                        <button 
                                            type="button" 
                                            onClick={() => setAdults(adults + 1)}
                                            className={css({ 
                                                w: '40px', h: '40px', flexShrink: 0,
                                                bg: '#2EC4B6', border: 'none', borderRadius: '14px', 
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                color: 'white', transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)', 
                                                _hover: { bg: '#249E93', boxShadow: '0 4px 12px rgba(46,196,182,0.2)' },
                                                _active: { transform: 'scale(0.92)' }
                                            })}
                                        >
                                            <Plus size={18} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#2C3A47' })}>아이 인원</label>
                                    <div className={css({
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        w: '100%',
                                        p: '8px 12px',
                                        border: '1px solid #eaeaea',
                                        borderRadius: '16px',
                                        bg: 'white',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.015)'
                                    })}>
                                        <button 
                                            type="button" 
                                            disabled={children <= 0}
                                            onClick={() => setChildren(children - 1)}
                                            className={css({ 
                                                w: '40px', h: '40px', flexShrink: 0,
                                                bg: children <= 0 ? '#F5F5F5' : '#EAF9F7', color: children <= 0 ? '#CCC' : '#2EC4B6',
                                                border: 'none', borderRadius: '14px', 
                                                cursor: children <= 0 ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)', 
                                                _hover: { bg: children <= 0 ? '#F5F5F5' : '#D1F2ED' },
                                                _active: { transform: children <= 0 ? 'none' : 'scale(0.92)' }
                                            })}
                                        >
                                            <Minus size={18} strokeWidth={3} />
                                        </button>
                                        <span className={css({ fontSize: '18px', fontWeight: '700', w: '40px', textAlign: 'center', color: '#2C3A47' })}>{children}</span>
                                        <button 
                                            type="button" 
                                            onClick={() => setChildren(children + 1)}
                                            className={css({ 
                                                w: '40px', h: '40px', flexShrink: 0,
                                                bg: '#2EC4B6', border: 'none', borderRadius: '14px', 
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                color: 'white', transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)', 
                                                _hover: { bg: '#249E93', boxShadow: '0 4px 12px rgba(46,196,182,0.2)' },
                                                _active: { transform: 'scale(0.92)' }
                                            })}
                                        >
                                            <Plus size={18} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {errorMsg && (
                                <div className={css({ p: '12px', bg: '#fee2e2', color: '#dc2626', borderRadius: '8px', fontSize: '14px' })}>
                                    {errorMsg}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={saving}
                                className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    w: '100%', mt: '8px', py: '18px', bg: '#2EC4B6', color: 'white',
                                    fontSize: '17px', fontWeight: '700', borderRadius: '20px',
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                                    boxShadow: '0 10px 25px rgba(46, 196, 182, 0.25)',
                                    _disabled: { opacity: 0.6, transform: 'none', boxShadow: 'none' }, 
                                    _hover: { bg: '#249E93', transform: 'translateY(-2px)', boxShadow: '0 15px 35px rgba(46,196,182,0.35)' },
                                    _active: { transform: 'scale(0.96)' }
                                })}
                            >
                                {saving ? <><Loader2 size={18} className={css({ animation: 'spin 1s linear infinite' })} /> 저장 중...</> : <><Save size={18} /> 수정 완료</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── 삭제 확인 다이얼로그 ── */}
            {showDeleteConfirm && (
                <div className={css({
                    position: 'fixed', inset: 0, zIndex: 300,
                    bg: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px',
                    animation: 'fadeIn 0.3s ease-out'
                })}>
                    <div className={css({
                        bg: 'white', borderRadius: '24px', p: { base: '24px', sm: '32px' }, maxW: '380px', w: '100%',
                        boxShadow: '0 25px 70px rgba(0,0,0,0.25)',
                        animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)'
                    })}>
                        <div className={css({ textAlign: 'center', mb: '20px' })}>
                            <div className={css({ fontSize: '40px', mb: '12px' })}>🗑️</div>
                            <h3 className={css({ fontSize: '18px', fontWeight: 'bold', color: '#172554', mb: '8px' })}>
                                여행을 삭제할까요?
                            </h3>
                            <p className={css({ fontSize: '14px', color: '#666', lineHeight: 1.6, wordBreak: 'keep-all' })}>
                                <strong>{trip.destination} 여행</strong>과 관련된 모든 일정, 체크리스트가 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                            </p>
                        </div>
                        <div className={css({ display: 'flex', gap: '12px' })}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className={css({
                                    flex: 1, py: '14px', bg: '#F8F9FA', color: '#6B7280',
                                    border: 'none', borderRadius: '16px', fontWeight: '700',
                                    fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s',
                                    _hover: { bg: '#F1F3F5', color: '#2C3A47' },
                                    _active: { transform: 'scale(0.96)' }
                                })}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className={css({
                                    flex: 1, py: '14px', bg: '#FF4D4D', color: 'white',
                                    border: 'none', borderRadius: '16px', fontWeight: '700',
                                    fontSize: '15px', cursor: deleting ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                                    boxShadow: '0 8px 20px rgba(255, 77, 77, 0.25)',
                                    _disabled: { opacity: 0.6, transform: 'none', boxShadow: 'none' }, 
                                    _hover: { bg: '#E63939', transform: 'translateY(-2px)', boxShadow: '0 12px 25px rgba(255, 77, 77, 0.35)' },
                                    _active: { transform: 'scale(0.96)' },
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                })}
                            >
                                {deleting ? <Loader2 size={18} className={css({ animation: 'spin 1s linear infinite' })} strokeWidth={2.5} /> : <Trash2 size={18} strokeWidth={2.5} />}
                                {deleting ? '삭제 중...' : '삭제하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
