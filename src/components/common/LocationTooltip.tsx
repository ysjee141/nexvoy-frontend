'use client'

import React, { useState, useEffect, useRef } from 'react'
import { css } from 'styled-system/css'
import { MapPin, Loader2, Info } from 'lucide-react'

interface LocationTooltipProps {
    locationName: string
    lat?: number
    lng?: number
    className?: string
}

export default function LocationTooltip({ locationName, lat, lng, className }: LocationTooltipProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [address, setAddress] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation()
        
        // 위경도가 없으면 툴팁을 띄울 필요가 없음
        if (!lat || !lng) {
            alert('자세한 주소 정보가 없습니다.')
            return
        }

        if (!isOpen && !address && !loading) {
            setLoading(true)
            try {
                const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=ko&key=${apiKey}`)
                const data = await res.json()
                
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
        }
        setIsOpen(!isOpen)
    }

    return (
        <div ref={containerRef} className={css({ position: 'relative', display: 'inline-flex', alignItems: 'center' })}>
            <button
                onClick={handleToggle}
                className={className || css({ 
                    fontSize: '14px', color: '#717171', display: 'flex', alignItems: 'center', gap: '4px',
                    bg: 'transparent', border: 'none', cursor: 'pointer', p: 0, m: 0,
                    transition: 'all 0.2s', _hover: { color: '#3B82F6' }
                })}
                title="클릭하여 현지 주소 보기"
                type="button"
            >
                <MapPin size={14} className={css({ flexShrink: 0 })} /> 
                <span className={css({ textDecoration: 'underline', textDecorationStyle: 'dashed', textUnderlineOffset: '4px' })}>
                    {locationName}
                </span>
            </button>

            {isOpen && (
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
        </div>
    )
}
