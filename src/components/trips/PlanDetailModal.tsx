'use client'

import { useEffect, useState, useCallback } from 'react'
import { css } from 'styled-system/css'
import {
    X, ChevronLeft, MapPin, Clock, Wallet, FileText, Globe,
    Pencil, Trash2, BookOpen, ExternalLink, Link2
} from 'lucide-react'
import { getCurrencyFromTimezone, formatCurrency, formatKRW } from '@/utils/currency'

// ── OG 미리보기 데이터 타입 ──
interface OGData {
    title?: string
    description?: string
    image?: string
    favicon?: string
    hostname: string
    url: string
}

// ── URL 프리뷰 카드 ──
function UrlPreviewCard({ url }: { url: string }) {
    const [og, setOg] = useState<OGData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
            ; (async () => {
                try {
                    const res = await fetch(`/api/og-preview?url=${encodeURIComponent(url)}`)
                    if (!cancelled && res.ok) setOg(await res.json())
                } catch { /* 무시 */ } finally {
                    if (!cancelled) setLoading(false)
                }
            })()
        return () => { cancelled = true }
    }, [url])

    const display = og ?? { hostname: (() => { try { return new URL(url).hostname } catch { return url } })(), url }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={css({
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                border: '1px solid #e8eaed', borderRadius: '12px',
                textDecoration: 'none', color: 'inherit',
                transition: 'box-shadow 0.2s, transform 0.2s',
                _hover: { boxShadow: '0 4px 16px rgba(0,0,0,0.1)', transform: 'translateY(-1px)' },
            })}
        >
            {/* OG 이미지 */}
            {og?.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={og.image}
                    alt=""
                    style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
            )}

            <div className={css({ p: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' })}>
                {/* favicon + hostname */}
                <div className={css({ display: 'flex', alignItems: 'center', gap: '6px', mb: '4px' })}>
                    {og?.favicon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={og.favicon} alt="" width={14} height={14}
                            style={{ borderRadius: 2, flexShrink: 0 }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    )}
                    <span className={css({ fontSize: '11px', color: '#888', fontWeight: '500' })}>
                        {display.hostname}
                    </span>
                </div>

                {/* title */}
                {loading ? (
                    <div className={css({ h: '16px', w: '70%', bg: '#f0f0f0', borderRadius: '4px', animation: 'pulse 1.5s infinite' })} />
                ) : (
                    <p className={css({
                        fontSize: '14px', fontWeight: '700', color: '#111', m: '0', lineHeight: 1.4,
                        overflow: 'hidden', display: '-webkit-box', lineClamp: 2
                    })}
                        style={{ WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {og?.title || url}
                    </p>
                )}

                {/* description */}
                {og?.description && (
                    <p className={css({ fontSize: '12px', color: '#666', m: '0', lineHeight: 1.5 })}
                        style={{ WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', display: '-webkit-box' }}>
                        {og.description}
                    </p>
                )}

                {/* URL */}
                <div className={css({ display: 'flex', alignItems: 'center', gap: '4px', mt: '4px' })}>
                    <ExternalLink size={11} color="#aaa" />
                    <span className={css({ fontSize: '11px', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                        {url}
                    </span>
                </div>
            </div>
        </a>
    )
}

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
}

export default function PlanDetailModal({
    plan, exchangeRates, formatLocalTime, formatKstTime, timeDisplayMode,
    userRole, onClose, onEdit, onDelete,
}: PlanDetailModalProps) {
    const [tab, setTab] = useState<'info' | 'refs'>('info')
    const [mapError, setMapError] = useState(false)

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [onClose])

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const currency = getCurrencyFromTimezone(plan.timezone_string || 'Asia/Seoul')
    const localAmount = plan.cost > 0 ? formatCurrency(plan.cost, currency) : null
    const rate = exchangeRates[currency.code]
    const krwAmount = localAmount && rate ? Math.round(plan.cost * rate) : null

    const localTime = formatLocalTime(plan.start_datetime_local)
    const kstTime = formatKstTime(plan.start_datetime_local, plan.timezone_string || 'Asia/Seoul')

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const encodedLocation = plan.location ? encodeURIComponent(plan.location) : ''
    const embedUrl = apiKey && plan.location
        ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedLocation}&language=ko`
        : null

    // plan_urls 파싱 (다양한 형태 처리)
    const planUrls: string[] = (() => {
        const raw = plan.plan_urls
        if (!raw) return []
        if (Array.isArray(raw)) return raw.map((pu: any) => (typeof pu === 'string' ? pu : pu.url)).filter(Boolean)
        return []
    })()

    const hasRefs = planUrls.length > 0

    const mapUrl = plan.location
        ? `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`
        : null

    return (
        <div
            className={css({
                position: 'fixed', inset: 0, zIndex: 300,
                bg: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: { base: 'flex-end', sm: 'center' },
                justifyContent: 'center',
                p: { base: '0', sm: '20px' },
            })}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className={css({
                    bg: 'white',
                    w: '100%',
                    maxW: { base: '100%', sm: '620px' },
                    h: { base: '100dvh', sm: 'auto' },
                    maxH: { base: '100dvh', sm: '91vh' },
                    borderRadius: { base: '0', sm: '20px' },
                    boxShadow: { base: 'none', sm: '0 20px 60px rgba(0,0,0,0.2)' },
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideUp 0.25s ease',
                })}
            >
                {/* ── 헤더 ── */}
                <div className={css({
                    px: '20px', py: '14px',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0, bg: 'white', zIndex: 10,
                })}>
                    <button
                        onClick={onClose}
                        className={css({
                            display: { base: 'flex', sm: 'none' },
                            alignItems: 'center', gap: '4px',
                            bg: 'transparent', border: 'none', cursor: 'pointer',
                            color: '#4285F4', fontWeight: '600', fontSize: '15px', p: '0',
                        })}
                    >
                        <ChevronLeft size={22} /> 뒤로
                    </button>

                    <h2 className={css({
                        fontSize: '17px', fontWeight: '800', color: '#111',
                        position: { base: 'absolute', sm: 'static' },
                        left: { base: '50%', sm: 'auto' },
                        transform: { base: 'translateX(-50%)', sm: 'none' },
                        whiteSpace: 'nowrap',
                    })}>
                        일정 상세
                    </h2>

                    <button
                        onClick={onClose}
                        className={css({
                            display: { base: 'none', sm: 'flex' },
                            alignItems: 'center', justifyContent: 'center',
                            bg: '#f5f5f5', border: 'none', borderRadius: '50%',
                            w: '32px', h: '32px', cursor: 'pointer', color: '#555',
                            _hover: { bg: '#eee', color: '#111' },
                        })}
                    >
                        <X size={18} />
                    </button>

                    {/* 모바일: 수정/삭제 */}
                    <div className={css({ display: { base: 'flex', sm: 'none' }, gap: '8px', ml: 'auto' })}>
                        {(userRole === 'owner' || userRole === 'editor') && (
                            <>
                                <button onClick={() => { onEdit(plan); onClose() }}
                                    className={css({ bg: 'transparent', border: 'none', cursor: 'pointer', color: '#4285F4', p: '6px' })}>
                                    <Pencil size={18} />
                                </button>
                                <button onClick={() => { onDelete(plan.id); onClose() }}
                                    className={css({ bg: 'transparent', border: 'none', cursor: 'pointer', color: '#dc2626', p: '6px' })}>
                                    <Trash2 size={18} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ── 탭 바 ── */}
                <div className={css({
                    display: 'flex', flexShrink: 0,
                    borderBottom: '1px solid #f0f0f0',
                    bg: 'white',
                })}>
                    {(['info', 'refs'] as const).map(t => {
                        const labels = { info: '기본 정보', refs: '참고자료' }
                        const icons = { info: <Globe size={14} />, refs: <BookOpen size={14} /> }
                        const isActive = tab === t
                        return (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={css({
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '5px', py: '11px',
                                    bg: 'transparent', border: 'none', cursor: 'pointer',
                                    fontSize: '13px', fontWeight: isActive ? '700' : '500',
                                    color: isActive ? '#4285F4' : '#888',
                                    borderBottom: isActive ? '2px solid #4285F4' : '2px solid transparent',
                                    mb: '-1px',
                                    transition: 'color 0.15s',
                                })}
                            >
                                {icons[t]}
                                {labels[t]}
                                {t === 'refs' && hasRefs && (
                                    <span className={css({
                                        bg: isActive ? '#4285F4' : '#e0e0e0',
                                        color: isActive ? 'white' : '#666',
                                        fontSize: '10px', fontWeight: '700',
                                        px: '5px', py: '1px', borderRadius: '8px',
                                    })}>
                                        {planUrls.length}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* ── 본문 ── */}
                <div className={css({ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' })}>

                    {/* ▸ 기본 정보 탭 */}
                    {tab === 'info' && (
                        <>
                            {/* 지도 */}
                            {plan.location && (
                                <div className={css({ flexShrink: 0 })}>
                                    {embedUrl && !mapError ? (
                                        <iframe
                                            src={embedUrl}
                                            width="100%" height="220"
                                            style={{ border: 0, display: 'block' }}
                                            allowFullScreen loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                            onError={() => setMapError(true)}
                                            title="지도"
                                        />
                                    ) : (
                                        <div className={css({ w: '100%', h: '140px', bg: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' })}>
                                            <MapPin size={24} color="#4285F4" />
                                            <span className={css({ fontSize: '13px', color: '#666' })}>{plan.location}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className={css({ p: { base: '20px', sm: '24px' }, display: 'flex', flexDirection: 'column', gap: '20px' })}>
                                {/* 일정명 */}
                                <h3 className={css({ fontSize: { base: '20px', sm: '22px' }, fontWeight: '800', color: '#111', lineHeight: 1.3, wordBreak: 'break-word', m: '0' })}>
                                    {plan.title}
                                </h3>

                                <hr className={css({ border: 'none', borderTop: '1px solid #f0f0f0', m: '0' })} />

                                <div className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>

                                    {/* 장소 */}
                                    {plan.location && (
                                        <InfoRow icon={<MapPin size={18} color="#F4511E" />} label="장소"
                                            value={
                                                mapUrl ? (
                                                    <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                                                        className={css({ fontSize: '15px', color: '#1a73e8', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none', wordBreak: 'break-word', _hover: { textDecoration: 'underline' } })}>
                                                        {plan.location}<ExternalLink size={13} style={{ flexShrink: 0 }} />
                                                    </a>
                                                ) : plan.location
                                            }
                                        />
                                    )}

                                    {/* 시간 */}
                                    <InfoRow icon={<Clock size={18} color="#4285F4" />} label="시간"
                                        value={
                                            <div className={css({ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', flexWrap: 'wrap' })}>
                                                <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '5px' })}>
                                                    <span className={css({ fontSize: '12px', color: '#555', fontWeight: '600' })}>현지</span>
                                                    <span className={css({ fontSize: '14px', fontWeight: '600', color: '#111', bg: '#f1f3f4', px: '10px', py: '5px', borderRadius: '8px' })}>{localTime}</span>
                                                </span>
                                                <span className={css({ color: '#ccc', fontSize: '12px' })}>|</span>
                                                <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '5px' })}>
                                                    <span className={css({ fontSize: '12px', color: '#555', fontWeight: '600' })}>한국</span>
                                                    <span className={css({ fontSize: '14px', fontWeight: '600', color: '#1a73e8', bg: '#e8f0fe', px: '10px', py: '5px', borderRadius: '8px' })}>{kstTime}</span>
                                                </span>
                                            </div>
                                        }
                                    />




                                    {/* 타임존 */}
                                    {plan.timezone_string && (
                                        <InfoRow icon={<Globe size={18} color="#34A853" />} label="타임존"
                                            value={<span className={css({ fontSize: '13px', color: '#777', fontFamily: 'monospace' })}>{plan.timezone_string}</span>}
                                        />
                                    )}

                                    {/* 예상 금액 */}
                                    {localAmount && (
                                        <InfoRow icon={<Wallet size={18} color="#FBBC05" />} label="예상 금액"
                                            value={
                                                <div className={css({ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' })}>
                                                    <span className={css({ fontSize: '18px', fontWeight: '800', color: '#34A853' })}>{localAmount}</span>
                                                    {currency.code !== 'KRW' && krwAmount !== null && (
                                                        <span className={css({ fontSize: '14px', color: '#888', bg: '#f1f3f4', px: '8px', py: '4px', borderRadius: '6px' })}>≈ {formatKRW(krwAmount)}</span>
                                                    )}
                                                    {currency.code !== 'KRW' && !krwAmount && (
                                                        <span className={css({ fontSize: '13px', color: '#bbb' })}>환율 로딩 중...</span>
                                                    )}
                                                </div>
                                            }
                                        />
                                    )}

                                    {/* 메모 */}
                                    {plan.memo && (
                                        <InfoRow icon={<FileText size={18} color="#9E9E9E" />} label="메모"
                                            value={
                                                <p className={css({ fontSize: '14px', color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', bg: '#f9f9f9', p: '12px', borderRadius: '8px', m: '0' })}>
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
                                    <p className={css({ fontSize: '13px', color: '#888', m: '0', display: 'flex', alignItems: 'center', gap: '5px' })}>
                                        <Link2 size={13} /> {planUrls.length}개의 참고자료가 있습니다
                                    </p>
                                    {planUrls.map((url, i) => (
                                        <UrlPreviewCard key={i} url={url} />
                                    ))}
                                </>
                            ) : (
                                <div className={css({ py: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#bbb' })}>
                                    <Link2 size={32} />
                                    <p className={css({ m: '0', fontSize: '14px', textAlign: 'center', lineHeight: 1.5 })}>
                                        등록된 참고자료가 없습니다.<br />
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
                        gap: '10px', p: '14px 24px',
                        borderTop: '1px solid #f0f0f0', flexShrink: 0,
                    })}>
                        <button onClick={() => { onEdit(plan); onClose() }}
                            className={css({ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', py: '12px', bg: '#f0f6ff', color: '#4285F4', border: '1px solid #d2e3fc', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', _hover: { bg: '#e8f0fd' } })}>
                            <Pencil size={15} /> 수정
                        </button>
                        <button onClick={() => { onDelete(plan.id); onClose() }}
                            className={css({ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', py: '12px', bg: '#fff5f5', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', _hover: { bg: '#fee2e2' } })}>
                            <Trash2 size={15} /> 삭제
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── 정보 행 ──
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className={css({ display: 'flex', gap: '14px', alignItems: 'flex-start' })}>
            <div className={css({ w: '36px', h: '36px', borderRadius: '10px', bg: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: '2px' })}>
                {icon}
            </div>
            <div className={css({ flex: 1, minW: 0 })}>
                <p className={css({ fontSize: '11px', fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', mb: '4px', m: '0 0 4px 0' })}>{label}</p>
                <div>{typeof value === 'string'
                    ? <span className={css({ fontSize: '15px', color: '#222', fontWeight: '500', wordBreak: 'break-word' })}>{value}</span>
                    : value}
                </div>
            </div>
        </div>
    )
}
