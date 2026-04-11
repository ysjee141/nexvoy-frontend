'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { X, Sparkles } from 'lucide-react'
import { useModalBackButton } from '@/hooks/useModalBackButton'
import { useRouter } from 'next/navigation'
import TemplateForm, { TemplateItemInput } from './TemplateForm'

interface NewTemplateModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
}

export default function NewTemplateModal({ isOpen, onClose, onSuccess }: NewTemplateModalProps) {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)

    // 폼 상태
    const [title, setTitle] = useState('')
    const [items, setItems] = useState<TemplateItemInput[]>([
        { id: '1', item_name: '', category: '의류', is_private: false }
    ])

    const resetForm = useCallback(() => {
        setTitle('')
        setItems([{ id: '1', item_name: '', category: '의류', is_private: false }])
    }, [])

    const handleClose = useCallback(() => {
        const isDirty = title.trim() !== '' || items.some(item => item.item_name.trim() !== '')
        if (isDirty) {
            if (!window.confirm('작성 중인 내용이 사라집니다. 그래도 닫으시겠습니까?')) {
                return
            }
        }
        resetForm()
        onClose()
    }, [title, items, onClose, resetForm])

    useModalBackButton(isOpen, handleClose, 'newTemplateModal')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) {
            alert('템플릿 이름을 지어주세요!')
            return
        }

        const validItems = items.filter((item) => item.item_name.trim() !== '')
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
            const itemsToInsert = validItems.map((item) => ({
                template_id: newTemplate.id,
                item_name: item.item_name.trim(),
                category: item.category,
                is_private: item.is_private
            }))

            const { error: itemsError } = await supabase
                .from('checklist_template_items')
                .insert(itemsToInsert)

            if (itemsError) throw itemsError

            resetForm()
            if (onSuccess) onSuccess()
            onClose()
            router.refresh()

        } catch (error: any) {
            console.error('Error creating template:', error)
            alert('저장 중에 잠시 문제가 생겼어요. 다시 한번 시도해 주시겠어요?')
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
                pt: { base: 'max(env(safe-area-inset-top), var(--safe-area-inset-top))', sm: '0' },
                pb: { base: 'max(env(safe-area-inset-bottom), var(--safe-area-inset-bottom))', sm: '0' },
                animation: 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)',
                overflow: 'hidden'
            })}>
                {/* 헤더 */}
                <div className={css({
                    p: '22px 24px', borderBottom: '1px solid', borderBottomColor: 'brand.border', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center', bg: 'white', zIndex: 10
                })}>
                    <div style={{ width: '40px' }} />
                    <h2 className={css({ fontSize: '18px', fontWeight: '700', color: 'brand.secondary', letterSpacing: '-0.02em', position: 'absolute', left: '50%', transform: 'translateX(-50%)' })}>
                        나만의 새 템플릿 만들기
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
                    <div className={css({ p: { base: '32px 24px 20px', sm: '40px 32px 32px' }, textAlign: 'center', flexShrink: 0 })}>
                        <div className={css({ 
                            w: '64px', h: '64px', bg: 'brand.primary/10', borderRadius: '24px', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', m: '0 auto 20px',
                            boxShadow: '0 8px 16px rgba(46, 196, 182, 0.1)'
                        })}>
                            <Sparkles size={28} className={css({ color: 'brand.primary' })} strokeWidth={2.2} />
                        </div>
                        <h3 className={css({ fontSize: '24px', fontWeight: '800', color: 'brand.secondary', mb: '8px', letterSpacing: '-0.03em' })}>어떤 준비물들을 모아둘까요?</h3>
                        <p className={css({ color: 'brand.muted', fontSize: '15px', fontWeight: '500' })}>자주 쓰는 준비물들을 만들어 두면 계획이 더 편해져요. ✨</p>
                    </div>

                    <TemplateForm
                        title={title}
                        setTitle={setTitle}
                        items={items}
                        setItems={setItems}
                        onSubmit={handleSubmit}
                        loading={loading}
                        onCancel={handleClose}
                        submitText="템플릿 저장할게요"
                    />
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
        </div>
    )
}
