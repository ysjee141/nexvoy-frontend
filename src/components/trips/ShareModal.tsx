'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { X, Share2, Copy, Mail, Lock, Globe, Check, Loader2 } from 'lucide-react'
import { analytics } from '@/services/AnalyticsService'
import { collaboration } from '@/utils/collaboration'
import { useModalBackButton } from '@/hooks/useModalBackButton'

interface ShareModalProps {
    tripId: string
    isOpen: boolean
    onClose: () => void
    tripTitle: string
}

export default function ShareModal({ tripId, isOpen, onClose, tripTitle }: ShareModalProps) {
    const [shareType, setShareType] = useState<'public' | 'password'>('public')
    const [password, setPassword] = useState('')
    const [shareToken, setShareToken] = useState('')
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useModalBackButton(isOpen, onClose, 'shareModal')

    const fetchShareToken = async (type: 'public' | 'password') => {
        setLoading(true)
        const { data, error } = await collaboration.getOrCreateShareLink(tripId, type, type === 'password' ? password : undefined)
        if (data) {
            setShareToken(data.share_token)
        } else if (error) {
            setMessage({ type: 'error', text: '공유 링크 생성에 실패했습니다.' })
        }
        setLoading(false)
    }

    useEffect(() => {
        if (isOpen && shareType === 'public') {
            fetchShareToken('public')
        }
    }, [isOpen, shareType])

    const handleCreateLink = () => {
        if (shareType === 'password' && !password) {
            setMessage({ type: 'error', text: '비밀번호를 입력해주세요.' })
            return
        }
        fetchShareToken(shareType)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' && window.location.origin.includes('localhost:3000') ? window.location.origin : 'https://app.nexvoy.xyz');
    const shareUrl = shareToken ? `${appUrl}/share/detail?token=${shareToken}` : ''

    const handleCopy = () => {
        if (!shareUrl) return
        navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        analytics.logTripShare('copy')
        setTimeout(() => setCopied(false), 2000)
    }

    const handleEmailShare = () => {
        if (!shareUrl) return
        const subject = encodeURIComponent(`[온여정] ${tripTitle} 여행 일정 공유`);
        const body = encodeURIComponent(`안녕하세요,\n\n${tripTitle} 여행 일정을 함께 확인해보세요!\n\n링크: ${shareUrl}\n\n감사합니다.`);
        analytics.logTripShare('system')
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed', top: 0, left: 0, w: '100vw', h: '100vh',
            bg: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(4px)'
        })} onClick={onClose}>
            <div className={css({
                bg: 'white', w: { base: '95%', sm: '480px' }, borderRadius: '24px', p: { base: '20px', sm: '32px' },
                boxShadow: '0 20px 40px rgba(0,0,0,0.15)', position: 'relative',
                maxW: '100%', boxSizing: 'border-box'
            })} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className={css({
                    position: 'absolute', top: '24px', right: '24px', bg: 'transparent',
                    border: 'none', cursor: 'pointer', color: '#999', _hover: { color: '#1E3A8A' }
                })}>
                    <X size={24} />
                </button>

                <h2 className={css({ fontSize: { base: '18px', sm: '22px' }, fontWeight: '800', mb: { base: '16px', sm: '24px' }, display: 'flex', alignItems: 'center', gap: '8px' })}>
                    <Share2 size={20} color="#2563EB" /> 일정 공유하기
                </h2>

                <div className={css({ mb: '24px' })}>
                    <p className={css({ fontSize: '14px', color: '#666', mb: '16px' })}>
                        동행자가 아닌 분들에게도 일정을 공유할 수 있어요. 공유된 일정은 **읽기 전용**으로 표시됩니다.
                    </p>

                    <div className={css({ display: 'flex', bg: '#f1f3f4', p: '4px', borderRadius: '12px', mb: '16px' })}>
                        <button
                            onClick={() => { setShareType('public'); setShareToken(''); }}
                            className={css({
                                flex: 1, py: '10px', fontSize: '14px', fontWeight: '600',
                                borderRadius: '8px', border: 'none', cursor: 'pointer',
                                bg: shareType === 'public' ? 'white' : 'transparent',
                                boxShadow: shareType === 'public' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                                color: shareType === 'public' ? '#111' : '#666',
                                transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            })}
                        >
                            <Globe size={16} /> 전체 공개
                        </button>
                        <button
                            onClick={() => { setShareType('password'); setShareToken(''); }}
                            className={css({
                                flex: 1, py: '10px', fontSize: '14px', fontWeight: '600',
                                borderRadius: '8px', border: 'none', cursor: 'pointer',
                                bg: shareType === 'password' ? 'white' : 'transparent',
                                boxShadow: shareType === 'password' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                                color: shareType === 'password' ? '#111' : '#666',
                                transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            })}
                        >
                            <Lock size={16} /> 비밀번호 보호
                        </button>
                    </div>

                    {shareType === 'password' && !shareToken && (
                        <div className={css({ mb: '16px' })}>
                            <label className={css({ display: 'block', fontSize: '13px', mb: '6px', color: '#555', fontWeight: 'bold' })}>접속 비밀번호 설정</label>
                            <div className={css({ display: 'flex', gap: '8px' })}>
                                <input
                                    type="password"
                                    placeholder="공유용 비밀번호 입력"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className={css({
                                        flex: 1, px: '12px', py: '12px', bg: '#f8f9fa', borderRadius: '12px',
                                        border: '1px solid #eee', outline: 'none', fontSize: '14px',
                                        _focus: { borderColor: '#2563EB', bg: 'white' }
                                    })}
                                />
                                <button
                                    onClick={handleCreateLink}
                                    className={css({
                                        px: '20px', bg: '#111', color: 'white', borderRadius: '12px',
                                        fontWeight: 'bold', cursor: 'pointer', border: 'none'
                                    })}
                                >
                                    생성
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className={css({ py: '40px', textAlign: 'center' })}>
                        <Loader2 size={32} className={css({ animation: 'spin 1s linear infinite', mx: 'auto', mb: '12px', color: '#2563EB' })} />
                        <p className={css({ color: '#888', fontSize: '14px' })}>공유 링크를 만들고 있어요... ✈️</p>
                    </div>
                ) : shareUrl ? (
                    <div className={css({ bg: '#f9f9f9', p: '24px', borderRadius: '16px', border: '1px solid #f0f0f0' })}>
                        <h3 className={css({ fontSize: '13px', fontWeight: 'bold', color: '#888', mb: '8px' })}>공유 링크 URL</h3>
                        <div className={css({
                            p: '12px', bg: 'white', borderRadius: '12px', border: '1px solid #ddd',
                            fontSize: '13px', color: '#172554', mb: '16px', lineHeight: 1.5,
                            wordBreak: 'break-all'
                        })}>
                            {shareUrl}
                        </div>

                        <div className={css({ display: 'flex', gap: '12px' })}>
                            <button
                                onClick={handleCopy}
                                className={css({
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    py: '12px', bg: 'white', border: '1px solid #ddd', borderRadius: '12px',
                                    fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', _hover: { bg: '#f5f5f5' }
                                })}
                            >
                                <Copy size={16} /> URL 복사
                            </button>
                            <button
                                onClick={handleEmailShare}
                                className={css({
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    py: '12px', bg: 'white', border: '1px solid #ddd', borderRadius: '12px',
                                    fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', _hover: { bg: '#f5f5f5' }
                                })}
                            >
                                <Mail size={16} /> 메일 공유
                            </button>
                        </div>
                        {copied && <p className={css({ mt: '12px', textAlign: 'center', fontSize: '13px', color: '#2563EB', fontWeight: 'bold' })}>링크가 복사되었습니다!</p>}
                    </div>
                ) : null}

                {message && !loading && (
                    <p className={css({
                        mt: '16px', fontSize: '13px', px: '12px', py: '8px', borderRadius: '8px',
                        bg: message.type === 'success' ? '#EFF6FF' : '#fce8e6',
                        color: message.type === 'success' ? '#2563EB' : '#c5221f'
                    })}>
                        {message.text}
                    </p>
                )}
            </div>
        </div >
    )
}
