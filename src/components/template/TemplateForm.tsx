'use client'

import { css } from 'styled-system/css'
import { Plus, Save, Trash2, ChevronDown } from 'lucide-react'
import { CATEGORIES } from '@/constants/checklist'

export interface TemplateItemInput {
    id: string
    item_name: string
    category: string
    is_private: boolean
    isNew?: boolean
}

interface TemplateFormProps {
    title: string
    setTitle: (title: string) => void
    items: TemplateItemInput[]
    setItems: (items: TemplateItemInput[]) => void
    onSubmit: (e: React.FormEvent) => void
    loading: boolean
    onCancel: () => void
    submitText?: string
    isEdit?: boolean
}

export default function TemplateForm({
    title,
    setTitle,
    items,
    setItems,
    onSubmit,
    loading,
    onCancel,
    submitText = '템플릿 저장할게요',
    isEdit = false
}: TemplateFormProps) {
    const handleAddItem = () => {
        setItems([
            ...items,
            { id: Date.now().toString(), item_name: '', category: '기타', is_private: false, isNew: true }
        ])
    }

    const handleRemoveItem = (id: string) => {
        setItems(items.filter((item) => item.id !== id))
    }

    const handleItemChange = (id: string, field: keyof TemplateItemInput, value: any) => {
        setItems(items.map(item => 
            item.id === id ? { ...item, [field]: value } : item
        ))
    }

    return (
        <form onSubmit={onSubmit} className={css({ 
            display: 'flex',
            flexDirection: 'column',
            h: '100%',
            overflow: 'hidden'
        })}>
            <div className={css({ flex: 1, overflowY: 'auto', p: { base: '20px', sm: '32px' } })}>
                {/* 템플릿 기본 정보 지정 */}
                <div className={css({ mb: '32px' })}>
                    <label className={css({ display: 'block', fontSize: '15px', fontWeight: '800', mb: '12px', color: 'brand.secondary' })}>
                        템플릿 이름
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="예: 여름 바다 여행 필수템 🏖️"
                        className={css({ 
                            w: '100%', 
                            p: '18px 20px', 
                            border: '2px solid',
                            borderColor: 'brand.border',
                            borderRadius: '20px', 
                            outline: 'none', 
                            bg: 'bg.softCotton',
                            fontSize: '16px', 
                            fontWeight: '600', 
                            color: 'brand.secondary', 
                            transition: 'all 0.3s', 
                            _placeholder: { color: 'brand.muted', fontWeight: '400' }, 
                            _focus: { borderColor: 'brand.primary', bg: 'white', boxShadow: '0 0 0 5px rgba(var(--colors-brand-primary-rgb), 0.1)' } 
                        })}
                        required
                    />
                </div>

                <hr className={css({ border: 'none', borderTop: '1px solid', borderTopColor: 'brand.border', mb: '32px' })} />

                {/* 템플릿 항목 지정 */}
                <div className={css({ mb: '32px' })}>
                    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '16px' })}>
                        <h4 className={css({ fontSize: '15px', fontWeight: '800', color: 'brand.secondary' })}>
                            {isEdit ? '준비물 항목을 다듬어 보세요' : '어떤 항목을 준비할까요?'}
                        </h4>
                        <span className={css({ fontSize: '13px', color: 'brand.muted', fontWeight: '600', bg: 'bg.softCotton', px: '10px', py: '4px', borderRadius: '10px' })}>
                            총 {items.length}개
                        </span>
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '14px' })}>
                        {items.length === 0 ? (
                            <div className={css({ p: '32px', textAlign: 'center', color: 'brand.muted', bg: 'bg.softCotton', borderRadius: '24px', fontSize: '14px', border: '1px dashed', borderColor: 'brand.border' })}>
                                아직 등록된 준비물이 없어요. 새로운 항목을 추가해 보세요!
                            </div>
                        ) : (
                            items.map((item, index) => (
                                <div key={item.id} className={css({
                                    display: 'flex',
                                    flexDirection: { base: 'column', sm: 'row' },
                                    alignItems: { base: 'stretch', sm: 'center' },
                                    bg: 'white',
                                    borderRadius: '22px',
                                    border: '2px solid',
                                    borderColor: 'brand.border',
                                    overflow: 'hidden',
                                    transition: 'all 0.3s',
                                    _focusWithin: { borderColor: 'brand.primary', boxShadow: '0 8px 20px rgba(46,196,182,0.08)' }
                                })}>
                                    {/* 카테고리 선택 */}
                                    <div className={css({ 
                                        position: 'relative', 
                                        borderRight: { base: 'none', sm: '2px solid' }, 
                                        borderRightColor: { base: 'none', sm: 'brand.border' },
                                        borderBottom: { base: '2px solid', sm: 'none' }, 
                                        borderBottomColor: { base: 'brand.border', sm: 'none' },
                                        w: { base: '100%', sm: '130px' }, 
                                        flexShrink: 0, 
                                        bg: 'bg.softCotton' 
                                    })}>
                                        <select
                                            value={item.category}
                                            onChange={(e) => handleItemChange(item.id, 'category', e.target.value)}
                                            className={css({ w: '100%', p: '14px 36px 14px 16px', bg: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontWeight: '700', color: 'brand.secondary', cursor: 'pointer', appearance: 'none' })}
                                        >
                                            {CATEGORIES.map((cat: any) => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                        <div className={css({ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'brand.muted' })}>
                                            <ChevronDown size={14} strokeWidth={2.5} />
                                        </div>
                                    </div>

                                    <div className={css({ display: 'flex', flex: 1, alignItems: 'center', gap: { base: '4px', sm: '8px' }, minW: 0 })}>
                                        <input
                                            type="text"
                                            value={item.item_name}
                                            onChange={(e) => handleItemChange(item.id, 'item_name', e.target.value)}
                                            placeholder={`${index + 1}번째 준비물`}
                                            className={css({ flex: 1, minW: 0, p: '14px 16px', border: 'none', outline: 'none', fontSize: '15px', fontWeight: '600', bg: 'transparent', color: 'brand.secondary', _placeholder: { color: 'brand.muted', fontWeight: '400' } })}
                                            required
                                        />

                                        <label className={css({ 
                                            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none', 
                                            px: { base: '8px', sm: '12px' }, py: '6px', mr: '4px', borderRadius: '12px',
                                            bg: item.is_private ? 'brand.primary/5' : 'transparent',
                                            transition: 'all 0.2s',
                                            _hover: { bg: 'bg.softCotton' }
                                        })}>
                                            <input
                                                type="checkbox"
                                                checked={item.is_private}
                                                onChange={(e) => handleItemChange(item.id, 'is_private', e.target.checked)}
                                                className={css({ accentColor: 'brand.primary', w: '16px', h: '16px' })}
                                            />
                                            <span className={css({ fontSize: '13px', fontWeight: '700', color: item.is_private ? 'brand.primary' : 'brand.muted', whiteSpace: 'nowrap' })}>비공개</span>
                                        </label>

                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(item.id)}
                                            className={css({ 
                                                p: '14px', mr: { base: '4px', sm: '8px' }, color: 'brand.error', bg: 'transparent', 
                                                border: 'none', cursor: 'pointer', borderRadius: '12px',
                                                _hover: { bg: 'brand.error/10' }, transition: 'all 0.2s', 
                                                display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                            })}
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
                        className={css({ 
                            w: '100%', mt: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            gap: '10px', p: '18px', bg: 'bg.softCotton', color: 'brand.secondary', 
                            borderRadius: '22px', border: '2px dashed', borderColor: 'brand.border', 
                            cursor: 'pointer', fontSize: '15px', fontWeight: '800', transition: 'all 0.3s', 
                            _hover: { bg: 'brand.primary/5', color: 'brand.primary', borderColor: 'brand.primary' }, 
                            _active: { transform: 'scale(0.98)' } 
                        })}
                    >
                        <Plus size={18} strokeWidth={3} /> 준비물 항목 추가하기
                    </button>
                </div>

                {/* 하단 여백 확보 (풀 너비 버튼용) */}
                <div className={css({ h: '20px' })} />
            </div>

            <div className={css({ 
                p: { base: '20px 24px', sm: '24px 32px' }, 
                borderTop: '1px solid',
                borderTopColor: 'brand.border',
                bg: 'white'
            })}>
                <button
                    type="submit"
                    disabled={loading}
                    className={css({ 
                        w: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', 
                        py: '18px', bg: 'brand.primary', color: 'white', 
                        borderRadius: '22px', fontWeight: '800', fontSize: '17px',
                        border: 'none', cursor: loading ? 'not-allowed' : 'pointer', 
                        opacity: loading ? 0.7 : 1, transition: 'all 0.3s', 
                        boxShadow: '0 8px 20px rgba(46, 196, 182, 0.15)', 
                        _hover: { bg: 'brand.primaryDark', transform: 'translateY(-2px)', boxShadow: '0 12px 28px rgba(46, 196, 182, 0.25)' },
                        _active: { transform: 'scale(0.97)' }
                    })}
                >
                    <Save size={20} /> {loading ? '저장하는 중...' : submitText}
                </button>
            </div>
        </form>
    )
}
