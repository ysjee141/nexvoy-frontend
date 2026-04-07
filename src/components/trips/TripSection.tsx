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
                                    borderRadius: '20px',
                                    overflow: 'hidden',
                                    transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                                    position: 'relative', 
                                    border: '1px solid',
                                    borderColor: 'brand.border',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                    _hover: {
                                        transform: 'translateY(-4px)',
                                        boxShadow: '0 12px 24px rgba(0,0,0,0.08)',
                                        borderColor: 'brand.primary/20',
                                    },
                                    _active: { transform: 'scale(0.97)' }
                                })}
                            >
                                <div className={css({ p: '24px' })}>
                                    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '12px' })}>
                                        <span className={css({
                                            fontSize: '11px', fontWeight: '700', px: '8px', py: '4px',
                                            borderRadius: '6px', 
                                            bg: 'bg.softCotton',
                                            color: isOwner ? 'brand.primary' : 'brand.secondary',
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            border: '1px solid',
                                            borderColor: isOwner ? 'brand.primary/10' : 'brand.border'
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
                                        <MapPin size={18} className={css({ 
                                            color: accentColor === 'brand.accent' ? 'brand.accent' : 
                                                   accentColor === 'brand.primary' ? 'brand.primary' : 'brand.muted' 
                                        })} />
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
                                            <span className={css({ 
                                                fontSize: '12px', fontWeight: '700', 
                                                color: progressPercent === 100 ? 'brand.success' : 'brand.primary' 
                                            })}>
                                                {progressPercent}%
                                            </span>
                                        </div>
                                        <div className={css({ 
                                            w: '100%', h: '6px', bg: 'brand.border/30', borderRadius: '10px', 
                                            overflow: 'hidden', border: 'none' 
                                        })}>
                                            <div
                                                className={css({ 
                                                    h: '100%', 
                                                    bg: progressPercent === 100 
                                                        ? 'brand.success' 
                                                        : (accentColor === 'brand.accent' ? 'brand.accent' : 'brand.primary'),
                                                    transition: 'width 1s cubic-bezier(0.2, 0, 0, 1)' 
                                                })}
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
