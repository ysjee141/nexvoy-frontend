'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Plus, ArrowLeft } from 'lucide-react'
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
            router.push(`/trips/${trip.id}`)
        }
    }

    return (
        <div className={css({ maxW: '600px', mx: 'auto', px: { base: '16px', sm: '0' }, py: { base: '20px', sm: '40px' } })}>
            <button
                onClick={() => router.back()}
                className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#666',
                    mb: '24px',
                    cursor: 'pointer',
                    bg: 'transparent',
                    border: 'none',
                    _hover: { color: '#111' },
                })}
            >
                <ArrowLeft size={20} /> 돌아가기
            </button>

            <div className={css({ bg: 'white', p: { base: '20px', sm: '32px' }, borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' })}>
                <h1 className={css({ fontSize: '24px', fontWeight: 'bold', color: '#111', mb: '24px' })}>
                    새로운 여행 등록
                </h1>

                <form onSubmit={handleSubmit} className={css({ display: 'flex', flexDirection: 'column', gap: '20px' })}>
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
                                    className={css({
                                        w: '100%',
                                        p: '14px',
                                        border: '1px solid #ddd',
                                        borderRadius: '8px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                        _focus: { borderColor: '#4285F4', boxShadow: '0 0 0 2px rgba(66, 133, 244, 0.1)' },
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
                                    borderRadius: '8px',
                                    outline: 'none',
                                    bg: '#f1f1f1'
                                })}
                            />
                        )}
                    </div>

                    <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' }, gap: '16px' })}>
                        <div>
                            <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#333' })}>
                                가는 날 (시작일)
                            </label>
                            <input
                                type="date"
                                required
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className={css({
                                    w: '100%',
                                    p: '14px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    outline: 'none',
                                    _focus: { borderColor: '#4285F4' },
                                })}
                            />
                        </div>
                        <div>
                            <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#333' })}>
                                오는 날 (종료일)
                            </label>
                            <input
                                type="date"
                                required
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className={css({
                                    w: '100%',
                                    p: '14px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    outline: 'none',
                                    _focus: { borderColor: '#4285F4' },
                                })}
                            />
                        </div>
                    </div>

                    <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' }, gap: '16px' })}>
                        <div>
                            <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#333' })}>
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
                                    borderRadius: '8px',
                                    outline: 'none',
                                    _focus: { borderColor: '#4285F4' },
                                })}
                            />
                        </div>
                        <div>
                            <label className={css({ display: 'block', fontSize: '14px', fontWeight: 'bold', mb: '8px', color: '#333' })}>
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
                                    borderRadius: '8px',
                                    outline: 'none',
                                    _focus: { borderColor: '#4285F4' },
                                })}
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
                        disabled={loading}
                        className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            w: '100%',
                            mt: '16px',
                            py: '16px',
                            bg: '#111',
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1,
                            transition: 'background 0.2s',
                            _hover: { bg: '#333' },
                        })}
                    >
                        {loading ? '저장 중...' : <><Plus size={20} /> 여행 생성하기</>}
                    </button>
                </form>
            </div>
        </div>
    )
}
