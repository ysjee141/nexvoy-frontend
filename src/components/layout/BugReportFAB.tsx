'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquareText } from 'lucide-react'
import { css } from 'styled-system/css'
import { createClient } from '@/utils/supabase/client'
import { isBetaTester } from '@/constants/testers'
import BugReportModal from '../profile/BugReportModal'

export default function BugReportFAB() {
    const [isOpen, setIsOpen] = useState(false)
    const [user, setUser] = useState<any>(null)
    const pathname = usePathname()
    const supabase = createClient()

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }
        getUser()
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    // 제외 페이지 로직
    const excludedPaths = ['/profile/licenses', '/profile/withdrawal', '/signup']
    const isExcluded = excludedPaths.includes(pathname)
    
    // 테스터 여부 확인
    if (!user || !isBetaTester(user.id) || isExcluded) return null

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
                    w: '54px',
                    h: '54px',
                    borderRadius: '18px',
                    bg: '#2EC4B6',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 32px rgba(46, 196, 182, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
                    _hover: { transform: 'translateY(-2px)', bg: '#249E93' },
                    _active: { transform: 'scale(0.9)' }
                })}
                title="피드백 보내기"
            >
                <div className={css({ position: 'relative' })}>
                    <MessageSquareText size={24} />
                    <span className={css({
                        position: 'absolute', top: '-6px', right: '-6px',
                        w: '10px', h: '10px', bg: '#FF9F1C', borderRadius: '50%',
                        border: '2px solid #2EC4B6'
                    })} />
                </div>
            </button>

            <BugReportModal 
                isOpen={isOpen} 
                onClose={() => setIsOpen(false)} 
                user={{ id: user.id, email: user.email }} 
            />
        </>
    )
}
