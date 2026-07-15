'use client'

import { useCallback, useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { Check, Loader2, Mail, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
    createInvitationRepository,
    type PendingDocumentInvitation,
} from '@nexvoy/core/supabase/invitationRepository'
import { createClient } from '@/lib/supabase/client'

export default function InvitationBanner() {
    const [invitations, setInvitations] = useState<PendingDocumentInvitation[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const fetchInvitations = useCallback(async () => {
        try {
            const rows = await createInvitationRepository(createClient()).listMyPendingDocumentInvitations()
            setInvitations(rows)
        } catch {
            setError('초대 목록을 불러오지 못했습니다.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void fetchInvitations()
    }, [fetchInvitations])

    const processInvitation = async (id: string, action: 'accept' | 'decline') => {
        setProcessingId(id)
        setError(null)
        try {
            const repository = createInvitationRepository(createClient())
            if (action === 'accept') await repository.acceptMyDocumentInvitation(id)
            else await repository.declineMyDocumentInvitation(id)
            setInvitations((current) => current.filter((invitation) => invitation.id !== id))
            router.refresh()
        } catch {
            setError(action === 'accept' ? '초대를 수락하지 못했습니다.' : '초대를 거절하지 못했습니다.')
        } finally {
            setProcessingId(null)
        }
    }

    if (loading || (invitations.length === 0 && !error)) return null

    return (
        <section className={css({ bg: 'bg.softCotton', borderBottom: '1px solid', borderColor: 'brand.border', px: '20px', py: '12px' })} aria-label="여행 초대">
            <div className={css({ maxW: 'screen-xl', mx: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' })}>
                {invitations.length > 0 && (
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '8px', color: 'brand.primary', fontSize: '14px', fontWeight: '700' })}>
                        <Mail size={18} aria-hidden="true" />
                        새로운 여행 초대 {invitations.length}건
                    </div>
                )}
                <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '8px' })}>
                    {invitations.map((invitation) => (
                        <article key={invitation.id} className={css({ bg: 'white', px: '12px', py: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid', borderColor: 'brand.border', maxW: '100%' })}>
                            <div className={css({ minW: 0 })}>
                                <strong className={css({ display: 'block', fontSize: '13px', color: 'brand.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                                    {invitation.destination || '새 여행'}
                                </strong>
                                <span className={css({ fontSize: '12px', color: 'brand.muted' })}>
                                    {invitation.ownerNickname || '동행자'} · {invitation.role === 'editor' ? '편집 가능' : '조회 전용'}
                                </span>
                            </div>
                            <div className={css({ display: 'flex', gap: '4px', flexShrink: 0 })}>
                                <button type="button" onClick={() => void processInvitation(invitation.id, 'accept')} disabled={processingId === invitation.id} aria-label="초대 수락" className={actionButtonStyle}>
                                    {processingId === invitation.id ? <Loader2 size={14} className={css({ animation: 'spin 1s linear infinite' })} /> : <Check size={14} />}
                                </button>
                                <button type="button" onClick={() => void processInvitation(invitation.id, 'decline')} disabled={processingId === invitation.id} aria-label="초대 거절" className={declineButtonStyle}>
                                    <X size={14} />
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
                {error && <p role="alert" className={css({ color: 'brand.error', fontSize: '13px', fontWeight: '600' })}>{error}</p>}
            </div>
        </section>
    )
}

const actionButtonStyle = css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', w: '32px', h: '32px', bg: 'brand.primary', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', _disabled: { opacity: 0.5 } })
const declineButtonStyle = css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', w: '32px', h: '32px', bg: 'white', color: 'brand.muted', border: '1px solid', borderColor: 'brand.border', borderRadius: '8px', cursor: 'pointer', _disabled: { opacity: 0.5 } })
