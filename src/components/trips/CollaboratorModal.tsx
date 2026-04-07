'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { X, UserPlus, Mail, Shield, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { CollaborationService } from '@/services/ExternalApiService'
import { useScrollLock } from '@/hooks/useScrollLock'

interface CollaboratorModalProps {
    isOpen: boolean
    onClose: () => void
    tripId: string
    tripTitle: string
    ownerId?: string
}

interface Collaborator {
    id: string
    email: string
    role: 'owner' | 'editor'
    joined_at: string
}

export default function CollaboratorModal({ isOpen, onClose, tripId, tripTitle, ownerId }: CollaboratorModalProps) {
    const supabase = createClient()
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [collaborators, setCollaborators] = useState<Collaborator[]>([])
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useScrollLock(isOpen)

    useEffect(() => {
        if (isOpen) {
            fetchCollaborators()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, tripId])

    const fetchCollaborators = async () => {
        const { data, error } = await supabase
            .from('trip_collaborators')
            .select(`
                user_id,
                role,
                created_at,
                profiles:user_id (email)
            `)
            .eq('trip_id', tripId)

        if (error) {
            console.error('Error fetching collaborators:', error)
            return
        }

        const formatted: Collaborator[] = data.map((item: any) => ({
            id: item.user_id,
            email: item.profiles?.email || 'Unknown',
            role: item.role,
            joined_at: item.created_at
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

            const result = await CollaborationService.createInvite({
                tripId,
                email: email.trim(),
                tripTitle
            })

            if (result.error) {
                setError(result.error)
            } else {
                setSuccess(`${email}님을 초대했습니다!`)
                setEmail('')
                fetchCollaborators()
            }
        } catch (err: any) {
            setError(err.message || '초대 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    const handleRemove = async (userId: string) => {
        if (!confirm('이 멤버를 제외하시겠습니까?')) return

        const { error } = await supabase
            .from('trip_collaborators')
            .delete()
            .eq('trip_id', tripId)
            .eq('user_id', userId)

        if (error) {
            alert('멤버 삭제 실패: ' + error.message)
        } else {
            fetchCollaborators()
        }
    }

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed', inset: 0, zIndex: 1000,
            bg: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px',
            animation: 'fadeIn 0.3s ease-out'
        })}>
            <div className={css({
                bg: 'white', w: '100%', maxW: '480px', borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 25px 70px rgba(0,0,0,0.2)',
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)'
            })}>
                {/* 헤더 */}
                <div className={css({ p: '20px 24px', borderBottom: '1px solid', borderBottomColor: 'brand.border', display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                    <h2 className={css({ fontSize: '18px', fontWeight: '700', color: 'brand.secondary', display: 'flex', alignItems: 'center', gap: '8px' })}>
                        <UserPlus size={20} className={css({ color: 'brand.primary' })} /> 함께하는 일행 관리
                    </h2>
                    <button onClick={onClose} className={css({ p: '6px', borderRadius: '50%', bg: 'bg.softCotton', color: 'brand.muted', cursor: 'pointer', transition: 'all 0.2s', _hover: { bg: 'brand.border', color: 'brand.secondary' } })}>
                        <X size={20} />
                    </button>
                </div>

                <div className={css({ p: '24px', display: 'flex', flexDirection: 'column', gap: '24px' })}>
                    {/* 초대 폼 */}
                    <form onSubmit={handleInvite} className={css({ display: 'flex', flexDirection: 'column', gap: '10px' })}>
                        <label className={css({ fontSize: '14px', fontWeight: '700', color: 'brand.secondary' })}>이메일로 초대하기</label>
                        <div className={css({ display: 'flex', gap: '8px' })}>
                            <div className={css({ position: 'relative', flex: 1 })}>
                                <Mail size={16} className={css({ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'brand.muted' })} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="friend@example.com"
                                    className={css({
                                        w: '100%', p: '12px 12px 12px 40px', bg: 'bg.softCotton', border: '1.5px solid', borderColor: 'brand.border', borderRadius: '14px',
                                        fontSize: '15px', outline: 'none', transition: 'all 0.2s', _focus: { borderColor: 'brand.primary', bg: 'white' }
                                    })}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !email}
                                className={css({
                                    p: '0 20px', bg: 'brand.primary', color: 'white', border: 'none', borderRadius: '14px',
                                    fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', _disabled: { opacity: 0.5 },
                                    _hover: { bg: 'brand.primaryDark' }, _active: { transform: 'scale(0.95)' }
                                })}
                            >
                                {loading ? <Loader2 size={18} className={css({ animation: 'spin 1s linear infinite' })} /> : '초대'}
                            </button>
                        </div>
                        {error && <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'brand.error', fontWeight: '600', mt: '4px' })}><AlertCircle size={14} /> {error}</div>}
                        {success && <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'brand.primary', fontWeight: '600', mt: '4px' })}><CheckCircle2 size={14} /> {success}</div>}
                    </form>

                    {/* 멤버 리스트 */}
                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                        <h3 className={css({ fontSize: '14px', fontWeight: '700', color: 'brand.secondary' })}>참여 중인 멤버 ({collaborators.length})</h3>
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px', maxH: '200px', overflowY: 'auto', pr: '4px' })}>
                            {collaborators.map(member => (
                                <div key={member.id} className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    p: '12px 16px', bg: 'bg.softCotton', borderRadius: '16px', border: '1px solid', borderColor: 'brand.border'
                                })}>
                                    <div className={css({ display: 'flex', flexDirection: 'column' })}>
                                        <span className={css({ fontSize: '14px', fontWeight: '700', color: 'brand.secondary' })}>{member.email}</span>
                                        <span className={css({ fontSize: '11px', color: 'brand.muted', display: 'flex', alignItems: 'center', gap: '4px' })}>
                                            {member.role === 'owner' ? <Shield size={10} className={css({ color: 'brand.accent' })} /> : null}
                                            {member.role === 'owner' ? '관리자' : '편집자'}  •  {new Date(member.joined_at).toLocaleDateString()} 합류
                                        </span>
                                    </div>
                                    {member.role !== 'owner' && (
                                        <button
                                            onClick={() => handleRemove(member.id)}
                                            className={css({ p: '6px', bg: 'transparent', border: 'none', color: 'brand.error', cursor: 'pointer', transition: 'all 0.2s', _hover: { transform: 'scale(1.1)' } })}
                                            title="추방하기"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={css({ p: '16px 24px', bg: 'bg.softCotton', borderTop: '1px solid', borderTopColor: 'brand.border', textAlign: 'center' })}>
                    <p className={css({ fontSize: '12px', color: 'brand.muted', lineHeight: 1.5, wordBreak: 'keep-all' })}>
                        초대된 멤버는 해당 여행의 일정을 추가, 수정, 삭제할 수 있습니다.<br />
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
