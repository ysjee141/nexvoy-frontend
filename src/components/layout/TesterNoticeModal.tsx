'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { Gift, Heart, ArrowRight } from 'lucide-react'

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

    const handleHideForDay = () => {
        const oneDayLater = Date.now() + 24 * 60 * 60 * 1000
        localStorage.setItem(STORAGE_KEY, oneDayLater.toString())
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
                    h: '160px', bg: 'linear-gradient(135deg, brand.primary 0%, brand.primaryDark 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', overflow: 'hidden'
                 })}>
                    <div className={css({ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', bg: 'white/10' })} />
                    <div className={css({ position: 'absolute', bottom: '-15px', left: '-15px', width: '80px', height: '80px', borderRadius: '50%', bg: 'white/10' })} />
                    <Gift size={64} className={css({ color: 'white', opacity: 0.9, position: 'relative', zIndex: 1 })} />
                </div>

                <div className={css({ p: '32px', textAlign: 'center' })}>
                    <div className={css({ mb: '24px' })}>
                        <h2 className={css({ fontSize: '24px', fontWeight: '700', color: 'brand.secondary', mb: '10px', letterSpacing: '-0.02em' })}>
                            베타 테스터에 참여해 주셔서 감사합니다! 🎁
                        </h2>
                        <p className={css({ fontSize: '15px', color: 'brand.muted', lineHeight: '1.65', wordBreak: 'keep-all', fontWeight: '500' })}>
                            온여정은 현재 더 나은 여행 경험을 위해 기능 개선 중에 있습니다. 사용자님의 소중한 의견이 서비스 발전에 큰 도움이 됩니다.
                        </p>
                    </div>

                    <div className={css({ 
                        display: 'flex', alignItems: 'flex-start', gap: '16px', bg: 'bg.softCotton', p: '20px', borderRadius: '20px', mb: '32px', textAlign: 'left',
                        border: '1px solid', borderColor: 'brand.border'
                    })}>
                        <div className={css({ 
                            w: '44px', h: '44px', bg: 'brand.primary', borderRadius: '14px', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            color: 'white'
                        })}>
                            <Heart size={20} />
                        </div>
                        <div>
                            <h4 className={css({ fontWeight: '700', fontSize: '15px', color: 'brand.secondary', mb: '6px' })}>피드백 방법 안내</h4>
                            <p className={css({ fontSize: '14px', color: 'brand.muted', lineHeight: '1.55', fontWeight: '500' })}>
                                화면 오른쪽 하단 <strong className={css({ color: 'brand.primary', fontWeight: '700' })}>피드백 버튼</strong>을 눌러주세요. 결함 제보부터 작은 아이디어까지 언제나 환영합니다! ✨
                            </p>
                        </div>
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                        <button
                            onClick={handleClose}
                            className={css({
                                w: '100%', py: '18px', bg: 'brand.primary', color: 'white', borderRadius: '20px',
                                fontWeight: '800', fontSize: '16px', border: 'none', cursor: 'pointer',
                                transition: 'all 0.2s',
                                _hover: { bg: 'brand.primaryDark', transform: 'translateY(-2px)' },
                                _active: { transform: 'scale(0.98)' }
                            })}
                        >
                            확인했습니다
                        </button>
                        
                        <button
                            onClick={handleHideForDay}
                            className={css({
                                fontSize: '13px', color: 'brand.muted', bg: 'transparent', border: 'none',
                                cursor: 'pointer', fontWeight: '600', py: '8px', borderRadius: '12px',
                                transition: 'all 0.2s',
                                _hover: { color: 'brand.secondary', bg: 'bg.softCotton' }
                            })}
                        >
                            하루 동안 보지 않기
                        </button>
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
