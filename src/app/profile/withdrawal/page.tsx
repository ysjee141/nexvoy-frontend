'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function WithdrawalPage() {
    const router = useRouter()
    const supabase = createClient()
    
    const [user, setUser] = useState<any>(null)
    const [stats, setStats] = useState({ totalTrips: 0, totalItems: 0 })
    const [loading, setLoading] = useState(true)
    
    const [step, setStep] = useState(1) // 1: Retention, 2: Final Confirmation
    const [confirmText, setConfirmText] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    useEffect(() => {
        const fetchStats = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }
            setUser(user)

            // Trips count
            const { data: trips } = await supabase.from('trips').select('id').eq('user_id', user.id)
            const tripIds = trips?.map((t: any) => t.id) || []
            
            let itemsCount = 0
            if (tripIds.length > 0) {
                const { data: checklists } = await supabase.from('checklists').select('id').in('trip_id', tripIds)
                const checklistIds = checklists?.map((c: any) => c.id) || []
                if (checklistIds.length > 0) {
                    const { count } = await supabase.from('checklist_items').select('id', { count: 'exact', head: true }).in('checklist_id', checklistIds)
                    itemsCount = count || 0
                }
            }
            
            setStats({ totalTrips: tripIds.length, totalItems: itemsCount })
            setLoading(false)
        }
        fetchStats()
    }, [supabase, router])

    const handleDeleteAccount = async () => {
        if (confirmText !== '탈퇴') return
        setIsDeleting(true)
        setErrorMsg('')

        // 1. Call RPC function to delete current user from auth.users
        const { error } = await supabase.rpc('delete_user')
        
        if (error) {
            setErrorMsg('계정을 삭제하다가 잠시 문제가 생겼어요. 다시 한번 시도해 주시겠어요? (' + error.message + ')')
            setIsDeleting(false)
            return
        }

        // 2. Sign out locally
        await supabase.auth.signOut()
        
        // 3. Clear local storage cache
        if (typeof window !== 'undefined') {
            localStorage.clear()
        }

        router.push('/')
    }

    if (loading) return <div className={css({ textAlign: 'center', py: '60px', color: '#888' })}>잠시만요, 정보를 가져오고 있어요! ✈️</div>

    return (
        <div className={css({ 
            position: { base: 'fixed', sm: 'relative' },
            inset: { base: 0, sm: 'auto' },
            zIndex: { base: 100, sm: 'auto' },
            minH: '100vh', 
            w: '100%',
            bg: '#f9f9fc',
            overflowY: 'auto'
        })}>
            {/* Header */}
            <header className={css({ 
                bg: 'white', h: '56px', display: { base: 'flex', sm: 'none' }, alignItems: 'center', borderBottom: '1px solid #eee', 
                position: 'sticky', top: 0, zIndex: 10, pt: 'max(env(safe-area-inset-top), var(--safe-area-inset-top))'
            })}>
                <div className={css({ display: 'flex', alignItems: 'center', px: '16px', w: '100%', maxW: '720px', mx: 'auto' })}>
                    <button onClick={() => router.back()} className={css({ p: '8px', ml: '-8px', mr: '8px', cursor: 'pointer', bg: 'none', border: 'none' })}>
                        <ChevronLeft size={24} color="#333" />
                    </button>
                    <h1 className={css({ fontSize: '18px', fontWeight: 'bold', color: '#172554' })}>회원 탈퇴</h1>
                </div>
            </header>

            <main className={css({ maxW: '720px', mx: 'auto', p: '24px 20px', pb: 'calc(24px + max(env(safe-area-inset-bottom), var(--safe-area-inset-bottom)))' })}>
                {step === 1 ? (
                    <div className={css({ bg: 'white', borderRadius: '24px', p: { base: '32px 24px', sm: '48px' }, textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' })}>
                        <div className={css({ fontSize: '48px', mb: '16px' })}>🥺</div>
                        <h2 className={css({ fontSize: '24px', fontWeight: '700', color: '#172554', mb: '12px' })}>
                            정말 온여정을 떠나시겠어요?
                        </h2>
                        
                        {(stats.totalTrips > 0 || stats.totalItems > 0) ? (
                            <p className={css({ fontSize: '15px', color: '#555', lineHeight: 1.6, mb: '32px', wordBreak: 'keep-all' })}>
                                지금 떠나시면 그동안 함께 했던 <strong className={css({ color: '#3B82F6' })}>{stats.totalTrips}개의 소중한 여행 일정</strong>과 <strong className={css({ color: '#2563EB' })}>{stats.totalItems}개의 짐 챙기기 기록</strong>이 모두 삭제되며, 영구적으로 복구할 수 없습니다. 계속 함께해 주시면 안 될까요?
                            </p>
                        ) : (
                            <p className={css({ fontSize: '15px', color: '#555', lineHeight: 1.6, mb: '32px', wordBreak: 'keep-all' })}>
                                탈퇴 시 계정 정보와 모든 데이터가 영구적으로 삭제되어 복구할 수 없게 돼요. 온여정과 함께 멋진 여행을 다시 스케치해 보는 건 어떨까요?
                            </p>
                        )}
                        
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                            <button onClick={() => router.back()} className={css({ w: '100%', py: '16px', bg: '#2563EB', color: 'white', fontWeight: 'bold', fontSize: '16px', borderRadius: '14px', cursor: 'pointer', border: 'none', transition: 'all 0.2s', _hover: { bg: '#2d8a45' }, boxShadow: '0 8px 20px rgba(52, 168, 83, 0.2)' })}>
                                우리 계속 함께해요! (돌아가기)
                            </button>
                            <button onClick={() => setStep(2)} className={css({ w: '100%', py: '16px', bg: 'transparent', color: '#999', fontWeight: '600', fontSize: '14px', borderRadius: '14px', cursor: 'pointer', border: 'none', textDecoration: 'underline', _hover: { color: '#666' } })}>
                                그래도 탈퇴하기
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={css({ bg: 'white', borderRadius: '24px', p: { base: '32px 24px', sm: '48px' }, boxShadow: '0 8px 24px rgba(0,0,0,0.04)' })}>
                        <div className={css({ display: 'flex', alignItems: 'flex-start', gap: '12px', mb: '24px', p: '16px', bg: '#fef2f2', borderRadius: '12px', color: '#dc2626' })}>
                            <AlertTriangle size={20} className={css({ flexShrink: 0, mt: '2px' })} />
                            <p className={css({ fontSize: '14px', lineHeight: 1.5, wordBreak: 'keep-all', m: 0 })}>
                                <strong>잠깐만요! 💡</strong> 계정 삭제 시 등록된 연락처, 여행 일정, 템플릿 등 모든 데이터가 즉시 파기되며 복구할 수 없어요.
                            </p>
                        </div>
                        
                        <h2 className={css({ fontSize: '20px', fontWeight: 'bold', color: '#172554', mb: '8px' })}>정말 떠나실 건가요?</h2>
                        <p className={css({ fontSize: '14px', color: '#666', mb: '24px', wordBreak: 'keep-all', lineHeight: 1.5 })}>
                            정말 탈퇴를 원하신다면, 아래 입력란에 <strong>탈퇴</strong> 라고 입력해 주세요.
                        </p>
                        
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="탈퇴"
                            className={css({ w: '100%', p: '14px 16px', border: '1px solid #ddd', borderRadius: '12px', fontSize: '16px', outline: 'none', mb: '24px', transition: 'border-color 0.2s', _focus: { borderColor: '#172554' } })}
                        />

                        {errorMsg && (
                            <div className={css({ mb: '20px', p: '12px', bg: '#fef2f2', color: '#dc2626', fontSize: '13px', borderRadius: '8px', wordBreak: 'keep-all' })}>
                                {errorMsg}
                            </div>
                        )}
                        
                        <div className={css({ display: 'flex', gap: '12px' })}>
                            <button onClick={() => setStep(1)} disabled={isDeleting} className={css({ flex: 1, py: '14px', bg: '#f1f3f4', color: '#555', fontWeight: '600', fontSize: '15px', borderRadius: '12px', cursor: 'pointer', border: 'none', _hover: { bg: '#e5e7eb' } })}>
                                취소
                            </button>
                            <button 
                                onClick={handleDeleteAccount}
                                disabled={confirmText !== '탈퇴' || isDeleting}
                                className={css({ flex: 1, py: '14px', bg: '#dc2626', color: 'white', fontWeight: 'bold', fontSize: '15px', borderRadius: '12px', cursor: 'pointer', border: 'none', transition: 'all 0.2s', _disabled: { opacity: 0.5, cursor: 'not-allowed' }, _hover: { bg: '#b91c1c' } })}
                            >
                                {isDeleting ? '여정을 마무리하는 중...' : '계정을 영구히 삭제할게요'}
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
