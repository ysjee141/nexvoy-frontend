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
            bg: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
            backdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.3s ease-out'
        })} onClick={onClose}>
            <div className={css({
                bg: 'white', w: { base: '95%', sm: '480px' }, borderRadius: '24px', p: { base: '24px', sm: '32px' },
                boxShadow: '0 30px 90px rgba(0,0,0,0.18)', position: 'relative',
                maxW: '100%', boxSizing: 'border-box',
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)'
            })} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className={css({
                    position: 'absolute', top: '22px', right: '22px', 
                    bg: '#F8F9FA', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                    p: '6px', borderRadius: '50%', transition: 'all 0.2s',
                    _hover: { bg: '#F1F3F5', color: '#2C3A47', transform: 'rotate(90deg)' }
                })}>
                    <X size={20} strokeWidth={2.5} />
                </button>

                <h2 className={css({ fontSize: { base: '22px', sm: '26px' }, fontWeight: '700', mb: { base: '24px', sm: '32px' }, display: 'flex', alignItems: 'center', gap: '12px', color: '#2C3A47', letterSpacing: '-0.03em' })}>
                    <div className={css({ p: '10px', bg: 'rgba(46, 196, 182, 0.1)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
                        <UserPlus size={24} color="#2EC4B6" strokeWidth={2.5} />
                    </div>
                    동행자 초대하기
                </h2>

                {/* 초대 폼 (소유자나 편집자만 가능) */}
                {(isOwner || members.find(m => m.user_id === currentUserId && m.role === 'editor')) && (
                    <form onSubmit={handleInvite} className={css({ display: 'flex', flexDirection: 'column', gap: '14px', mb: '36px' })}>
                        <div className={css({ position: 'relative' })}>
                            <Mail size={18} className={css({ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#888', zIndex: 1 })} />
                                <input
                                    type="email"
                                    placeholder="친구의 이메일을 입력하세요"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    className={css({
                                            flex: 1, px: '16px', py: '16px', pl: '46px', bg: '#F8F9FA', borderRadius: '20px',
                                            border: '1.5px solid #F1F3F5', outline: 'none', fontSize: '15px', fontWeight: '600', color: '#2C3A47', transition: 'all 0.25s',
                                            _placeholder: { color: '#BBB', fontWeight: '400' },
                                            _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 4px rgba(46,196,182,0.1)' }
                                    })}
                                />
                        </div>
                        <div className={css({ display: 'flex', gap: '10px' })}>
                            <div className={css({ position: 'relative', flex: 1.2 })}>
                                <select
                                    value={role}
                                    onChange={e => setRole(e.target.value as any)}
                                    className={css({
                                    w: '100%', px: '18px', py: '16px', pr: '44px', bg: '#F8F9FA', borderRadius: '20px',
                                        border: '1.5px solid #F1F3F5', outline: 'none', fontSize: '14px', fontWeight: '700', color: '#2C3A47', cursor: 'pointer', appearance: 'none', transition: 'all 0.25s', 
                                        _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 4px rgba(46,196,182,0.1)' }
                                    })}
                                >
                                    <option value="editor">편집자 권한</option>
                                    <option value="viewer">조회자 권한</option>
                                </select>
                                <div className={css({ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#2EC4B6' })}>
                                    <ChevronDown size={18} strokeWidth={3} />
                                </div>
                            </div>
                             <button
                                 type="submit"
                                 disabled={inviting}
                                 className={css({
                                     flex: 1, py: '16px', bg: '#2EC4B6', color: 'white',
                                     fontSize: '16.5px', fontWeight: '700', cursor: 'pointer', borderRadius: '20px',
                                     transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                                     boxShadow: '0 10px 25px rgba(46,196,182,0.25)',
                                     _hover: { bg: '#249E93', transform: 'translateY(-2px)', boxShadow: '0 15px 35px rgba(46,196,182,0.35)' }, 
                                     _active: { transform: 'translateY(0) scale(0.96)' },
                                     _disabled: { opacity: 0.5, cursor: 'not-allowed', transform: 'none', boxShadow: 'none' }
                                 })}
                             >
                                 {inviting ? <Loader2 size={24} className={css({ animation: 'spin 1s linear infinite' })} strokeWidth={2.5} /> : '초대장 보내기'}
                             </button>
                        </div>
                        {message && (
                            <p className={css({
                                fontSize: '14px', px: '16px', py: '12px', borderRadius: '14px',
                                bg: message.type === 'success' ? 'rgba(46, 196, 182, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                color: message.type === 'success' ? '#2EC4B6' : '#EF4444',
                                display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600',
                                animation: 'fadeIn 0.2s ease-out'
                            })}>
                                {message.type === 'success' ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />} {message.text}
                            </p>
                        )}
                    </form>
                )}

                <div className={css({ borderTop: '1px solid #F5F5F5', pt: '28px' })}>
                    <h3 className={css({ fontSize: '16px', fontWeight: '700', mb: '18px', color: '#2C3A47', display: 'flex', alignItems: 'center', gap: '6px' })}>
                        함께하는 분들
                        <span className={css({ fontSize: '13px', color: '#2EC4B6', bg: 'rgba(46, 196, 182, 0.1)', px: '8px', py: '2px', borderRadius: '20px' })}>{members.length + (ownerProfile && !members.some(m => m.user_id === ownerId) ? 1 : 0)}</span>
                    </h3>
                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '14px', maxH: '280px', overflowY: 'auto', pr: '8px',
                        '&::-webkit-scrollbar': { w: '4px' },
                        '&::-webkit-scrollbar-track': { bg: 'transparent' },
                        '&::-webkit-scrollbar-thumb': { bg: '#EEE', borderRadius: '10px' }
                    })}>
                        {loading && members.length === 0 ? (
                            <p className={css({ textAlign: 'center', py: '30px', color: '#999', fontSize: '14px', fontWeight: '500' })}>동행자 정보를 불러오고 있어요... ✈️</p>
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
                                    return <p className={css({ textAlign: 'center', py: '40px', color: '#999', fontSize: '14px', lineHeight: 1.6, wordBreak: 'keep-all' })}>아직 함께하는 분들이 없어요.<br />함께 떠날 소중한 분들을 초대해 볼까요? 💌</p>
                                }

                                return allDisplayMembers.map((m) => {
                                    const isSelf = m.user_id === currentUserId
                                    const isMemberOwner = m.role === 'owner'

                                    return (
                                        <div key={m.id} className={css({
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            p: '16px', borderRadius: '20px', border: '1.5px solid #F1F3F5', bg: '#F8F9FA', transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)', 
                                            _hover: { bg: 'white', borderColor: '#2EC4B6', boxShadow: '0 12px 25px rgba(46,196,182,0.08)', transform: 'translateY(-2px)' }
                                        })}>
                                            <div className={css({ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minW: 0 })}>
                                                <div className={css({
                                                    w: '36px', h: '36px', bg: m.status === 'accepted' ? '#2EC4B6' : '#EEE',
                                                    borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: m.status === 'accepted' ? 'white' : '#888', fontSize: '13px', fontWeight: '700', flexShrink: 0,
                                                    boxShadow: m.status === 'accepted' ? '0 4px 10px rgba(46,196,182,0.2)' : 'none'
                                                })}>
                                                    {(m.profiles?.nickname || m.invited_email || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div className={css({ minW: 0, flex: 1 })}>
                                                    <p className={css({ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', color: '#2C3A47' })}>
                                                        <span className={css({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                                                            {m.profiles?.nickname || m.invited_email?.split('@')[0] || 'Unknown'}
                                                        </span>
                                                        {isSelf && <span className={css({ fontSize: '10px', color: '#2EC4B6', bg: 'rgba(46, 196, 182, 0.1)', px: '7px', py: '2.5px', borderRadius: '7px', fontWeight: '700' })}>나</span>}
                                                        {m.status === 'pending' && <span className={css({ fontSize: '10px', color: '#F2994A', bg: 'rgba(242, 153, 74, 0.1)', px: '7px', py: '2.5px', borderRadius: '7px', fontWeight: '700' })}>대기중</span>}
                                                    </p>
                                                    <p className={css({ fontSize: '12px', color: '#9BA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' })}>{m.invited_email}</p>
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
                                                                    fontSize: '12px', fontWeight: '700', px: '10px', py: '7px', pr: '28px', bg: 'white', border: '1.2px solid #EEE', color: '#4B5563',
                                                                    borderRadius: '10px', outline: 'none', cursor: 'pointer', appearance: 'none', transition: 'all 0.2s', _focus: { borderColor: '#2EC4B6', boxShadow: '0 0 0 3px rgba(46,196,182,0.05)' }
                                                                })}
                                                            >
                                                                <option value="editor">편집자</option>
                                                                <option value="viewer">뷰어</option>
                                                            </select>
                                                            <div className={css({ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF' })}>
                                                                <ChevronDown size={14} strokeWidth={2.5} />
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveMember(m.id, m.invited_email)}
                                                            className={css({
                                                                p: '10px', color: '#9CA3AF', bg: 'transparent', border: 'none', cursor: 'pointer',
                                                                transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)', borderRadius: '12px',
                                                                _hover: { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.08)', transform: 'scale(1.1)' },
                                                                _active: { transform: 'scale(0.9)' }
                                                            })}
                                                            title="동행자 제외"
                                                        >
                                                            <Trash2 size={18} strokeWidth={2.2} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className={css({
                                                        fontSize: '11px', px: '9px', py: '5px', bg: isMemberOwner ? '#2C3A47' : '#F3F4F6',
                                                        color: isMemberOwner ? 'white' : '#6B7280', borderRadius: '8px', fontWeight: '700', letterSpacing: '0.02em'
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
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
