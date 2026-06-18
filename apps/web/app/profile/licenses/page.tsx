'use client'

import { useState, useMemo } from 'react'
import { css } from 'styled-system/css'
import { ArrowLeft, ChevronRight, ExternalLink, Search } from 'lucide-react'
import Link from 'next/link'
import licensesData from '@/assets/data/licenses.json'

interface License {
    licenses: string
    repository: string
    publisher: string
    licenseText: string
}

export default function LicensesPage() {
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const licenses = licensesData as Record<string, License>

    const entries = useMemo(() => {
        const all = Object.entries(licenses)
        if (!searchQuery.trim()) return all
        const q = searchQuery.toLowerCase()
        return all.filter(([id, data]) =>
            id.toLowerCase().includes(q) ||
            data.licenses.toLowerCase().includes(q) ||
            data.publisher.toLowerCase().includes(q)
        )
    }, [licenses, searchQuery])

    const licenseStats = useMemo(() => {
        const counts: Record<string, number> = {}
        Object.values(licenses).forEach(d => {
            const key = d.licenses || 'Unknown'
            counts[key] = (counts[key] || 0) + 1
        })
        return counts
    }, [licenses])

    return (
        <div className={css({ maxW: '720px', mx: 'auto', py: { base: '20px', sm: '40px' }, px: { base: '8px', sm: '0' } })}>
            {/* 헤더 - 모바일에서는 상단 바와 중복되므로 숨김 */}
            <div className={css({ display: { base: 'none', sm: 'flex' }, alignItems: 'center', gap: '16px', mb: '24px' })}>
                <Link href="/profile" className={css({ p: '8px', borderRadius: '50%', _hover: { bg: 'bg.softCotton' }, color: 'brand.muted', transition: 'all 0.2s' })}>
                    <ArrowLeft size={24} />
                </Link>
                <h1 className={css({ fontSize: { base: '20px', sm: '24px' }, fontWeight: '850', color: 'brand.secondary' })}>오픈 소스 라이선스</h1>
            </div>

            <p className={css({ color: 'brand.muted', fontSize: '14px', mb: '16px', px: '8px', lineHeight: '1.6' })}>
                온여정 개발에 사용된 오픈 소스 라이브러리 목록입니다.
            </p>

            {/* 라이선스 통계 */}
            <div className={css({ display: 'flex', gap: '8px', flexWrap: 'wrap', px: '8px', mb: '16px' })}>
                {Object.entries(licenseStats).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                    <span key={type} className={css({
                        px: '10px', py: '4px', borderRadius: '12px', fontSize: '12px', fontWeight: '700',
                        bg: type === 'MIT' ? 'rgba(37, 99, 235, 0.08)' : type === 'ISC' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                        color: type === 'MIT' ? 'brand.primary' : type === 'ISC' ? '#10B981' : '#F59E0B',
                    })}>
                        {type} ({count})
                    </span>
                ))}
                <span className={css({ px: '10px', py: '4px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', bg: 'bg.softCotton', color: 'brand.muted' })}>
                    총 {Object.keys(licenses).length}개
                </span>
            </div>

            {/* 검색 */}
            <div className={css({ position: 'relative', mb: '20px', px: '8px' })}>
                <Search size={16} className={css({ position: 'absolute', left: '22px', top: '50%', transform: 'translateY(-50%)', color: 'brand.muted' })} />
                <input
                    type="text"
                    placeholder="라이브러리 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={css({
                        w: '100%', h: '44px', pl: '40px', pr: '16px',
                        border: '1px solid', borderColor: 'brand.border', borderRadius: '14px',
                        fontSize: '14px', color: 'brand.secondary',
                        bg: 'white', outline: 'none',
                        transition: 'all 0.2s',
                        _focus: { borderColor: 'brand.primary', boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.08)' },
                        _placeholder: { color: 'brand.muted' },
                    })}
                />
            </div>

            {/* 리스트 */}
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                {entries.length === 0 ? (
                    <div className={css({ textAlign: 'center', py: '40px', color: 'brand.muted', fontSize: '14px' })}>
                        검색 결과가 없습니다.
                    </div>
                ) : entries.map(([id, data]) => (
                    <div key={id} className={css({ bg: 'white', borderRadius: '16px', overflow: 'hidden', border: '1px solid', borderColor: selectedId === id ? 'brand.primary/30' : 'brand.border' , transition: 'all 0.2s' })}>
                        <button
                            onClick={() => setSelectedId(selectedId === id ? null : id)}
                            className={css({
                                w: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                px: '20px',
                                py: '16px',
                                bg: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background-color 0.2s',
                                _hover: { bg: 'bg.softCotton' }
                            })}
                        >
                            <div className={css({ flex: 1, minW: 0 })}>
                                <div className={css({ display: 'flex', alignItems: 'center', gap: '8px', mb: '2px' })}>
                                    <div className={css({ fontSize: '15px', fontWeight: '700', color: 'brand.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>{id}</div>
                                    <span className={css({
                                        flexShrink: 0, px: '6px', py: '2px', borderRadius: '6px', fontSize: '10px', fontWeight: '800',
                                        bg: data.licenses === 'MIT' ? 'rgba(37, 99, 235, 0.08)' : data.licenses === 'ISC' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                                        color: data.licenses === 'MIT' ? 'brand.primary' : data.licenses === 'ISC' ? '#10B981' : '#F59E0B',
                                    })}>
                                        {data.licenses}
                                    </span>
                                </div>
                                {data.publisher && (
                                    <div className={css({ fontSize: '12px', color: 'brand.muted', fontWeight: '500' })}>{data.publisher}</div>
                                )}
                            </div>
                            <div className={css({
                                transform: selectedId === id ? 'rotate(90deg)' : 'none',
                                transition: 'transform 0.2s',
                                flexShrink: 0, ml: '8px',
                            })}>
                                <ChevronRight size={16} className={css({ color: 'brand.muted' })} />
                            </div>
                        </button>

                        {selectedId === id && (
                            <div className={css({ p: '16px 20px 20px', bg: 'bg.softCotton', borderTop: '1px solid', borderColor: 'brand.border' })}>
                                <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '12px' })}>
                                    <span className={css({ fontSize: '11px', fontWeight: '800', color: 'brand.muted', textTransform: 'uppercase', letterSpacing: '0.05em' })}>License Text</span>
                                    {data.repository && (
                                        <a href={data.repository} target="_blank" rel="noopener noreferrer" className={css({
                                            fontSize: '12px', color: 'brand.primary', display: 'flex', alignItems: 'center', gap: '4px',
                                            textDecoration: 'none', fontWeight: '600',
                                            _hover: { textDecoration: 'underline' }
                                        })}>
                                            Repository <ExternalLink size={11} />
                                        </a>
                                    )}
                                </div>
                                <pre className={css({
                                    fontSize: '11px',
                                    color: 'brand.secondary',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                    bg: 'white',
                                    p: '16px',
                                    borderRadius: '12px',
                                    border: '1px solid',
                                    borderColor: 'brand.border',
                                    fontFamily: 'monospace',
                                    maxH: '200px',
                                    overflowY: 'auto',
                                    lineHeight: '1.6',
                                })}>
                                    {data.licenseText}
                                </pre>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className={css({ textAlign: 'center', mt: '40px', pb: '20px' })}>
                <p className={css({ fontSize: '12px', color: 'brand.muted' })}>
                    각 라이선스의 저작권을 존중하며 개발되었습니다.
                </p>
            </div>
        </div>
    )
}
