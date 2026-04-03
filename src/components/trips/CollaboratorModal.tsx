'use client'

import { useState, useEffect, useCallback } from 'react'
import { css } from 'styled-system/css'
import { X, UserPlus, Mail, Shield, Trash2, Check, Loader2, ChevronDown } from 'lucide-react'
import { collaboration } from '@/utils/collaboration'
import { Capacitor } from '@capacitor/core'
import { useModalBackButton } from '@/hooks/useModalBackButton'

interface CollaboratorModalProps {
    tripId: string
    isOpen: boolean
    onClose: () => void
    tripTitle: string
    ownerId?: string
}

export default function CollaboratorModal({ tripId, isOpen, onClose, tripTitle, ownerId }: CollaboratorModalProps) {
    const [email, setEmail] = useState('')
    const [role, setRole] = useState<'editor' | 'viewer'>('editor')
    const [members, setMembers] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [inviting, setInviting] = useState(false)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [ownerProfile, setOwnerProfile] = useState<any>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useModalBackButton(isOpen, onClose, 'collaboratorModal')

    const fetchMembers = useCallback(async () => {
        setLoading(true)
        const { data, error } = await collaboration.getMembers(tripId)
        if (data) setMembers(data)
        setLoading(false)
    }, [tripId])

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await collaboration.getCurrentUser()
            if (user) setCurrentUserId(user.id)
        }
        checkUser()
    }, [])

    useEffect(() => {
        if (isOpen && ownerId) {
            const fetchOwner = async () => {
                const { data } = await collaboration.getProfile(ownerId)
                if (data) setOwnerProfile(data)
            }
            fetchOwner()
        }
    }, [isOpen, ownerId])

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
            // 실제 이메일 발송 시도 (웹/앱 동일하게 시도)
            try {
                // 웹 환경에서는 상대 경로(/api/invite)를 사용하고, 
                // 네이티브(앱) 환경에서만 절대 경로(NEXT_PUBLIC_APP_URL)를 사용하도록 하여 CORS 문제를 방지합니다.
                const isNative = Capacitor.isNativePlatform();
                const apiUrl = isNative ? (process.env.NEXT_PUBLIC_APP_URL || '') : '';
                
                await fetch(`${apiUrl}/api/invite/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, tripTitle, tripId })
                })
            } catch (emailErr) {
                // 이메일 발송은 부가 기능이므로 실패해도 사용자에게는 성공 메시지를 보여줌 (푸시 알림은 트리거로 발송됨)
                console.warn('Email invite API call failed. Push notification should still work via DB trigger:', emailErr)
            }

            setMessage({ type: 'success', text: `${email}님에게 초대장이 발송되었습니다.` })
            setEmail('')
            fetchMembers()
        }
        setInviting(false)
    }

    const handleUpdateRole = async (memberId: string, newRole: 'editor' | 'viewer') => {
        const { error } = await collaboration.updateMemberRole(memberId, newRole)
        if (error) {
            alert('권한 변경에 실패했습니다.')
        } else {
            fetchMembers()
        }
    }

    const handleRemoveMember = async (memberId: string, memberEmail: string) => {
        if (!confirm(`${memberEmail}님과 여정을 함께하지 않으시겠어요? 🥺`)) return

        const { error } = await collaboration.removeMember(memberId)
        if (error) {
            alert('제외 처리 중에 문제가 발생했습니다. 다시 시도해 주세요.')
        } else {
            fetchMembers()
        }
    }

    if (!isOpen) return null

    // 현재 사용자가 이 여행의 소유자인지 확인
    const isOwner = currentUserId === ownerId

    return (
        <div className={css({
            position: 'fixed', top: 0, left: 0, w: '100vw', h: '100vh',
            bg: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
            backdropFilter: 'blur(4px)'
        })} onClick={onClose}>
            <div className={css({
                bg: 'white', w: { base: '95%', sm: '480px' }, borderRadius: '24px', p: { base: '20px', sm: '32px' },
                boxShadow: '0 20px 40px rgba(0,0,0,0.15)', position: 'relative',
                maxW: '100%', boxSizing: 'border-box'
            })} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className={css({
                    position: 'absolute', top: '24px', right: '24px', bg: 'transparent',
                    border: 'none', cursor: 'pointer', color: '#999', _hover: { color: '#2C3A47', transform: 'scale(1.1)' }, transition: 'all 0.2s'
                })}>
                    <X size={24} />
                </button>

                <h2 className={css({ fontSize: { base: '20px', sm: '24px' }, fontWeight: '900', mb: { base: '20px', sm: '28px' }, display: 'flex', alignItems: 'center', gap: '10px', color: '#2C3A47', letterSpacing: '-0.02em' })}>
                    <div className={css({ p: '8px', bg: '#EAF9F7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
                        <UserPlus size={22} color="#2EC4B6" strokeWidth={2.5} />
                    </div>
                    동행자 초대하기
                </h2>

                {/* 초대 폼 (소유자나 편집자만 가능) */}
                {(isOwner || members.find(m => m.user_id === currentUserId && m.role === 'editor')) && (
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
                                        flex: 1, px: '14px', py: '14px', pl: '40px', bg: '#F9F9F9', borderRadius: '16px',
                                        border: '1px solid #EEEEEE', outline: 'none', fontSize: '14px', fontWeight: '600', color: '#2C3A47', transition: 'all 0.2s',
                                        _placeholder: { color: '#CCC', fontWeight: '400' },
                                        _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 3px rgba(46,196,182,0.1)' }
                                })}
                            />
                        </div>
                        <div className={css({ display: 'flex', gap: '8px' })}>
                            <div className={css({ position: 'relative', flex: 1 })}>
                                <select
                                    value={role}
                                    onChange={e => setRole(e.target.value as any)}
                                    className={css({
                                    w: '100%', px: '16px', py: '14px', pr: '40px', bg: '#F2F4F5', borderRadius: '16px',
                                        border: '1px solid #EEEEEE', outline: 'none', fontSize: '14px', fontWeight: '700', color: '#2C3A47', cursor: 'pointer', appearance: 'none', transition: 'all 0.2s', _focus: { borderColor: '#2EC4B6', bg: 'white' }
                                    })}
                                >
                                    <option value="editor">편집자 (수정 가능)</option>
                                    <option value="viewer">조회자 (읽기 전용)</option>
                                </select>
                                <div className={css({ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#2EC4B6' })}>
                                    <ChevronDown size={18} strokeWidth={3} />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={inviting}
                                className={css({
                                    px: { base: '20px', sm: '32px' }, py: '14px', bg: '#2EC4B6', color: 'white',
                                    fontSize: '15px', fontWeight: '800', cursor: 'pointer', borderRadius: '16px',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(46,196,182,0.2)',
                                    _hover: { bg: '#249E93', transform: 'translateY(-1px)' }, 
                                    _active: { transform: 'scale(0.95)' },
                                    _disabled: { opacity: 0.7, cursor: 'not-allowed' }
                                })}
                            >
                                {inviting ? <Loader2 size={20} className={css({ animation: 'spin 1s linear infinite' })} /> : '초대'}
                            </button>
                        </div>
                        {message && (
                            <p className={css({
                                fontSize: '13px', px: '12px', py: '8px', borderRadius: '12px',
                                bg: message.type === 'success' ? '#EAF9F7' : '#fce8e6',
                                color: message.type === 'success' ? '#2EC4B6' : '#c5221f',
                                display: 'flex', alignItems: 'center', gap: '6px'
                            })}>
                                {message.type === 'success' ? <Check size={14} /> : <X size={14} />} {message.text}
                            </p>
                        )}
                    </form>
                )}

                <div className={css({ borderTop: '1px solid #eee', pt: '24px' })}>
                    <h3 className={css({ fontSize: '15px', fontWeight: 'bold', mb: '16px', color: '#555' })}>함께하는 분들</h3>
                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px', maxH: '250px', overflowY: 'auto', pr: '4px' })}>
                        {loading && members.length === 0 ? (
                            <p className={css({ textAlign: 'center', py: '20px', color: '#999', fontSize: '14px' })}>동행자 정보를 불러오고 있어요... ✈️</p>
                        ) : (
                            (() => {
                                const allDisplayMembers = [...members]
                                if (ownerProfile && !members.some(m => m.user_id === ownerId)) {
                                    allDisplayMembers.unshift({
                                        id: 'owner-virtual',
                                        user_id: ownerId,
                                        invited_email: ownerProfile.email,
                                        role: 'owner',
                                        status: 'accepted',
                                        profiles: ownerProfile
                                    })
                                }

                                if (allDisplayMembers.length === 0) {
                                    return <p className={css({ textAlign: 'center', py: '20px', color: '#999', fontSize: '14px' })}>아직 함께하는 분들이 없어요. 함께 떠날 소중한 분들을 초대해 볼까요? 💌</p>
                                }

                                return allDisplayMembers.map((m) => {
                                    const isSelf = m.user_id === currentUserId
                                    const isMemberOwner = m.role === 'owner'

                                    return (
                                        <div key={m.id} className={css({
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            p: '14px', borderRadius: '16px', border: '1px solid #EEEEEE', transition: 'all 0.2s', _hover: { bg: '#F9F9F9', borderColor: '#2EC4B6' }
                                        })}>
                                            <div className={css({ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minW: 0 })}>
                                                <div className={css({
                                                    w: '32px', h: '32px', bg: m.status === 'accepted' ? '#2EC4B6' : '#F7F7F7',
                                                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: m.status === 'accepted' ? 'white' : '#888', fontSize: '12px', fontWeight: 'bold', flexShrink: 0
                                                })}>
                                                    {(m.profiles?.nickname || m.invited_email || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div className={css({ minW: 0, flex: 1 })}>
                                                    <p className={css({ fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' })}>
                                                        <span className={css({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                                                            {m.profiles?.nickname || m.invited_email?.split('@')[0] || 'Unknown'}
                                                        </span>
                                                        {isSelf && <span className={css({ fontSize: '10px', color: '#2EC4B6', bg: '#EAF9F7', px: '6px', py: '2px', borderRadius: '6px', fontWeight: '800' })}>나</span>}
                                                        {m.status === 'pending' && <span className={css({ fontSize: '10px', color: '#f2994a', bg: '#FFF3E8', px: '6px', py: '2px', borderRadius: '6px', fontWeight: '800' })}>대기중</span>}
                                                    </p>
                                                    <p className={css({ fontSize: '12px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>{m.invited_email}</p>
                                                </div>
                                            </div>

                                            <div className={css({ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 })}>
                                                {/* 소유자이고 관리 대상이 자신이 아니면서 소유자도 아닐 때만 관리 가능 */}
                                                {isOwner && !isMemberOwner ? (
                                                    <>
                                                        <div className={css({ position: 'relative' })}>
                                                            <select
                                                                value={m.role}
                                                                onChange={(e) => handleUpdateRole(m.id, e.target.value as any)}
                                                                className={css({
                                                                    fontSize: '11px', fontWeight: '600', px: '8px', py: '6px', pr: '22px', bg: 'white', border: '1px solid #eee', color: '#2C3A47',
                                                                    borderRadius: '8px', outline: 'none', cursor: 'pointer', appearance: 'none', _focus: { borderColor: '#2EC4B6' }
                                                                })}
                                                            >
                                                                <option value="editor">편집자</option>
                                                                <option value="viewer">뷰어</option>
                                                            </select>
                                                            <div className={css({ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#888' })}>
                                                                <ChevronDown size={12} />
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveMember(m.id, m.invited_email)}
                                                            className={css({
                                                                p: '8px', color: '#999', bg: 'transparent', border: 'none', cursor: 'pointer',
                                                                transition: 'all 0.2s', borderRadius: '10px',
                                                                _hover: { color: '#dc2626', bg: '#fee2e2', transform: 'scale(1.05)' },
                                                                _active: { transform: 'scale(0.95)' }
                                                            })}
                                                            title="동행자 제외"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className={css({
                                                        fontSize: '11px', px: '8px', py: '4px', bg: isMemberOwner ? '#111' : '#f1f1f1',
                                                        color: isMemberOwner ? 'white' : '#666', borderRadius: '6px', fontWeight: 'bold'
                                                    })}>
                                                        {isMemberOwner ? '관리자' : m.role === 'editor' ? '편집자' : '뷰어'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            })()
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
