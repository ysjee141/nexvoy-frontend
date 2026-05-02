'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { Wifi, ChevronRight, X } from 'lucide-react'
import { useNetworkStore } from '@/stores/useNetworkStore'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'

export default function OnlinePromptModal() {
    const { isOnline, isOfflineMode, setOfflineMode } = useNetworkStore()
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()
    const isNative = Capacitor.isNativePlatform()

    // 네트워크가 다시 연결되었고(isOnline = true), 앱은 아직 오프라인 모드일 때 모달 노출
    useEffect(() => {
        if (isOnline && isOfflineMode && isNative) {
            setIsOpen(true)
        } else {
            setIsOpen(false)
        }
    }, [isOnline, isOfflineMode, isNative])

    const handleSwitch = () => {
        setOfflineMode(false)
        setIsOpen(false)
        router.push('/')
    }

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            p: '20px',
            bg: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease-out',
        })}>
            <div className={css({
                bg: 'white',
                borderRadius: '32px',
                p: '32px 24px',
                w: '100%',
                maxW: '340px',
                boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                animation: 'slideUpScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative'
            })}>
                <button
                    onClick={() => setIsOpen(false)}
                    className={css({
                        position: 'absolute', top: '16px', right: '16px',
                        p: '8px', borderRadius: '50%', bg: 'transparent',
                        color: 'brand.muted', cursor: 'pointer', border: 'none',
                        transition: 'bg 0.2s', _hover: { bg: 'bg.softCotton' }
                    })}
                >
                    <X size={20} />
                </button>

                <div className={css({
                    w: '64px', h: '64px', borderRadius: '20px',
                    bg: 'rgba(16, 185, 129, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    mb: '20px'
                })}>
                    <Wifi size={32} className={css({ color: '#10B981' })} />
                </div>

                <h3 className={css({
                    fontSize: '20px', fontWeight: '800', color: 'brand.secondary',
                    mb: '12px', textAlign: 'center'
                })}>
                    네트워크 연결 회복
                </h3>
                
                <p className={css({
                    fontSize: '15px', color: 'brand.muted', textAlign: 'center',
                    lineHeight: 1.6, mb: '28px', wordBreak: 'keep-all'
                })}>
                    인터넷이 다시 연결되었습니다.<br />
                    모든 기능을 사용할 수 있는<br />
                    <strong>온라인 모드</strong>로 전환하시겠습니까?
                </p>

                <div className={css({
                    display: 'flex', flexDirection: 'column', gap: '12px', w: '100%'
                })}>
                    <button
                        onClick={handleSwitch}
                        className={css({
                            w: '100%', py: '14px', bg: '#10B981', color: 'white',
                            fontWeight: '700', fontSize: '16px', borderRadius: '16px', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            transition: 'all 0.2s', _active: { transform: 'scale(0.98)', opacity: 0.9 }
                        })}
                    >
                        온라인 모드 전환
                        <ChevronRight size={18} />
                    </button>
                    
                    <button
                        onClick={() => setIsOpen(false)}
                        className={css({
                            w: '100%', py: '12px', bg: 'transparent', color: 'brand.muted',
                            fontWeight: '600', fontSize: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            transition: 'all 0.2s', _active: { bg: 'bg.softCotton' }
                        })}
                    >
                        오프라인 모드 유지
                    </button>
                </div>
            </div>
        </div>
    )
}
