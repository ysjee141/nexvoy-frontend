'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { X, UserPlus, Mail, Shield, Eye, Pencil, Trash2, Loader2, CheckCircle2, AlertCircle, ChevronDown, Link as LinkIcon, Copy, Share2 } from 'lucide-react'
import { CollaborationService } from '@/services/ExternalApiService'
import { collaboration } from '@/utils/collaboration'
import { useScrollLock } from '@/hooks/useScrollLock'
import { Share } from '@capacitor/share'

interface CollaboratorModalProps {
    isOpen: boolean
    onClose: () => void
    tripId: string
    tripTitle: string
    ownerId?: string
}

type MemberRole = 'owner' | 'editor' | 'viewer'

interface Collaborator {
    memberId: string
    userId: string | null
    nickname: string | null
    email: string
    role: MemberRole
    joined_at: string
    status: string
}

const ROLE_LABELS: Record<MemberRole, string> = {
    owner: '관리자',
    editor: '편집자',
    viewer: '뷰어',
}

const ROLE_ICONS: Record<MemberRole, React.ReactNode> = {
    owner: <Shield size={10} />,
    editor: <Pencil size={10} />,
    viewer: <Eye size={10} />,
}

export default function CollaboratorModal({ isOpen, onClose, tripId, tripTitle, ownerId }: CollaboratorModalProps) {
    const supabase = createClient()
    const [email, setEmail] = useState('')
    const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
    const [loading, setLoading] = useState(false)
    const [collaborators, setCollaborators] = useState<Collaborator[]>([])
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [generatedLink, setGeneratedLink] = useState<string | null>(null)

    useScrollLock(isOpen)

    useEffect(() => {
        if (isOpen) {
            const fetchUser = async () => {
                const { data: { user } } = await supabase.auth.getUser()
                setCurrentUserId(user?.id || null)
            }
            fetchUser()
            fetchCollaborators()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, tripId])

    const fetchCollaborators = async () => {
        const { data, error } = await supabase
            .from('trip_members')
            .select('*, profiles(nickname, email)')
            .eq('trip_id', tripId)

        if (error) {
            console.error('Error fetching collaborators:', error)
            return
        }

        const formatted: Collaborator[] = (data || []).map((item: any) => ({
            memberId: item.id,
            userId: item.user_id || null,
            nickname: item.profiles?.nickname || null,
            email: item.profiles?.email || item.invited_email || '',
            role: item.role,
            joined_at: item.created_at,
            status: item.status || 'accepted',
        }))

        setCollaborators(formatted)
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (!email.trim()) return

        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('로그인이 필요합니다.')

            const { error: memberError } = await collaboration.inviteMember(tripId, email.trim(), inviteRole)
            if (memberError) {
                setError(memberError.message || '멤버 추가 중 오류가 발생했습니다.')
                return
            }

            await CollaborationService.createInvite({
                tripId,
                email: email.trim(),
                tripTitle
            })

            setSuccess(`${email}님을 ${ROLE_LABELS[inviteRole]}(으)로 초대했습니다!`)
            setEmail('')
            fetchCollaborators()
        } catch (err: any) {
            setError(err.message || '초대 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    const handleRoleChange = async (memberId: string, newRole: MemberRole) => {
        if (newRole === 'owner') return

        const { error } = await collaboration.updateMemberRole(memberId, newRole)
        if (error) {
            alert('권한 변경 실패: ' + (typeof error === 'string' ? error : error.message))
        } else {
            setCollaborators(prev =>
                prev.map(m => m.memberId === memberId ? { ...m, role: newRole } : m)
            )
        }
        setEditingRoleId(null)
    }

    const handleRemove = async (memberId: string, isSelf: boolean = false) => {
        if (!confirm(isSelf ? '정말 이 여정에서 나가시겠습니까?' : '이 멤버를 제외하시겠습니까?')) return

        const { error } = await collaboration.removeMember(memberId)
        if (error) {
            alert((isSelf ? '나가기 실패: ' : '멤버 삭제 실패: ') + (typeof error === 'string' ? error : error.message))
        } else {
            if (isSelf) {
                onClose()
                window.location.href = '/'
            } else {
                fetchCollaborators()
            }
        }
    }

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed', inset: 0, zIndex: 1000,
            bg: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px',
            animation: 'fadeIn 0.3s ease-out',
            overscrollBehavior: 'none',
            touchAction: 'none',
        })}>
            <div className={css({
                bg: 'white', w: '100%', maxW: '480px', borderRadius: '16px', overflow: 'hidden',
                boxShadow: 'airbnbHover',
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)',
                overscrollBehavior: 'contain',
            })}>
                <div className={css({ p: '20px 24px', borderBottom: '1px solid', borderBottomColor: 'brand.hairline', display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                    <h2 className={css({ fontSize: '18px', fontWeight: '700', color: 'brand.ink', display: 'flex', alignItems: 'center', gap: '8px' })}>
                        <UserPlus size={20} className={css({ color: 'brand.primary' })} /> 함께하는 일행 관리
                    </h2>
                    <button onClick={onClose} className={css({ p: '6px', borderRadius: '50%', bg: 'bg.softCotton', color: 'brand.muted', cursor: 'pointer', border: 'none', transition: 'all 0.2s', _hover: { bg: 'rgba(0,0,0,0.05)', color: 'brand.ink' } })}>
                        <X size={20} />
                    </button>
                </div>

                <div className={css({ p: '24px', display: 'flex', flexDirection: 'column', gap: '24px' })}>
                    <form onSubmit={handleInvite} className={css({ display: 'flex', flexDirection: 'column', gap: '10px' })}>
                        <label className={css({ fontSize: '14px', fontWeight: '700', color: 'brand.ink' })}>이메일로 초대하기</label>
                        <div className={css({ display: 'flex', gap: '8px' })}>
                            <div className={css({ position: 'relative', flex: 1 })}>
                                <Mail size={16} className={css({ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'brand.muted' })} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="friend@example.com"
                                    className={css({
                                        w: '100%', p: '12px 12px 12px 40px', bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px',
                                        fontSize: '15px', outline: 'none', transition: 'all 0.2s', _focus: { borderColor: 'brand.primary', boxShadow: '0 0 0 4px rgba(var(--colors-brand-primary-rgb), 0.1)' }
                                    })}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !email}
                                className={css({
                                    p: '0 20px', bg: 'brand.primary', color: 'white', border: 'none', borderRadius: '8px',
                                    fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', _disabled: { opacity: 0.5 },
                                    _hover: { bg: 'brand.primaryActive', boxShadow: 'airbnbHover' }, _active: { transform: 'scale(0.95)' }
                                })}
                            >
                                {loading ? <Loader2 size={18} className={css({ animation: 'spin 1s linear infinite' })} /> : '초대'}
                            </button>
                        </div>
                        <div className={css({ display: 'flex', gap: '8px' })}>
                            {(['editor', 'viewer'] as const).map(role => (
                                <button
                                    key={role}
                                    type="button"
                                    onClick={() => setInviteRole(role)}
                                    className={css({
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        py: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: '700',
                                        cursor: 'pointer', transition: 'all 0.2s', border: '1px solid',
                                        bg: inviteRole === role ? 'brand.primary' : 'white',
                                        color: inviteRole === role ? 'white' : 'brand.ink',
                                        borderColor: inviteRole === role ? 'brand.primary' : 'brand.hairline',
                                        _active: { transform: 'scale(0.96)' },
                                    })}
                                >
                                    {role === 'editor' ? <Pencil size={13} /> : <Eye size={13} />}
                                    {ROLE_LABELS[role]}
                                </button>
                            ))}
                        </div>
                        {error && <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'brand.error', fontWeight: '600', mt: '4px' })}><AlertCircle size={14} /> {error}</div>}
                        {success && <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'brand.primary', fontWeight: '600', mt: '4px' })}><CheckCircle2 size={14} /> {success}</div>}
                    </form>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '10px', pt: '16px', borderTop: '1px solid', borderColor: 'brand.hairline' })}>
                        <label className={css({ fontSize: '14px', fontWeight: '700', color: 'brand.ink' })}>링크로 초대하기</label>
                        {!generatedLink ? (
                            <button
                                type="button"
                                onClick={async () => {
                                    setLoading(true)
                                    setError('')
                                    setSuccess('')
                                    try {
                                        const { data, error } = await collaboration.createInvitationLink(tripId)
                                        if (error || !data) throw new Error(error?.message || '링크 생성에 실패했습니다.')
                                        
                                        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
                                        setGeneratedLink(`${appUrl}/join?token=${data}`)
                                    } catch (err: any) {
                                        if (err.name !== 'AbortError') {
                                            setError(err.message || '링크 생성 중 오류가 발생했습니다.')
                                        }
                                    } finally {
                                        setLoading(false)
                                    }
                                }}
                                disabled={loading}
                                className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    w: '100%', p: '12px', bg: 'white', color: 'brand.ink', border: '1.5px solid', borderColor: 'brand.hairline', borderRadius: '12px',
                                    fontSize: '15px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s',
                                    _hover: { borderColor: 'brand.primary', color: 'brand.primary', bg: 'bg.softCotton' },
                                    _active: { transform: 'scale(0.98)' },
                                    _disabled: { opacity: 0.5, cursor: 'not-allowed', transform: 'none' }
                                })}
                            >
                                {loading ? <Loader2 size={18} className={css({ animation: 'spin 1s linear infinite' })} /> : <LinkIcon size={18} />}
                                초대 링크 생성
                            </button>
                        ) : (
                            <div className={css({ display: 'flex', gap: '8px' })}>
                                <div className={css({ 
                                    flex: 1, p: '12px 14px', bg: 'bg.softCotton', border: '1.5px solid', borderColor: 'brand.hairline', borderRadius: '12px',
                                    fontSize: '14px', color: 'brand.ink', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    display: 'flex', alignItems: 'center'
                                })}>
                                    {generatedLink}
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(generatedLink)
                                        setSuccess('초대 링크가 클립보드에 복사되었습니다.')
                                        setTimeout(() => setSuccess(''), 3000)
                                    }}
                                    className={css({
                                        p: '12px', bg: 'white', color: 'brand.ink', border: '1.5px solid', borderColor: 'brand.hairline', borderRadius: '12px',
                                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        _hover: { borderColor: 'brand.primary', color: 'brand.primary', bg: 'bg.softCotton' },
                                        _active: { transform: 'scale(0.95)' }
                                    })}
                                    title="복사하기"
                                >
                                    <Copy size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            const canShare = await Share.canShare();
                                            if (canShare.value) {
                                                await Share.share({
                                                    title: `${tripTitle} 여정에 초대합니다`,
                                                    text: `함께 여정을 계획해보세요! 링크는 6시간 동안 유효합니다.`,
                                                    url: generatedLink,
                                                    dialogTitle: '초대 링크 공유'
                                                })
                                                setSuccess('초대 링크가 공유되었습니다.')
                                                setTimeout(() => setSuccess(''), 3000)
                                            } else if (navigator.share) {
                                                await navigator.share({
                                                    title: `${tripTitle} 여정에 초대합니다`,
                                                    text: `함께 여정을 계획해보세요! 링크는 6시간 동안 유효합니다.`,
                                                    url: generatedLink
                                                })
                                                setSuccess('초대 링크가 공유되었습니다.')
                                                setTimeout(() => setSuccess(''), 3000)
                                            } else {
                                                await navigator.clipboard.writeText(generatedLink)
                                                setSuccess('초대 링크가 클립보드에 복사되었습니다.')
                                                setTimeout(() => setSuccess(''), 3000)
                                            }
                                        } catch (err: any) {
                                            if (err.name !== 'AbortError' && err.message !== 'Share canceled') {
                                                setError('공유 중 오류가 발생했습니다.')
                                            }
                                        }
                                    }}
                                    className={css({
                                        p: '12px', bg: 'brand.primary', color: 'white', border: 'none', borderRadius: '12px',
                                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        _hover: { bg: 'brand.primaryActive' }, _active: { transform: 'scale(0.95)' }
                                    })}
                                    title="공유하기"
                                >
                                    <Share2 size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                        <h3 className={css({ fontSize: '14px', fontWeight: '700', color: 'brand.ink' })}>참여 중인 멤버 ({collaborators.length})</h3>
                        <div className={css({
                            display: 'flex', flexDirection: 'column', gap: '8px', maxH: '200px', overflowY: 'auto', pr: '4px', overscrollBehavior: 'contain',
                        })}>
                            {collaborators.map(member => (
                                <div key={member.memberId} className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    p: '12px 16px', bg: 'white', borderRadius: '12px', border: '1px solid', borderColor: 'brand.hairline'
                                })}>
                                    <div className={css({ display: 'flex', flexDirection: 'column', flex: 1, minW: 0, mr: '8px' })}>
                                        <span className={css({ fontSize: '14px', fontWeight: '700', color: 'brand.ink', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                                            {member.nickname || member.email || '초대됨'}
                                        </span>
                                        <span className={css({ fontSize: '11px', color: 'brand.muted', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                                            {member.nickname && member.email ? member.email : ''}
                                            {member.status === 'pending' && (member.nickname && member.email ? ' • ' : '') + '수락 대기 중'}
                                        </span>
                                    </div>
                                    {member.role !== 'owner' && (
                                        <div className={css({ display: 'flex', alignItems: 'center', gap: '4px', ml: '8px', flexShrink: 0 })}>
                                            {currentUserId === ownerId && (
                                                <div className={css({ position: 'relative' })}>
                                                    <button
                                                        onClick={() => setEditingRoleId(editingRoleId === member.memberId ? null : member.memberId)}
                                                        className={css({
                                                            display: 'flex', alignItems: 'center', gap: '4px',
                                                            px: '8px', py: '4px', borderRadius: '8px',
                                                            fontSize: '11px', fontWeight: '700',
                                                            bg: 'white', border: '1px solid', borderColor: 'brand.hairline',
                                                            color: 'brand.ink', cursor: 'pointer', transition: 'all 0.2s',
                                                            _hover: { borderColor: 'brand.primary', boxShadow: 'airbnbHover' },
                                                        })}
                                                    >
                                                        {ROLE_LABELS[member.role]}
                                                        <ChevronDown size={12} className={css({ transition: 'transform 0.2s', transform: editingRoleId === member.memberId ? 'rotate(180deg)' : 'none' })} />
                                                    </button>
                                                    {editingRoleId === member.memberId && (
                                                        <>
                                                            <div className={css({ position: 'fixed', inset: 0, zIndex: 10 })} onClick={() => setEditingRoleId(null)} />
                                                            <div className={css({
                                                                position: 'absolute', top: '100%', right: 0, mt: '4px',
                                                                bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px',
                                                                boxShadow: 'airbnbHover', zIndex: 11, overflow: 'hidden', minW: '100px',
                                                            })}>
                                                                {(['editor', 'viewer'] as const).map(role => (
                                                                    <button
                                                                        key={role}
                                                                        onClick={() => handleRoleChange(member.memberId, role)}
                                                                        className={css({
                                                                            display: 'flex', alignItems: 'center', gap: '6px',
                                                                            w: '100%', px: '12px', py: '10px',
                                                                            fontSize: '12px', fontWeight: member.role === role ? '800' : '600',
                                                                            bg: member.role === role ? 'bg.softCotton' : 'white',
                                                                            color: member.role === role ? 'brand.primary' : 'brand.ink',
                                                                            border: 'none', cursor: 'pointer', textAlign: 'left',
                                                                            _hover: { bg: 'bg.softCotton' },
                                                                        })}
                                                                    >
                                                                        {role === 'editor' ? <Pencil size={12} /> : <Eye size={12} />}
                                                                        {ROLE_LABELS[role]}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            {(currentUserId === ownerId || currentUserId === member.userId) && (
                                                <button
                                                    onClick={() => handleRemove(member.memberId, currentUserId === member.userId)}
                                                    className={css({ p: '6px', bg: 'transparent', border: 'none', color: 'brand.muted', cursor: 'pointer', transition: 'all 0.2s', _hover: { color: 'brand.error' } })}
                                                    title={currentUserId === member.userId ? "나가기" : "추방하기"}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={css({ p: '16px 24px', bg: 'bg.softCotton', borderTop: '1px solid', borderTopColor: 'brand.hairline', textAlign: 'center' })}>
                    <p className={css({ fontSize: '12px', color: 'brand.muted', lineHeight: 1.5, wordBreak: 'keep-all' })}>
                        <strong>편집자</strong>는 일정을 추가, 수정, 삭제할 수 있고 <strong>뷰어</strong>는 조회만 가능합니다.<br />
                        멤버 초대를 위해 상대방이 <strong>온여정</strong>에 가입되어 있어야 합니다.
                    </p>
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
        </div>
    )
}
