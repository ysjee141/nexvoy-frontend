'use client'

import { useEffect, useState, useCallback } from 'react'
import { css } from 'styled-system/css'
import { Mail, Check, X, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { collaboration } from '@/utils/collaboration'

export default function InvitationBanner() {
    const [invitations, setInvitations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const router = useRouter()

    const fetchInvitations = useCallback(async () => {
        const { data } = await collaboration.getInvitedTrips()
        if (data) setInvitations(data)
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchInvitations()
    }, [fetchInvitations])

    const handleAccept = async (id: string) => {
        setProcessingId(id)
        const { error } = await collaboration.acceptInvite(id)
        if (!error) {
            setInvitations(prev => prev.filter(inv => inv.id !== id))
            router.refresh() // 메인 페이지의 서버 컴포넌트 데이터 갱신
        } else {
            alert('초대를 수락하다가 잠시 문제가 생겼어요. 다시 한번 시도해 주시겠어요?')
        }
        setProcessingId(null)
    }

    if (loading || invitations.length === 0) return null

    return (
        <div className={css({
            bg: 'bg.softCotton',
            borderBottom: '1px solid',
            borderBottomColor: 'brand.border',
            px: '20px',
            py: '12px'
        })}>
            <div className={css({
                maxW: 'screen-xl',
                mx: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexDirection: { base: 'column', sm: 'row' },
                gap: '12px'
            })}>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '8px', color: 'brand.primary', fontSize: '14px', fontWeight: '500' })}>
                    <Mail size={18} />
                    <span>반가운 소식! 새로운 여행 초대 {invitations.length}건이 도착했어요! 💌</span>
                </div>

                <div className={css({ display: 'flex', gap: '8px', w: { base: '100%', sm: 'auto' } })}>
                    {invitations.map((inv) => (
                        <div key={inv.id} className={css({
                            bg: 'white',
                            px: '12px',
                            py: '6px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            boxShadow: 'dimensional',
                            w: { base: '100%', sm: 'auto' },
                            border: '1px solid',
                            borderColor: 'brand.border'
                        })}>
                            <span className={css({ fontSize: '13px', fontWeight: 'bold', color: 'brand.secondary' })}>
                                {inv.trips?.destination || '여행'}
                            </span>
                            <div className={css({ display: 'flex', gap: '4px' })}>
                                <button
                                    onClick={() => handleAccept(inv.id)}
                                    disabled={processingId === inv.id}
                                    className={css({
                                        bg: 'brand.primary',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        px: '12px',
                                        py: '6px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s',
                                        _hover: { bg: 'brand.primaryDark', transform: 'scale(1.02)' },
                                        _disabled: { opacity: 0.5 }
                                    })}
                                >
                                    {processingId === inv.id ? <Loader2 size={12} className={css({ animation: 'spin 1s linear infinite' })} /> : <Check size={12} />}
                                    수락
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
