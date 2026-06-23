'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { css } from 'styled-system/css'
import { X, Trash2, Sparkles, Loader2 } from 'lucide-react'
import { useModalBackButton } from '@/hooks/useModalBackButton'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/stores/useUIStore'
import TemplateForm, { TemplateItemInput } from './TemplateForm'
import {
    createChecklistCategory,
    deleteChecklistCategory,
    getChecklistCategories,
    getProfileByEmail,
    getTemplateShares,
    removeTemplateShare,
    shareTemplate,
    updateChecklistCategory,
    updateTemplateShareRole,
} from '@nexvoy/core'
import type { ChecklistCategory, ChecklistTemplateShareWithProfile } from '@nexvoy/types'

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
    const [categories, setCategories] = useState<ChecklistCategory[]>([])
    const [shares, setShares] = useState<ChecklistTemplateShareWithProfile[]>([])
    const [ownerId, setOwnerId] = useState<string | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [shareEmail, setShareEmail] = useState('')
    const [shareRole, setShareRole] = useState<'viewer' | 'editor'>('viewer')
    const canManageShares = Boolean(ownerId && currentUserId && ownerId === currentUserId)
    const canEditTemplate = canManageShares || shares.some((share) => share.shared_with_user_id === currentUserId && share.role === 'editor')

    const fetchTemplate = useCallback(async () => {
        if (!templateId) return
        
        setFetching(true)
        try {
            const { data, error } = await supabase
                .from('checklist_templates')
                .select(`
                    id, 
                    user_id,
                    title, 
                    checklist_template_items (id, item_name, category, is_private)
                `)
                .eq('id', templateId)
                .single()

            if (data) {
                setOwnerId(data.user_id)
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
                const { data: { session } } = await supabase.auth.getSession()
                setCurrentUserId(session?.user.id ?? null)
                if (session?.user.id) {
                    const [categoryData, shareData] = await Promise.all([
                        getChecklistCategories(supabase, session.user.id),
                        getTemplateShares(supabase, templateId),
                    ])
                    setCategories(categoryData)
                    setShares(shareData)
                }
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
        if (!templateId) return
        if (!canManageShares) {
            alert('템플릿 삭제는 소유자만 할 수 있어요.')
            return
        }
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
        if (!templateId) return
        if (!canEditTemplate) {
            alert('이 템플릿은 보기 권한만 있어요.')
            return
        }
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

    const loadCategories = useCallback(async () => {
        if (!currentUserId) return
        setCategories(await getChecklistCategories(supabase, currentUserId))
    }, [currentUserId, supabase])

    const loadShares = useCallback(async () => {
        if (!templateId) return
        setShares(await getTemplateShares(supabase, templateId))
    }, [supabase, templateId])

    const handleCreateCategory = useCallback(async (name: string) => {
        if (!currentUserId) return
        await createChecklistCategory(supabase, { user_id: currentUserId, name })
        await loadCategories()
    }, [currentUserId, loadCategories, supabase])

    const handleRenameCategory = useCallback(async (id: string, name: string) => {
        await updateChecklistCategory(supabase, id, { name })
        await loadCategories()
    }, [loadCategories, supabase])

    const handleDeleteCategory = useCallback(async (id: string) => {
        if (!confirm('이 카테고리를 삭제할까요? 기존 준비물의 카테고리 텍스트는 유지됩니다.')) return
        await deleteChecklistCategory(supabase, id)
        await loadCategories()
    }, [loadCategories, supabase])

    const handleShareTemplate = useCallback(async () => {
        if (!templateId || !currentUserId || !shareEmail.trim()) return
        const profile = await getProfileByEmail(supabase, shareEmail)
        if (!profile) {
            alert('해당 이메일의 사용자를 찾지 못했어요.')
            return
        }
        if (profile.id === ownerId) {
            alert('소유자에게는 공유할 필요가 없어요.')
            return
        }
        await shareTemplate(supabase, {
            template_id: templateId,
            shared_with_user_id: profile.id,
            role: shareRole,
            created_by: currentUserId,
        })
        setShareEmail('')
        await loadShares()
    }, [currentUserId, loadShares, ownerId, shareEmail, shareRole, supabase, templateId])

    if (!isOpen) return null

    return (
        <div className={css({
            position: 'fixed', inset: 0, zIndex: 3000,
            bg: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: { base: 'flex-start', sm: 'center' },
            justifyContent: 'center', p: { base: '0', sm: '20px' },
            animation: 'fadeIn 0.3s ease-out'
        })}>
            <div className={css({
                bg: 'white', w: '100%', maxW: { base: '100%', sm: '600px' },
                h: { base: '100dvh', sm: 'auto' }, maxH: { base: '100dvh', sm: '90vh' },
                borderRadius: { base: '0', sm: '16px' },
                boxShadow: { base: 'none', sm: 'floating' },
                display: 'flex', flexDirection: 'column',
                pt: { base: 'max(env(safe-area-inset-top), var(--safe-area-inset-top))', sm: '0' },
                pb: { base: 'max(env(safe-area-inset-bottom), var(--safe-area-inset-bottom))', sm: '0' },
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)',
                overflow: 'hidden'
            })}>
                {/* 헤더 */}
                <div className={css({
                    p: '22px 24px', borderBottom: '1px solid', borderBottomColor: 'brand.hairline', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center', bg: 'white', zIndex: 10
                })}>
                    <button
                        onClick={handleDeleteTemplate}
                        disabled={loading || fetching || !canManageShares}
                        className={css({ 
                            p: '10px', borderRadius: '14px', bg: 'brand.error/10', color: 'brand.error', 
                            transition: 'all 0.2s', _hover: { bg: 'brand.error/20', transform: 'scale(1.05)' },
                            _disabled: { opacity: 0.5 }
                        })}
                        title="템플릿 삭제"
                    >
                        <Trash2 size={18} />
                    </button>
                    <h2 className={css({ fontSize: '18px', fontWeight: '700', color: 'brand.ink', letterSpacing: '-0.02em', position: 'absolute', left: '50%', transform: 'translateX(-50%)' })}>
                        템플릿 수정하기
                    </h2>
                    <button
                        onClick={handleClose}
                        className={css({ 
                            p: '8px', borderRadius: '50%', bg: 'bg.softCotton', color: 'brand.muted', 
                            transition: 'all 0.2s', 
                            _hover: { bg: 'rgba(0,0,0,0.05)', color: 'brand.ink', transform: 'rotate(90deg)' } 
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
                                    w: '64px', h: '64px', bg: 'brand.primary/10', borderRadius: '16px', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', m: '0 auto 20px',
                                    boxShadow: 'none'
                                })}>
                                    <Sparkles size={28} className={css({ color: 'brand.primary' })} strokeWidth={2.2} />
                                </div>
                                <h3 className={css({ fontSize: '24px', fontWeight: '800', color: 'brand.ink', mb: '8px', letterSpacing: '-0.03em' })}>{title}</h3>
                                <p className={css({ color: 'brand.muted', fontSize: '15px', fontWeight: '500' })}>필요한 항목들을 자유롭게 수정해 보세요. ✨</p>
                            </div>

                            <div className={css({ mx: { base: '20px', sm: '32px' }, mb: '16px', p: '18px', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '16px', bg: 'bg.surfaceSoft' })}>
                                <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '12px' })}>
                                    <h4 className={css({ fontSize: '15px', fontWeight: '800', color: 'brand.ink' })}>템플릿 공유</h4>
                                    <span className={css({ fontSize: '12px', fontWeight: '700', color: canManageShares ? 'brand.primary' : 'brand.muted' })}>
                                        {canManageShares ? 'Owner' : canEditTemplate ? 'Editor' : 'Viewer'}
                                    </span>
                                </div>
                                {canManageShares ? (
                                    <div className={css({ display: 'flex', gap: '8px', mb: '12px', flexDirection: { base: 'column', sm: 'row' } })}>
                                        <input
                                            type="email"
                                            value={shareEmail}
                                            onChange={(e) => setShareEmail(e.target.value)}
                                            placeholder="공유할 사용자 이메일"
                                            className={css({ flex: 1, p: '12px 14px', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', bg: 'white', outline: 'none', fontSize: '14px' })}
                                        />
                                        <select
                                            value={shareRole}
                                            onChange={(e) => setShareRole(e.target.value as 'viewer' | 'editor')}
                                            className={css({ p: '12px', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', bg: 'white', fontSize: '13px', fontWeight: '700' })}
                                        >
                                            <option value="viewer">뷰어</option>
                                            <option value="editor">편집</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleShareTemplate}
                                            disabled={!shareEmail.trim()}
                                            className={css({ px: '16px', borderRadius: '8px', bg: 'brand.primary', color: 'white', fontSize: '13px', fontWeight: '800', border: 'none', cursor: 'pointer', _disabled: { opacity: 0.4, cursor: 'not-allowed' } })}
                                        >
                                            공유
                                        </button>
                                    </div>
                                ) : (
                                    <p className={css({ fontSize: '13px', color: 'brand.muted', lineHeight: '1.6', mb: '12px' })}>
                                        공유 사용자 관리는 템플릿 소유자만 할 수 있어요.
                                    </p>
                                )}
                                <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                                    {shares.length === 0 ? (
                                        <p className={css({ fontSize: '13px', color: 'brand.muted' })}>아직 공유된 사용자가 없어요.</p>
                                    ) : shares.map((share) => {
                                        const label = share.profiles?.nickname || share.profiles?.email || share.shared_with_user_id
                                        return (
                                            <div key={share.id} className={css({ display: 'flex', alignItems: 'center', gap: '10px', bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '12px', p: '10px 12px' })}>
                                                <span className={css({ flex: 1, fontSize: '13px', fontWeight: '700', color: 'brand.ink', minW: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>{label}</span>
                                                <select
                                                    value={share.role}
                                                    disabled={!canManageShares}
                                                    onChange={async (e) => {
                                                        await updateTemplateShareRole(supabase, share.id, e.target.value as 'viewer' | 'editor')
                                                        await loadShares()
                                                    }}
                                                    className={css({ p: '8px', borderRadius: '8px', border: '1px solid', borderColor: 'brand.hairline', bg: 'white', fontSize: '12px', fontWeight: '700' })}
                                                >
                                                    <option value="viewer">뷰어</option>
                                                    <option value="editor">편집</option>
                                                </select>
                                                {canManageShares && (
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            await removeTemplateShare(supabase, share.id)
                                                            await loadShares()
                                                        }}
                                                        className={css({ border: 'none', bg: 'transparent', color: 'brand.error', cursor: 'pointer', display: 'flex' })}
                                                        aria-label={`${label} 공유 해제`}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
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
                                categories={categories}
                                onCreateCategory={handleCreateCategory}
                                onRenameCategory={handleRenameCategory}
                                onDeleteCategory={handleDeleteCategory}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
