'use client'

import { useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { X, Copy } from 'lucide-react'
import { analytics } from '@/services/AnalyticsService'
import { createClient } from '@/utils/supabase/client'

interface TemplateModalProps {
    isOpen: boolean
    onClose: () => void
    checklistId: string
    onSuccess: (newItems: any[]) => void
}

export default function TemplateModal({ isOpen, onClose, checklistId, onSuccess }: TemplateModalProps) {
    const supabase = createClient()
    const [templates, setTemplates] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null)

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
            alert('템플릿 항목을 불러올 수 없거나 비어 있습니다.')
            setLoadingTemplateId(null)
            return
        }

        // 2. 현재 체크리스트에 이미 존재하는 항목 가져오기 (중복 방지)
        const { data: existingItems } = await supabase
            .from('checklist_items')
            .select('item_name')
            .eq('checklist_id', checklistId)

        const existingNames = new Set(existingItems?.map((item: any) => item.item_name.trim().toLowerCase()) || [])

        // 3. 템플릿 아이템 중복 필터링
        const newItemsToInsert = templateItems.filter((tItem: any) => 
            !existingNames.has(tItem.item_name.trim().toLowerCase())
        )

        if (newItemsToInsert.length === 0) {
            alert('해당 템플릿의 모든 항목이 이미 체크리스트에 포함되어 있습니다.')
            setLoadingTemplateId(null)
            return
        }

        // 선택한 템플릿 이름 찾기
        const selectedTemplate = templates.find(t => t.id === templateId)
        const templateName = selectedTemplate ? selectedTemplate.title : null

        // 4. 현재 체크리스트에 새 항목들만 벌크 인서트할 포맷팅 배열 만들기
        const insertData = newItemsToInsert.map((tItem: any) => ({
            checklist_id: checklistId,
            item_name: tItem.item_name,
            category: tItem.category || '기타',
            is_checked: false,
            source_template_name: templateName
        }))

        const { data: insertedItems, error: insertError } = await supabase
            .from('checklist_items')
            .insert(insertData)
            .select()

        if (insertError) {
            console.error('Template apply error', insertError)
            alert('템플릿 적용 중 오류가 발생했습니다.')
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
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            bg: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px'
        })}>
            <div className={css({
                bg: 'white', borderRadius: '16px', w: '100%', maxW: '400px', p: '24px', position: 'relative',
                maxH: '80vh', display: 'flex', flexDirection: 'column'
            })}>
                <button
                    onClick={onClose}
                    className={css({ position: 'absolute', top: '20px', right: '20px', bg: 'transparent', border: 'none', cursor: 'pointer', color: '#666' })}
                >
                    <X size={24} />
                </button>

                <h3 className={css({ fontSize: '20px', fontWeight: 'bold', mb: '16px' })}>템플릿 불러오기</h3>

                {loading ? (
                    <div className={css({ textAlign: 'center', py: '40px', color: '#888' })}>템플릿을 불러오는 중...</div>
                ) : templates.length === 0 ? (
                    <div className={css({ textAlign: 'center', py: '40px', color: '#888', fontSize: '14px' })}>
                        등록된 템플릿이 없습니다.
                    </div>
                ) : (
                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, pr: '4px' })}>
                        {templates.map((template: any) => (
                            <div
                                key={template.id}
                                className={css({ p: '14px', border: '1px solid #eee', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' })}
                            >
                                <span className={css({ fontWeight: '600', fontSize: '14px', color: '#064E3B', flex: 1 })}>{template.title}</span>
                                <button
                                    onClick={() => handleApplyTemplate(template.id)}
                                    disabled={loadingTemplateId === template.id}
                                    className={css({ display: 'flex', alignItems: 'center', gap: '6px', px: '12px', py: '8px', bg: '#10B981', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', _hover: { bg: '#059669' }, _active: { transform: 'scale(0.95)' }, _disabled: { opacity: 0.5, cursor: 'not-allowed' } })}
                                >
                                    {loadingTemplateId === template.id ? '...' : (
                                        <>
                                            <Copy size={14} /> 적용
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
