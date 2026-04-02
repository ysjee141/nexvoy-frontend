'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { ChevronLeft, MapPin, Footprints, Heart, Search, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Skeleton from '@/components/ui/Skeleton'
import CommonListSkeleton from '@/components/common/CommonListSkeleton'

interface TripInfo {
    id: string
    destination: string
    start_date: string
}

interface GroupedPlace {
    location: string
    tripCount: number
    associatedTrips: TripInfo[]
}

const EMOTIONAL_QUOTES = [
    "당신의 소중한 발자취가 이곳에 머물러 있습니다.",
    "따스한 햇살과 함께 기록된 그날의 풍경입니다.",
    "낯선 공기 속에서 찾은 나만의 작은 평온함.",
    "다시 꺼내보는 기억 속, 당신은 여전히 빛나고 있네요.",
    "바람을 따라 걷던 그 길의 끝에 머물렀던 마음.",
    "사진첩 한 켠을 장식한, 잊지 못할 찰나의 순간.",
    "지도 위에 새겨진 점 하나가 당신에겐 커다란 우주였기를.",
    "그날의 웃음소리가 고여있는 소중한 추억의 자리입니다.",
    "복잡한 세상을 잠시 잊고 오롯이 당신에게 집중했던 시간.",
    "소박하지만 아름다웠던, 당신만의 여행 이야기.",
    "가끔은 그리워질, 그곳에서의 여유로운 오후.",
    "낯설어서 더 설레고, 익숙해서 더 포근했던 공간.",
    "당신의 시선이 머문 곳마다 따뜻한 색깔이 칠해졌을 거예요.",
    "우연한 만남이 선물한 뜻밖의 행복을 기억하시나요?",
    "멈추어 서서 바라본 하늘이 참 예뻤던 그날입니다.",
    "여행 가방에 가득 채워온 것은 물건보다 귀한 마음이었습니다.",
    "발길이 닿는 곳마다 당신만의 리듬이 흐르던 시간.",
    "혼자여서 깊었고, 함께여서 벅찼던 소중한 날들의 기록.",
    "언젠가 다시 마주할 그날을 조용히 기다리게 되는 곳.",
    "여행은 끝났지만, 그곳에서 얻은 힘으로 오늘을 살아갑니다.",
    "싱그러운 풀냄새, 혹은 차가운 도시의 공기가 전해지나요?",
    "눈을 감으면 선명하게 떠오르는, 당신만의 비밀 장소.",
    "수많은 사람 사이에서 당신만의 이야기를 써 내려갔던 곳.",
    "일상의 소중함을 다시금 깨닫게 해준 고마운 여정.",
    "기억의 조각들이 모여 당신이라는 아름다운 지도를 그립니다.",
    "그때의 당신과 지금의 당신이 서로에게 건네는 따뜻한 안부.",
    "서툰 발걸음조차 소중한 역사가 되는 여행의 마법.",
    "마음속 깊이 간직한, 나만의 보석 같은 풍경입니다.",
    "계절의 변화와 함께 더욱 깊어질 당신의 여행 기록.",
    "이곳에서의 시간이 당신의 삶에 작은 쉼표가 되었기를 바랍니다."
]

const getStableQuote = (id: string) => {
    // ID를 기반으로 결정론적인(deterministic) 인덱스 생성
    let hash = 0
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    const index = Math.abs(hash) % EMOTIONAL_QUOTES.length
    return EMOTIONAL_QUOTES[index]
}

export default function PlacesVisitedPage() {
    const supabase = createClient()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [places, setPlaces] = useState<GroupedPlace[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [expandedLocation, setExpandedLocation] = useState<string | null>(null)

    useEffect(() => {
        const fetchPlaces = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. 사용자의 모든 여행 가져오기
            const { data: trips } = await supabase
                .from('trips')
                .select('id, destination, start_date')
                .eq('user_id', user.id)
            
            const tripIds = trips?.map((t: any) => t.id) || []

            if (tripIds.length > 0) {
                // 2. 해당 여행들에 속한 장소들 인출
                const { data: plans } = await supabase
                    .from('plans')
                    .select('location, trip_id')
                    .in('trip_id', tripIds)

                if (plans) {
                    // 3. 집계 및 중복 제거 로직
                    const grouped = plans.reduce((acc: Record<string, GroupedPlace>, plan: any) => {
                        const loc = plan.location?.trim()
                        if (!loc) return acc
                        
                        if (!acc[loc]) {
                            acc[loc] = {
                                location: loc,
                                tripCount: 0,
                                associatedTrips: []
                            }
                        }
                        
                        // 해당 장소가 포함된 여행(trip_id) 중복 체크
                        const tripId = plan.trip_id
                        const tripDetail = trips?.find((t: any) => t.id === tripId)
                        
                        if (tripDetail) {
                            const alreadyAdded = acc[loc].associatedTrips.some(t => t.id === tripId)
                            if (!alreadyAdded) {
                                acc[loc].associatedTrips.push({
                                    id: tripDetail.id,
                                    destination: tripDetail.destination,
                                    start_date: tripDetail.start_date
                                })
                                acc[loc].tripCount++
                            }
                        }
                        
                        return acc
                    }, {})

                    // 4. 결과 정렬 (방문 횟수 많은 순 -> 장소명 순)
                    const sorted = (Object.values(grouped) as GroupedPlace[]).sort((a, b) => {
                        if (b.tripCount !== a.tripCount) return b.tripCount - a.tripCount
                        return a.location.localeCompare(b.location)
                    })

                    setPlaces(sorted)
                }
            }
            setLoading(false)
        }

        fetchPlaces()
    }, [supabase])

    const filteredPlaces = places.filter(p => 
        p.location.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.associatedTrips.some(t => t.destination.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    if (loading) return (
        <div className={css({ maxW: '800px', mx: 'auto', p: '24px' })}>
            <Skeleton width="180px" height="28px" className={css({ mb: '16px' })} />
            <Skeleton width="100%" height="50px" borderRadius="12px" className={css({ mb: '40px' })} />
            <Skeleton width="120px" height="20px" className={css({ mb: '16px' })} />
            <CommonListSkeleton count={4} height="70px" gap="12px" />
        </div>
    )

    return (
        <div className={css({ 
            position: 'relative', left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw', width: '100vw',
            marginTop: { base: '-calc(64px + env(safe-area-inset-top))', md: '-calc(88px + env(safe-area-inset-top))' },
            paddingTop: { base: 'calc(64px + env(safe-area-inset-top))', md: 'calc(88px + env(safe-area-inset-top))' },
            minH: 'calc(100vh - 60px)', bg: '#F8FAFC', pb: '60px' 
        })}>
            <div className={css({ maxW: '720px', mx: 'auto' })}>
                <main className={css({ px: '20px', pt: '24px' })}>
                    {/* Visual Intro */}
                    <div className={css({ 
                        p: '40px 24px', borderRadius: '24px', color: 'white', mb: '32px', 
                        position: 'relative', overflow: 'hidden', boxShadow: '0 20px 40px rgba(59, 130, 246, 0.15)',
                        bg: 'brand.primary',
                        backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                    })}>
                        <div className={css({ position: 'relative', zIndex: 2 })}>
                            <div className={css({ 
                                display: 'inline-flex', p: '12px', bg: 'rgba(255,255,255,0.15)', 
                                borderRadius: '16px', mb: '20px', backdropFilter: 'blur(8px)'
                            })}>
                                <Footprints size={28} color="white" />
                            </div>
                            <h2 className={css({ fontSize: '24px', fontWeight: '900', mb: '12px', letterSpacing: '-0.03em' })}>
                                {places.length}곳에서 남긴 소중한 흔적들
                            </h2>
                            <p className={css({ fontSize: '15px', opacity: 0.9, lineHeight: '1.6', fontWeight: '500' })}>
                                우리가 함께 머물렀던 모든 곳들이<br />
                                당신의 여정에 따뜻한 온기가 되기를 바랍니다.
                            </p>
                        </div>
                        <div className={css({ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.15 })}>
                            <MapPin size={160} />
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className={css({ position: 'relative', mb: '32px' })}>
                        <Search size={20} color="#94A3B8" className={css({ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)' })} />
                        <input 
                            type="text" 
                            placeholder="기억하고 싶은 장소를 검색해보세요..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={css({ 
                                w: '100%', p: '16px 16px 16px 52px', borderRadius: '18px', 
                                bg: 'white', border: '1px solid #E2E8F0', fontSize: '15px',
                                outline: 'none', transition: 'all 0.2s',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                                _focus: { borderColor: 'brand.primary', boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.1)' }
                            })}
                        />
                    </div>

                    {/* Grouped Places Grid */}
                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '20px' })}>
                        {filteredPlaces.length > 0 ? (
                            filteredPlaces.map((place) => {
                                const isExpanded = expandedLocation === place.location

                                return (
                                    <div 
                                        key={place.location}
                                        className={css({ 
                                            bg: 'white', borderRadius: '28px', 
                                            border: '1px solid #EDF2F7', overflow: 'hidden',
                                            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                            boxShadow: isExpanded ? '0 25px 50px rgba(0,0,0,0.08)' : '0 4px 6px rgba(0,0,0,0.02)',
                                            transform: isExpanded ? 'scale(1.02)' : 'none',
                                            position: 'relative'
                                        })}
                                    >
                                        <button 
                                            onClick={() => setExpandedLocation(isExpanded ? null : place.location)}
                                            className={css({ 
                                                w: '100%', p: '24px 28px', display: 'flex', alignItems: 'center', 
                                                gap: '24px', bg: 'transparent', border: 'none', textAlign: 'left',
                                                cursor: 'pointer', transition: 'background 0.3s',
                                                _hover: { bg: '#F8FAFF' }
                                            })}
                                        >
                                            <div className={css({ 
                                                w: '64px', h: '64px', 
                                                bg: place.tripCount > 1 ? 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' : 'linear-gradient(135deg, #FFF5F5 0%, #FEE2E2 100%)', 
                                                borderRadius: '22px', display: 'flex', alignItems: 'center', 
                                                justifyContent: 'center', flexShrink: 0,
                                                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.8)'
                                            })}>
                                                {place.tripCount > 1 ? (
                                                    <Heart size={32} color="#D97706" fill="#D97706" style={{ opacity: 0.8 }} />
                                                ) : (
                                                    <Heart size={32} color="#EF4444" fill="#EF4444" style={{ opacity: 0.8 }} />
                                                )}
                                            </div>
                                            <div className={css({ flex: 1 })}>
                                                <div className={css({ fontSize: '20px', fontWeight: '900', color: '#1A202C', mb: '8px', letterSpacing: '-0.03em' })}>
                                                    {place.location}
                                                </div>
                                                <div className={css({ 
                                                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                                                    px: '14px', py: '6px', bg: place.tripCount > 1 ? '#FFFBEB' : '#F8FAFC',
                                                    color: place.tripCount > 1 ? '#B45309' : '#64748B', 
                                                    borderRadius: '12px', fontSize: '13px', fontWeight: '850',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                                                })}>
                                                    {place.tripCount > 1 && <Sparkles size={14} className={css({ animation: 'bounce 2s infinite', color: '#F59E0B' })} />}
                                                    {place.tripCount}개의 추억 조각이 담겨있어요
                                                </div>
                                            </div>
                                        </button>

                                        {/* Accordion Detail (Associated Trips) */}
                                        <div className={css({ 
                                            maxH: isExpanded ? '1000px' : '0', 
                                            overflow: 'hidden', 
                                            transition: 'max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                                            bg: '#FBFCFD', 
                                            borderTop: isExpanded ? '1px solid #F1F5F9' : 'none'
                                        })}>
                                            <div className={css({ p: '36px 28px' })}>
                                                <div className={css({ 
                                                    fontSize: '12px', color: '#94A3B8', fontWeight: '900', 
                                                    mb: '28px', textTransform: 'uppercase', letterSpacing: '0.2em',
                                                    display: 'flex', alignItems: 'center', gap: '12px'
                                                })}>
                                                    <div className={css({ w: '20px', h: '3px', bg: 'brand.primary', opacity: 0.4, borderRadius: 'full' })} />
                                                    그날의 기록들을 펼쳐보아요
                                                </div>
                                                
                                                <div className={css({ 
                                                    display: 'flex', flexDirection: 'column', gap: '4px',
                                                    position: 'relative', ml: '10px'
                                                })}>
                                                    {/* Vertical Timeline Guide Line */}
                                                    <div className={css({ 
                                                        position: 'absolute', left: '7px', top: '12px', bottom: '12px', 
                                                        w: '2px', bg: 'linear-gradient(to bottom, brand.primary, #E2E8F0, #F1F5F9)', borderRadius: 'full',
                                                        opacity: 0.4
                                                    })} />

                                                    {place.associatedTrips.map((trip, idx) => (
                                                        <div key={trip.id} className={css({ position: 'relative', pl: '36px', pb: idx === place.associatedTrips.length - 1 ? '0' : '28px' })}>
                                                            {/* Timeline Dot */}
                                                            <div className={css({ 
                                                                position: 'absolute', left: '0', top: '10px', 
                                                                w: '16px', h: '16px', bg: 'white', border: '3px solid', 
                                                                borderColor: 'brand.primary', borderRadius: 'full', zIndex: 2,
                                                                boxShadow: '0 0 12px rgba(59, 130, 246, 0.3)'
                                                            })} />
                                                            
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    router.push(`/trips/detail?id=${trip.id}`)
                                                                }}
                                                                className={css({ 
                                                                    w: '100%', p: '28px', bg: 'white', borderRadius: '28px',
                                                                    border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column',
                                                                    gap: '18px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                    boxShadow: '0 6px 16px rgba(0,0,0,0.03)',
                                                                    textAlign: 'left',
                                                                    _hover: { 
                                                                        borderColor: 'brand.primary', 
                                                                        bg: '#F0F7FF',
                                                                        transform: 'translateX(10px)',
                                                                        boxShadow: '0 20px 40px rgba(59, 130, 246, 0.1)'
                                                                    },
                                                                    cursor: 'pointer'
                                                                })}
                                                            >
                                                                <div className={css({ w: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
                                                                    <div className={css({ fontSize: '18px', fontWeight: '900', color: '#1E293B', letterSpacing: '-0.02em' })}>
                                                                        {trip.destination}
                                                                    </div>
                                                                    <ChevronLeft size={18} className={css({ color: '#CBD5E1', transform: 'rotate(180deg)' })} />
                                                                </div>

                                                                <div className={css({ 
                                                                    display: 'flex', flexDirection: 'column', gap: '12px'
                                                                })}>
                                                                    <div className={css({ 
                                                                        display: 'inline-flex', alignSelf: 'flex-start',
                                                                        px: '14px', py: '6px', bg: '#EDF2F7', color: '#475569',
                                                                        borderRadius: '12px', fontSize: '12px', fontWeight: '850',
                                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                                                                    })}>
                                                                        {new Date(trip.start_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                                    </div>
                                                                    
                                                                    <div className={css({ 
                                                                        fontSize: '15px', color: '#64748B', lineHeight: '1.7', 
                                                                        letterSpacing: '-0.025em', fontStyle: 'italic',
                                                                        borderLeft: '4px solid #E2E8F0', pl: '16px',
                                                                        fontWeight: '500'
                                                                    })}>
                                                                        "{new Date(trip.start_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}의 기록, <br/>
                                                                        {getStableQuote(trip.id)}"
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className={css({ textAlign: 'center', py: '80px', color: '#A0AEC0' })}>
                                <div className={css({ mb: '16px', opacity: 0.5, display: 'flex', justifyContent: 'center' })}>
                                    <Search size={48} />
                                </div>
                                <p className={css({ fontSize: '15px' })}>검색 결과가 없어요. 새로운 발자취를 남겨볼까요?</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}
