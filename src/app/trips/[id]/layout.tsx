import { createClient } from '@/utils/supabase/server'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { ArrowLeft, Calendar, Users } from 'lucide-react'
import { notFound } from 'next/navigation'
import TripTabNavigation from '@/components/trips/TripTabNavigation'

export default async function TripLayout(props: {
    children: React.ReactNode
    params: Promise<{ id: string }>
}) {
    const { id } = await props.params
    const supabase = await createClient()

    // 여행 상세 정보 가져오기
    const { data: trip } = await supabase
        .from('trips')
        .select('*')
        .eq('id', id)
        .single()

    if (!trip) {
        notFound()
    }

    const start = new Date(trip.start_date).toLocaleDateString()
    const end = new Date(trip.end_date).toLocaleDateString()

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
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '6px' })}>
                    <p className={css({ color: '#555', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' })}>
                        <Calendar size={15} color="#4285F4" />
                        {start} ~ {end}
                    </p>
                    <p className={css({ color: '#555', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' })}>
                        <Users size={15} color="#34A853" />
                        성인 {trip.adults_count}명{trip.children_count > 0 ? `, 아이 ${trip.children_count}명` : ''}
                    </p>
                </div>
            </div>

            <TripTabNavigation tripId={id} />

            {/* 하위 페이지 렌더링 영역 (일정표 OR 체크리스트) */}
            <div>{props.children}</div>
        </div>
    )
}
