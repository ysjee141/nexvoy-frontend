'use client'

import { useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { X, Copy, Loader2 } from 'lucide-react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { analytics } from '@/services/AnalyticsService'
import { createClient } from '@/lib/supabase/client'
import { applyTemplateToChecklist, getTemplatesWithPreview } from '@nexvoy/core'

interface TemplateModalProps {
    isOpen: boolean
    onClose: () => void
    checklistId: string
    currentUser: any
    onSuccess: (newItems: any[]) => void
}

export default function TemplateModal({ isOpen, onClose, checklistId, currentUser, onSuccess }: TemplateModalProps) {
    const supabase = createClient()
    const [templates, setTemplates] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null)

    useScrollLock(isOpen)

    useEffect(() => {
        if (!isOpen) return

        const fetchTemplates = async () => {
            setLoading(true)

            if (currentUser?.id) {
                setTemplates(await getTemplatesWithPreview(supabase, currentUser.id))
            }
            setLoading(false)
        }

        fetchTemplates()
    }, [isOpen, supabase])

    const handleApplyTemplate = async (templateId: string) => {
        if (!checklistId) return
        setLoadingTemplateId(templateId)

        try {
            const insertedItems = await applyTemplateToChecklist(supabase, checklistId, templateId, currentUser?.id)
            if (insertedItems.length === 0) {
                alert('완전해요! 해당 템플릿의 모든 항목이 이미 체크리스트에 들어있어요.')
                return
            }
            analytics.logEvent('template_use', { template_id: templateId })
            onSuccess(insertedItems)
            onClose()
        } catch (error) {
            console.error('Template apply error', error)
            alert('어라, 템플릿을 가져오다가 잠시 길을 잃었나 봐요. 다시 시도해 볼까요?')
        } finally {
            setLoadingTemplateId(null)
        }
    }

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed', inset: 0,
            bg: 'bg.scrim/50', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px',
            backdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.3s ease-out'
        })}>
            <div className={css({
                bg: 'white', borderRadius: '16px', w: '100%', maxW: '440px', p: '32px', position: 'relative',
                maxH: '85vh', display: 'flex', flexDirection: 'column',
                boxShadow: 'airbnbHover',
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)'
            })}>
                <button
                    onClick={onClose}
                    className={css({
                        position: 'absolute', right: '16px', top: '16px',
                        w: '36px', h: '36px', borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bg: 'bg.softCotton', border: 'none', cursor: 'pointer', color: 'brand.muted',
                        transition: 'all 0.2s',
                        _hover: { bg: 'bg.scrim/5', color: 'brand.ink', transform: 'rotate(90deg)' }
                    })}
                >
                    <X size={20} strokeWidth={2.5} />
                </button>

                <h3 className={css({ fontSize: '22px', fontWeight: '700', mb: '24px', color: 'brand.ink', letterSpacing: '-0.02em' })}>템플릿 불러오기</h3>

                <div className={css({ maxHeight: '400px', overflowY: 'auto', pr: '8px' })}>
                    {loading ? (
                        <div className={css({ textAlign: 'center', py: '40px', color: 'brand.muted' })}>
                            <Loader2 size={36} className={css({ animation: 'spin 1s linear infinite', mx: 'auto', mb: '16px', color: 'brand.primary' })} />
                            템플릿을 열심히 불러오고 있어요... ✈️
                        </div>
                    ) : templates.length === 0 ? (
                        <div className={css({ textAlign: 'center', py: '40px', color: 'brand.muted', fontSize: '14px' })}>
                            아직 저장된 템플릿이 없네요! 😅
                        </div>
                    ) : (
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                            {templates.map((template) => (
                                <div
                                    key={template.id}
                                    className={css({
                                        p: '18px', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '12px',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                                        transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
                                        _hover: { bg: 'bg.softCotton', borderColor: 'brand.primary', transform: 'translateY(-2px)' }
                                    })}
                                >
                                    <div className={css({ flex: 1 })}>
                                        <span className={css({ fontWeight: '700', fontSize: '15px', color: 'brand.ink', display: 'block' })}>{template.title}</span>
                                        <span className={css({ fontSize: '11px', color: 'brand.muted', fontWeight: '700' })}>
                                            {template.access === 'owner' ? '내 템플릿' : template.access === 'editor' ? '공유받음 · 편집 가능' : template.access === 'viewer' ? '공유받음 · 보기' : '기본 템플릿'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleApplyTemplate(template.id)}
                                        disabled={loadingTemplateId === template.id}
                                        className={css({
                                            bg: 'brand.primary', color: 'white', borderRadius: '8px', border: 'none',
                                            px: '14px', py: '10px', fontSize: '13px', fontWeight: '700',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                            _hover: { bg: 'brand.primaryActive', transform: 'translateY(-2px)', boxShadow: 'airbnbHover' },
                                            _active: { transform: 'scale(0.95)' },
                                            _disabled: { opacity: 0.5, cursor: 'not-allowed' }
                                        })}
                                    >
                                        {loadingTemplateId === template.id ? <Loader2 size={16} className={css({ animation: 'spin 1s linear infinite' })} /> : '가져오기'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
