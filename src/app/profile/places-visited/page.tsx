'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { ChevronLeft, MapPin, Footprints, Heart, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Plan {
    id: string
    location: string
    trip_id: string
    trips: {
        destination: string
        start_date: string
    }
}

export default function PlacesVisitedPage() {
    const supabase = createClient()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [places, setPlaces] = useState<Plan[]>([])
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        const fetchPlaces = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: plans } = await supabase
                .from('plans')
                .select('id, location, trip_id, trips(destination, start_date)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (plans) {
                setPlaces(plans as any[])
            }
            setLoading(false)
        }

        fetchPlaces()
    }, [supabase])

    const filteredPlaces = places.filter(p => 
        p.location.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.trips?.destination.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) return (
        <div className={css({ minH: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
            <div className={css({ animation: 'pulse 1.5s infinite', fontSize: '14px', color: '#888' })}>장소들을 불러오는 중...</div>
        </div>
    )

    return (
        <div className={css({ maxW: '720px', mx: 'auto', minH: '100vh', bg: '#F8FAFC', pb: '60px' })}>
            {/* Header */}
            <header className={css({ 
                position: 'sticky', top: 0, bg: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', 
                zIndex: 10, px: '20px', py: '16px', display: 'flex', alignItems: 'center', gap: '12px'
            })}>
                <button onClick={() => router.back()} className={css({ p: '8px', ml: '-8px', borderRadius: '50%', _active: { bg: '#eee' } })}>
                    <ChevronLeft size={24} />
                </button>
                <h1 className={css({ fontSize: '18px', fontWeight: '700' })}>내가 머문 발자취</h1>
            </header>

            <main className={css({ px: '20px', mt: '24px' })}>
                {/* Visual Intro */}
                <div className={css({ 
                    bg: 'brand.primary', p: '32px 24px', borderRadius: '24px', 
                    color: 'white', mb: '32px', position: 'relative', overflow: 'hidden',
                    boxShadow: '0 20px 40px rgba(59, 130, 246, 0.15)'
                })}>
                    <div className={css({ position: 'relative', zIndex: 2 })}>
                        <div className={css({ display: 'inline-flex', p: '10px', bg: 'rgba(255,255,255,0.2)', borderRadius: '12px', mb: '16px' })}>
                            <Footprints size={24} color="white" />
                        </div>
                        <h2 className={css({ fontSize: '22px', fontWeight: '800', mb: '8px' })}>
                            {places.length}개의 소중한 발자취
                        </h2>
                        <p className={css({ fontSize: '14px', opacity: 0.9, lineHeight: '1.5' })}>
                            우리가 함께 머물렀던 모든 곳들이<br />
                            당신의 여정에 따뜻한 온기가 되기를 바랍니다.
                        </p>
                    </div>
                    {/* Decorative Background Icon */}
                    <div className={css({ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.1 })}>
                        <MapPin size={120} />
                    </div>
                </div>

                {/* Search Bar */}
                <div className={css({ position: 'relative', mb: '24px' })}>
                    <Search size={18} color="#999" className={css({ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' })} />
                    <input 
                        type="text" 
                        placeholder="장소나 여행지 검색..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={css({ 
                            w: '100%', p: '14px 16px 14px 44px', borderRadius: '14px', 
                            bg: 'white', border: '1px solid #E2E8F0', fontSize: '14px',
                            outline: 'none', transition: 'border-color 0.2s',
                            _focus: { borderColor: 'brand.primary' }
                        })}
                    />
                </div>

                {/* Places Grid */}
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
                    {filteredPlaces.length > 0 ? (
                        filteredPlaces.map((place) => (
                            <div 
                                key={place.id}
                                className={css({ 
                                    bg: 'white', p: '20px', borderRadius: '18px', 
                                    border: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', gap: '16px',
                                    transition: 'transform 0.2s',
                                    _active: { transform: 'scale(0.98)' }
                                })}
                            >
                                <div className={css({ 
                                    w: '52px', h: '52px', bg: '#FEE2E2', borderRadius: '16px', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                                })}>
                                    <Heart size={24} color="#EF4444" fill="#EF4444" style={{ opacity: 0.8 }} />
                                </div>
                                <div className={css({ flex: 1 })}>
                                    <div className={css({ fontSize: '16px', fontWeight: '700', color: '#1A202C', mb: '4px' })}>{place.location}</div>
                                    <div className={css({ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#718096' })}>
                                        <MapPin size={12} color="#A0AEC0" /> 
                                        <span>{place.trips?.destination} 여정 중</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className={css({ textAlign: 'center', py: '60px', color: '#A0AEC0' })}>
                            <p className={css({ fontSize: '14px' })}>검색 결과가 없어요. 새로운 발자취를 남겨볼까요?</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
