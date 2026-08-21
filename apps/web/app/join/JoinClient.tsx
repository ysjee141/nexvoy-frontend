'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, Loader2, Plane, TicketCheck } from 'lucide-react'
import { css } from 'styled-system/css'
import {
    createInvitationRepository,
    type DocumentInvitationSummary,
} from '@nexvoy/core/supabase/invitationRepository'
import { createClient } from '@/lib/supabase/client'

type JoinState = 'code_entry' | 'resolving' | 'preview' | 'accepting' | 'invalid' | 'error'
type JoinInput = { token?: string; inviteCode?: string }

export default function JoinClient() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [state, setState] = useState<JoinState>(() => (
        searchParams.get('token') || searchParams.get('code') ? 'resolving' : 'code_entry'
    ))
    const [summary, setSummary] = useState<DocumentInvitationSummary | null>(null)
    const [activeInput, setActiveInput] = useState<JoinInput | null>(null)
    const [codeInput, setCodeInput] = useState('')
    const [message, setMessage] = useState<string | null>(null)

    const resolveInvitation = useCallback(async (input: JoinInput) => {
        setState('resolving')
        setMessage(null)
        try {
            const supabase = createClient()
            const nextSummary = await createInvitationRepository(supabase)
                .getDocumentInvitationSummary(input)
            if (!nextSummary) throw new Error('invalid')
            setSummary(nextSummary)
            setActiveInput(input)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.replace(`/login?next=${encodeURIComponent(buildJoinPath(input))}`)
                return
            }
            setState('preview')
        } catch {
            setSummary(null)
            setActiveInput(null)
            setState('invalid')
        }
    }, [router])

    useEffect(() => {
        const token = searchParams.get('token')
        const code = searchParams.get('code')
        const input = token ? { token } : code ? { inviteCode: sanitizeInviteCode(code) } : null
        if (input) void resolveInvitation(input)
        else setState('code_entry')
    }, [resolveInvitation, searchParams])

    const handleAccept = async () => {
        if (!activeInput || !summary || state === 'accepting') return
        setState('accepting')
        setMessage(null)
        try {
            const result = await createInvitationRepository(createClient())
                .acceptDocumentInvitation(activeInput)
            router.replace(`/trips/detail?id=${encodeURIComponent(result.documentId)}`)
        } catch (error) {
            const detail = (error as { message?: string } | null)?.message ?? ''
            setMessage(detail.includes('다른 계정')
                ? '이 초대는 다른 계정으로 발송되었습니다. 초대받은 이메일 계정으로 로그인해 주세요.'
                : '초대를 수락하지 못했습니다. 잠시 후 다시 시도해 주세요.')
            setState('error')
        }
    }

    const handleCodeSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        const inviteCode = sanitizeInviteCode(codeInput)
        if (!inviteCode) return
        void resolveInvitation({ inviteCode })
    }

    const isBusy = state === 'resolving' || state === 'accepting'

    return (
        <main className={css({ minH: '100dvh', bg: 'bg.canvas', px: { base: '16px', sm: '24px' }, pt: 'max(24px, env(safe-area-inset-top))', pb: 'max(24px, env(safe-area-inset-bottom))' })}>
            <div className={css({ w: '100%', maxW: '520px', mx: 'auto' })}>
                <button type="button" onClick={() => router.replace('/')} aria-label="홈으로" className={iconButtonStyle}><ArrowLeft size={20} /></button>
                <section className={css({ mt: '20px', bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', p: { base: '20px', sm: '28px' }, boxShadow: 'shadow.sm' })} aria-live="polite">
                    <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'center', w: '48px', h: '48px', borderRadius: '50%', bg: 'bg.surfaceSoft', color: state === 'invalid' || state === 'error' ? 'brand.error' : 'brand.primary', mb: '18px' })}>
                        {isBusy ? <Loader2 size={24} className={css({ animation: 'spin 1s linear infinite' })} /> : state === 'invalid' || state === 'error' ? <AlertCircle size={24} /> : state === 'code_entry' ? <TicketCheck size={24} /> : <Plane size={24} />}
                    </div>
                    <h1 className={css({ fontSize: '22px', fontWeight: '700', color: 'brand.ink', lineHeight: 1.35 })}>{getTitle(state, summary)}</h1>
                    <p className={css({ mt: '8px', color: 'brand.muted', fontSize: '14px', lineHeight: 1.6, wordBreak: 'keep-all' })}>{getDescription(state, summary, message)}</p>

                    {summary && state !== 'code_entry' && state !== 'invalid' ? (
                        <div className={css({ mt: '20px', p: '16px', bg: 'bg.surfaceSoft', borderRadius: '8px', display: 'grid', gap: '6px', fontSize: '13px', color: 'brand.ink' })}>
                            <strong>{summary.destination || '공유된 여정'}</strong>
                            <span>권한: {summary.role === 'editor' ? '편집자' : '뷰어'}</span>
                            {summary.startDate && summary.endDate ? <span>기간: {summary.startDate} ~ {summary.endDate}</span> : null}
                            {summary.ownerNickname ? <span>{summary.ownerNickname}님이 초대했습니다.</span> : null}
                        </div>
                    ) : null}

                    {(state === 'code_entry' || state === 'invalid') ? (
                        <form onSubmit={handleCodeSubmit} className={css({ mt: '24px', display: 'grid', gap: '10px' })}>
                            <label htmlFor="invite-code" className={css({ fontSize: '13px', fontWeight: '700', color: 'brand.ink' })}>초대 코드</label>
                            <input id="invite-code" value={codeInput} onChange={(event) => setCodeInput(formatInviteCode(event.target.value))} placeholder="A7K9-P2Q4-X8" autoCapitalize="characters" className={inputStyle} />
                            <button type="submit" disabled={!codeInput.trim()} className={primaryButtonStyle}>초대 확인</button>
                        </form>
                    ) : null}

                    {state === 'preview' ? <button type="button" onClick={() => void handleAccept()} className={primaryButtonStyle}>여정에 참여하기</button> : null}
                    {state === 'accepting' ? <button type="button" disabled className={primaryButtonStyle}>참여 처리 중</button> : null}
                    {state === 'error' ? <button type="button" onClick={() => activeInput && void resolveInvitation(activeInput)} className={primaryButtonStyle}>다시 시도</button> : null}
                </section>
            </div>
        </main>
    )
}

function getTitle(state: JoinState, summary: DocumentInvitationSummary | null): string {
    if (state === 'code_entry') return '초대 코드로 참여하기'
    if (state === 'resolving') return '초대를 확인하고 있어요'
    if (state === 'accepting') return '여정 참여를 처리하고 있어요'
    if (state === 'invalid') return '초대를 확인할 수 없어요'
    if (state === 'error') return '처리를 완료하지 못했어요'
    return summary?.destination ? `${summary.destination} 여정에 초대받았어요` : '여정에 초대받았어요'
}

function getDescription(
    state: JoinState,
    summary: DocumentInvitationSummary | null,
    message: string | null,
): string {
    if (message) return message
    if (state === 'code_entry') return '받은 초대 코드를 입력하면 참여할 여정을 확인할 수 있습니다.'
    if (state === 'invalid') return '링크가 만료되었거나 코드가 올바르지 않습니다. 코드를 다시 확인해 주세요.'
    if (state === 'error') return '네트워크 상태를 확인한 뒤 다시 시도해 주세요.'
    return summary?.ownerNickname ? `${summary.ownerNickname}님의 초대입니다.` : '초대 정보를 확인했습니다.'
}

function buildJoinPath(input: JoinInput): string {
    if (input.token) return `/join?token=${encodeURIComponent(input.token)}`
    if (input.inviteCode) return `/join?code=${encodeURIComponent(input.inviteCode)}`
    return '/join'
}

function sanitizeInviteCode(value: string): string {
    return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

function formatInviteCode(value: string): string {
    return sanitizeInviteCode(value).replace(/(.{4})(?=.)/g, '$1-')
}

const iconButtonStyle = css({ display: { base: 'none', md: 'inline-flex' }, alignItems: 'center', justifyContent: 'center', w: '40px', h: '40px', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', bg: 'white', color: 'brand.ink', cursor: 'pointer' })
const inputStyle = css({ w: '100%', h: '48px', px: '14px', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', bg: 'white', color: 'brand.ink', fontSize: '16px', textAlign: 'center', outline: 'none', _focus: { borderColor: 'brand.primary', boxShadow: '0 0 0 3px rgba(64, 82, 210, 0.12)' } })
const primaryButtonStyle = css({ mt: '22px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', w: '100%', minH: '48px', px: '16px', border: 'none', borderRadius: '8px', bg: 'brand.primary', color: 'white', fontSize: '15px', fontWeight: '700', cursor: 'pointer', _hover: { bg: 'brand.primaryActive' }, _disabled: { opacity: 0.5, cursor: 'not-allowed' } })
