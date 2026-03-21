'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Plus, X, ArrowLeft, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface TemplateItemInput {
    id: string; // db id 혹은 로컬 임시 id
    item_name: string;
    category: string;
    isNew?: boolean; // 신규 추가된 항목 식별용
}

const CATEGORIES = ['의류', '전자기기', '세면도구', '상비약', '서류', '기타']

export default function EditTemplatePage() {
    const searchParams = useSearchParams()
    const templateId = searchParams.get('id')

    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)

    const [title, setTitle] = useState('')
    const [items, setItems] = useState<TemplateItemInput[]>([])
    const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]) // 기존 항목 중 삭제된 DB ID 추적

    useEffect(() => {
        const fetchTemplate = async () => {
            const { data, error } = await supabase
                .from('checklist_templates')
                .select(`
                    id, 
                    title, 
                    checklist_template_items (id, item_name, category)
                `)
                .eq('id', templateId)
                .single()

            if (data) {
                setTitle(data.title)
                if (data.checklist_template_items) {
                    setItems(data.checklist_template_items.map((item: any) => ({
                        id: item.id,
                        item_name: item.item_name,
                        category: item.category || '기타',
                        isNew: false
                    })))
                } else {
                    setItems([])
                }
            } else if (error) {
                console.error("Fetch template error:", error)
                alert('템플릿을 불러올 수 없습니다.')
                router.push('/templates')
            }
            setInitialLoading(false)
        }

        fetchTemplate()
    }, [templateId, supabase, router])

    const handleAddItem = () => {
        setItems([
            ...items,
            { id: Date.now().toString(), item_name: '', category: '기타', isNew: true }
        ])
    }

    const handleRemoveItem = (itemToRemove: TemplateItemInput) => {
        if (!itemToRemove.isNew) {
            // DB에 존재하는 항목이면 삭제 대기열에 추가
            setDeletedItemIds([...deletedItemIds, itemToRemove.id])
        }
        // UI에서 즉시 제거
        setItems(items.filter((item: any) => item.id !== itemToRemove.id))
    }

    const handleItemChange = (id: string, field: 'item_name' | 'category', value: string) => {
        setItems(items.map((item: any) =>
            item.id === id ? { ...item, [field]: value } : item
        ))
    }

    const handleDeleteTemplate = async () => {
        if (!confirm('정말 이 템플릿을 삭제하시겠습니까? 관련된 시스템 내 항목들도 모두 삭제됩니다.')) return

        setLoading(true)
        const { error } = await supabase.from('checklist_templates').delete().eq('id', templateId)
        if (error) {
            alert('삭제에 실패했습니다.')
            setLoading(false)
        } else {
            router.push('/templates')
            router.refresh()
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) {
            alert('템플릿 이름을 입력해주세요.')
            return
        }

        const validItems = items.filter((item: any) => item.item_name.trim() !== '')
        if (validItems.length === 0) {
            alert('최소 1개 이상의 유효한 항목이 필요합니다.')
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

            // 2. 삭제된 기존 Item 제거
            if (deletedItemIds.length > 0) {
                const { error: deleteError } = await supabase
                    .from('checklist_template_items')
                    .delete()
                    .in('id', deletedItemIds)

                if (deleteError) throw deleteError
            }

            // 3. 신규 추가 및 기준 항목 수정
            const existingItemsToUpdate = validItems.filter((item: any) => !item.isNew)
            const newItemsToInsert = validItems.filter((item: any) => item.isNew)

            // 3-1. 기존 항목 업데이트 (각 건별 혹은 Bulk Upsert)
            // Supabase client의 upsert 사용
            if (existingItemsToUpdate.length > 0) {
                const updatePayload = existingItemsToUpdate.map((item: any) => ({
                    id: item.id,
                    template_id: templateId,
                    item_name: item.item_name.trim(),
                    category: item.category
                }))
                const { error: updateError } = await supabase
                    .from('checklist_template_items')
                    .upsert(updatePayload) // PK 매칭으로 자동 আপডেট

                if (updateError) throw updateError
            }

            // 3-2. 신규 항목 Insert
            if (newItemsToInsert.length > 0) {
                const insertPayload = newItemsToInsert.map((item: any) => ({
                    template_id: templateId,
                    item_name: item.item_name.trim(),
                    category: item.category
                }))
                const { error: insertError } = await supabase
                    .from('checklist_template_items')
                    .insert(insertPayload)

                if (insertError) throw insertError
            }

            alert('템플릿이 성공적으로 수정되었습니다.')
            router.push('/templates')
            router.refresh()

        } catch (error: any) {
            console.error('Error updating template:', error)
            alert('템플릿 저장 중 오류가 발생했습니다. 다시 시도해주세요.')
            setLoading(false)
        }
    }

    if (initialLoading) {
        return <div className={css({ p: '40px', textAlign: 'center', color: '#888' })}>템플릿 정보를 불러오는 중...</div>
    }

    return (
        <div className={css({ w: '100%', maxW: '800px', mx: 'auto', py: '40px' })}>
            <div className={css({ mb: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' })}>
                <div>
                    <Link
                        href="/templates"
                        className={css({
                            display: { base: 'inline-flex', sm: 'none' },
                            alignItems: 'center',
                            gap: '6px',
                            color: '#666',
                            textDecoration: 'none',
                            fontSize: '15px',
                            mb: '16px',
                            _hover: { color: '#111' },
                        })}
                    >
                        <ArrowLeft size={18} /> 목록으로 돌아가기
                    </Link>
                    <h1 className={css({ fontSize: '28px', fontWeight: 'bold', color: '#111' })}>
                        템플릿 수정
                    </h1>
                </div>

                <button
                    onClick={handleDeleteTemplate}
                    disabled={loading}
                    className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#dc2626',
                        bg: '#fee2e2',
                        px: '16px',
                        py: '10px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                        transition: 'all 0.2s',
                        _hover: { bg: '#fecaca' },
                        _disabled: { opacity: 0.5, cursor: 'not-allowed' }
                    })}
                >
                    <Trash2 size={16} /> 삭제하기
                </button>
            </div>

            <form onSubmit={handleSubmit} className={css({ bg: 'white', p: '32px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' })}>
                <div className={css({ mb: '32px' })}>
                    <label className={css({ display: 'block', fontSize: '15px', fontWeight: '600', mb: '8px', color: '#333' })}>
                        템플릿 이름
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="예: 여름 휴양지 기본 세트"
                        className={css({ w: '100%', p: '14px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', fontSize: '15px', _focus: { borderColor: '#4285F4' } })}
                        required
                    />
                </div>

                <hr className={css({ border: 'none', borderTop: '1px solid #eee', mb: '32px' })} />

                <div className={css({ mb: '32px' })}>
                    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '16px' })}>
                        <label className={css({ display: 'block', fontSize: '15px', fontWeight: '600', color: '#333' })}>
                            항목 구성 수정
                        </label>
                        <span className={css({ fontSize: '13px', color: '#888' })}>총 {items.length}개</span>
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                        {items.length === 0 ? (
                            <div className={css({ p: '20px', textAlign: 'center', color: '#999', bg: '#f9f9f9', borderRadius: '8px' })}>
                                등록된 항목이 없습니다. 항목을 추가해보세요.
                            </div>
                        ) : (
                            items.map((item, index) => (
                                <div key={item.id} className={css({ display: 'flex', flexDirection: { base: 'column', sm: 'row' }, gap: '8px', alignItems: { base: 'stretch', sm: 'center' }, p: { base: '12px', sm: '0' }, bg: { base: '#fafafa', sm: 'transparent' }, borderRadius: '8px', border: { base: '1px solid #eee', sm: 'none' } })}>
                                    <select
                                        value={item.category}
                                        onChange={(e) => handleItemChange(item.id, 'category', e.target.value)}
                                        className={css({ p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', bg: { base: 'white', sm: '#f9f9f9' }, w: { base: '100%', sm: '120px' }, fontSize: '14px', _focus: { borderColor: '#4285F4' }, flexShrink: 0 })}
                                    >
                                        {CATEGORIES.map((cat: any) => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>

                                    <div className={css({ display: 'flex', gap: '8px', flex: 1 })}>
                                        <input
                                            type="text"
                                            value={item.item_name}
                                            onChange={(e) => handleItemChange(item.id, 'item_name', e.target.value)}
                                            placeholder={`항목 ${index + 1}`}
                                            className={css({ flex: 1, p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', fontSize: '14px', _focus: { borderColor: '#4285F4' } })}
                                            required
                                        />

                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(item)}
                                            className={css({ p: '12px', color: '#dc2626', bg: '#fee2e2', borderRadius: '8px', border: 'none', cursor: 'pointer', _hover: { bg: '#fecaca' }, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' })}
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleAddItem}
                        className={css({ w: '100%', mt: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', p: '14px', bg: '#f8f9fa', color: '#555', borderRadius: '8px', border: '1px dashed #ccc', cursor: 'pointer', fontSize: '15px', fontWeight: '500', transition: 'all 0.2s', _hover: { bg: '#f1f3f4', borderColor: '#aaa' } })}
                    >
                        <Plus size={18} /> 새 항목 추가하기
                    </button>
                </div>

                <div className={css({ display: 'flex', justifyContent: 'flex-end', gap: '12px', pt: '24px', borderTop: '1px solid #eee' })}>
                    <Link
                        href="/templates"
                        className={css({ px: '20px', py: '12px', color: '#555', bg: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '600', textDecoration: 'none' })}
                    >
                        취소
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        className={css({ display: 'flex', alignItems: 'center', gap: '8px', px: '24px', py: '12px', bg: '#111', color: 'white', borderRadius: '8px', fontWeight: '600', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.2s', _hover: { bg: '#333' } })}
                    >
                        <Save size={18} /> {loading ? '저장 중...' : '변경사항 저장'}
                    </button>
                </div>
            </form>
        </div>
    )
}
