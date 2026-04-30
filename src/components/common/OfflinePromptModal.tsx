'use client'

import { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { WifiOff, ChevronRight, X } from 'lucide-react'
import { useNetworkStore } from '@/stores/useNetworkStore'
import { useRouter, usePathname } from 'next/navigation'
import { Capacitor } from '@capacitor/core'

export default function OfflinePromptModal() {
    const { isOnline, isOfflineMode, setOfflineMode } = useNetworkStore()
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()
    const pathname = usePathname() || '/'
    const isNative = Capacitor.isNativePlatform()

    // 오프라인 상태이고, 아직 오프라인 모드가 아니며, 네이티브 환경일 때 모달 노출
    useEffect(() => {
        if (!isOnline && !isOfflineMode && isNative) {
            setIsOpen(true)
        } else {
            setIsOpen(false)
        }
    }, [isOnline, isOfflineMode, isNative])

    const handleSwitch = () => {
        setOfflineMode(true)
        setIsOpen(false)
        
        // 현재 경로에 따라 오프라인 전용 페이지로 전환
        if (pathname.includes('/trips/detail/')) {
            const id = pathname.split('/').filter(Boolean).pop()
            router.push(`/offline/trips/detail/?id=${id}&tab=plans`)
        } else if (pathname.includes('/trips/checklist/')) {
            const id = pathname.split('/').filter(Boolean).pop()
            router.push(`/offline/trips/detail/?id=${id}&tab=checklist`)
        } else {
            router.push('/profile?openDownloads=true')
        }
    }

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: '20px',
            bg: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease-out',
        })}>
            <div className={css({
                bg: 'white',
                w: '100%',
                maxW: '340px',
                borderRadius: '24px',
                p: '32px 24px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                position: 'relative',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            })}>
                <button 
                    onClick={() => setIsOpen(false)}
                    className={css({
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        p: '8px',
                        color: 'brand.muted',
                        bg: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        _active: { transform: 'scale(0.9)' }
                    })}
                >
                    <X size={20} />
                </button>

                <div className={css({
                    w: '64px',
                    h: '64px',
                    bg: 'brand.errorLight',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: '20px',
                    color: 'brand.error'
                })}>
                    <WifiOff size={32} />
                </div>

                <h3 className={css({
                    fontSize: '19px',
                    fontWeight: '700',
                    color: 'brand.secondary',
                    mb: '12px',
                    textAlign: 'center'
                })}>
                    네트워크 연결 확인
                </h3>
                
                <p className={css({
                    fontSize: '15px',
                    color: 'brand.muted',
                    textAlign: 'center',
                    lineHeight: 1.6,
                    mb: '28px',
                    wordBreak: 'keep-all'
                })}>
                    인터넷 연결이 원활하지 않습니다.<br />
                    다운로드된 여행 정보를<br />
                    <strong>오프라인 모드</strong>에서 확인하시겠습니까?
                </p>

                <div className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    w: '100%'
                })}>
                    <button
                        onClick={handleSwitch}
                        className={css({
                            w: '100%',
                            py: '14px',
                            bg: 'brand.primary',
                            color: 'white',
                            fontWeight: '700',
                            fontSize: '16px',
                            borderRadius: '16px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s',
                            _active: { transform: 'scale(0.98)', opacity: 0.9 }
                        })}
                    >
                        오프라인 모드 전환
                        <ChevronRight size={18} />
                    </button>
                    
                    <button
                        onClick={() => setIsOpen(false)}
                        className={css({
                            w: '100%',
                            py: '12px',
                            bg: 'transparent',
                            color: 'brand.muted',
                            fontWeight: '600',
                            fontSize: '14px',
                            borderRadius: '12px',
                            border: 'none',
                            cursor: 'pointer',
                            _active: { color: 'brand.secondary' }
                        })}
                    >
                        다음에 하기
                    </button>
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    )
}
