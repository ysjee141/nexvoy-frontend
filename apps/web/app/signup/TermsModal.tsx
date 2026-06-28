'use client'

import { css } from 'styled-system/css'
import { X, ChevronLeft } from 'lucide-react'
import { useEffect } from 'react'
import { ONVOY_TERMS_DOCUMENT } from '@nexvoy/core'

interface TermsModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: { base: 'flex-start', sm: 'center' },
            justifyContent: 'center',
            bg: { base: 'white', sm: 'rgba(0, 0, 0, 0.4)' },
            p: { base: 0, sm: '20px' },
            backdropFilter: { base: 'none', sm: 'blur(10px)' },
            animation: 'fadeIn 0.3s ease-out'
        })}>
            <div className={css({
                bg: 'white',
                w: '100%',
                maxW: { base: 'none', sm: '640px' },
                h: { base: '100vh', sm: 'auto' },
                maxH: { base: 'none', sm: '85vh' },
                borderRadius: { base: '0', sm: '24px' },
                display: 'flex',
                flexDirection: 'column',
                boxShadow: { base: 'none', sm: '0 30px 80px rgba(0,0,0,0.2)' },
                overflow: 'hidden',
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)'
            })}>
                {/* Header */}
                <div className={css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: '16px 20px',
                    borderBottom: '1px solid',
                    borderColor: 'brand.border',
                    pt: { base: 'calc(16px + max(env(safe-area-inset-top), var(--safe-area-inset-top)))', sm: '24px' },
                    px: { base: '20px', sm: '24px' },
                    bg: 'white'
                })}>
                    <button onClick={onClose} className={css({ 
                        display: { base: 'flex', sm: 'none' }, 
                        alignItems: 'center', bg: 'none', border: 'none', p: 0, 
                        color: 'brand.primary', cursor: 'pointer' 
                    })}>
                        <ChevronLeft size={24} strokeWidth={2.5} />
                    </button>
                    <h2 className={css({ 
                        fontSize: '18px', fontWeight: '700', color: 'brand.secondary', flex: 1, 
                        textAlign: { base: 'center', sm: 'left' }, letterSpacing: '-0.02em' 
                    })}>
                        {ONVOY_TERMS_DOCUMENT.title}
                    </h2>
                    <button onClick={onClose} className={css({ 
                        display: { base: 'none', sm: 'flex' }, 
                        p: '6px', bg: 'bg.softCotton', borderRadius: '50%', color: 'brand.muted', 
                        cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                        _hover: { bg: 'brand.border', color: 'brand.secondary', transform: 'rotate(90deg)' }
                    })}>
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Content */}
                <div className={css({
                    flex: 1,
                    overflowY: 'auto',
                    p: { base: '24px 20px', sm: '32px' },
                    pb: 'calc(max(env(safe-area-inset-bottom), var(--safe-area-inset-bottom)) + 40px)',
                    scrollbarWidth: 'thin',
                    '&::-webkit-scrollbar': { w: '6px' },
                    '&::-webkit-scrollbar-thumb': { bg: 'brand.border', borderRadius: '10px' }
                })}>
                    <div className={css({
                        fontSize: '14.5px',
                        color: 'brand.muted',
                        lineHeight: 1.7,
                        wordBreak: 'keep-all',
                        '& h3': { fontSize: '16px', fontWeight: '800', mt: '36px', mb: '12px', color: 'brand.primary', display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '4px solid', pl: '12px' },
                        '& h4': { fontSize: '14.5px', fontWeight: '700', mt: '20px', mb: '8px', color: 'brand.secondary' },
                        '& p': { mb: '14px', fontWeight: '500' },
                        '& ul': { pl: '20px', mb: '14px', listStyleType: 'none', position: 'relative' },
                        '& li': { mb: '8px', position: 'relative', pl: '12px', _before: { content: '"•"', position: 'absolute', left: 0, color: 'brand.primary', fontWeight: 'bold' } },
                        '& strong': { color: 'brand.secondary', fontWeight: '700' },
                        '& .footer': { mt: '48px', pt: '24px', borderTop: '1px solid', borderColor: 'brand.border', fontSize: '13px' }
                    })}>
                        <p className={css({ fontSize: '15px', color: 'brand.secondary', fontWeight: '700' })}>
                            {ONVOY_TERMS_DOCUMENT.intro}
                        </p>

                        {ONVOY_TERMS_DOCUMENT.sections.map((section) => (
                            <section key={section.title}>
                                <h3>{section.title}</h3>
                                {section.blocks.map((block, index) => {
                                    if (block.type === 'paragraph') {
                                        return <p key={`${section.title}-${index}`}>{block.text}</p>
                                    }

                                    if (block.type === 'subheading') {
                                        return <h4 key={`${section.title}-${index}`}>{block.text}</h4>
                                    }

                                    return (
                                        <ul key={`${section.title}-${index}`}>
                                            {block.items.map((item) => (
                                                <li key={`${item.title ?? 'item'}-${item.text}`}>
                                                    {item.title ? <><strong>{item.title}</strong>: </> : null}
                                                    {item.text === 'ysjee141@gmail.com' ? (
                                                        <a href="mailto:ysjee141@gmail.com" className={css({ borderBottom: '1px solid', color: 'brand.primary', fontWeight: '700' })}>
                                                            {item.text}
                                                        </a>
                                                    ) : item.text}
                                                </li>
                                            ))}
                                        </ul>
                                    )
                                })}
                            </section>
                        ))}

                        <div className="footer">
                            <p><strong>공고일자</strong>: {ONVOY_TERMS_DOCUMENT.footer.noticeDate}</p>
                            <p><strong>시행일자</strong>: {ONVOY_TERMS_DOCUMENT.footer.effectiveDate}</p>
                            <p><strong>이전 버전 확인</strong>: {ONVOY_TERMS_DOCUMENT.footer.previousVersion}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
