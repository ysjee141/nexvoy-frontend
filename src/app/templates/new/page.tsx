'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Plus, X, ArrowLeft, Save, ChevronDown, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { CATEGORIES } from '@/constants/checklist'

interface TemplateItemInput {
    id: string; // 로컬 고유키
    item_name: string;
    category: string;
    is_private: boolean;
}



export default function NewTemplatePage() {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)

    // 폼 상태
    const [title, setTitle] = useState('')
    const [items, setItems] = useState<TemplateItemInput[]>([
        { id: '1', item_name: '', category: '의류', is_private: false }
    ])

    useEffect(() => {
        async function checkAuth() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
            }
        }
        checkAuth()
    }, [router, supabase])

    const handleAddItem = () => {
        setItems([
            ...items,
            { id: Date.now().toString(), item_name: '', category: '기타', is_private: false }
        ])
    }

    const handleRemoveItem = (idToRemove: string) => {
        if (items.length > 1) {
            setItems(items.filter((item: any) => item.id !== idToRemove))
        }
    }

    const handleItemChange = (id: string, field: 'item_name' | 'category' | 'is_private', value: any) => {
        setItems(items.map((item: any) =>
            item.id === id ? { ...item, [field]: value } : item
        ))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) {
            alert('템플릿 이름을 지어주세요!')
            return
        }

        const validItems = items.filter((item: any) => item.item_name.trim() !== '')
        if (validItems.length === 0) {
            alert('적어도 하나의 준비물은 등록해야 해요!')
            return
        }

        setLoading(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) throw new Error('인증 정보가 없습니다.')

            // 1. 템플릿 레코드 생성
            const { data: newTemplate, error: templateError } = await supabase
                .from('checklist_templates')
                .insert({
                    user_id: session.user.id,
                    title: title.trim()
                })
                .select()
                .single()

            if (templateError) throw templateError

            // 2. 템플릿 하위 항목 생성
            const itemsToInsert = validItems.map((item: any) => ({
                template_id: newTemplate.id,
                item_name: item.item_name.trim(),
                category: item.category,
                is_private: item.is_private
            }))

            const { error: itemsError } = await supabase
                .from('checklist_template_items')
                .insert(itemsToInsert)

            if (itemsError) throw itemsError

            router.push('/templates')
            router.refresh()

        } catch (error: any) {
            console.error('Error creating template:', error)
            alert('저장 중에 잠시 문제가 생겼어요. 다시 한번 시도해 주시겠어요?')
            setLoading(false)
        }
    }

    return (
        <div className={css({ w: '100%', maxW: '800px', mx: 'auto', py: '40px' })}>
            <div className={css({ mb: '40px' })}>
                <h1 className={css({ fontSize: { base: '24px', sm: '32px' }, fontWeight: '700', color: '#2C3A47', lineHeight: '1.2' })}>
                    나만의 새 템플릿 만들기
                </h1>
                <p className={css({ color: '#717171', mt: '8px', fontSize: '16px', fontWeight: '500' })}>
                    자주 쓰는 준비물들을 모아 나만의 템플릿을 만들어 보세요! ✨
                </p>
            </div>

            <form onSubmit={handleSubmit} className={css({ bg: 'white', p: { base: '20px', sm: '32px' }, borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #EEEEEE' })}>
                {/* 템플릿 기본 정보 지정 */}
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

                {/* 템플릿 항목 지정 */}
                <div className={css({ mb: '32px' })}>
                    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '16px' })}>
                        <label className={css({ display: 'block', fontSize: '15px', fontWeight: '700', color: '#2C3A47' })}>
                            어떤 항목을 준비할까요?
                        </label>
                        <span className={css({ fontSize: '13px', color: '#717171', fontWeight: '600' })}>총 {items.length}개</span>
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                        {items.map((item, index) => (
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
                                        className={css({ w: '100%', p: '14px 40px 14px 16px', bg: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontWeight: '700', color: '#2C3A47', cursor: 'pointer', appearance: 'none' })}
                                    >
                                        {CATEGORIES.map((cat: any) => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    <div className={css({ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#2EC4B6' })}>
                                        <ChevronDown size={16} strokeWidth={3} />
                                    </div>
                                </div>

                                <div className={css({ display: 'flex', flex: 1, alignItems: 'center', gap: '8px' })}>
                                    <input
                                        type="text"
                                        value={item.item_name}
                                        onChange={(e) => handleItemChange(item.id, 'item_name', e.target.value)}
                                        placeholder={`${index + 1}번째 준비물`}
                                        className={css({ flex: 1, p: '14px 16px', border: 'none', outline: 'none', fontSize: '15px', fontWeight: '600', bg: 'transparent', color: '#2C3A47', _placeholder: { color: '#CCC', fontWeight: '400' } })}
                                        required
                                    />

                                    <label className={css({ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none', px: '8px' })}>
                                        <input
                                            type="checkbox"
                                            checked={item.is_private}
                                            onChange={(e) => handleItemChange(item.id, 'is_private', e.target.checked)}
                                            className={css({ accentColor: '#2EC4B6', w: '16px', h: '16px' })}
                                        />
                                        <span className={css({ fontSize: '12px', fontWeight: '700', color: '#717171', whiteSpace: 'nowrap' })}>나만 보기</span>
                                    </label>

                                    {items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(item.id)}
                                            className={css({ p: '14px', color: '#ff4d4f', bg: 'transparent', border: 'none', cursor: 'pointer', _hover: { color: '#dc2626', bg: '#fff1f0' }, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' })}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
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
                        <Save size={18} /> {loading ? '저장 중...' : '템플릿 저장할게요'}
                    </button>
                </div>
            </form>
        </div>
    )
}
