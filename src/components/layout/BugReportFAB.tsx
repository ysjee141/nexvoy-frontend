'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquarePlus } from 'lucide-react'
import { css } from 'styled-system/css'
import { createClient } from '@/utils/supabase/client'
import { isBetaTester } from '@/constants/testers'
import BugReportModal from '../profile/BugReportModal'

export default function BugReportFAB() {
    const pathname = usePathname()
    const [user, setUser] = useState<any>(null)
    const [isOpen, setIsOpen] = useState(false)
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

    // 제외 페이지 로직 (로그인한 경우 메인에서도 노출되도록 '/' 제거)
    const excludedPaths = ['/profile/licenses', '/profile/withdrawal', '/signup']
    const isExcluded = excludedPaths.includes(pathname)
    
    // 테스터 여부 확인
    if (!user || !isBetaTester(user.id) || isExcluded) return null

    // 스태킹 로직: 체크리스트나 상세 페이지 등 기존 FAB가 있는 곳에선 더 높게 배치
    const hasExistingFAB = pathname.includes('/trips/checklist') || pathname.includes('/trips/detail')
    const bottomOffset = hasExistingFAB ? '160px' : '90px'

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed',
                    right: '20px',
                    bottom: `calc(${bottomOffset} + env(safe-area-inset-bottom, 0px))`,
                    zIndex: 9999,
                }}
                className={css({
                    w: '48px',
                    h: '48px',
                    borderRadius: '50%',
                    bg: '#222',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    border: '2px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    _hover: { transform: 'scale(1.1)', bg: '#000' },
                    _active: { transform: 'scale(0.9)' }
                })}
                title="피드백 보내기"
            >
                <MessageSquarePlus size={24} />
            </button>

            <BugReportModal 
                isOpen={isOpen} 
                onClose={() => setIsOpen(false)} 
                user={{ id: user.id, email: user.email }} 
            />
        </>
    )
}
