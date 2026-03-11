'use client'

import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import TripTabNavigation from '@/components/trips/TripTabNavigation'
import TripHeaderActions from '@/components/trips/TripHeaderActions'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function TripLayoutClient({ children }: { children: React.ReactNode }) {
    const searchParams = useSearchParams()
    const id = searchParams.get('id')
    const router = useRouter()
    const supabase = createClient()

    const [trip, setTrip] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchTrip() {
            const { data } = await supabase
                .from('trips')
                .select('*')
                .eq('id', id)
                .single()

            if (!data) {
                router.replace('/404')
            } else {
                setTrip(data)
            }
            setLoading(false)
        }
        fetchTrip()
    }, [id, supabase, router])

    if (loading) {
        return <div className={css({ w: '100%', py: '40px', textAlign: 'center', color: '#888' })}>여행 정보를 불러오는 중...</div>
    }

    if (!trip || !id) return null;

    return (
        <div className={css({ w: '100%', py: '20px' })}>
            {/* 뒤로 가기 및 타이틀 영역 */}
            <div className={css({ mb: '24px' })}>
                <Link
                    href="/"
                    className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#666',
                        fontSize: '14px',
                        mb: '12px',
                        _hover: { color: '#111' },
                    })}
                >
                    <ArrowLeft size={16} /> 목록으로
                </Link>
                <h1 className={css({
                    fontSize: { base: '22px', sm: '28px' },
                    fontWeight: 'bold',
                    color: '#111',
                    mb: '10px',
                    wordBreak: 'keep-all',
                    lineHeight: 1.3,
                })}>
                    {trip.destination} 여행
                </h1>

                {/* 날짜·인원 표시 + 수정/삭제 버튼 (클라이언트 컴포넌트) */}
                <TripHeaderActions trip={trip} />
            </div>

            <TripTabNavigation tripId={id} />

            {/* 하위 페이지 렌더링 영역 (일정표 OR 체크리스트) */}
            <div>{children}</div>
        </div>
    )
}
