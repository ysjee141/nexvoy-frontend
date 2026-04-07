'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { X, Trash2, Sparkles, Loader2 } from 'lucide-react'
import { useModalBackButton } from '@/hooks/useModalBackButton'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/stores/useUIStore'
import TemplateForm, { TemplateItemInput } from './TemplateForm'

interface EditTemplateModalProps {
    isOpen: boolean
    onClose: () => void
    templateId: string | null
    onSuccess?: () => void
}

export default function EditTemplateModal({ isOpen, onClose, templateId, onSuccess }: EditTemplateModalProps) {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(false)

    // 폼 상태
    const [title, setTitle] = useState('')
    const [items, setItems] = useState<TemplateItemInput[]>([])
    const [originalItemIds, setOriginalItemIds] = useState<string[]>([])
    const [deletedItemIds, setDeletedItemIds] = useState<string[]>([])

    const fetchTemplate = useCallback(async () => {
        if (!templateId) return
        
        setFetching(true)
        try {
            const { data, error } = await supabase
                .from('checklist_templates')
                .select(`
                    id, 
                    title, 
                    checklist_template_items (id, item_name, category, is_private)
                `)
                .eq('id', templateId)
                .single()

            if (data) {
                setTitle(data.title)
                const mappedItems = (data.checklist_template_items || []).map((item: any) => ({
                    id: item.id,
                    item_name: item.item_name,
                    category: item.category || '기타',
                    is_private: item.is_private || false,
                    isNew: false
                }))
                setItems(mappedItems)
                setOriginalItemIds(mappedItems.map((i: any) => i.id))
                setDeletedItemIds([])
            } else if (error) {
                console.error("Fetch template error:", error)
                alert('템플릿 정보를 불러오는 데 실패했어요.')
                onClose()
            }
        } finally {
            setFetching(false)
        }
    }, [templateId, supabase, onClose])

    useEffect(() => {
        if (isOpen && templateId) {
            fetchTemplate()
        }
    }, [isOpen, templateId, fetchTemplate])

    const handleClose = useCallback(() => {
        // 수정 모달은 이탈 방지 확인을 조금 더 단순하게 처리 (변화 여부 체크 가능하지만 여기선 확인창 위주)
        onClose()
    }, [onClose])

    useModalBackButton(isOpen, handleClose, 'editTemplateModal')

    const handleDeleteTemplate = async () => {
        if (!confirm('정말 이 템플릿을 삭제하시겠어요? 🥺')) return

        setLoading(true)
        try {
            const { error } = await supabase.from('checklist_templates').delete().eq('id', templateId)
            if (error) throw error
            
            if (onSuccess) onSuccess()
            onClose()
            router.refresh()
        } catch (err) {
            alert('삭제하는 중에 문제가 생겼어요.')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) {
            alert('템플릿 이름을 지어주세요!')
            return
        }

        const validItems = items.filter((item) => item.item_name.trim() !== '')
        if (validItems.length === 0) {
            alert('적어도 하나의 준비물은 등록되어야 해요!')
            return
        }

        setLoading(true)

        try {
            // 1. 타이틀 업데이트
            const { error: titleError } = await supabase
                .from('checklist_templates')
                .update({ title: title.trim() })
                .eq('id', templateId)

            if (titleError) throw titleError

            // 2. 삭제된 항목 처리
            // UI에서 제거된 항목들 중 원래 DB에 있던 것들 찾기
            const currentItemIds = items.map(i => i.id)
            const itemsToDelete = originalItemIds.filter(id => !currentItemIds.includes(id))
            
            if (itemsToDelete.length > 0) {
                await supabase.from('checklist_template_items').delete().in('id', itemsToDelete)
            }

            // 3. Upsert / Insert
            const existingItems = validItems.filter(i => !i.isNew)
            const newItems = validItems.filter(i => i.isNew)

            if (existingItems.length > 0) {
                await supabase.from('checklist_template_items').upsert(
                    existingItems.map(i => ({
                        id: i.id,
                        template_id: templateId,
                        item_name: i.item_name.trim(),
                        category: i.category,
                        is_private: i.is_private
                    }))
                )
            }

            if (newItems.length > 0) {
                await supabase.from('checklist_template_items').insert(
                    newItems.map(i => ({
                        template_id: templateId,
                        item_name: i.item_name.trim(),
                        category: i.category,
                        is_private: i.is_private
                    }))
                )
            }

            if (onSuccess) onSuccess()
            onClose()
            router.refresh()

        } catch (error: any) {
            console.error('Error updating template:', error)
            alert('저장 중에 잠시 문제가 생겼어요.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed', inset: 0, zIndex: 3000,
            bg: 'black/50',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: { base: 'flex-start', sm: 'center' },
            justifyContent: 'center', p: { base: '0', sm: '20px' },
            animation: 'fadeIn 0.3s ease-out'
        })}>
            <div className={css({
                bg: 'white', w: '100%', maxW: { base: '100%', sm: '600px' },
                h: { base: '100dvh', sm: 'auto' }, maxH: { base: '100dvh', sm: '90vh' },
                borderRadius: { base: '0', sm: '32px' },
                boxShadow: { base: 'none', sm: 'floating' },
                display: 'flex', flexDirection: 'column',
                pt: { base: 'env(safe-area-inset-top)', sm: '0' },
                pb: { base: 'env(safe-area-inset-bottom)', sm: '0' },
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)',
                overflow: 'hidden'
            })}>
                {/* 헤더 */}
                <div className={css({
                    p: '22px 24px', borderBottom: '1px solid', borderBottomColor: 'brand.border', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center', bg: 'white', zIndex: 10
                })}>
                    <button
                        onClick={handleDeleteTemplate}
                        disabled={loading || fetching}
                        className={css({ 
                            p: '10px', borderRadius: '14px', bg: 'brand.error/10', color: 'brand.error', 
                            transition: 'all 0.2s', _hover: { bg: 'brand.error/20', transform: 'scale(1.05)' },
                            _disabled: { opacity: 0.5 }
                        })}
                        title="템플릿 삭제"
                    >
                        <Trash2 size={18} />
                    </button>
                    <h2 className={css({ fontSize: '18px', fontWeight: '700', color: 'brand.secondary', letterSpacing: '-0.02em', position: 'absolute', left: '50%', transform: 'translateX(-50%)' })}>
                        템플릿 수정하기
                    </h2>
                    <button
                        onClick={handleClose}
                        className={css({ 
                            p: '8px', borderRadius: '50%', bg: 'bg.softCotton', color: 'brand.muted', 
                            transition: 'all 0.2s', 
                            _hover: { bg: 'brand.border', color: 'brand.secondary', transform: 'rotate(90deg)' } 
                        })}
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                <div className={css({ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' })}>
                    {fetching ? (
                        <div className={css({ p: '32px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
                            <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' })}>
                                <Loader2 size={40} className={css({ color: 'brand.primary', animation: 'spin 1.5s linear infinite' })} />
                                <p className={css({ fontSize: '16px', fontWeight: '600', color: 'brand.muted' })}>정보를 불러오고 있어요...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className={css({ p: { base: '32px 24px 20px', sm: '40px 32px 32px' }, textAlign: 'center', flexShrink: 0 })}>
                                <div className={css({ 
                                    w: '64px', h: '64px', bg: 'brand.primary/10', borderRadius: '24px', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', m: '0 auto 20px',
                                    boxShadow: '0 8px 16px rgba(46, 196, 182, 0.1)'
                                })}>
                                    <Sparkles size={28} className={css({ color: 'brand.primary' })} strokeWidth={2.2} />
                                </div>
                                <h3 className={css({ fontSize: '24px', fontWeight: '800', color: 'brand.secondary', mb: '8px', letterSpacing: '-0.03em' })}>{title}</h3>
                                <p className={css({ color: 'brand.muted', fontSize: '15px', fontWeight: '500' })}>필요한 항목들을 자유롭게 수정해 보세요. ✨</p>
                            </div>

                            <TemplateForm
                                title={title}
                                setTitle={setTitle}
                                items={items}
                                setItems={setItems}
                                onSubmit={handleSubmit}
                                loading={loading}
                                onCancel={handleClose}
                                submitText="변경 내용 저장할게요"
                                isEdit={true}
                            />
                        </>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
