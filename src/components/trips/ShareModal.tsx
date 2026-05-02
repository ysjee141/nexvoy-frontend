'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { X, Share2, Copy, Mail, Lock, Globe, Check, Loader2 } from 'lucide-react'
import { analytics } from '@/services/AnalyticsService'
import { collaboration } from '@/utils/collaboration'
import { useModalBackButton } from '@/hooks/useModalBackButton'
import { useScrollLock } from '@/hooks/useScrollLock'

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
    useScrollLock(isOpen)

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
            bg: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
            backdropFilter: 'blur(10px)', animation: 'fadeIn 0.3s ease-out',
            overscrollBehavior: 'none',
            touchAction: 'none',
        })} onClick={onClose}>
            <div className={css({
                bg: 'white', w: { base: '95%', sm: '480px' }, borderRadius: '16px', p: { base: '24px', sm: '32px' },
                boxShadow: 'airbnbHover', position: 'relative',
                maxW: '100%', boxSizing: 'border-box',
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)',
                overscrollBehavior: 'contain',
            })} onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className={css({
                        position: 'absolute', right: '16px', top: '16px',
                        w: '36px', h: '36px', borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bg: 'bg.softCotton', border: 'none', cursor: 'pointer', color: 'brand.muted',
                        transition: 'all 0.2s',
                        _hover: { bg: 'rgba(0,0,0,0.05)', color: 'brand.ink', transform: 'rotate(90deg)' }
                    })}
                >
                    <X size={20} strokeWidth={2.5} />
                </button>

                <h2 className={css({ fontSize: { base: '20px', sm: '22px' }, fontWeight: '700', mb: { base: '24px', sm: '32px' }, display: 'flex', alignItems: 'center', gap: '12px', color: 'brand.ink', letterSpacing: '-0.02em' })}>
                    <div className={css({ w: '44px', h: '44px', bg: 'bg.softCotton', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid', borderColor: 'brand.hairline' })}>
                        <Share2 size={22} className={css({ color: 'brand.primary' })} strokeWidth={2.5} />
                    </div>
                    여행 일정 공유하기
                </h2>

                <div className={css({ textAlign: 'left' })}>
                    <p className={css({ fontSize: '14px', color: 'brand.muted', mb: '24px', fontWeight: '500', lineHeight: '1.6', wordBreak: 'keep-all' })}>
                        동행자가 아닌 분들에게도 일정을 공유할 수 있어요. 공유된 일정은 <span className={css({ color: 'brand.primary', fontWeight: '700' })}>읽기 전용</span>으로 안전하게 표시됩니다.
                    </p>

                    <div className={css({ display: 'flex', bg: 'bg.softCotton', p: '5px', borderRadius: '14px', mb: '24px', border: '1px solid', borderColor: 'brand.hairline' })}>
                        <button
                            onClick={() => { setShareType('public'); setShareToken(''); }}
                            className={css({
                                flex: 1, py: '12px', fontSize: '14px', fontWeight: '700',
                                borderRadius: '10px', border: 'none', cursor: 'pointer',
                                bg: shareType === 'public' ? 'white' : 'transparent',
                                boxShadow: shareType === 'public' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                                color: shareType === 'public' ? 'brand.primary' : 'brand.muted',
                                transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                _active: { transform: 'scale(0.96)' }
                            })}
                        >
                            <Globe size={18} strokeWidth={shareType === 'public' ? 2.5 : 2} /> 전체 공개
                        </button>
                        <button
                            onClick={() => { setShareType('password'); setShareToken(''); }}
                            className={css({
                                flex: 1, py: '12px', fontSize: '14px', fontWeight: '700',
                                borderRadius: '10px', border: 'none', cursor: 'pointer',
                                bg: shareType === 'password' ? 'white' : 'transparent',
                                boxShadow: shareType === 'password' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                                color: shareType === 'password' ? 'brand.primary' : 'brand.muted',
                                transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                _active: { transform: 'scale(0.96)' }
                            })}
                        >
                            <Lock size={18} strokeWidth={shareType === 'password' ? 2.5 : 2} /> 비밀번호 보호
                        </button>
                    </div>

                    {shareType === 'password' && !shareToken && (
                        <div className={css({ mb: '16px', animation: 'fadeIn 0.3s ease-out' })}>
                            <label className={css({ display: 'block', fontSize: '13px', mb: '10px', color: 'brand.ink', fontWeight: '700' })}>접속 비밀번호 설정</label>
                            <div className={css({ display: 'flex', gap: '10px' })}>
                                <input
                                    type="password"
                                    placeholder="공유용 비밀번호 입력"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className={css({
                                        flex: 1, px: '16px', py: '16px', bg: 'white', borderRadius: '8px',
                                        border: '1px solid', borderColor: 'brand.hairline', outline: 'none', fontSize: '14px', fontWeight: '600', color: 'brand.ink', transition: 'all 0.2s',
                                        _placeholder: { color: 'brand.muted', fontWeight: '500' },
                                        _focus: { borderColor: 'brand.primary', boxShadow: '0 0 0 4px rgba(var(--colors-brand-primary-rgb), 0.1)' }
                                    })}
                                />
                                <button
                                    onClick={handleCreateLink}
                                    className={css({
                                        px: '24px', bg: 'brand.primary', color: 'white', borderRadius: '8px',
                                        fontWeight: '700', cursor: 'pointer', border: 'none',
                                        transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                                        _hover: { bg: 'brand.primaryActive', boxShadow: 'airbnbHover' },
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
                    <div className={css({ textAlign: 'center', py: '32px' })}>
                        <Loader2 size={36} className={css({ animation: 'spin 1s linear infinite', mx: 'auto', mb: '16px', color: 'brand.primary' })} />
                        <p className={css({ color: 'brand.muted', fontSize: '14px', fontWeight: '600' })}>공유 링크를 만들고 있어요... ✈️</p>
                    </div>
                ) : shareUrl ? (
                    <div className={css({ bg: 'bg.softCotton', p: '24px', borderRadius: '16px', border: '1px solid', borderColor: 'brand.hairline', animation: 'fadeIn 0.4s ease-out' })}>
                        <h3 className={css({ fontSize: '13px', fontWeight: '700', color: 'brand.ink', mb: '14px', display: 'flex', alignItems: 'center', gap: '8px' })}>
                            <div className={css({ w: '4px', h: '12px', bg: 'brand.primary', borderRadius: '2px' })} /> 공유 링크 URL
                        </h3>
                        <div className={css({ 
                            p: '18px', bg: 'white', borderRadius: '8px', border: '1px solid', borderColor: 'brand.hairline',
                            fontSize: '13px', fontWeight: '600', color: 'brand.muted', mb: '22px', lineHeight: 1.6,
                            wordBreak: 'break-all'
                        })}>
                            {shareUrl}
                        </div>
                        
                        <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' })}>
                             <button
                                onClick={handleCopy}
                                className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    py: '15px', bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px',
                                    fontSize: '14px', fontWeight: '700', color: 'brand.ink', cursor: 'pointer', 
                                    transition: 'all 0.2s',
                                    _hover: { bg: 'bg.softCotton', borderColor: 'brand.primary', color: 'brand.primary', boxShadow: 'airbnbHover' },
                                    _active: { transform: 'scale(0.98)' }
                                })}
                            >
                                <Copy size={18} /> 링크 복사
                            </button>
                             <button
                                onClick={handleEmailShare}
                                className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    py: '15px', bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px',
                                    fontSize: '14px', fontWeight: '700', color: 'brand.ink', cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    _hover: { bg: 'bg.softCotton', borderColor: 'brand.primary', color: 'brand.primary', boxShadow: 'airbnbHover' },
                                    _active: { transform: 'scale(0.98)' }
                                })}
                            >
                                <Mail size={18} /> 메일 공유
                            </button>
                        </div>
                        {copied && <p className={css({ mt: '14px', textAlign: 'center', fontSize: '13px', color: 'brand.primary', fontWeight: '700', animation: 'fadeIn 0.2s' })}>✨ 링크가 복사되었습니다!</p>}
                    </div>
                ) : null}

                {message && !loading && (
                    <div className={css({ 
                        mt: '24px', p: '14px', borderRadius: '8px', textAlign: 'center', fontSize: '13px', fontWeight: '700',
                        bg: 'bg.softCotton',
                        color: message.type === 'success' ? 'brand.primary' : 'brand.error',
                        border: '1px solid',
                        borderColor: message.type === 'success' ? 'brand.primary/20' : 'brand.error/20',
                        animation: 'fadeIn 0.3s'
                    })}>
                        {message.text}
                    </div>
                )}
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
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div >
    )
}
