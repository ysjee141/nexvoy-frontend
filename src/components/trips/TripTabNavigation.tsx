'use client'

import { css } from 'styled-system/css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, ListChecks } from 'lucide-react'

export default function TripTabNavigation({ tripId }: { tripId: string }) {
    const pathname = usePathname()

    const isChecklist = pathname?.includes('/checklist')

    return (
        <div
            className={css({
                display: 'flex',
                gap: '16px',
                borderBottom: '1px solid #ddd',
                mb: '24px',
            })}
        >
            <Link
                href={`/trips/${tripId}`}
                className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    px: '16px',
                    py: '12px',
                    color: isChecklist ? '#666' : '#111',
                    fontWeight: isChecklist ? '500' : '600',
                    borderBottom: isChecklist ? '2px solid transparent' : '2px solid #111',
                    _hover: { bg: '#f9fafb' },
                })}
            >
                <Calendar size={18} /> 일정표
            </Link>
            <Link
                href={`/trips/${tripId}/checklist`}
                className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    px: '16px',
                    py: '12px',
                    color: isChecklist ? '#111' : '#666',
                    fontWeight: isChecklist ? '600' : '500',
                    borderBottom: isChecklist ? '2px solid #111' : '2px solid transparent',
                    _hover: { bg: '#f9fafb' },
                })}
            >
                <ListChecks size={18} /> 준비물 체크리스트
            </Link>
        </div>
    )
}
