'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Plus, X, ArrowLeft, Save, Trash2, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useUIStore } from '@/stores/useUIStore'
import { CATEGORIES } from '@/constants/checklist'

interface TemplateItemInput {
    id: string; // db id 혹은 로컬 임시 id
    item_name: string;
    category: string;
    isNew?: boolean; // 신규 추가된 항목 식별용
}



export default function EditTemplatePage({ initialData }: { initialData: any }) {
    const searchParams = useSearchParams()
    const templateId = searchParams.get('id')

    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(!initialData)

    const [title, setTitle] = useState(initialData?.title || '')
    const [items, setItems] = useState<TemplateItemInput[]>(
        initialData?.checklist_template_items?.map((item: any) => ({
            id: item.id,
            item_name: item.item_name,
            category: item.category || '기타',
            isNew: false
        })) || []
    )
    const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]) // 기존 항목 중 삭제된 DB ID 추적
    const { setMobileTitle } = useUIStore()

    useEffect(() => {
        if (title) {
            setMobileTitle(`${title} 수정하기`)
        }
        return () => setMobileTitle(null)
    }, [title, setMobileTitle])

    useEffect(() => {
        if (initialData) return // 이미 데이터가 있으면 페칭 스킵

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
                alert('템플릿 정보를 불러오는 데 실패했어요.')
                router.push('/templates')
            }
            setInitialLoading(false)
        }

        fetchTemplate()
    }, [templateId, supabase, router, initialData])

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
        if (!confirm('정말 이 템플릿을 삭제하시겠어요? 함께 등록된 모든 항목이 사라지게 돼요. 🥺')) return

        setLoading(true)
        const { error } = await supabase.from('checklist_templates').delete().eq('id', templateId)
        if (error) {
            alert('삭제하는 중에 문제가 생겼어요. 다시 시도해 주세요.')
            setLoading(false)
        } else {
            router.push('/templates')
            router.refresh()
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) {
            alert('템플릿 이름을 지어주세요!')
            return
        }

        const validItems = items.filter((item: any) => item.item_name.trim() !== '')
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

            alert('템플릿이 성공적으로 수정되었어요! ✨')
            router.push('/templates')
            router.refresh()

        } catch (error: any) {
            console.error('Error updating template:', error)
            alert('저장 중에 잠시 문제가 생겼어요. 다시 한번 시도해 주시겠어요?')
            setLoading(false)
        }
    }

    if (initialLoading) {
        return <div className={css({ p: '40px', textAlign: 'center', color: '#888' })}>템플릿 정보를 불러오고 있어요... ✈️</div>
    }

    return (
        <div className={css({ w: '100%', maxW: '800px', mx: 'auto', py: { base: '20px', sm: '40px' } })}>
            <div className={css({ 
                mb: '32px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                gap: '12px'
            })}>
                <div className={css({ 
                    textAlign: 'left',
                    flex: '1'
                })}>
                    <Link
                        href="/templates"
                        className={css({
                            display: { base: 'none', sm: 'inline-flex' },
                            alignItems: 'center',
                            gap: '6px',
                            color: '#666',
                            textDecoration: 'none',
                            fontSize: '15px',
                            mb: '16px',
                            _hover: { color: '#172554' },
                        })}
                    >
                        <ArrowLeft size={18} /> 목록으로 돌아가기
                    </Link>
                    <h1 className={css({ fontSize: { base: '24px', sm: '28px' }, fontWeight: '800', color: '#2C3A47', lineHeight: '1.2' })}>
                        {title} 수정하기
                    </h1>
                </div>

                <button
                    onClick={handleDeleteTemplate}
                    disabled={loading}
                    className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: '10px',
                        bg: '#fdeeea',
                        color: '#EF4444',
                        border: 'none',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        _hover: { bg: '#fad2cf', transform: 'scale(1.05)' },
                        _disabled: { opacity: 0.5, cursor: 'not-allowed' }
                    })}
                    title="템플릿 삭제"
                >
                    <Trash2 size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className={css({ bg: 'white', p: { base: '20px', sm: '32px' }, borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #EEEEEE' })}>
                <div className={css({ mb: '32px' })}>
                    <label className={css({ display: 'block', fontSize: '15px', fontWeight: '700', mb: '8px', color: '#2C3A47' })}>
                        템플릿 이름
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="예: 여름 바다 여행 필수템 🏖️"
                        className={css({ w: '100%', p: '14px 16px', border: '1px solid #EEEEEE', borderRadius: '12px', outline: 'none', bg: '#F9F9F9', fontSize: '15px', fontWeight: '600', color: '#2C3A47', transition: 'all 0.2s', _placeholder: { color: '#CCC', fontWeight: '400' }, _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 3px rgba(46, 196, 182, 0.1)' } })}
                        required
                    />
                </div>

                <hr className={css({ border: 'none', borderTop: '1px solid #eee', mb: '32px' })} />

                <div className={css({ mb: '32px' })}>
                    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '16px' })}>
                        <label className={css({ display: 'block', fontSize: '15px', fontWeight: '700', color: '#2C3A47' })}>
                            준비물 항목을 다듬어 보세요
                        </label>
                        <span className={css({ fontSize: '13px', color: '#717171', fontWeight: '600' })}>총 {items.length}개</span>
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                        {items.length === 0 ? (
                            <div className={css({ p: '20px', textAlign: 'center', color: '#999', bg: '#F7F7F7', borderRadius: '12px' })}>
                                아직 등록된 준비물이 없어요. 새로운 항목을 추가해 보세요!
                            </div>
                        ) : (
                            items.map((item, index) => (
                                <div key={item.id} className={css({
                                    display: 'flex',
                                    flexDirection: { base: 'column', sm: 'row' },
                                    alignItems: { base: 'stretch', sm: 'center' },
                                    bg: 'white',
                                    borderRadius: '16px',
                                    border: '1px solid #eee',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                                    overflow: 'hidden',
                                    transition: 'all 0.2s',
                                    _focusWithin: { borderColor: '#2EC4B6', boxShadow: '0 4px 12px rgba(46,196,182,0.1)' }
                                })}>
                                    <div className={css({ position: 'relative', borderRight: { base: 'none', sm: '1px solid #EEEEEE' }, borderBottom: { base: '1px solid #EEEEEE', sm: 'none' }, w: { base: '100%', sm: '140px' }, flexShrink: 0, bg: '#F9F9F9' })}>
                                        <select
                                            value={item.category}
                                            onChange={(e) => handleItemChange(item.id, 'category', e.target.value)}
                                            className={css({ w: '100%', p: '14px 40px 14px 16px', bg: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontWeight: '800', color: '#2C3A47', cursor: 'pointer', appearance: 'none' })}
                                        >
                                            {CATEGORIES.map((cat: any) => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                        <div className={css({ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#2EC4B6' })}>
                                            <ChevronDown size={16} strokeWidth={3} />
                                        </div>
                                    </div>

                                    <div className={css({ display: 'flex', flex: 1, alignItems: 'center' })}>
                                        <input
                                            type="text"
                                            value={item.item_name}
                                            onChange={(e) => handleItemChange(item.id, 'item_name', e.target.value)}
                                            placeholder={`${index + 1}번째 준비물`}
                                            className={css({ flex: 1, p: '14px 16px', border: 'none', outline: 'none', fontSize: '15px', fontWeight: '600', bg: 'transparent', color: '#2C3A47', _placeholder: { color: '#CCC', fontWeight: '400' } })}
                                            required
                                        />

                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(item)}
                                            className={css({ p: '14px', color: '#ff4d4f', bg: 'transparent', border: 'none', cursor: 'pointer', _hover: { color: '#dc2626', bg: '#fff1f0' }, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' })}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleAddItem}
                        className={css({ w: '100%', mt: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', p: '14px', bg: '#F2F4F5', color: '#2C3A47', borderRadius: '16px', border: '1px dashed #CCC', cursor: 'pointer', fontSize: '15px', fontWeight: '700', transition: 'all 0.2s', _hover: { bg: '#EAF9F7', color: '#2EC4B6', borderColor: '#2EC4B6' }, _active: { transform: 'scale(0.98)' } })}
                    >
                        <Plus size={18} strokeWidth={3} /> 준비물 추가하기
                    </button>
                </div>

                <div className={css({ display: 'flex', justifyContent: 'flex-end', gap: '12px', pt: '24px', borderTop: '1px solid #eee' })}>
                    <Link
                        href="/templates"
                        className={css({ px: '24px', py: '14px', color: '#717171', bg: '#F5F5F5', borderRadius: '14px', cursor: 'pointer', fontWeight: '700', textDecoration: 'none', fontSize: '15px', transition: 'all 0.2s', _hover: { bg: '#EEEEEE' }, _active: { transform: 'scale(0.96)' } })}
                    >
                        취소
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        className={css({ display: 'flex', alignItems: 'center', gap: '8px', px: '24px', py: '12px', bg: '#2EC4B6', color: 'white', borderRadius: '16px', fontWeight: '700', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(46,196,182,0.2)', _hover: { bg: '#249E93' } })}
                    >
                        <Save size={18} /> {loading ? '저장 중...' : '변경 내용 저장할게요'}
                    </button>
                </div>
            </form>
        </div>
    )
}
