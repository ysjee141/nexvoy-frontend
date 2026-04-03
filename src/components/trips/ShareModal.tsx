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
            bg: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
            backdropFilter: 'blur(10px)', animation: 'fadeIn 0.3s ease-out'
        })} onClick={onClose}>
            <div className={css({
                bg: 'white', w: { base: '95%', sm: '480px' }, borderRadius: '24px', p: { base: '24px', sm: '32px' },
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)', position: 'relative',
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

                <h2 className={css({ fontSize: { base: '20px', sm: '22px' }, fontWeight: '700', mb: { base: '24px', sm: '32px' }, display: 'flex', alignItems: 'center', gap: '12px', color: '#2C3A47', letterSpacing: '-0.02em' })}>
                    <div className={css({ p: '10px', bg: 'rgba(46, 196, 182, 0.1)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
                        <Share2 size={22} color="#2EC4B6" strokeWidth={2.5} />
                    </div>
                    일정 공유하기
                </h2>

                <div className={css({ mb: '28px' })}>
                    <p className={css({ fontSize: '14px', color: '#4B5563', mb: '24px', fontWeight: '500', lineHeight: '1.6', wordBreak: 'keep-all' })}>
                        동행자가 아닌 분들에게도 일정을 공유할 수 있어요. 공유된 일정은 <span className={css({ color: '#2EC4B6', fontWeight: '700' })}>읽기 전용</span>으로 안전하게 표시됩니다.
                    </p>

                    <div className={css({ display: 'flex', bg: '#F8F9FA', p: '5px', borderRadius: '18px', mb: '24px' })}>
                        <button
                            onClick={() => { setShareType('public'); setShareToken(''); }}
                            className={css({
                                flex: 1, py: '12px', fontSize: '14px', fontWeight: '700',
                                borderRadius: '14px', border: 'none', cursor: 'pointer',
                                bg: shareType === 'public' ? 'white' : 'transparent',
                                boxShadow: shareType === 'public' ? '0 4px 15px rgba(0,0,0,0.06)' : 'none',
                                color: shareType === 'public' ? '#2EC4B6' : '#9BA3AF',
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
                                borderRadius: '14px', border: 'none', cursor: 'pointer',
                                bg: shareType === 'password' ? 'white' : 'transparent',
                                boxShadow: shareType === 'password' ? '0 4px 15px rgba(0,0,0,0.06)' : 'none',
                                color: shareType === 'password' ? '#2EC4B6' : '#9BA3AF',
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
                            <label className={css({ display: 'block', fontSize: '13px', mb: '10px', color: '#2C3A47', fontWeight: '700' })}>접속 비밀번호 설정</label>
                            <div className={css({ display: 'flex', gap: '10px' })}>
                                <input
                                    type="password"
                                    placeholder="공유용 비밀번호 입력"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className={css({
                                        flex: 1, px: '16px', py: '16px', bg: '#F8F9FA', borderRadius: '20px',
                                        border: '1.5px solid #F1F3F5', outline: 'none', fontSize: '14px', fontWeight: '600', color: '#2C3A47', transition: 'all 0.2s',
                                        _placeholder: { color: '#9CA3AF', fontWeight: '500' },
                                        _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 4px rgba(46, 196, 182, 0.1)' }
                                    })}
                                />
                                <button
                                    onClick={handleCreateLink}
                                    className={css({
                                        px: '24px', bg: '#2EC4B6', color: 'white', borderRadius: '20px',
                                        fontWeight: '700', cursor: 'pointer', border: 'none',
                                        transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                                        boxShadow: '0 8px 20px rgba(46,196,182,0.25)',
                                        _hover: { bg: '#249E93', transform: 'translateY(-2px)', boxShadow: '0 12px 25px rgba(46,196,182,0.35)' },
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
                        <Loader2 size={36} className={css({ animation: 'spin 1s linear infinite', mx: 'auto', mb: '16px', color: '#2EC4B6' })} />
                        <p className={css({ color: '#6B7280', fontSize: '14px', fontWeight: '600' })}>공유 링크를 만들고 있어요... ✈️</p>
                    </div>
                ) : shareUrl ? (
                    <div className={css({ bg: '#F8F9FA', p: '24px', borderRadius: '24px', border: '1.5px solid #F1F3F5', animation: 'fadeIn 0.4s ease-out' })}>
                        <h3 className={css({ fontSize: '13px', fontWeight: '700', color: '#2C3A47', mb: '14px', display: 'flex', alignItems: 'center', gap: '8px' })}>
                            <div className={css({ w: '4px', h: '12px', bg: '#2EC4B6', borderRadius: '2px' })} /> 공유 링크 URL
                        </h3>
                        <div className={css({
                            p: '18px', bg: 'white', borderRadius: '16px', border: '1.2px solid #EEEEEE',
                            fontSize: '13px', fontWeight: '600', color: '#4B5563', mb: '22px', lineHeight: 1.6,
                            wordBreak: 'break-all', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                        })}>
                            {shareUrl}
                        </div>

                        <div className={css({ display: 'flex', gap: '12px' })}>
                            <button
                                onClick={handleCopy}
                                className={css({
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    py: '15px', bg: 'white', border: '1.5px solid #EEEEEE', borderRadius: '16px',
                                    fontSize: '14px', fontWeight: '700', color: '#2C3A47', cursor: 'pointer', 
                                    transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)', 
                                    _hover: { bg: '#F8F9FA', borderColor: '#2EC4B6', color: '#2EC4B6', transform: 'translateY(-1px)' },
                                    _active: { transform: 'scale(0.96)' }
                                })}
                            >
                                <Copy size={16} strokeWidth={2.5} /> URL 복사
                            </button>
                            <button
                                onClick={handleEmailShare}
                                className={css({
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    py: '15px', bg: 'white', border: '1.5px solid #EEEEEE', borderRadius: '16px',
                                    fontSize: '14px', fontWeight: '700', color: '#2C3A47', cursor: 'pointer',
                                    transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)', 
                                    _hover: { bg: '#F8F9FA', borderColor: '#2EC4B6', color: '#2EC4B6', transform: 'translateY(-1px)' },
                                    _active: { transform: 'scale(0.96)' }
                                })}
                            >
                                <Mail size={16} strokeWidth={2.5} /> 메일 공유
                            </button>
                        </div>
                        {copied && <p className={css({ mt: '14px', textAlign: 'center', fontSize: '13px', color: '#2EC4B6', fontWeight: '700', animation: 'fadeIn 0.2s' })}>✨ 링크가 복사되었습니다!</p>}
                    </div>
                ) : null}

                {message && !loading && (
                    <p className={css({
                        mt: '20px', fontSize: '13px', px: '14px', py: '10px', borderRadius: '14px', fontWeight: '600',
                        bg: message.type === 'success' ? 'rgba(46, 196, 182, 0.1)' : 'rgba(239, 68, 68, 0.08)',
                        color: message.type === 'success' ? '#2EC4B6' : '#EF4444',
                        animation: 'fadeIn 0.3s ease-out'
                    })}>
                        {message.text}
                    </p>
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
