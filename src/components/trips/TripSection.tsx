'use client'

import { useState } from 'react'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { MapPin, CalendarDays, User, ChevronDown, ChevronUp } from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'
import { formatDate } from '@/utils/date'

interface Trip {
    id: string
    destination: string
    start_date: string
    end_date: string
    adults_count: number
    children_count: number
    user_id: string
    checklists?: { checklist_items: { is_checked: boolean }[] }[]
}

interface TripSectionProps {
    title: string
    subtitle: string
    emoji: string
    accentColor: string
    badgeBg: string
    badgeColor: string
    badgeLabel: string
    trips: Trip[]
    currentUserId: string
    defaultOpen?: boolean
}

export default function TripSection({
    title, subtitle, emoji, accentColor, badgeBg, badgeColor, badgeLabel,
    trips, currentUserId, defaultOpen = true
}: TripSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    const { setMobileTitle } = useUIStore()

    if (trips.length === 0) return null

    return (
        <section className={css({ mb: '48px' })}>
            {/* 섹션 헤더 (클릭 시 폴딩) */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className={css({
                    w: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    mb: '16px', cursor: 'pointer', bg: 'transparent', border: 'none', p: '0',
                    textAlign: 'left',
                })}
            >
                <div className={css({ display: 'flex', alignItems: 'center', gap: '10px' })}>
                    <span className={css({ fontSize: '22px' })}>{emoji}</span>
                    <div>
                        <h2 className={css({ fontSize: { base: '17px', sm: '20px' }, fontWeight: '700', color: 'brand.secondary' })}>
                            {title}
                        </h2>
                        <p className={css({ fontSize: '13px', color: 'brand.muted', mt: '1px' })}>{subtitle} · {trips.length}개</p>
                    </div>
                </div>
                <div className={css({
                    w: '32px', h: '32px', borderRadius: '50%', bg: 'bg.softCotton',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                })}>
                    {isOpen
                        ? <ChevronUp size={18} className={css({ color: 'brand.muted' })} />
                        : <ChevronDown size={18} className={css({ color: 'brand.muted' })} />
                    }
                </div>
            </button>

            {/* 섹션 콘텐츠 */}
            {isOpen && (
                <div className={css({
                    display: 'grid',
                    gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: { base: '20px', lg: '32px' },
                })}>
                    {trips.map((trip) => {
                        const start = formatDate(trip.start_date)
                        const end = formatDate(trip.end_date)

                        const mainChecklist = trip.checklists?.[0]
                        const items = mainChecklist?.checklist_items || []
                        const totalItems = items.length
                        const checkedItems = items.filter((item) => item.is_checked).length
                        const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0
                        const isOwner = trip.user_id === currentUserId

                        return (
                            <Link
                                key={trip.id}
                                href={`/trips/detail?id=${trip.id}`}
                                onClick={() => setMobileTitle(trip.destination)}
                                className={css({
                                    display: 'block', 
                                    bg: 'white',
                                    p: { base: '16px', sm: '20px' },
                                    borderRadius: '16px',
                                    boxShadow: '0 6px 20px rgba(0,0,0,0.05)',
                                    border: '1px solid',
                                    borderColor: 'brand.border',
                                    transition: 'all 0.4s cubic-bezier(0.2, 0, 0, 1)',
                                    position: 'relative', 
                                    overflow: 'hidden',
                                    _hover: {
                                        transform: 'translateY(-6px)',
                                        boxShadow: '0 15px 30px rgba(0,0,0,0.1)',
                                        borderColor: 'brand.border',
                                    },
                                    _active: { transform: 'scale(0.97)' }
                                })}
                            >
                                {/* 상단 포인트 바 */}
                                <div className={css({
                                    position: 'absolute', top: 0, left: 0, right: 0,
                                    h: '4px',
                                    bg: isOwner
                                        ? 'brand.primary'
                                        : 'brand.muted',
                                })} />

                                <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '10px' })}>
                                    <span className={css({
                                        fontSize: '11px', fontWeight: '700', px: '8px', py: '4px',
                                        borderRadius: '6px', 
                                        bg: isOwner ? 'bg.softCotton' : 'bg.softCotton',
                                        color: isOwner ? 'brand.primary' : 'brand.secondary',
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        border: '1px solid',
                                        borderColor: isOwner ? 'rgba(46, 196, 182, 0.1)' : 'brand.border'
                                    })}>
                                        {isOwner ? '내 소중한 여정' : '함께하고 있어요'}
                                    </span>
                                    {/* 상태 뱃지 */}
                                    <span className={css({
                                        fontSize: '11px', fontWeight: '700', px: '8px', py: '3px',
                                        borderRadius: '6px', bg: badgeBg, color: badgeColor,
                                    })}>
                                        {badgeLabel}
                                    </span>
                                </div>

                                <h3 className={css({
                                    fontSize: { base: '17px', sm: '18px' }, fontWeight: '700',
                                    mb: '12px', display: 'flex', alignItems: 'center', gap: '6px',
                                    color: 'brand.secondary', wordBreak: 'break-all',
                                })}>
                                    <MapPin size={18} className={css({ color: 'brand.accent' })} />
                                    {trip.destination}
                                </h3>

                                <div className={css({ display: 'flex', flexDirection: 'column', gap: '6px', color: 'brand.muted', mb: '16px' })}>
                                    <p className={css({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' })}>
                                        <CalendarDays size={14} className={css({ color: 'brand.muted' })} /> {start} ~ {end}
                                    </p>
                                    <p className={css({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' })}>
                                        <User size={14} className={css({ color: 'brand.muted' })} /> 성인 {trip.adults_count}명
                                        {trip.children_count > 0 && `, 아이 ${trip.children_count}명`}
                                    </p>
                                </div>

                                {/* 체크리스트 진행률 */}
                                <div className={css({ borderTop: '1px solid', borderTopColor: 'brand.border', pt: '12px' })}>
                                    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '6px' })}>
                                        <span className={css({ fontSize: '12px', fontWeight: '600', color: 'brand.muted' })}>준비물</span>
                                        <span className={css({ fontSize: '12px', fontWeight: '700', color: progressPercent === 100 ? 'brand.secondary' : 'brand.primary' })}>
                                            {progressPercent}%
                                        </span>
                                    </div>
                                    <div className={css({ w: '100%', h: '8px', bg: 'bg.softCotton', borderRadius: '10px', overflow: 'hidden', border: '1px solid', borderColor: 'brand.border' })}>
                                        <div
                                            className={css({ h: '100%', bg: progressPercent === 100 ? 'brand.primary' : 'brand.accent', transition: 'width 1s cubic-bezier(0.2, 0, 0, 1)' })}
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                    {totalItems === 0 && (
                                        <p className={css({ fontSize: '11px', color: 'brand.muted', mt: '4px', textAlign: 'right' })}>앗, 등록된 항목이 없어요!</p>
                                    )}
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
