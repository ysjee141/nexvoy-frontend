'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { X, Sparkles, MessageSquarePlus, Heart, ArrowRight } from 'lucide-react'

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
            position: 'fixed', inset: 0, bg: 'rgba(0,0,0,0.6)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px',
            backdropFilter: 'blur(6px)'
        })}>
            <div className={css({
                bg: 'white', w: '100%', maxW: '480px', borderRadius: '32px', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
                animation: 'slideIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)'
            })}>
                {/* 상단 이미지/아이콘 영역 */}
                <div className={css({
                    h: '140px', bg: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative'
                })}>
                    <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                    <Sparkles size={64} color="white" />
                </div>

                <div className={css({ p: '32px' })}>
                    <div className={css({ textAlign: 'center', mb: '24px' })}>
                        <h2 className={css({ fontSize: '24px', fontWeight: '900', color: '#172554', mb: '8px' })}>
                            테스터님, 환영합니다! 👋
                        </h2>
                        <p className={css({ fontSize: '15px', color: '#555', lineHeight: '1.6', wordBreak: 'keep-all' })}>
                            온여정의 비공개 테스트에 참여해주셔서 진심으로 감사합니다. 테스터님의 소중한 경험이 더 완벽한 서비스를 만듭니다.
                        </p>
                    </div>

                    <div className={css({ 
                        bg: '#F8FAFF', p: '20px', borderRadius: '20px', mb: '28px',
                        border: '1px solid #E0E7FF'
                    })}>
                        <div className={css({ display: 'flex', gap: '12px', alignItems: 'flex-start' })}>
                            <div className={css({ 
                                w: '40px', h: '40px', bg: '#222', borderRadius: '12px', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                            })}>
                                <MessageSquarePlus size={20} color="white" />
                            </div>
                            <div>
                                <h4 className={css({ fontWeight: '800', fontSize: '14px', color: '#111', mb: '4px' })}>피드백 방법 안내</h4>
                                <p className={css({ fontSize: '13px', color: '#666', lineHeight: '1.5' })}>
                                    화면 오른쪽 하단에 있는 <strong style={{ color: '#222' }}>피드백 버튼</strong>을 눌러주세요. 결함 제보부터 아이언 의견까지 자유롭게 들려주세요!
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                        <button
                            onClick={handleClose}
                            className={css({
                                w: '100%', py: '16px', bg: '#222', color: 'white', borderRadius: '16px',
                                fontWeight: '800', fontSize: '16px', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                transition: 'all 0.2s', _hover: { bg: '#000', transform: 'translateY(-2px)' }
                            })}
                        >
                            시작하기 <ArrowRight size={18} />
                        </button>
                        
                        <div className={css({ display: 'flex', justifyContent: 'center' })}>
                            <button
                                onClick={handleHideForWeek}
                                className={css({
                                    fontSize: '13px', color: '#999', bg: 'transparent', border: 'none',
                                    cursor: 'pointer', textDecoration: 'underline', transition: 'color 0.2s',
                                    _hover: { color: '#666' }
                                })}
                            >
                                아쉽지만 일주일 동안 보지 않기
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes slideIn {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
