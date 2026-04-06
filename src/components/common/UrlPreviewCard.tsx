'use client'

import React, { useState, useEffect } from 'react'
import { css } from 'styled-system/css'
import { ExternalLink } from 'lucide-react'
import { MetadataService } from '@/services/ExternalApiService'

// ── OG 미리보기 데이터 타입 ──
interface OGData {
    title?: string
    description?: string
    image?: string
    favicon?: string
    hostname: string
    url: string
}

export default function UrlPreviewCard({ url }: { url: string }) {
    const [og, setOg] = useState<OGData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
            ; (async () => {
                try {
                    const data = await MetadataService.getOgPreview(url)
                    if (!cancelled && data) setOg(data)
                } catch (error) {
                    console.error('[UrlPreviewCard] Failed to fetch OG preview:', error)
                } finally {
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
                    referrerPolicy="no-referrer"
                    style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
            )}

            <div className={css({ p: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', minW: 0 })}>
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
                        fontSize: '14px', fontWeight: '700', color: '#172554', m: '0', lineHeight: 1.4,
                        overflow: 'hidden', display: '-webkit-box', lineClamp: 2,
                        wordBreak: 'break-all'
                    })}
                        style={{ WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {og?.title || url}
                    </p>
                )}

                {/* description */}
                {og?.description && (
                    <p className={css({ fontSize: '12px', color: '#666', m: '0', lineHeight: 1.5, wordBreak: 'break-all' })}
                        style={{ WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', display: '-webkit-box' }}>
                        {og.description}
                    </p>
                )}

                {/* URL */}
                <div className={css({ display: 'flex', alignItems: 'center', gap: '4px', mt: '4px', minW: 0 })}>
                    <ExternalLink size={11} color="#aaa" className={css({ flexShrink: 0 })} />
                    <span className={css({ fontSize: '11px', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minW: 0 })}>
                        {url}
                    </span>
                </div>
            </div>
        </a>
    )
}
