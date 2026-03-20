'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Plus, ArrowLeft, ChevronLeft } from 'lucide-react'
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
            {/* Header: Fixed/Sticky app bar */}
            <header className={css({ 
                position: 'sticky', 
                top: 0, 
                zIndex: 10,
                bg: 'white', 
                p: '16px 20px', 
                borderBottom: '1px solid #eee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pt: { base: 'calc(8px + env(safe-area-inset-top))', sm: '16px' }
            })}>
                <button
                    onClick={() => router.back()}
                    className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: { base: '#4285F4', sm: '#666' },
                        cursor: 'pointer',
                        bg: 'transparent',
                        border: 'none',
                        p: '0',
                        _hover: { color: '#111' },
                    })}
                >
                    <ChevronLeft size={28} className={css({ display: { base: 'block', sm: 'none' } })} />
                    <ArrowLeft size={20} className={css({ display: { base: 'none', sm: 'block' } })} />
                    <span className={css({ display: { base: 'none', sm: 'inline' }, fontSize: '14px', fontWeight: '600' })}>돌아가기</span>
                </button>

                <h1 className={css({ 
                    fontSize: { base: '17px', sm: '18px' }, 
                    fontWeight: 'bold', 
                    color: '#111',
                    position: { base: 'absolute', sm: 'static' },
                    left: { base: '50%', sm: 'auto' },
                    transform: { base: 'translateX(-50%)', sm: 'none' },
                    textAlign: 'center'
                })}>
                    새로운 여행 등록
                </h1>

                {/* Empty spacer for flex-between balance */}
                <div className={css({ w: '40px', display: { base: 'none', sm: 'block' } })} />
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
                            <label className={css({ display: 'block', fontSize: '14px', fontWeight: '600', mb: '8px', color: '#333' })}>
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
                                            p: '14px',
                                            border: '1px solid #ddd',
                                            borderRadius: '12px',
                                            outline: 'none',
                                            transition: 'all 0.2s',
                                            bg: '#f9f9f9',
                                            _focus: { borderColor: '#4285F4', bg: 'white', boxShadow: '0 0 0 2px rgba(66, 133, 244, 0.1)' },
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
                                <label className={css({ display: 'block', fontSize: '14px', fontWeight: '600', mb: '8px', color: '#333' })}>
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
                                            p: '14px',
                                            border: '1px solid #ddd',
                                            borderRadius: '12px',
                                            outline: 'none',
                                            bg: '#f9f9f9',
                                            _focus: { borderColor: '#4285F4', bg: 'white' },
                                        })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={css({ display: 'block', fontSize: '14px', fontWeight: '600', mb: '8px', color: '#333' })}>
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
                                            p: '14px',
                                            border: '1px solid #ddd',
                                            borderRadius: '12px',
                                            outline: 'none',
                                            bg: '#f9f9f9',
                                            _focus: { borderColor: '#4285F4', bg: 'white' },
                                        })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' }, gap: '16px' })}>
                            <div>
                                <label className={css({ display: 'block', fontSize: '14px', fontWeight: '600', mb: '8px', color: '#333' })}>
                                    성인 인원
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    required
                                    value={adults}
                                    onChange={e => setAdults(Number(e.target.value))}
                                    className={css({
                                        w: '100%',
                                        p: '14px',
                                        border: '1px solid #ddd',
                                        borderRadius: '12px',
                                        outline: 'none',
                                        bg: '#f9f9f9',
                                        _focus: { borderColor: '#4285F4', bg: 'white' },
                                    })}
                                />
                            </div>
                            <div>
                                <label className={css({ display: 'block', fontSize: '14px', fontWeight: '600', mb: '8px', color: '#333' })}>
                                    아이 인원
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={childrenCount}
                                    onChange={e => setChildren(Number(e.target.value))}
                                    className={css({
                                        w: '100%',
                                        p: '14px',
                                        border: '1px solid #ddd',
                                        borderRadius: '12px',
                                        outline: 'none',
                                        bg: '#f9f9f9',
                                        _focus: { borderColor: '#4285F4', bg: 'white' },
                                    })}
                                />
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
                                    py: '18px',
                                    bg: '#111',
                                    color: 'white',
                                    fontSize: '16px',
                                    fontWeight: '800',
                                    borderRadius: '14px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    opacity: loading ? 0.7 : 1,
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    _active: { transform: 'scale(0.98)' },
                                    _hover: { bg: '#333' }
                                })}
                            >
                                {loading ? '저장 중...' : <><Plus size={20} /> 여행 생성하기</>}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    )
}
