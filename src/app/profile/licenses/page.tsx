'use client'

import { useState } from 'react'
import { css } from 'styled-system/css'
import { ArrowLeft, ChevronRight, ExternalLink } from 'lucide-react'
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
    const licenses = licensesData as Record<string, License>

    return (
        <div className={css({ maxW: '720px', mx: 'auto', py: { base: '20px', sm: '40px' }, px: { base: '8px', sm: '0' } })}>
            {/* 헤더 - 모바일에서는 상단 바와 중복되므로 숨김 */}
            <div className={css({ display: { base: 'none', sm: 'flex' }, alignItems: 'center', gap: '16px', mb: '24px' })}>
                <Link href="/profile" className={css({ p: '8px', borderRadius: '50%', _hover: { bg: '#eee' }, color: '#555', transition: 'all 0.2s' })}>
                    <ArrowLeft size={24} />
                </Link>
                <h1 className={css({ fontSize: { base: '20px', sm: '24px' }, fontWeight: 'bold', color: '#172554' })}>오픈 소스 라이선스</h1>
            </div>

            <p className={css({ color: '#666', fontSize: '14px', mb: '24px', px: '8px' })}>
                온여정(OnVoy) 개발에 사용된 주요 오픈 소스 라이브러리 목록입니다. 각 라이선스의 저작권을 존중하며 개발되었습니다.
            </p>

            <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                {Object.entries(licenses).map(([id, data]) => (
                    <div key={id} className={css({ bg: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' })}>
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
                                _hover: { bg: '#fafafa' }
                            })}
                        >
                            <div>
                                <div className={css({ fontSize: '16px', fontWeight: 'bold', color: '#111' })}>{id}</div>
                                <div className={css({ fontSize: '13px', color: '#888', mt: '2px' })}>{data.licenses} | {data.publisher}</div>
                            </div>
                            <div className={css({ transform: selectedId === id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' })}>
                                <ChevronRight size={18} color="#ccc" />
                            </div>
                        </button>

                        {selectedId === id && (
                            <div className={css({ p: '16px 20px 24px', bg: '#f9f9f9', borderTop: '1px solid #eee' })}>
                                <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '12px' })}>
                                    <span className={css({ fontSize: '12px', fontWeight: 'bold', color: '#555' })}>LICENSE TEXT</span>
                                    {data.repository && (
                                        <a href={data.repository} target="_blank" rel="noopener noreferrer" className={css({ fontSize: '12px', color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', _hover: { textDecoration: 'underline' } })}>
                                            Repository <ExternalLink size={12} />
                                        </a>
                                    )}
                                </div>
                                <pre className={css({
                                    fontSize: '11px',
                                    color: '#666',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                    bg: '#fff',
                                    p: '16px',
                                    borderRadius: '8px',
                                    border: '1px solid #eee',
                                    fontFamily: 'monospace',
                                    maxH: '200px',
                                    overflowY: 'auto'
                                })}>
                                    {data.licenseText}
                                </pre>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className={css({ textAlign: 'center', mt: '40px', pb: '20px' })}>
                <p className={css({ fontSize: '12px', color: '#aaa' })}>© 2026 OnVoy Team. All rights reserved.</p>
            </div>
        </div>
    )
}
