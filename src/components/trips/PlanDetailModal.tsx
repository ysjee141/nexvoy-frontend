'use client'

import { useEffect, useState, useCallback } from 'react'
import { css } from 'styled-system/css'
import {
    X, ChevronLeft, MapPin, Clock, Wallet, FileText, Globe,
    Pencil, Trash2, BookOpen, ExternalLink, Link2, Bell,
    Circle, CheckCircle2
} from 'lucide-react'
import { getCurrencyFromTimezone, formatCurrency, formatKRW } from '@/utils/currency'
import { useNetworkStore } from '@/stores/useNetworkStore'
import { useModalBackButton } from '@/hooks/useModalBackButton'
import { useScrollLock } from '@/hooks/useScrollLock'
import UrlPreviewCard from '@/components/common/UrlPreviewCard'
// ── Main Modal ──
interface PlanDetailModalProps {
    plan: any
    exchangeRates: Record<string, number>
    formatLocalTime: (d: string) => string
    formatKstTime: (d: string, tz: string) => string
    timeDisplayMode: 'local' | 'kst' | 'both'
    userRole: 'owner' | 'editor' | 'viewer' | null
    onClose: () => void
    onEdit: (plan: any) => void
    onDelete: (id: string) => void
    onToggleVisit: (planId: string, isVisited: boolean) => void
}

export default function PlanDetailModal({
    plan, exchangeRates, formatLocalTime, formatKstTime, timeDisplayMode,
    userRole, onClose, onEdit, onDelete, onToggleVisit,
}: PlanDetailModalProps) {
    const [tab, setTab] = useState<'info' | 'refs'>('info')
    const [mapError, setMapError] = useState(false)
    const [mapLoaded, setMapLoaded] = useState(false)
    const { isOnline } = useNetworkStore()

    const handleClose = useCallback(() => {
        setTab('info')
        onClose()
    }, [onClose])

    useModalBackButton(true, handleClose, `planDetail_${plan.id}`)

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [handleClose])

    useScrollLock(true)

    const currency = getCurrencyFromTimezone(plan.timezone_string || 'Asia/Seoul')
    const localAmount = plan.cost > 0 ? formatCurrency(plan.cost, currency) : null
    const rate = exchangeRates[currency.code]
    const krwAmount = localAmount && rate ? Math.round(plan.cost * rate) : null

    const localTime = formatLocalTime(plan.start_datetime_local)
    const kstTime = formatKstTime(plan.start_datetime_local, plan.timezone_string || 'Asia/Seoul')

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const encodedLocation = plan.location ? encodeURIComponent(plan.location) : ''
    
    let embedUrl = null
    let mapUrl = null
    
    if (apiKey && plan.location) {
        if (plan.google_place_id) {
            embedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=place_id:${plan.google_place_id}&language=ko`
            mapUrl = `https://www.google.com/maps/search/?api=1&query=${plan.location_lat},${plan.location_lng}&query_place_id=${plan.google_place_id}`
        } else if (plan.location_lat && plan.location_lng) {
            embedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${plan.location_lat},${plan.location_lng}&language=ko`
            mapUrl = `https://www.google.com/maps/search/?api=1&query=${plan.location_lat},${plan.location_lng}`
        } else {
            embedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedLocation}&language=ko`
            mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`
        }
    }

    // plan_urls 파싱 (다양한 형태 처리)
    const planUrls: string[] = (() => {
        const raw = plan.plan_urls
        if (!raw) return []
        if (Array.isArray(raw)) return raw.map((pu: any) => (typeof pu === 'string' ? pu : pu.url)).filter(Boolean)
        return []
    })()

    const hasRefs = planUrls.length > 0



    return (
        <div
            className={css({
                position: 'fixed', inset: 0, zIndex: 2000,
                bg: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: { base: 'flex-end', sm: 'center' },
                justifyContent: 'center',
                p: { base: '0', sm: '20px' },
                backdropFilter: 'blur(10px)',
                animation: 'fadeIn 0.3s ease-out',
                overscrollBehavior: 'none',
                touchAction: 'none',
            })}
            onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
            <div
                className={css({
                    bg: 'white',
                    w: '100%',
                    maxW: { base: '100%', sm: '620px' },
                    h: { base: '100dvh', sm: 'auto' },
                    maxH: { base: '100dvh', sm: '92vh' },
                    borderRadius: { base: '0', sm: '16px' },
                    boxShadow: { base: 'none', sm: 'airbnbHover' },
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)',
                    pt: { base: 'max(env(safe-area-inset-top), var(--safe-area-inset-top))', sm: '0' },
                    pb: { base: 'max(env(safe-area-inset-bottom), var(--safe-area-inset-bottom))', sm: '0' },
                })}
            >
                {/* ── 헤더 & 히어로 섹션 ── */}
                <div className={css({ 
                    position: 'relative', 
                    h: plan.image_url ? { base: '240px', sm: '260px' } : { base: '140px', sm: '160px' },
                    flexShrink: 0,
                    overflow: 'hidden',
                    bg: 'brand.primary',
                })}>
                    {plan.image_url && (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                                src={plan.image_url} 
                                alt={plan.title} 
                                className={css({ w: '100%', h: '100%', objectFit: 'cover' })} 
                            />
                            <div className={css({ 
                                position: 'absolute', inset: 0, 
                                background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.7) 100%)' 
                            })} />
                        </>
                    )}

                    {/* 상단 액션 바 (뒤로가기, 닫기, 수정/삭제) */}
                    <div className={css({
                        position: 'absolute', top: 0, left: 0, right: 0,
                        p: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        zIndex: 20,
                        pt: { base: 'calc(max(env(safe-area-inset-top), var(--safe-area-inset-top)) + 12px)', sm: '20px' },
                    })}>
                        <button
                            onClick={handleClose}
                            className={css({
                                display: { base: 'flex', sm: 'none' },
                                alignItems: 'center', gap: '4px',
                                bg: 'rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer',
                                color: 'white', fontWeight: '700', fontSize: '15px', px: '12px', py: '6px',
                                borderRadius: '20px', backdropFilter: 'blur(10px)',
                            })}
                        >
                            <ChevronLeft size={20} strokeWidth={3} /> 뒤로
                        </button>

                        <div className={css({ display: 'flex', gap: '8px', ml: 'auto' })}>
                            {(userRole === 'owner' || userRole === 'editor') && (
                                <>
                                    <button onClick={() => { onEdit(plan); handleClose() }} 
                                        className={css({ bg: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', color: 'white', p: '10px', borderRadius: '50%', backdropFilter: 'blur(10px)', transition: 'all 0.2s', _hover: { bg: 'white/30' } })}>
                                        <Pencil size={18} />
                                    </button>
                                    <button onClick={() => { onDelete(plan.id); handleClose() }}
                                        className={css({ bg: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', color: 'white', p: '10px', borderRadius: '50%', backdropFilter: 'blur(10px)', transition: 'all 0.2s', _hover: { bg: 'brand.error/40' } })}>
                                        <Trash2 size={18} />
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleClose}
                                className={css({
                                    display: { base: 'none', sm: 'flex' },
                                    alignItems: 'center', justifyContent: 'center',
                                    bg: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                                    w: '38px', h: '38px', cursor: 'pointer', color: 'white',
                                    backdropFilter: 'blur(10px)', transition: 'all 0.2s',
                                    _hover: { bg: 'white/30', transform: 'rotate(90deg)' },
                                })}
                            >
                                <X size={20} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    {/* 히어로 텍스트 (Title & Location) */}
                    <div className={css({
                        position: 'absolute', bottom: '24px', left: '24px', right: '24px',
                        zIndex: 15, color: 'white'
                    })}>
                        <div className={css({ display: 'flex', alignItems: 'center', gap: '8px', mb: '10px' })}>
                            <div className={css({ 
                                px: '10px', py: '4px', bg: 'brand.primary', color: 'white', 
                                borderRadius: '8px', fontSize: '11px', fontWeight: '800', 
                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                            })}>
                                {plan.location || '장소 지정 안됨'}
                            </div>
                        </div>
                        <h2 className={css({
                            fontSize: { base: '26px', sm: '32px' },
                            fontWeight: '900',
                            lineHeight: 1.2,
                            textShadow: '0 2px 15px rgba(0,0,0,0.4)',
                            wordBreak: 'break-word'
                        })}>
                            {plan.title}
                        </h2>
                        {(userRole === 'owner' || userRole === 'editor') && (
                            <button
                                onClick={() => onToggleVisit(plan.id, !plan.is_visited)}
                                className={css({
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    mt: '10px',
                                    bg: 'rgba(255,255,255,0.15)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'white',
                                    px: '12px',
                                    py: '6px',
                                    borderRadius: '20px',
                                    backdropFilter: 'blur(10px)',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    transition: 'all 0.2s',
                                    opacity: plan.is_visited ? 0.8 : 1,
                                    _hover: { bg: 'rgba(255,255,255,0.25)' }
                                })}
                                aria-label={plan.is_visited ? '방문 취소' : '방문 완료'}
                            >
                                {plan.is_visited
                                    ? <CheckCircle2 size={16} />
                                    : <Circle size={16} />
                                }
                                {plan.is_visited ? '방문 완료' : '방문 전'}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── 탭 바 ── */}
                <div className={css({
                    display: 'flex', flexShrink: 0,
                    borderBottom: '1px solid', borderColor: 'brand.hairline',
                    bg: 'white',
                    px: '8px',
                })}>
                    {(['info', 'refs'] as const).map(t => {
                        const labels = { info: '기본 정보', refs: '참고자료' }
                        const icons = { info: <Globe size={15} />, refs: <BookOpen size={15} /> }
                        const isActive = tab === t
                        return (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={css({
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '6px', py: '14px',
                                    bg: 'transparent', border: 'none', cursor: 'pointer',
                                    fontSize: '14px', fontWeight: isActive ? '900' : '600',
                                    color: isActive ? 'brand.primary' : 'brand.muted',
                                    position: 'relative',
                                    transition: 'all 0.2s',
                                    _after: {
                                        content: '""',
                                        position: 'absolute',
                                        bottom: 0,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: isActive ? '40%' : '0%',
                                        height: '3px',
                                        bg: 'brand.primary',
                                        borderRadius: '3px 3px 0 0',
                                        transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)',
                                    }
                                })}
                            >
                                {icons[t]}
                                {labels[t]}
                                {t === 'refs' && hasRefs && (
                                    <span className={css({
                                        bg: 'brand.primary',
                                        color: 'white',
                                        fontSize: '10px', fontWeight: '700',
                                        px: '6px', py: '1.5px', borderRadius: '8px',
                                        ml: '2px',
                                    })}>
                                        {planUrls.length}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* ── 본문 ── */}
                <div className={css({ 
                    overflowY: 'auto', 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column',
                    overscrollBehavior: 'contain',
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-y',
                })}>

                    {/* ▸ 기본 정보 탭 */}
                    {tab === 'info' && (
                        <>
                            {/* 지도 */}
                            {plan.location && (
                                <div className={css({ flexShrink: 0 })}>
                                    {embedUrl && !mapError ? (
                                        <div style={{ position: 'relative', height: 220, overflow: 'hidden' }}>
                                            {/* 스켈레톤: 지도 로드 전 shimmer 플레이스홀더 */}
                                            {!mapLoaded && (
                                                <div style={{
                                                    position: 'absolute', inset: 0, zIndex: 1,
                                                    background: 'var(--colors-bg-softCotton)',
                                                    display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', justifyContent: 'center', gap: 10,
                                                }}>
                                                    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.3 }} aria-hidden>
                                                        <defs>
                                                            <pattern id="mapgrid" width="36" height="36" patternUnits="userSpaceOnUse">
                                                                <path d="M 36 0 L 0 0 0 36" fill="none" stroke="var(--colors-brand-primary)" strokeWidth="0.7" />
                                                            </pattern>
                                                        </defs>
                                                        <rect width="100%" height="100%" fill="url(#mapgrid)" />
                                                    </svg>
                                                    <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                                        <div style={{
                                                            width: 44, height: 44, borderRadius: '50%',
                                                            background: 'rgba(var(--colors-brand-primary-rgb), 0.18)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            animation: 'pulse 1.4s ease-in-out infinite',
                                                        }}>
                                                            <MapPin size={24} color="var(--colors-brand-primary)" />
                                                        </div>
                                                        <span style={{ fontSize: 12, color: 'var(--colors-brand-primary)', fontWeight: 700, letterSpacing: 0.3 }}>지도 불러오는 중...</span>
                                                    </div>
                                                </div>
                                            )}
                                            <iframe
                                                src={embedUrl}
                                                width="100%" height="220"
                                                style={{
                                                    border: 0, display: 'block',
                                                    opacity: mapLoaded ? 1 : 0,
                                                    transition: 'opacity 0.5s ease',
                                                }}
                                                allowFullScreen loading="lazy"
                                                referrerPolicy="no-referrer-when-downgrade"
                                                onLoad={() => setMapLoaded(true)}
                                                onError={() => setMapError(true)}
                                                title="지도"
                                            />
                                        </div>
                                    ) : (
                                        <div className={css({ w: '100%', h: '140px', bg: 'bg.softCotton', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' })}>
                                            <MapPin size={24} color="brand.primary" />
                                            <span className={css({ fontSize: '13px', color: 'brand.muted' })}>{plan.location}</span>
                                        </div>
                                    )}
                                </div>

                            )}

                                <div className={css({ 
                                    display: 'flex', flexDirection: 'column', gap: '24px',
                                    p: { base: '20px 24px', sm: '24px 32px' } 
                                })}>
                                    {/* 상세 구역 구분선 */}
                                    <div className={css({ h: '4px', w: '40px', bg: 'brand.primary/20', borderRadius: '2px', mb: '4px' })} />

                                <div className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>

                                    {/* 장소 */}
                                    {plan.location && (
                                        <InfoRow 
                                            icon={<MapPin size={18} className={css({ color: 'brand.primary' })} />} 
                                            label="장소"
                                            bgColor="bg.softCotton"
                                            value={
                                                <div className={css({ display: 'flex', flexDirection: 'column', gap: '4px' })}>
                                                    {mapUrl ? (
                                                        <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                                                            className={css({ fontSize: '15.5px', color: 'brand.ink', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none', wordBreak: 'break-word', _hover: { textDecoration: 'underline' } })}>
                                                            {plan.location}<ExternalLink size={13} style={{ flexShrink: 0 }} />
                                                        </a>
                                                    ) : (
                                                        <span className={css({ fontSize: '15.5px', color: 'brand.ink', fontWeight: '700' })}>{plan.location}</span>
                                                    )}
                                                    {plan.address && (
                                                        <span className={css({ fontSize: '13px', color: 'brand.muted', fontWeight: '500' })}>{plan.address}</span>
                                                    )}
                                                </div>
                                            }
                                        />
                                    )}

                                    {/* 시간 */}
                                    <InfoRow 
                                        icon={<Clock size={18} className={css({ color: 'brand.primary' })} />} 
                                        label="시간"
                                        bgColor="rgba(37, 99, 235, 0.05)"
                                        value={
                                            <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px', w: '100%' })}>
                                                <div className={css({ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', flexWrap: 'wrap' })}>
                                                    <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '5px' })}>
                                                        <span className={css({ fontSize: '12px', color: 'brand.muted', fontWeight: '600' })}>현지</span>
                                                        <span className={css({ fontSize: '14px', fontWeight: '600', color: 'brand.ink', bg: 'bg.softCotton', px: '10px', py: '5px', borderRadius: '8px', border: '1px solid', borderColor: 'brand.hairline' })}>{localTime}</span>
                                                    </span>
                                                    <span className={css({ color: 'brand.hairline', fontSize: '12px' })}>|</span>
                                                    <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '5px' })}>
                                                        <span className={css({ fontSize: '12px', color: 'brand.muted', fontWeight: '600' })}>한국</span>
                                                        <span className={css({ fontSize: '14px', fontWeight: '700', color: 'brand.primary', bg: 'brand.primary/5', px: '10px', py: '5px', borderRadius: '8px', border: '1px solid', borderColor: 'brand.primary/10' })}>{kstTime}</span>
                                                    </span>
                                                </div>
                                                {plan.end_datetime_local && (
                                                    <div className={css({ fontSize: '13px', color: 'brand.muted', fontWeight: '500', pl: '4px' })}>
                                                        ⏳ 체류 시간: {(() => {
                                                            const s = new Date(plan.start_datetime_local).getTime()
                                                            const e = new Date(plan.end_datetime_local).getTime()
                                                            const diffHrs = (e - s) / (1000 * 60 * 60)
                                                            if (diffHrs < 1) return `${Math.round(diffHrs * 60)}분`
                                                            return `${diffHrs.toFixed(1)}시간`
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        }
                                    />

                                    {/* 알림 설정 */}
                                    {plan.alarm_minutes_before !== undefined && (
                                        <InfoRow 
                                            icon={<Bell size={18} className={css({ color: '#F59E0B' })} />} 
                                            label="알림 설정"
                                            bgColor="rgba(245, 158, 11, 0.05)"
                                            value={
                                                <span className={css({ fontSize: '14px', fontWeight: '600', color: 'brand.ink' })}>
                                                    {plan.alarm_minutes_before === 0 ? '알림 없음' : 
                                                     plan.alarm_minutes_before >= 1440 ? `${Math.floor(plan.alarm_minutes_before / 1440)}일 전` :
                                                     plan.alarm_minutes_before >= 60 ? `${Math.floor(plan.alarm_minutes_before / 60)}시간 전` :
                                                     `${plan.alarm_minutes_before}분 전`}
                                                </span>
                                            }
                                        />
                                    )}




                                    {/* 타임존 */}
                                    {plan.timezone_string && (
                                        <InfoRow 
                                            icon={<Globe size={18} className={css({ color: '#6366F1' })} />} 
                                            label="타임존"
                                            bgColor="rgba(99, 102, 241, 0.05)"
                                            value={<span className={css({ fontSize: '13px', color: 'brand.muted', fontFamily: 'monospace' })}>{plan.timezone_string}</span>}
                                        />
                                    )}

                                    {/* 예상 금액 */}
                                    {localAmount && (
                                        <InfoRow 
                                            icon={<Wallet size={18} className={css({ color: '#10B981' })} />} 
                                            label="예상 금액"
                                            bgColor="rgba(16, 185, 129, 0.05)"
                                            value={
                                                <div className={css({ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' })}>
                                                    <span className={css({ fontSize: '15.5px', fontWeight: '600', color: 'brand.ink', letterSpacing: '-0.01em' })}>{localAmount}</span>
                                                    {currency.code !== 'KRW' && krwAmount !== null && (
                                                        <span className={css({ fontSize: '14px', color: 'brand.muted', bg: 'bg.softCotton', px: '8px', py: '4px', borderRadius: '8px', border: '1px solid', borderColor: 'brand.hairline' })}>≈ {formatKRW(krwAmount)}</span>
                                                    )}
                                                    {currency.code !== 'KRW' && !krwAmount && (
                                                        <span className={css({ fontSize: '13px', color: 'brand.hairline' })}>환율 로딩 중...</span>
                                                    )}
                                                </div>
                                            }
                                        />
                                    )}

                                    {/* 메모 */}
                                    {plan.memo && (
                                        <InfoRow 
                                            icon={<FileText size={18} className={css({ color: 'brand.muted' })} />} 
                                            label="메모"
                                            bgColor="bg.softCotton"
                                            value={
                                                <p className={css({ fontSize: '14px', color: 'brand.ink', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', bg: 'bg.softCotton', p: '12px', borderRadius: '8px', border: '1px solid', borderColor: 'brand.hairline', m: '0' })}>
                                                    {plan.memo}
                                                </p>
                                            }
                                        />
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ▸ 참고자료 탭 */}
                    {tab === 'refs' && (
                        <div className={css({ p: { base: '20px', sm: '24px' }, display: 'flex', flexDirection: 'column', gap: '12px' })}>
                            {hasRefs ? (
                                <>
                                    <p className={css({ fontSize: '13px', color: 'brand.muted', m: '0', display: 'flex', alignItems: 'center', gap: '5px' })}>
                                        <Link2 size={13} /> {planUrls.length}개의 참고자료가 있습니다
                                    </p>
                                    {planUrls.map((url, i) => (
                                        <UrlPreviewCard key={i} url={url} />
                                    ))}
                                </>
                            ) : (
                                <div className={css({ py: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'brand.hairline' })}>
                                    <Link2 size={32} />
                                    <p className={css({ m: '0', fontSize: '14px', textAlign: 'center', lineHeight: 1.5, color: 'brand.muted' })}>
                                        참고할 자료가 아직 없네요. 📂<br />
                                        필요한 정보들을 모아 보세요!<br />
                                        <span className={css({ fontSize: '12px' })}>일정 수정에서 URL을 추가해보세요.</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── 푸터 (PC) ── */}
                {(userRole === 'owner' || userRole === 'editor') && (
                    <div className={css({
                        display: { base: 'none', sm: 'flex' },
                        gap: '12px', p: '20px 24px',
                        borderTop: '1px solid', borderColor: 'brand.hairline', flexShrink: 0,
                        bg: 'white'
                    })}>
                        <button onClick={() => { onEdit(plan); handleClose() }} disabled={!isOnline}
                            className={css({ 
                                flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', py: '14px', 
                                bg: 'brand.primary', color: 'white', borderRadius: '8px', fontWeight: '700', fontSize: '15px', 
                                border: 'none', cursor: isOnline ? 'pointer' : 'not-allowed', 
                                opacity: isOnline ? 1 : 0.5,
                                transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)',
                                _hover: { bg: 'brand.primaryActive', boxShadow: 'airbnbHover' } 
                            })}>
                            <Pencil size={16} strokeWidth={2.5} /> 수정하기
                        </button>
                        <button onClick={() => { onDelete(plan.id); handleClose() }} disabled={!isOnline}
                            className={css({ 
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', py: '14px', 
                                bg: 'white', color: '#94A3B8', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', 
                                fontWeight: '700', fontSize: '15px', cursor: isOnline ? 'pointer' : 'not-allowed', 
                                opacity: isOnline ? 1 : 0.5,
                                transition: 'all 0.2s',
                                _hover: { bg: '#F8FAFC', color: '#F43F5E', borderColor: '#F43F5E/30', boxShadow: 'airbnbHover' } 
                            })}>
                            <Trash2 size={16} strokeWidth={2.5} /> 삭제
                        </button>
                    </div>
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
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.8; }
                }
            `}</style>
        </div>
    )
}

// ── 정보 행 ──
function InfoRow({ icon, label, value, bgColor = 'bg.softCotton' }: { icon: React.ReactNode; label: string; value: React.ReactNode; bgColor?: string }) {
    return (
        <div className={css({ display: 'flex', gap: '16px', alignItems: 'flex-start' })}>
            <div className={css({ 
                w: '42px', h: '42px', borderRadius: '12px', bg: bgColor, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                border: '1px solid', borderColor: 'rgba(0,0,0,0.03)',
                mt: '2px' // 텍스트 첫 줄과 높이를 맞추기 위한 미세 조정
            })}>
                {icon}
            </div>
            <div className={css({ flex: 1, minW: 0 })}>
                <p className={css({ fontSize: '11px', fontWeight: '800', color: 'brand.muted', textTransform: 'uppercase', letterSpacing: '0.08em', m: '0 0 4px 0' })}>{label}</p>
                <div className={css({ display: 'flex', flexDirection: 'column', justifyContent: 'center' })}>{typeof value === 'string'
                    ? <span className={css({ fontSize: '15.5px', color: 'brand.ink', fontWeight: '700', wordBreak: 'break-word', lineHeight: 1.5 })}>{value}</span>
                    : value}
                </div>
            </div>
        </div>
    )
}
