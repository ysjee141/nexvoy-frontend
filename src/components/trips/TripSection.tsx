'use client'

import { useState } from 'react'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { MapPin, CalendarDays, User, ChevronDown, ChevronUp } from 'lucide-react'

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

    if (trips.length === 0) return null

    return (
        <section className={css({ mb: '32px' })}>
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
                        <h2 className={css({ fontSize: { base: '17px', sm: '20px' }, fontWeight: '700', color: '#222' })}>
                            {title}
                        </h2>
                        <p className={css({ fontSize: '13px', color: '#999', mt: '1px' })}>{subtitle} · {trips.length}개</p>
                    </div>
                </div>
                <div className={css({
                    w: '32px', h: '32px', borderRadius: '50%', bg: '#f1f3f4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                })}>
                    {isOpen
                        ? <ChevronUp size={18} color="#555" />
                        : <ChevronDown size={18} color="#555" />
                    }
                </div>
            </button>

            {/* 섹션 콘텐츠 */}
            {isOpen && (
                <div className={css({
                    display: 'grid',
                    gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: '16px',
                })}>
                    {trips.map((trip) => {
                        const start = new Date(trip.start_date).toLocaleDateString()
                        const end = new Date(trip.end_date).toLocaleDateString()

                        const mainChecklist = trip.checklists?.[0]
                        const items = mainChecklist?.checklist_items || []
                        const totalItems = items.length
                        const checkedItems = items.filter((item) => item.is_checked).length
                        const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0
                        const isOwner = trip.user_id === currentUserId

                        return (
                            <Link
                                key={trip.id}
                                href={`/trips/${trip.id}`}
                                className={css({
                                    display: 'block', bg: 'white',
                                    p: { base: '16px', sm: '20px' },
                                    borderRadius: '16px',
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                                    border: '1px solid #f0f0f0',
                                    transition: 'all 0.2s',
                                    position: 'relative', overflow: 'hidden',
                                    _hover: {
                                        transform: 'translateY(-4px)',
                                        boxShadow: '0 12px 28px rgba(0,0,0,0.09)',
                                        borderColor: accentColor,
                                    },
                                })}
                            >
                                {/* 왼쪽 컬러 바 */}
                                <div className={css({
                                    position: 'absolute', top: 0, left: 0,
                                    w: '4px', h: '100%',
                                    bg: isOwner
                                        ? 'linear-gradient(to bottom, #4285F4, #34A853)'
                                        : 'linear-gradient(to bottom, #FBBC05, #EA4335)',
                                })} />

                                <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '10px' })}>
                                    <span className={css({
                                        fontSize: '11px', fontWeight: '800', px: '8px', py: '4px',
                                        borderRadius: '6px', bg: isOwner ? '#e8f0fe' : '#fef7e0',
                                        color: isOwner ? '#1a73e8' : '#ea8600',
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    })}>
                                        {isOwner ? '내 여정' : '참여 중'}
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
                                    color: '#222', wordBreak: 'break-all',
                                })}>
                                    <MapPin size={18} color="#EA4335" />
                                    {trip.destination}
                                </h3>

                                <div className={css({ display: 'flex', flexDirection: 'column', gap: '6px', color: '#666', mb: '16px' })}>
                                    <p className={css({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' })}>
                                        <CalendarDays size={14} color="#888" /> {start} ~ {end}
                                    </p>
                                    <p className={css({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' })}>
                                        <User size={14} color="#888" /> 성인 {trip.adults_count}명
                                        {trip.children_count > 0 && `, 아이 ${trip.children_count}명`}
                                    </p>
                                </div>

                                {/* 체크리스트 진행률 */}
                                <div className={css({ borderTop: '1px solid #f0f0f0', pt: '12px' })}>
                                    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '6px' })}>
                                        <span className={css({ fontSize: '12px', fontWeight: '600', color: '#666' })}>준비물</span>
                                        <span className={css({ fontSize: '12px', fontWeight: 'bold', color: progressPercent === 100 ? '#34A853' : '#4285F4' })}>
                                            {progressPercent}%
                                        </span>
                                    </div>
                                    <div className={css({ w: '100%', h: '5px', bg: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' })}>
                                        <div
                                            className={css({ h: '100%', bg: progressPercent === 100 ? '#34A853' : accentColor, transition: 'width 0.5s ease' })}
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                    {totalItems === 0 && (
                                        <p className={css({ fontSize: '11px', color: '#bbb', mt: '4px', textAlign: 'right' })}>항목 없음</p>
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
