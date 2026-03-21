'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Calendar, Users, Pencil, Trash2, X, ChevronLeft, Save, Loader2, Wallet } from 'lucide-react'
import { useLoadScript, Autocomplete } from '@react-google-maps/api'
import { getCurrencyFromTimezone, formatCurrency, formatKRW } from '@/utils/currency'

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
}

export default function TripHeaderActions({ trip }: TripHeaderActionsProps) {
    const router = useRouter()
    const supabase = createClient()

    const [isOwner, setIsOwner] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)

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

    const start = new Date(trip.start_date).toLocaleDateString()
    const end = new Date(trip.end_date).toLocaleDateString()

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
                        const res = await fetch(`${apiUrl}/api/exchange?from=${code}`)
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
            {/* 날짜/인원 정보 + 수정/삭제 버튼 */}
            <div className={css({ 
                display: 'flex', 
                flexDirection: { base: 'column', sm: 'row' }, 
                alignItems: { base: 'flex-start', sm: 'flex-end' }, 
                justifyContent: 'space-between', 
                gap: '20px',
                pt: '16px',
                borderTop: '1px solid #f0f0f0'
            })}>
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '10px' })}>
                    <p className={css({ color: '#555', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' })}>
                        <Calendar size={16} color="#4285F4" />
                        <span className={css({ fontWeight: '500' })}>{start} ~ {end}</span>
                    </p>
                    <p className={css({ color: '#555', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' })}>
                        <Users size={16} color="#34A853" />
                        <span className={css({ fontWeight: '500' })}>성인 {trip.adults_count}명{trip.children_count > 0 ? `, 아이 ${trip.children_count}명` : ''}</span>
                    </p>
                    {/* 총 예상 비용 */}
                    {!costSummary.loading && costSummary.byCurrency.length > 0 && (
                        <div className={css({ display: 'flex', alignItems: 'flex-start', gap: '8px', mt: '2px' })}>
                            <Wallet size={16} color="#FBBC05" className={css({ mt: '3px', flexShrink: 0 })} />
                            <div>
                                {/* KRW 총합 (주 표시) */}
                                {costSummary.totalKrw !== null ? (
                                    <p className={css({ color: '#333', fontSize: '14px', fontWeight: '700' })}>
                                        약 {formatKRW(costSummary.totalKrw)}
                                    </p>
                                ) : (
                                    <p className={css({ color: '#333', fontSize: '14px', fontWeight: '700' })}>합산 중...</p>
                                )}
                                {/* 통화별 소계 (서브 텍스트) */}
                                <p className={css({ fontSize: '12px', color: '#888', mt: '2px', fontWeight: '500' })}>
                                    {costSummary.byCurrency.map((c, i) => (
                                        <span key={c.code}>
                                            {i > 0 && ' · '}
                                            {formatCurrency(c.total, { code: c.code, symbol: c.symbol, locale: 'ko-KR', name: '' })}
                                        </span>
                                    ))}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 오너만 수정/삭제 표시 */}
                {isOwner && (
                    <div className={css({ display: 'flex', gap: '8px', w: { base: '100%', sm: 'auto' } })}>
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
                                flex: { base: 1, sm: 'none' },
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                px: '14px', py: '10px', bg: '#f8f9fa', color: '#555',
                                border: '1px solid #ddd', borderRadius: '8px',
                                fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                transition: 'all 0.2s', _hover: { bg: '#eee', color: '#111' }
                            })}
                        >
                            <Pencil size={14} /> 수정
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className={css({
                                flex: { base: 1, sm: 'none' },
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                px: '14px', py: '10px', bg: '#fff5f5', color: '#dc2626',
                                border: '1px solid #fecaca', borderRadius: '8px',
                                fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                transition: 'all 0.2s', _hover: { bg: '#fee2e2' }
                            })}
                        >
                            <Trash2 size={14} /> 삭제
                        </button>
                    </div>
                )}
            </div>

            {/* ── 수정 모달 ── */}
            {showEditModal && (
                <div className={css({
                    position: 'fixed', inset: 0, zIndex: 200,
                    bg: { base: 'white', sm: 'rgba(0,0,0,0.4)' },
                    display: 'flex', alignItems: { base: 'flex-start', sm: 'center' },
                    justifyContent: 'center', p: { base: '0', sm: '20px' },
                })}>
                    <div className={css({
                        bg: 'white', w: '100%', maxW: { base: '100%', sm: '520px' },
                        h: { base: '100%', sm: 'auto' }, maxH: { base: '100dvh', sm: '90vh' },
                        overflowY: 'auto', borderRadius: { base: '0', sm: '16px' },
                        boxShadow: { base: 'none', sm: '0 10px 40px rgba(0,0,0,0.15)' },
                        display: 'flex', flexDirection: 'column',
                        pt: { base: 'env(safe-area-inset-top)', sm: '0' },
                    })}>
                        {/* 헤더 */}
                        <div className={css({ p: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, bg: 'white', zIndex: 10 })}>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className={css({ display: { base: 'flex', sm: 'none' }, alignItems: 'center', bg: 'transparent', border: 'none', cursor: 'pointer', color: '#4285F4', p: '0', zIndex: 1 })}
                            >
                                <ChevronLeft size={26} />
                            </button>
                            <h2 className={css({ fontSize: '17px', fontWeight: 'bold', position: { base: 'absolute', sm: 'static' }, left: { base: '50%', sm: 'auto' }, transform: { base: 'translateX(-50%)', sm: 'none' }, whiteSpace: 'nowrap' })}>
                                여행 수정
                            </h2>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className={css({ display: { base: 'none', sm: 'flex' }, bg: 'transparent', border: 'none', cursor: 'pointer', color: '#666', _hover: { color: '#111' } })}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* 폼 */}
                        <form onSubmit={handleEdit} className={css({ p: { base: '16px', sm: '24px' }, display: 'flex', flexDirection: 'column', gap: '20px', overflowX: 'hidden' })}>
                            <div>
                                <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#333' })}>
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
                                            className={css({ w: '100%', p: '13px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', fontSize: '15px', _focus: { borderColor: '#4285F4' } })}
                                        />
                                    </Autocomplete>
                                ) : (
                                    <input
                                        type="text"
                                        required
                                        value={destination}
                                        onChange={e => setDestination(e.target.value)}
                                        className={css({ w: '100%', p: '13px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', fontSize: '15px', _focus: { borderColor: '#4285F4' } })}
                                    />
                                )}
                            </div>

                            <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' }, gap: '16px' })}>
                                <div>
                                    <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#333' })}>가는 날 (시작일)</label>
                                    <div style={{ overflow: 'hidden', width: '100%' }}>
                                        <input
                                            type="date"
                                            required
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            style={{ minWidth: 0 }}
                                            className={css({ w: '100%', maxW: '100%', boxSizing: 'border-box', p: '13px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', _focus: { borderColor: '#4285F4' } })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#333' })}>오는 날 (종료일)</label>
                                    <div style={{ overflow: 'hidden', width: '100%' }}>
                                        <input
                                            type="date"
                                            required
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                            style={{ minWidth: 0 }}
                                            className={css({ w: '100%', maxW: '100%', boxSizing: 'border-box', p: '13px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', _focus: { borderColor: '#4285F4' } })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' }, gap: '16px' })}>
                                <div>
                                    <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#333' })}>성인 인원</label>
                                    <input
                                        type="number" min="1" required
                                        value={adults}
                                        onChange={e => setAdults(Number(e.target.value))}
                                        className={css({ w: '100%', p: '13px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', _focus: { borderColor: '#4285F4' } })}
                                    />
                                </div>
                                <div>
                                    <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#333' })}>아이 인원</label>
                                    <input
                                        type="number" min="0"
                                        value={children}
                                        onChange={e => setChildren(Number(e.target.value))}
                                        className={css({ w: '100%', p: '13px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', _focus: { borderColor: '#4285F4' } })}
                                    />
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
                                    w: '100%', mt: '4px', py: '14px', bg: '#111', color: 'white',
                                    fontSize: '15px', fontWeight: 'bold', borderRadius: '8px',
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    _disabled: { opacity: 0.6 }, _hover: { bg: '#333' }
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
                    position: 'fixed', inset: 0, zIndex: 200,
                    bg: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px',
                })}>
                    <div className={css({
                        bg: 'white', borderRadius: '16px', p: '28px', maxW: '360px', w: '100%',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                    })}>
                        <div className={css({ textAlign: 'center', mb: '20px' })}>
                            <div className={css({ fontSize: '40px', mb: '12px' })}>🗑️</div>
                            <h3 className={css({ fontSize: '18px', fontWeight: 'bold', color: '#111', mb: '8px' })}>
                                여행을 삭제할까요?
                            </h3>
                            <p className={css({ fontSize: '14px', color: '#666', lineHeight: 1.6, wordBreak: 'keep-all' })}>
                                <strong>{trip.destination} 여행</strong>과 관련된 모든 일정, 체크리스트가 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                            </p>
                        </div>
                        <div className={css({ display: 'flex', gap: '10px' })}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className={css({
                                    flex: 1, py: '12px', bg: '#f1f3f4', color: '#555',
                                    border: 'none', borderRadius: '10px', fontWeight: '600',
                                    fontSize: '15px', cursor: 'pointer', _hover: { bg: '#e8e8e8' }
                                })}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className={css({
                                    flex: 1, py: '12px', bg: '#d32f2f', color: 'white',
                                    border: 'none', borderRadius: '10px', fontWeight: '600',
                                    fontSize: '15px', cursor: deleting ? 'not-allowed' : 'pointer',
                                    _disabled: { opacity: 0.6 }, _hover: { bg: '#b71c1c' },
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                })}
                            >
                                {deleting ? <Loader2 size={16} className={css({ animation: 'spin 1s linear infinite' })} /> : <Trash2 size={16} />}
                                {deleting ? '삭제 중...' : '삭제하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
