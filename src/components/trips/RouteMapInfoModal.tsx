'use client'

import { useCallback } from 'react'
import { css } from 'styled-system/css'
import { Navigation2, Eye, CheckCircle2, Circle, X } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useModalBackButton } from '@/hooks/useModalBackButton'
import { useBottomSheetDrag } from '@/hooks/useBottomSheetDrag'

interface RouteMapInfoModalProps {
    plan: {
        id: string
        title: string
        location?: string
        address?: string
        start_datetime_local?: string
        memo?: string
        is_visited: boolean
        location_lat?: number
        location_lng?: number
    }
    onClose: () => void
    onToggleVisit: (planId: string, isVisited: boolean) => void
    onDetail: (plan: RouteMapInfoModalProps['plan']) => void
    userRole: 'owner' | 'editor' | 'viewer' | null
}

function formatTimeDisplay(dateString?: string): string {
    if (!dateString) return ''
    try {
        const localIso = dateString.replace(' ', 'T')
        const timePart = localIso.split('T')[1]
        if (!timePart) return ''
        const [h, m] = timePart.split(':')
        const hour = parseInt(h, 10)
        const ampm = hour < 12 ? '오전' : '오후'
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
        return `${ampm} ${String(displayHour).padStart(2, '0')}:${m}`
    } catch {
        return ''
    }
}

export default function RouteMapInfoModal({
    plan,
    onClose,
    onToggleVisit,
    onDetail,
    userRole,
}: RouteMapInfoModalProps) {
    const handleClose = useCallback(() => {
        onClose()
    }, [onClose])

    const { handleRef: dragHandleRef, dragY, isDragging } = useBottomSheetDrag(handleClose)

    useModalBackButton(true, handleClose, `routeMapInfo_${plan.id}`)

    const timeStr = formatTimeDisplay(plan.start_datetime_local)

    const handleNavigate = () => {
        if (!plan.location_lat || !plan.location_lng) return
        const url = `https://www.google.com/maps/dir/?api=1&destination=${plan.location_lat},${plan.location_lng}`
        if (Capacitor.isNativePlatform()) {
            window.open(url, '_system')
        } else {
            window.open(url, '_blank')
        }
    }

    const handleDetail = () => {
        onDetail(plan)
        onClose()
    }

    const canEdit = userRole === 'owner' || userRole === 'editor'

    return (
        <div
            className={css({
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 200,
                animation: 'slideUp 0.3s ease-out',
            })}
            style={{
                transform: `translateY(${dragY}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease',
            }}
        >
            <div
                className={css({
                    bg: 'white',
                    borderRadius: '20px 20px 0 0',
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
                    px: '20px',
                    pb: 'calc(20px + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))',
                    maxH: '320px',
                })}
            >
                {/* Handle bar */}
                <div ref={dragHandleRef} className={css({
                    display: 'flex',
                    justifyContent: 'center',
                    py: '12px',
                    cursor: 'ns-resize',
                    touchAction: 'none',
                })}>
                    <div
                        className={css({
                            w: '40px',
                            h: '4px',
                            bg: 'brand.border',
                            borderRadius: '2px',
                        })}
                    />
                </div>

                {/* Header: Title + Close */}
                <div className={css({ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: '8px' })}>
                    <div className={css({ flex: 1, minW: 0 })}>
                        <h3
                            className={css({
                                fontSize: '17px',
                                fontWeight: '700',
                                color: 'brand.secondary',
                                lineHeight: '1.4',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            })}
                        >
                            {plan.title}
                        </h3>
                        {plan.address && (
                            <p
                                className={css({
                                    fontSize: '13px',
                                    color: 'brand.muted',
                                    mt: '2px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                })}
                            >
                                {plan.address}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            w: '32px',
                            h: '32px',
                            borderRadius: '50%',
                            border: 'none',
                            bg: 'bg.softCotton',
                            cursor: 'pointer',
                            flexShrink: 0,
                            ml: '12px',
                            transition: 'all 0.2s',
                            _hover: { bg: 'brand.border' },
                            _active: { transform: 'scale(0.9)' },
                        })}
                        aria-label="닫기"
                    >
                        <X size={16} className={css({ color: 'brand.muted' })} />
                    </button>
                </div>

                {/* Time + Visit toggle */}
                <div className={css({ display: 'flex', alignItems: 'center', gap: '12px', mb: '12px' })}>
                    {timeStr && (
                        <span className={css({ fontSize: '13px', color: 'brand.muted', fontWeight: '600' })}>
                            {timeStr}
                        </span>
                    )}
                    {canEdit && (
                        <button
                            onClick={() => onToggleVisit(plan.id, !plan.is_visited)}
                            className={css({
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                border: 'none',
                                bg: 'transparent',
                                cursor: 'pointer',
                                px: '0',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: plan.is_visited ? 'brand.primary' : 'brand.muted',
                                transition: 'all 0.2s',
                                _active: { transform: 'scale(0.95)' },
                            })}
                        >
                            {plan.is_visited ? (
                                <CheckCircle2 size={18} strokeWidth={2.5} />
                            ) : (
                                <Circle size={18} />
                            )}
                            {plan.is_visited ? '방문 완료' : '방문 전'}
                        </button>
                    )}
                </div>

                {/* Memo (max 2 lines) */}
                {plan.memo && (
                    <p
                        className={css({
                            fontSize: '13px',
                            color: 'brand.muted',
                            lineHeight: '1.5',
                            mb: '16px',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            lineClamp: 2,
                        })}
                        style={{ WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                    >
                        {plan.memo}
                    </p>
                )}

                {/* Action buttons */}
                <div className={css({ display: 'flex', gap: '8px' })}>
                    {plan.location_lat && plan.location_lng && (
                        <button
                            onClick={handleNavigate}
                            className={css({
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                flex: 1,
                                h: '44px',
                                bg: 'white',
                                color: 'brand.secondary',
                                border: '1px solid',
                                borderColor: 'brand.border',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                _hover: { bg: 'bg.softCotton', borderColor: 'brand.primary' },
                                _active: { transform: 'scale(0.96)' },
                            })}
                        >
                            <Navigation2 size={16} />
                            길찾기
                        </button>
                    )}
                    <button
                        onClick={handleDetail}
                        className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            flex: 1,
                            h: '44px',
                            bg: 'brand.primary',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            _hover: { bg: 'brand.primaryDark' },
                            _active: { transform: 'scale(0.96)' },
                        })}
                    >
                        <Eye size={16} />
                        상세보기
                    </button>
                </div>
            </div>
        </div>
    )
}
