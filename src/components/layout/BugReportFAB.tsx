'use client'

import { MessageSquareText } from 'lucide-react'
import { css } from 'styled-system/css'
import { useBugReport } from '@/hooks/useBugReport'
import BugReportModal from '../profile/BugReportModal'

export default function BugReportFAB() {
    const { isOpen, setIsOpen, user, isVisible, pathname } = useBugReport()
    
    if (!isVisible) return null

    // 스태킹 로직
    const hasExistingFAB = pathname.includes('/trips/checklist') || pathname.includes('/trips/detail')
    const bottomOffset = hasExistingFAB ? '160px' : '90px'

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed',
                    right: '24px',
                    bottom: `calc(${bottomOffset} + env(safe-area-inset-bottom, 0px))`,
                    zIndex: 1000,
                }}
                className={css({
                    display: { base: 'none', sm: 'flex' }, // 데스크톱 전용
                    w: '50px',
                    h: '50px',
                    borderRadius: '16px',
                    bg: 'brand.primary',
                    color: 'white',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 32px rgba(46, 196, 182, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
                    _hover: { transform: 'translateY(-2px)', bg: 'brand.primaryDark' },
                    _active: { transform: 'scale(0.95)' }
                })}
                title="피드백 보내기"
            >
                <div className={css({ position: 'relative' })}>
                    <MessageSquareText size={22} />
                    <span className={css({
                        position: 'absolute', top: '-6px', right: '-6px',
                        w: '8px', h: '8px', bg: 'orange.500', borderRadius: '50%',
                        border: '2.5px solid', borderColor: 'brand.primary'
                    })} />
                </div>
            </button>

            <BugReportModal 
                isOpen={isOpen} 
                onClose={() => setIsOpen(false)} 
                user={{ id: user?.id, email: user?.email }} 
            />
        </>
    )
}
