'use client'

import { useState, useEffect, useCallback } from 'react'
import { css } from 'styled-system/css'
import { X, UserPlus, Mail, Shield, Trash2, Check, Loader2 } from 'lucide-react'
import { collaboration } from '@/utils/collaboration'

interface CollaboratorModalProps {
    tripId: string
    isOpen: boolean
    onClose: () => void
    tripTitle: string
}

export default function CollaboratorModal({ tripId, isOpen, onClose, tripTitle }: CollaboratorModalProps) {
    const [email, setEmail] = useState('')
    const [role, setRole] = useState<'editor' | 'viewer'>('editor')
    const [members, setMembers] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [inviting, setInviting] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const fetchMembers = useCallback(async () => {
        setLoading(true)
        const { data, error } = await collaboration.getMembers(tripId)
        if (data) setMembers(data)
        setLoading(false)
    }, [tripId])

    useEffect(() => {
        if (isOpen) {
            fetchMembers()
            setMessage(null)
            setEmail('')
        }
    }, [isOpen, fetchMembers])

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) return

        setInviting(true)
        setMessage(null)

        const { error } = await collaboration.inviteMember(tripId, email, role)

        if (error) {
            setMessage({ type: 'error', text: '초대에 실패했습니다. 이미 초대된 사용자거나 오류가 발생했습니다.' })
        } else {
            // 실제 이메일 발송 시도
            try {
                await fetch('/api/invite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, tripTitle, tripId })
                })
            } catch (emailErr) {
                console.error('Email sending failed:', emailErr)
            }

            setMessage({ type: 'success', text: `${email}님에게 초대장이 발송되었습니다.` })
            setEmail('')
            fetchMembers()
        }
        setInviting(false)
    }

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed', top: 0, left: 0, w: '100vw', h: '100vh',
            bg: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(4px)'
        })} onClick={onClose}>
            <div className={css({
                bg: 'white', w: { base: '90%', sm: '480px' }, borderRadius: '24px', p: '32px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.15)', position: 'relative'
            })} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className={css({
                    position: 'absolute', top: '24px', right: '24px', bg: 'transparent',
                    border: 'none', cursor: 'pointer', color: '#999', _hover: { color: '#333' }
                })}>
                    <X size={24} />
                </button>

                <h2 className={css({ fontSize: '22px', fontWeight: '800', mb: '24px', display: 'flex', alignItems: 'center', gap: '8px' })}>
                    <UserPlus size={24} color="#4285F4" /> 협업자 초대
                </h2>

                {/* 초대 폼 */}
                <form onSubmit={handleInvite} className={css({ display: 'flex', flexDirection: 'column', gap: '12px', mb: '32px' })}>
                    <div className={css({ position: 'relative' })}>
                        <Mail size={18} className={css({ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' })} />
                        <input
                            type="email"
                            placeholder="초대할 친구의 이메일"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className={css({
                                w: '100%', pl: '40px', pr: '12px', py: '14px', bg: '#f8f9fa',
                                borderRadius: '12px', border: '1px solid #eee', outline: 'none',
                                _focus: { borderColor: '#4285F4', bg: 'white' }, fontSize: '14px'
                            })}
                        />
                    </div>
                    <div className={css({ display: 'flex', gap: '8px' })}>
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value as any)}
                            className={css({
                                flex: 1, px: '12px', py: '12px', bg: '#f8f9fa', borderRadius: '12px',
                                border: '1px solid #eee', outline: 'none', fontSize: '14px', cursor: 'pointer'
                            })}
                        >
                            <option value="editor">편집자 (수정 가능)</option>
                            <option value="viewer">조회자 (읽기 전용)</option>
                        </select>
                        <button
                            type="submit"
                            disabled={inviting}
                            className={css({
                                px: '24px', bg: '#111', color: 'white', borderRadius: '12px',
                                fontWeight: 'bold', cursor: 'pointer', _hover: { bg: '#333' },
                                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                                display: 'flex', alignItems: 'center', gap: '6px'
                            })}
                        >
                            {inviting ? <Loader2 size={18} className={css({ animation: 'spin 1s linear infinite' })} /> : '초대'}
                        </button>
                    </div>
                    {message && (
                        <p className={css({
                            fontSize: '13px', px: '12px', py: '8px', borderRadius: '8px',
                            bg: message.type === 'success' ? '#e6f4ea' : '#fce8e6',
                            color: message.type === 'success' ? '#137333' : '#c5221f',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        })}>
                            {message.type === 'success' ? <Check size={14} /> : <X size={14} />} {message.text}
                        </p>
                    )}
                </form>

                <div className={css({ borderTop: '1px solid #eee', pt: '24px' })}>
                    <h3 className={css({ fontSize: '15px', fontWeight: 'bold', mb: '16px', color: '#555' })}>함께하는 멤버</h3>
                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px', maxH: '200px', overflowY: 'auto', pr: '4px' })}>
                        {loading && members.length === 0 ? (
                            <p className={css({ textAlign: 'center', py: '20px', color: '#999', fontSize: '14px' })}>멤버를 불러오는 중...</p>
                        ) : members.length === 0 ? (
                            <p className={css({ textAlign: 'center', py: '20px', color: '#999', fontSize: '14px' })}>초대된 멤버가 없습니다.</p>
                        ) : (
                            members.map((m) => (
                                <div key={m.id} className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    p: '12px', borderRadius: '12px', border: '1px solid #f0f0f0', _hover: { bg: '#f9f9f9' }
                                })}>
                                    <div className={css({ display: 'flex', alignItems: 'center', gap: '10px' })}>
                                        <div className={css({
                                            w: '32px', h: '32px', bg: m.status === 'accepted' ? '#4285F4' : '#eee',
                                            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontSize: '12px', fontWeight: 'bold'
                                        })}>
                                            {(m.profiles?.nickname || m.invited_email).charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className={css({ fontSize: '14px', fontWeight: '600' })}>
                                                {m.profiles?.nickname || m.invited_email.split('@')[0]}
                                                {m.status === 'pending' && <span className={css({ ml: '6px', fontSize: '10px', color: '#f2994a', bg: '#fff4e5', px: '6px', py: '2px', borderRadius: '4px' })}>대기중</span>}
                                            </p>
                                            <p className={css({ fontSize: '12px', color: '#888' })}>{m.invited_email}</p>
                                        </div>
                                    </div>
                                    <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                                        <span className={css({
                                            fontSize: '11px', px: '8px', py: '4px', bg: m.role === 'owner' ? '#111' : '#f1f1f1',
                                            color: m.role === 'owner' ? 'white' : '#666', borderRadius: '6px', fontWeight: 'bold'
                                        })}>
                                            {m.role === 'owner' ? '관리자' : m.role === 'editor' ? '편집자' : '뷰어'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
