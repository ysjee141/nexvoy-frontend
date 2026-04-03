'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { analytics } from '@/services/AnalyticsService'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Plus, ArrowLeft, ChevronLeft, Minus } from 'lucide-react'
import { useLoadScript, Autocomplete } from '@react-google-maps/api'

const libraries: ("places")[] = ["places"]

export default function NewTripPage() {
    const { isLoaded } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
        libraries,
        language: 'ko',
    })

    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [destination, setDestination] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [adults, setAdults] = useState(1)
    const [childrenCount, setChildren] = useState(0)
    const [errorMsg, setErrorMsg] = useState('')

    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)

    useEffect(() => {
        async function checkAuth() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
            }
        }
        checkAuth()
    }, [router])

    const onPlaceChanged = () => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace()
            setDestination(place.name || place.formatted_address || '')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setErrorMsg('')

        if (new Date(startDate) > new Date(endDate)) {
            setErrorMsg('종료일이 시작일보다 빠를 수 없습니다.')
            setLoading(false)
            return
        }

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            router.push('/login')
            return
        }

        const { data: trip, error } = await supabase
            .from('trips')
            .insert({
                user_id: user.id,
                destination,
                start_date: startDate,
                end_date: endDate,
                adults_count: adults,
                children_count: childrenCount,
            })
            .select()
            .single()

        setLoading(false)

        if (error) {
            setErrorMsg(error.message)
        } else if (trip) {
            analytics.logTripCreate(destination)
            router.push(`/trips/detail?id=${trip.id}`)
        }
    }

    return (
        <div className={css({
            position: { base: 'fixed', sm: 'relative' },
            inset: { base: 0, sm: 'auto' },
            zIndex: { base: 100, sm: 'auto' },
            minH: '100vh',
            bg: 'white',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
        })}>
            {/* 상단 헤더 (모바일 전용) */}
            <header className={css({
                display: { base: 'flex', sm: 'none' },
                alignItems: 'center',
                p: '16px 20px',
                borderBottom: '1px solid #EEEEEE',
                bg: 'white',
                position: 'sticky',
                top: 0,
                zIndex: 10
            })}>
                <button 
                    onClick={() => router.back()}
                    className={css({ p: '8px', ml: '-8px', bg: 'transparent', border: 'none', cursor: 'pointer' })}
                >
                    <ChevronLeft size={24} color="#222" />
                </button>
                <h1 className={css({ flex: 1, textAlign: 'center', fontSize: '16px', fontWeight: '700', mr: '24px', color: '#2C3A47' })}>새로운 여행 계획</h1>
            </header>

            <main className={css({
                flex: 1,
                maxW: '600px',
                mx: 'auto',
                w: '100%',
                px: { base: '20px', sm: '0' },
                py: { base: '24px', sm: '40px' }
            })}>
                <div className={css({
                    bg: 'white',
                    p: { base: '0', sm: '32px' },
                    borderRadius: { base: '0', sm: '16px' },
                    boxShadow: { base: 'none', sm: '0 4px 20px rgba(0,0,0,0.05)' }
                })}>
                    <form onSubmit={handleSubmit} className={css({ display: 'flex', flexDirection: 'column', gap: '24px', overflowX: 'hidden' })}>
                        <div>
                            <label className={css({ display: 'block', fontSize: '15px', fontWeight: '700', mb: '12px', color: '#2C3A47' })}>
                                여행지 (국가/도시) *
                            </label>
                            {isLoaded ? (
                                <Autocomplete onLoad={(a) => setAutocomplete(a)} onPlaceChanged={onPlaceChanged}>
                                    <input
                                        type="text"
                                        required
                                        value={destination}
                                        onChange={e => setDestination(e.target.value)}
                                        placeholder="어디로 떠나시나요?"
                                        className={css({
                                            w: '100%',
                                            p: '16px 18px',
                                            border: '1px solid #EEEEEE',
                                            borderRadius: '16px',
                                            outline: 'none',
                                            transition: 'all 0.2s cubic-bezier(0.2, 0, 0.4, 1)',
                                            bg: '#F9F9F9',
                                            fontSize: '16px',
                                            fontWeight: '600',
                                            color: '#2C3A47',
                                            _placeholder: { color: '#CCC', fontWeight: '400' },
                                            _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 3px rgba(46, 196, 182, 0.1)' },
                                        })}
                                    />
                                </Autocomplete>
                            ) : (
                                <input
                                    type="text"
                                    required
                                    value={destination}
                                    onChange={e => setDestination(e.target.value)}
                                    placeholder="지도 로딩 중..."
                                    disabled
                                    className={css({
                                        w: '100%',
                                        p: '14px',
                                        border: '1px solid #ddd',
                                        borderRadius: '12px',
                                        outline: 'none',
                                        bg: '#f1f1f1'
                                    })}
                                />
                            )}
                        </div>

                        <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' }, gap: '16px' })}>
                            <div>
                                <label className={css({ display: 'block', fontSize: '15px', fontWeight: '700', mb: '12px', color: '#2C3A47' })}>
                                    가는 날 (시작일) *
                                </label>
                                <div style={{ overflow: 'hidden', width: '100%' }}>
                                    <input
                                        type="date"
                                        required
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        style={{ minWidth: 0 }}
                                        className={css({
                                            w: '100%',
                                            maxW: '100%',
                                            boxSizing: 'border-box',
                                            p: '16px 18px',
                                            border: '1px solid #EEEEEE',
                                            borderRadius: '16px',
                                            outline: 'none',
                                            bg: '#F9F9F9',
                                            fontSize: '15px',
                                            fontWeight: '600',
                                            color: '#2C3A47',
                                            transition: 'all 0.2s',
                                            _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 3px rgba(46, 196, 182, 0.1)' },
                                        })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={css({ display: 'block', fontSize: '15px', fontWeight: '700', mb: '12px', color: '#2C3A47' })}>
                                    오는 날 (종료일) *
                                </label>
                                <div style={{ overflow: 'hidden', width: '100%' }}>
                                    <input
                                        type="date"
                                        required
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        style={{ minWidth: 0 }}
                                        className={css({
                                            w: '100%',
                                            maxW: '100%',
                                            boxSizing: 'border-box',
                                            p: '16px 18px',
                                            border: '1px solid #EEEEEE',
                                            borderRadius: '16px',
                                            outline: 'none',
                                            bg: '#F9F9F9',
                                            fontSize: '15px',
                                            fontWeight: '600',
                                            color: '#2C3A47',
                                            transition: 'all 0.2s',
                                            _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 3px rgba(46, 196, 182, 0.1)' },
                                        })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' }, gap: '16px' })}>
                            <div>
                                <label className={css({ display: 'block', fontSize: '15px', fontWeight: '700', mb: '12px', color: '#2C3A47' })}>
                                    성인 인원
                                </label>
                                <div className={css({
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    w: '100%',
                                    p: '10px 14px',
                                    border: '1px solid #DDDDDD',
                                    borderRadius: '16px',
                                    bg: 'white'
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
                                <label className={css({ display: 'block', fontSize: '15px', fontWeight: '700', mb: '12px', color: '#2C3A47' })}>
                                    아이 인원
                                </label>
                                <div className={css({
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    w: '100%',
                                    p: '10px 14px',
                                    border: '1px solid #DDDDDD',
                                    borderRadius: '16px',
                                    bg: 'white'
                                })}>
                                    <button
                                        type="button"
                                        disabled={childrenCount <= 0}
                                        onClick={() => setChildren(childrenCount - 1)}
                                        className={css({
                                            w: '40px', h: '40px', flexShrink: 0,
                                            bg: childrenCount <= 0 ? '#F5F5F5' : '#EAF9F7', color: childrenCount <= 0 ? '#CCC' : '#2EC4B6',
                                            border: 'none', borderRadius: '14px',
                                            cursor: childrenCount <= 0 ? 'not-allowed' : 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
                                            _hover: { bg: childrenCount <= 0 ? '#F5F5F5' : '#D1F2ED' },
                                            _active: { transform: childrenCount <= 0 ? 'none' : 'scale(0.92)' }
                                        })}
                                    >
                                        <Minus size={18} strokeWidth={3} />
                                    </button>
                                    <span className={css({ fontSize: '18px', fontWeight: '700', w: '40px', textAlign: 'center', color: '#2C3A47' })}>{childrenCount}</span>
                                    <button
                                        type="button"
                                        onClick={() => setChildren(childrenCount + 1)}
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
                            <div className={css({ p: '12px', bg: '#fee2e2', color: '#dc2626', borderRadius: '12px', fontSize: '14px', fontWeight: '500' })}>
                                ⚠️ {errorMsg}
                            </div>
                        )}

                        <div className={css({ mt: '8px' })}>
                             <button
                                 type="submit"
                                 disabled={loading}
                                 className={css({
                                     display: 'flex',
                                     alignItems: 'center',
                                     justifyContent: 'center',
                                     gap: '8px',
                                     w: '100%',
                                     py: '20px',
                                     bg: '#2EC4B6',
                                     color: 'white',
                                     fontSize: '17px',
                                     fontWeight: '700',
                                     borderRadius: '16px',
                                     cursor: loading ? 'not-allowed' : 'pointer',
                                     opacity: loading ? 0.7 : 1,
                                     transition: 'all 0.2s',
                                     boxShadow: '0 8px 16px rgba(46,196,182,0.2)',
                                     _active: { transform: 'scale(0.96)' },
                                     _hover: { bg: '#249E93' }
                                 })}
                             >
                                 {loading ? '저장 중...' : '여행 계획 시작하기'}
                             </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    )
}
