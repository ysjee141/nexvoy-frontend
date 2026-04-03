'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { Sparkles, Megaphone, ArrowRight } from 'lucide-react'

interface TesterNoticeModalProps {
    userId: string;
}

export default function TesterNoticeModal({ userId }: TesterNoticeModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const STORAGE_KEY = `tester_notice_hide_until_${userId}`

    useEffect(() => {
        const hideUntil = localStorage.getItem(STORAGE_KEY)
        if (!hideUntil || Date.now() > parseInt(hideUntil, 10)) {
            setIsOpen(true)
        }
    }, [STORAGE_KEY])

    const handleClose = () => {
        setIsOpen(false)
    }

    const handleHideForWeek = () => {
        const oneWeekLater = Date.now() + 7 * 24 * 60 * 60 * 1000
        localStorage.setItem(STORAGE_KEY, oneWeekLater.toString())
        setIsOpen(false)
    }

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed', inset: 0, bg: 'rgba(0,0,0,0.5)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px',
            backdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.3s ease-out'
        })}>
            <div className={css({
                bg: 'white', w: '100%', maxW: '480px', borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)'
            })}>
                {/* 상단 이미지/아이콘 영역 */}
                <div className={css({
                    h: '160px', bg: 'linear-gradient(135deg, #2EC4B6 0%, #17A99C 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', overflow: 'hidden'
                 })}>
                    <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                    <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                    <Sparkles size={68} color="white" strokeWidth={1.5} />
                </div>

                <div className={css({ p: '32px' })}>
                    <div className={css({ textAlign: 'center', mb: '28px' })}>
                        <h2 className={css({ fontSize: '24px', fontWeight: '900', color: '#2C3A47', mb: '10px', letterSpacing: '-0.02em' })}>
                            테스터님, 환영합니다! 👋
                        </h2>
                        <p className={css({ fontSize: '15px', color: '#6B7280', lineHeight: '1.65', wordBreak: 'keep-all', fontWeight: '500' })}>
                            온여정의 비공개 테스트에 참여해주셔서 진심으로 감사합니다. 테스터님의 소중한 경험이 더 완벽한 서비스를 만듭니다.
                        </p>
                    </div>

                    <div className={css({ 
                        bg: 'rgba(46, 196, 182, 0.05)', p: '24px', borderRadius: '24px', mb: '32px',
                        border: '1.5px solid rgba(46, 196, 182, 0.1)'
                    })}>
                        <div className={css({ display: 'flex', gap: '16px', alignItems: 'flex-start' })}>
                            <div className={css({ 
                                w: '44px', h: '44px', bg: '#2EC4B6', borderRadius: '14px', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                boxShadow: '0 8px 16px rgba(46, 196, 182, 0.2)'
                            })}>
                                <Megaphone size={22} color="white" strokeWidth={2.5} />
                            </div>
                            <div>
                                <h4 className={css({ fontWeight: '900', fontSize: '15px', color: '#2C3A47', mb: '6px' })}>피드백 방법 안내</h4>
                                <p className={css({ fontSize: '14px', color: '#6B7280', lineHeight: '1.55', fontWeight: '500' })}>
                                    화면 오른쪽 하단 <strong style={{ color: '#2EC4B6', fontWeight: '900' }}>피드백 버튼</strong>을 눌러주세요. 결함 제보부터 작은 아이디어까지 언제나 환영합니다! ✨
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
                        <button
                            onClick={handleClose}
                            className={css({
                                w: '100%', py: '18px', bg: '#2EC4B6', color: 'white', borderRadius: '20px',
                                fontWeight: '900', fontSize: '17px', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                boxShadow: '0 10px 25px rgba(46, 196, 182, 0.25)',
                                transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)', 
                                _hover: { bg: '#249E93', transform: 'translateY(-2px)', boxShadow: '0 15px 35px rgba(46, 196, 182, 0.35)' },
                                _active: { transform: 'scale(0.97)' }
                            })}
                        >
                            여정 시작하기 <ArrowRight size={20} strokeWidth={2.5} />
                        </button>
                        
                        <div className={css({ display: 'flex', justifyContent: 'center' })}>
                            <button
                                onClick={handleHideForWeek}
                                className={css({
                                    fontSize: '13px', color: '#9CA3AF', bg: 'transparent', border: 'none',
                                    cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s',
                                    _hover: { color: '#4B5563' },
                                    borderBottom: '1px solid currentColor',
                                    pb: '2px'
                                })}
                            >
                                아쉽지만 일주일 동안 보지 않기
                            </button>
                        </div>
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
