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
                        <Share2 size={22} color="#2EC4B6" strokeWidth={2.5} />
                    </div>
                    일정 공유하기
                </h2>

                <div className={css({ mb: '28px' })}>
                    <p className={css({ fontSize: '14px', color: '#717171', mb: '20px', fontWeight: '500', lineHeight: '1.5' })}>
                        동행자가 아닌 분들에게도 일정을 공유할 수 있어요. 공유된 일정은 **읽기 전용**으로 표시됩니다.
                    </p>

                    <div className={css({ display: 'flex', bg: '#F2F4F5', p: '4px', borderRadius: '18px', mb: '20px' })}>
                        <button
                            onClick={() => { setShareType('public'); setShareToken(''); }}
                            className={css({
                                flex: 1, py: '12px', fontSize: '14px', fontWeight: '800',
                                borderRadius: '14px', border: 'none', cursor: 'pointer',
                                bg: shareType === 'public' ? 'white' : 'transparent',
                                boxShadow: shareType === 'public' ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
                                color: shareType === 'public' ? '#2C3A47' : '#717171',
                                transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            })}
                        >
                            <Globe size={18} strokeWidth={shareType === 'public' ? 2.5 : 2} /> 전체 공개
                        </button>
                        <button
                            onClick={() => { setShareType('password'); setShareToken(''); }}
                            className={css({
                                flex: 1, py: '12px', fontSize: '14px', fontWeight: '800',
                                borderRadius: '14px', border: 'none', cursor: 'pointer',
                                bg: shareType === 'password' ? 'white' : 'transparent',
                                boxShadow: shareType === 'password' ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
                                color: shareType === 'password' ? '#2C3A47' : '#717171',
                                transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            })}
                        >
                            <Lock size={18} strokeWidth={shareType === 'password' ? 2.5 : 2} /> 비밀번호 보호
                        </button>
                    </div>

                    {shareType === 'password' && !shareToken && (
                        <div className={css({ mb: '16px' })}>
                            <label className={css({ display: 'block', fontSize: '13px', mb: '8px', color: '#2C3A47', fontWeight: '800' })}>접속 비밀번호 설정</label>
                            <div className={css({ display: 'flex', gap: '10px' })}>
                                <input
                                    type="password"
                                    placeholder="공유용 비밀번호 입력"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className={css({
                                        flex: 1, px: '14px', py: '14px', bg: '#F9F9F9', borderRadius: '16px',
                                        border: '1px solid #EEEEEE', outline: 'none', fontSize: '14px', fontWeight: '600', color: '#2C3A47', transition: 'all 0.2s',
                                        _placeholder: { color: '#CCC', fontWeight: '400' },
                                        _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 3px rgba(46, 196, 182, 0.1)' }
                                    })}
                                />
                                <button
                                    onClick={handleCreateLink}
                                    className={css({
                                        px: '24px', bg: '#2EC4B6', color: 'white', borderRadius: '16px',
                                        fontWeight: '800', cursor: 'pointer', border: 'none',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 12px rgba(46,196,182,0.2)',
                                        _hover: { bg: '#249E93', transform: 'translateY(-1px)' },
                                        _active: { transform: 'scale(0.95)' }
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
                        <Loader2 size={32} className={css({ animation: 'spin 1s linear infinite', mx: 'auto', mb: '12px', color: '#2EC4B6' })} />
                        <p className={css({ color: '#888', fontSize: '14px' })}>공유 링크를 만들고 있어요... ✈️</p>
                    </div>
                ) : shareUrl ? (
                    <div className={css({ bg: '#F9F9F9', p: '24px', borderRadius: '24px', border: '1px solid #EEEEEE' })}>
                        <h3 className={css({ fontSize: '13px', fontWeight: '800', color: '#2C3A47', mb: '12px', display: 'flex', alignItems: 'center', gap: '6px' })}>
                            <div className={css({ w: '4px', h: '12px', bg: '#2EC4B6', borderRadius: '2px' })} /> 공유 링크 URL
                        </h3>
                        <div className={css({
                            p: '16px', bg: 'white', borderRadius: '16px', border: '1px solid #EEEEEE',
                            fontSize: '13px', fontWeight: '600', color: '#2C3A47', mb: '20px', lineHeight: 1.6,
                            wordBreak: 'break-all'
                        })}>
                            {shareUrl}
                        </div>

                        <div className={css({ display: 'flex', gap: '12px' })}>
                            <button
                                onClick={handleCopy}
                                className={css({
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    py: '14px', bg: 'white', border: '1px solid #EEEEEE', borderRadius: '16px',
                                    fontSize: '14px', fontWeight: '800', color: '#2C3A47', cursor: 'pointer', 
                                    transition: 'all 0.2s', _hover: { bg: '#F2F4F5', borderColor: '#CCC' },
                                    _active: { transform: 'scale(0.98)' }
                                })}
                            >
                                <Copy size={16} strokeWidth={2.5} /> URL 복사
                            </button>
                            <button
                                onClick={handleEmailShare}
                                className={css({
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    py: '14px', bg: 'white', border: '1px solid #EEEEEE', borderRadius: '16px',
                                    fontSize: '14px', fontWeight: '800', color: '#2C3A47', cursor: 'pointer',
                                    transition: 'all 0.2s', _hover: { bg: '#F2F4F5', borderColor: '#CCC' },
                                    _active: { transform: 'scale(0.98)' }
                                })}
                            >
                                <Mail size={16} strokeWidth={2.5} /> 메일 공유
                            </button>
                        </div>
                        {copied && <p className={css({ mt: '12px', textAlign: 'center', fontSize: '13px', color: '#2EC4B6', fontWeight: 'bold' })}>링크가 복사되었습니다!</p>}
                    </div>
                ) : null}

                {message && !loading && (
                    <p className={css({
                        mt: '16px', fontSize: '13px', px: '12px', py: '8px', borderRadius: '12px',
                        bg: message.type === 'success' ? '#EAF9F7' : '#fce8e6',
                        color: message.type === 'success' ? '#2EC4B6' : '#c5221f'
                    })}>
                        {message.text}
                    </p>
                )}
            </div>
        </div >
    )
}
