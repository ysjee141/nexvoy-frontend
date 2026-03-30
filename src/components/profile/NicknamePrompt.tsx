'use client'

import { css } from 'styled-system/css'
import { Sparkles, ArrowRight, X } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'

interface NicknamePromptProps {
    onClose?: () => void
}

export default function NicknamePrompt({ onClose }: NicknamePromptProps) {
    const [isVisible, setIsVisible] = useState(true)

    // 로컬 스토리지에서 닫기 기록 확인 (24시간 동안 보지 않기)
    useEffect(() => {
        const dismissedAt = localStorage.getItem('nicknamePromptDismissedAt')
        if (dismissedAt) {
            const lastDismissed = parseInt(dismissedAt, 10)
            const now = Date.now()
            const ONE_DAY = 24 * 60 * 60 * 1000
            
            if (now - lastDismissed < ONE_DAY) {
                setIsVisible(false)
            }
        }
    }, [])

    const handleClose = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsVisible(false)
        localStorage.setItem('nicknamePromptDismissedAt', Date.now().toString())
        if (onClose) onClose()
    }

    if (!isVisible) return null

    return (
        <div className={css({ mb: '24px', position: 'relative' })}>
            <Link 
                href="/profile?edit=nickname"
                className={css({
                    display: 'flex',
                    flexDirection: { base: 'column', sm: 'row' },
                    alignItems: { base: 'flex-start', sm: 'center' },
                    gap: '16px',
                    p: '20px 24px',
                    bg: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                    borderRadius: '16px',
                    border: '1px solid #BFDBFE',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                    _hover: { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)' },
                    _active: { transform: 'scale(0.98)' }
                })}
            >
                {/* Decorative Sparkles */}
                <div className={css({ position: 'absolute', top: '-10px', right: '10%', opacity: 0.4, color: '#3B82F6' })}>
                    <Sparkles size={40} />
                </div>

                <div className={css({
                    w: '48px', h: '48px', bg: 'white', borderRadius: '12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#3B82F6', flexShrink: 0, boxShadow: '0 2px 6px rgba(59, 130, 246, 0.1)'
                })}>
                    <Sparkles size={24} />
                </div>

                <div className={css({ flex: 1 })}>
                    <h3 className={css({ fontSize: '16px', fontWeight: '800', color: '#1E3A8A', mb: '2px' })}>
                        닉네임을 설정해 주세요!
                    </h3>
                    <p className={css({ fontSize: '13px', color: '#3B82F6', fontWeight: '500' })}>
                        동행자들이 나를 더 쉽게 알아볼 수 있어요.
                    </p>
                </div>

                <div className={css({ 
                    display: 'flex', alignItems: 'center', gap: '6px', 
                    bg: 'white', color: '#1E40AF', px: '14px', py: '8px', 
                    borderRadius: '10px', fontSize: '13px', fontWeight: '800',
                    mt: { base: '12px', sm: 0 }
                })}>
                    설정하러 가기 <ArrowRight size={14} />
                </div>

                <button 
                    onClick={handleClose}
                    className={css({
                        position: 'absolute', top: '12px', right: '12px',
                        p: '4px', bg: 'transparent', border: 'none', cursor: 'pointer',
                        color: '#3B82F6', opacity: 0.6,
                        _hover: { opacity: 1 }
                    })}
                >
                    <X size={16} />
                </button>
            </Link>
        </div>
    )
}
