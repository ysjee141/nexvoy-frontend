'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Calendar, Users, Pencil, Trash2, Wallet, Loader2 } from 'lucide-react'
import { getCurrencyFromTimezone, formatKRW } from '@/utils/currency'
import { formatDate } from '@/utils/date'
import { ExchangeService } from '@/services/ExternalApiService'
import EditTripModal from './EditTripModal'

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

    // 총 비용 요약 상태
    interface CostSummary {
        totalKrw: number | null
        byCurrency: { code: string; symbol: string; total: number }[]
        loading: boolean
    }
    const [costSummary, setCostSummary] = useState<CostSummary>({ totalKrw: null, byCurrency: [], loading: true })

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
            const rates: Record<string, number> = {}
            await Promise.all(
                Array.from(uniqueNonKrw).map(async (code) => {
                    try {
                        const data = await ExchangeService.getExchangeRate(code)
                        if (data && data.rate) {
                            rates[code] = data.rate
                        }
                    } catch (error) {
                        console.error(`Failed to fetch exchange rate for ${code}:`, error)
                    }
                })
            )

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
                <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' })}>
                    <h1 className={css({
                        fontSize: { base: '26px', sm: '32px' },
                        fontWeight: '700',
                        color: 'brand.secondary',
                        wordBreak: 'keep-all',
                        lineHeight: 1.2,
                        letterSpacing: '-1px',
                        flex: 1,
                        mt: '4px'
                    })}>
                        {trip.destination} 여행
                    </h1>

                    {isOwner && (
                        <div className={css({ display: 'flex', gap: '8px', flexShrink: 0 })}>
                            <button
                                onClick={() => setShowEditModal(true)}
                                className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    p: '8px', bg: 'white', color: 'brand.muted', border: '1.5px solid', borderColor: 'brand.border', borderRadius: '50%', cursor: 'pointer', transition: 'all 0.2s', 
                                    _hover: { bg: 'bg.softCotton', color: 'brand.primary', borderColor: 'brand.primary' }, 
                                    _active: { transform: 'scale(0.92)' }
                                })}
                                title="여행 수정"
                            >
                                <Pencil size={18} />
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    p: '8px', bg: 'white', color: 'brand.muted', border: '1.5px solid', borderColor: 'brand.border', borderRadius: '50%', cursor: 'pointer', transition: 'all 0.2s', 
                                    _hover: { bg: 'brand.errorLight', color: 'brand.error', borderColor: 'brand.error' }, 
                                    _active: { transform: 'scale(0.92)' }
                                })}
                                title="여행 삭제"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    )}
                </div>

                <div className={css({ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    alignItems: 'center', 
                    gap: '8px', 
                    color: 'brand.secondary', 
                    fontSize: { base: '14px', sm: '15px' },
                    fontWeight: '500'
                })}>
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '5px' })}>
                        <Calendar size={15} className={css({ color: 'brand.accent' })} strokeWidth={2.5} />
                        <span>{start} ~ {end}</span>
                    </div>

                    <span className={css({ color: 'brand.border', px: '2px' })}>•</span>
                    
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '5px' })}>
                        <Users size={15} className={css({ color: 'brand.primary' })} strokeWidth={2.5} />
                        <span>성인 {trip.adults_count}명{trip.children_count > 0 ? `, 아이 ${trip.children_count}명` : ''}</span>
                    </div>
                    
                    {!costSummary.loading && costSummary.byCurrency.length > 0 && (
                        <>
                            <span className={css({ color: 'brand.border', px: '2px' })}>•</span>
                            <div className={css({ display: 'flex', alignItems: 'center', gap: '5px' })}>
                                <Wallet size={15} className={css({ color: 'brand.secondary' })} strokeWidth={2.5} />
                                <span className={css({ fontWeight: '700', color: 'brand.secondary' })}>
                                    {costSummary.totalKrw !== null ? `약 ${formatKRW(costSummary.totalKrw)}` : '비용 합산 중'}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <EditTripModal 
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                trip={trip}
                onSuccess={(updatedFields) => {
                    if (onUpdate) onUpdate(updatedFields)
                    router.refresh()
                }}
            />

            {showDeleteConfirm && (
                <div className={css({
                    position: 'fixed', inset: 0, zIndex: 300,
                    bg: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', p: '24px'
                })}>
                    <div className={css({
                        bg: 'white', w: '100%', maxW: '380px', borderRadius: '28px', p: '32px',
                        boxShadow: '0 25px 70px rgba(0,0,0,0.15)',
                        animation: 'slideUp 0.35s cubic-bezier(0.2, 0, 0, 1)',
                        textAlign: 'center'
                    })}>
                        <div className={css({ 
                            w: '64px', h: '64px', borderRadius: '22px', bg: 'brand.errorLight', color: 'brand.error',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
                        })}>
                            <Trash2 size={28} strokeWidth={2.5} />
                        </div>
                        <h3 className={css({ fontSize: '20px', fontWeight: '800', color: 'brand.primary', mb: '10px', letterSpacing: '-0.02em' })}>
                            여행을 삭제할까요?
                        </h3>
                        <p className={css({ color: 'brand.secondary', mb: '28px', lineHeight: 1.6, fontSize: '15px' })}>
                            정말 이 여행을 삭제하시겠습니까?<br/>
                            이 작업은 되돌릴 수 없으며 모든 일정과 가계부 내역이 삭제됩니다.
                        </p>
                        <div className={css({ display: 'flex', gap: '12px' })}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className={css({ 
                                    flex: 1, py: '16px', borderRadius: '18px', border: '1px solid token(colors.brand.border)', bg: 'white', 
                                    fontWeight: '700', fontSize: '15px', color: 'brand.secondary', cursor: 'pointer', transition: 'all 0.2s',
                                    _hover: { bg: 'bg.softCotton', color: 'brand.primary' }
                                })}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className={css({ 
                                    flex: 1, py: '16px', borderRadius: '18px', bg: 'brand.error', color: 'white', 
                                    border: 'none', fontWeight: '700', fontSize: '15px', cursor: 'pointer', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    boxShadow: '0 8px 20px rgba(255, 59, 48, 0.2)',
                                    transition: 'all 0.2s',
                                    _hover: { bg: '#e53935', transform: 'translateY(-2px)' },
                                    _active: { transform: 'scale(0.96)' }
                                })}
                            >
                                {deleting ? <Loader2 className={css({ animation: 'spin 1s linear infinite' })} size={20} /> : '삭제하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
