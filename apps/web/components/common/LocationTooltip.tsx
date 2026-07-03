'use client'

import React, { useState, useEffect, useRef } from 'react'
import { css } from 'styled-system/css'
import { MapPin, Loader2, Info, X, ExternalLink } from 'lucide-react'
import { LocationService } from '@/services/ExternalApiService'

interface LocationTooltipProps {
    locationName: string
    address?: string
    lat?: number
    lng?: number
    className?: string
    onOpenChange?: (isOpen: boolean) => void
}

interface MapLaunchOption {
    id: string
    label: string
    shortLabel: string
    color: string
    appUrl: string
    fallbackUrl: string
}

function useIsMobileViewport() {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return

        const mediaQuery = window.matchMedia('(max-width: 767px)')
        const update = () => setIsMobile(mediaQuery.matches)
        update()

        mediaQuery.addEventListener('change', update)
        return () => mediaQuery.removeEventListener('change', update)
    }, [])

    return isMobile
}

function buildMapLaunchOptions(query: string, locationName: string, lat?: number, lng?: number): MapLaunchOption[] {
    const encodedQuery = encodeURIComponent(query)
    const encodedName = encodeURIComponent(locationName || query)
    const hasCoordinates = lat != null && lng != null
    const coordinateQuery = hasCoordinates ? `${lat},${lng}` : encodedQuery

    return [
        {
            id: 'naver',
            label: '네이버 지도',
            shortLabel: 'N',
            color: '#03C75A',
            appUrl: `nmap://search?query=${encodedQuery}&appname=xyz.nexvoy.app`,
            fallbackUrl: `https://map.naver.com/p/search/${encodedQuery}`,
        },
        {
            id: 'kakao',
            label: '카카오내비',
            shortLabel: 'K',
            color: '#FEE500',
            appUrl: hasCoordinates
                ? `kakaonavi://navigate?coord_type=wgs84&name=${encodedName}&x=${lng}&y=${lat}`
                : `kakaomap://search?q=${encodedQuery}`,
            fallbackUrl: `https://map.kakao.com/link/search/${encodedQuery}`,
        },
        {
            id: 'tmap',
            label: 'T맵',
            shortLabel: 'T',
            color: '#0B5CFF',
            appUrl: hasCoordinates
                ? `tmap://route?rGoName=${encodedName}&rGoX=${lng}&rGoY=${lat}`
                : `tmap://search?name=${encodedQuery}`,
            fallbackUrl: `https://www.tmap.co.kr/my_tmap/my_map_tip/map_tip.do?searchKeyword=${encodedQuery}`,
        },
        {
            id: 'google',
            label: 'Google Maps',
            shortLabel: 'G',
            color: '#4285F4',
            appUrl: `https://www.google.com/maps/search/?api=1&query=${coordinateQuery}`,
            fallbackUrl: `https://www.google.com/maps/search/?api=1&query=${coordinateQuery}`,
        },
    ]
}

export default function LocationTooltip({ locationName, address: initialAddress, lat, lng, className, onOpenChange }: LocationTooltipProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [address, setAddress] = useState<string | null>(initialAddress || null)
    const [loading, setLoading] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const isMobile = useIsMobileViewport()

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
                onOpenChange?.(false)
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen, onOpenChange])

    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
                onOpenChange?.(false)
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onOpenChange])

    const loadAddress = async () => {
        if (address || loading) return

        if (initialAddress) {
            setAddress(initialAddress)
        } else if (lat != null && lng != null) {
            setLoading(true)
            try {
                const data = await LocationService.getAddress(lat, lng)
                if (data.status === 'OK' && data.results.length > 0) {
                    setAddress(data.results[0].formatted_address)
                } else {
                    setAddress('주소를 불러올 수 없습니다.')
                }
            } catch (err) {
                setAddress('주소 로딩 오류가 발생했습니다.')
            } finally {
                setLoading(false)
            }
        } else {
            setAddress('상세 주소 정보가 없습니다.')
        }
    }

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation()

        // 데스크톱 툴팁은 상세 주소 조회가 가능한 경우에만 노출한다.
        if (!isMobile && !initialAddress && (lat == null || lng == null)) {
            alert('자세한 주소 정보가 없습니다.')
            return
        }

        const nextOpen = !isOpen
        setIsOpen(nextOpen)
        onOpenChange?.(nextOpen)

        if (nextOpen) {
            void loadAddress()
        }
    }

    const handleClose = () => {
        setIsOpen(false)
        onOpenChange?.(false)
    }

    const handleLaunchMap = (option: MapLaunchOption) => {
        const isWebUrl = option.appUrl.startsWith('http')
        if (isWebUrl) {
            window.open(option.appUrl, '_blank', 'noopener,noreferrer')
            return
        }

        const launchedAt = Date.now()
        const fallbackTimer = window.setTimeout(() => {
            if (document.visibilityState === 'visible' && Date.now() - launchedAt < 1800) {
                window.location.href = option.fallbackUrl
            }
        }, 900)

        const clearFallback = () => window.clearTimeout(fallbackTimer)
        window.addEventListener('pagehide', clearFallback, { once: true })
        document.addEventListener('visibilitychange', clearFallback, { once: true })
        window.location.href = option.appUrl
    }

    const resolvedAddress = address || initialAddress || '주소를 가져오는 중...'
    const searchQuery = address && !address.includes('불러올 수') && !address.includes('오류') && !address.includes('없습니다')
        ? address
        : locationName
    const mapOptions = buildMapLaunchOptions(searchQuery, locationName, lat, lng)

    return (
        <div ref={containerRef} className={css({ position: 'relative', display: 'inline-flex', alignItems: 'center' })}>
            <button
                onClick={handleToggle}
                className={className || css({ 
                    fontSize: '14px', color: '#717171', display: 'flex', alignItems: 'center', gap: '4px',
                    bg: 'transparent', border: 'none', cursor: 'pointer', p: 0, m: 0,
                    transition: 'all 0.2s', _hover: { color: '#3B82F6' }
                })}
                title={isMobile ? '주소와 지도 앱 열기' : '클릭하여 현지 주소 보기'}
                aria-label={isMobile ? `${locationName} 주소와 지도 앱 열기` : `${locationName} 현지 주소 보기`}
                aria-expanded={isOpen}
                type="button"
            >
                <MapPin size={14} className={css({ flexShrink: 0 })} /> 
                <span className={css({ textDecoration: 'underline', textDecorationStyle: 'dashed', textUnderlineOffset: '4px' })}>
                    {locationName}
                </span>
            </button>

            {isOpen && !isMobile && (
                <div className={css({
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    mt: '8px',
                    bg: '#222',
                    color: 'white',
                    p: '12px 16px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    minW: '220px',
                    maxW: '280px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    zIndex: 50,
                    textAlign: 'left',
                    wordBreak: 'keep-all',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                })}>
                    {/* Tooltip 화살표 */}
                    <div className={css({
                        position: 'absolute',
                        top: '-6px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        w: 0, h: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderBottom: '6px solid #222'
                    })} />
                    
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontWeight: 'bold' })}>
                        <Info size={14} /> 현지 주소 (한국어)
                    </div>

                    <div className={css({ color: '#EBEBEB' })}>
                        {loading ? (
                            <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', py: '4px' })}>
                                <Loader2 size={14} className={css({ animation: 'spin 1s linear infinite' })} /> 주소를 가져오는 중...
                            </div>
                        ) : (
                            address
                        )}
                    </div>
                </div>
            )}

            {isOpen && isMobile && (
                <div
                    className={css({
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10000,
                        bg: 'rgba(0, 0, 0, 0.45)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                    })}
                    onClick={handleClose}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="location-map-modal-title"
                        className={css({
                            bg: 'white',
                            w: '100%',
                            maxW: '480px',
                            borderRadius: '20px 20px 0 0',
                            boxShadow: '0 -8px 32px rgba(15, 23, 42, 0.18)',
                            px: '20px',
                            pt: '12px',
                            pb: 'calc(20px + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))',
                            maxH: 'min(86vh, 560px)',
                            overflowY: 'auto',
                            animation: 'slideUp 0.24s ease-out',
                        })}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className={css({ display: 'flex', justifyContent: 'center', pb: '12px' })}>
                            <div className={css({ w: '40px', h: '4px', bg: '#E2E8F0', borderRadius: '999px' })} />
                        </div>

                        <div className={css({ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', mb: '18px' })}>
                            <div className={css({ minW: 0 })}>
                                <p id="location-map-modal-title" className={css({ fontSize: '13px', fontWeight: '700', color: '#64748B', mb: '6px' })}>
                                    장소 정보
                                </p>
                                <h3 className={css({ fontSize: '18px', fontWeight: '800', color: '#1E293B', lineHeight: 1.35 })}>
                                    {locationName}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={handleClose}
                                aria-label="주소 모달 닫기"
                                className={css({
                                    w: '36px',
                                    h: '36px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    bg: '#F8FAFF',
                                    color: '#64748B',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    _active: { transform: 'scale(0.94)' },
                                })}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className={css({
                            p: '16px',
                            borderRadius: '16px',
                            border: '1px solid #E2E8F0',
                            bg: '#F8FAFF',
                            mb: '20px',
                        })}>
                            <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', color: '#1E293B', fontWeight: '800', fontSize: '14px', mb: '8px' })}>
                                <Info size={15} />
                                상세 주소
                            </div>
                            <p className={css({ color: '#64748B', fontSize: '14px', lineHeight: 1.6, wordBreak: 'keep-all' })}>
                                {loading ? (
                                    <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '6px' })}>
                                        <Loader2 size={14} className={css({ animation: 'spin 1s linear infinite' })} />
                                        주소를 가져오는 중...
                                    </span>
                                ) : (
                                    resolvedAddress
                                )}
                            </p>
                        </div>

                        <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '10px' })}>
                            <h4 className={css({ fontSize: '15px', fontWeight: '800', color: '#1E293B' })}>
                                지도 앱으로 열기
                            </h4>
                            <span className={css({ fontSize: '12px', color: '#94A3B8' })}>모바일 전용</span>
                        </div>

                        <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' })}>
                            {mapOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleLaunchMap(option)}
                                    disabled={loading}
                                    aria-label={`${option.label}에서 ${locationName} 검색`}
                                    className={css({
                                        minH: '58px',
                                        borderRadius: '16px',
                                        border: '1px solid #E2E8F0',
                                        bg: 'white',
                                        px: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        _active: { transform: 'scale(0.97)' },
                                        _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                                    })}
                                >
                                    <span className={css({
                                        w: '34px',
                                        h: '34px',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: option.id === 'kakao' ? '#1E293B' : 'white',
                                        bg: option.color,
                                        fontSize: '15px',
                                        fontWeight: '900',
                                        flexShrink: 0,
                                    })}>
                                        {option.shortLabel}
                                    </span>
                                    <span className={css({ flex: 1, minW: 0 })}>
                                        <span className={css({ display: 'block', color: '#1E293B', fontSize: '14px', fontWeight: '800' })}>
                                            {option.label}
                                        </span>
                                        <span className={css({ display: 'block', color: '#94A3B8', fontSize: '12px', mt: '2px' })}>
                                            주소 검색
                                        </span>
                                    </span>
                                    <ExternalLink size={14} className={css({ color: '#94A3B8', flexShrink: 0 })} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
