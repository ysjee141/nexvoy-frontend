'use client'

import { useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { X, Copy, Loader2 } from 'lucide-react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { analytics } from '@/services/AnalyticsService'
import { createClient } from '@/utils/supabase/client'

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

            // 공용 템플릿(user_id가 null인 것)과 본인 템플릿 가져오기
            // 우선 MVP 단계에선 로그인한 유저의 세션에 맞춘 RLS를 통해 자동으로 필터링 된 데이터 가져오기
            const { data } = await supabase
                .from('checklist_templates')
                .select('*')
                .order('created_at', { ascending: false })

            if (data) {
                setTemplates(data)
            }
            setLoading(false)
        }

        fetchTemplates()
    }, [isOpen, supabase])

    const handleApplyTemplate = async (templateId: string) => {
        if (!checklistId) return
        setLoadingTemplateId(templateId)

        // 1. 선택한 템플릿의 아이템 목록 가져오기
        const { data: templateItems, error: itemsError } = await supabase
            .from('checklist_template_items')
            .select('*')
            .eq('template_id', templateId)

        if (itemsError || !templateItems || templateItems.length === 0) {
            alert('어라, 템플릿 항목을 불러올 수 없거나 비어 있네요. 다시 한번 확인해 볼까요?')
            setLoadingTemplateId(null)
            return
        }

        // 2. 선택한 템플릿 이름 찾기 (중복 체크 키 생성을 위해 먼저 조회)
        const selectedTemplate = templates.find(t => t.id === templateId)
        const templateName = selectedTemplate ? selectedTemplate.title : null

        // 3. 현재 체크리스트에 이미 존재하는 항목 가져오기 (중복 방지)
        const { data: existingItems } = await supabase
            .from('checklist_items')
            .select('item_name, source_template_name')
            .eq('checklist_id', checklistId)

        // 중복 판단 기준: 항목명(item_name) + 출처(source_template_name)
        const existingKeys = new Set(existingItems?.map((item: any) => 
            `${item.item_name.trim().toLowerCase()}|${(item.source_template_name || '').trim().toLowerCase()}`
        ) || [])

        // 4. 템플릿 아이템 중복 필터링
        const newItemsToInsert = templateItems.filter((tItem: any) => {
            const key = `${tItem.item_name.trim().toLowerCase()}|${(templateName || '').trim().toLowerCase()}`
            return !existingKeys.has(key)
        })

        if (newItemsToInsert.length === 0) {
            alert('완전해요! 해당 템플릿의 모든 항목이 이미 체크리스트에 들어있어요.')
            setLoadingTemplateId(null)
            return
        }

        // 4. 현재 체크리스트에 새 항목들만 벌크 인서트할 포맷팅 배열 만들기
        const insertData = newItemsToInsert.map((item: any) => {
            const isPrivate = item.is_private || false
            return {
                checklist_id: checklistId,
                item_name: item.item_name,
                category: item.category || '기타',
                is_checked: false,
                source_template_name: templateName,
                is_private: isPrivate,
                assignment_type: isPrivate ? 'specific' : 'anyone',
                assigned_user_id: isPrivate ? (currentUser?.id || null) : null
            }
        })

        const { data: insertedItems, error: insertError } = await supabase
            .from('checklist_items')
            .insert(insertData)
            .select()

        if (insertError) {
            console.error('Template apply error', insertError)
            alert('어라, 템플릿을 가져오다가 잠시 길을 잃었나 봐요. 다시 시도해 볼까요?')
        } else if (insertedItems) {
            analytics.logEvent('template_use', { template_id: templateId })
            onSuccess(insertedItems)
            onClose()
        }
        setLoadingTemplateId(null)
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
                                    <span className={css({ fontWeight: '700', fontSize: '15px', color: 'brand.ink', flex: 1 })}>{template.title}</span>
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
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
