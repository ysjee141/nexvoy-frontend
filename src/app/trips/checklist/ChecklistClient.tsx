'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Plus, CheckSquare, Square, Trash2, Settings, ChevronDown, Check, ListTodo } from 'lucide-react'
import Link from 'next/link'
import TemplateModal from '@/components/trips/TemplateModal'

const CustomViewDropdown = ({ groupBy, setGroupBy }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = [
        { value: 'category', label: '카테고리별 보기' },
        { value: 'template', label: '템플릿별 보기' }
    ];
    const currentLabel = options.find(o => o.value === groupBy)?.label || '카테고리별 보기';

    return (
        <div className={css({ position: 'relative', display: { base: 'block', sm: 'none' } })}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={css({
                    display: 'flex', alignItems: 'center', gap: '4px',
                    bg: 'white', border: '1px solid #10B981', borderRadius: '16px',
                    px: '12px', py: '6px', fontSize: '12px', fontWeight: '700', color: '#10B981', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)'
                })}
            >
                {currentLabel}
                <ChevronDown size={14} />
            </button>
            {isOpen && (
                <>
                    <div className={css({ position: 'fixed', inset: 0, zIndex: 10 })} onClick={() => setIsOpen(false)} />
                    <div className={css({
                        position: 'absolute', top: '100%', right: 0, mt: '4px',
                        bg: 'white', border: '1px solid #eee', borderRadius: '12px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 11, minW: '130px',
                        overflow: 'hidden'
                    })}>
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { setGroupBy(opt.value); setIsOpen(false); }}
                                className={css({
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', w: '100%', textAlign: 'left', px: '14px', py: '10px', fontSize: '13px',
                                    bg: groupBy === opt.value ? '#ECFDF5' : 'transparent',
                                    color: groupBy === opt.value ? '#10B981' : '#555',
                                    fontWeight: groupBy === opt.value ? '700' : '500',
                                    border: 'none', cursor: 'pointer', _hover: { bg: '#f9f9f9' }
                                })}
                            >
                                {opt.label}
                                {groupBy === opt.value && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export default function ChecklistPage() {
    const searchParams = useSearchParams()
    const tripId = searchParams.get('id')
    const supabase = createClient()

    const [checklistId, setChecklistId] = useState<string | null>(null)
    const [items, setItems] = useState<any[]>([])
    const [newItemName, setNewItemName] = useState('')
    const [newItemCategory, setNewItemCategory] = useState('기타')
    const [isAdding, setIsAdding] = useState(false)
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
    const [groupBy, setGroupBy] = useState<'category' | 'template'>('category')
    const [tripInfo, setTripInfo] = useState<{ destination: string, start_date: string } | null>(null)

    const CATEGORIES = ['필수', '의류', '세면도구', '전자기기', '상비약', '기타']

    useEffect(() => {
        const fetchChecklist = async () => {
            // 1. 해당 trip의 checklist 조회
            let { data: checklists } = await supabase
                .from('checklists')
                .select('id, title')
                .eq('trip_id', tripId)
                .limit(1)

            let currentChecklistId = checklists?.[0]?.id

            // 없다면 생성
            if (!currentChecklistId) {
                const { data: newChecklist } = await supabase
                    .from('checklists')
                    .insert({ trip_id: tripId, title: '기본 준비물' })
                    .select()
                    .single()

                if (newChecklist) {
                    currentChecklistId = newChecklist.id
                }
            }

            if (currentChecklistId) {
                setChecklistId(currentChecklistId)

                // 2. 여행 정보 및 항목 병렬 조회
                const [tripRes, itemsRes] = await Promise.all([
                    supabase.from('trips').select('destination, start_date').eq('id', tripId).single(),
                    supabase.from('checklist_items').select('*').eq('checklist_id', currentChecklistId).order('created_at', { ascending: true })
                ])

                if (tripRes.data) setTripInfo(tripRes.data)
                
                if (itemsRes.data) {
                    setItems(itemsRes.data)
                    if (tripRes.data) {
                        const pendingCount = itemsRes.data.filter((i: any) => !i.is_checked).length
                        import('@/services/NotificationService').then(({ NotificationService }) => {
                            NotificationService.scheduleChecklistReminder(tripId!, tripRes.data.destination, tripRes.data.start_date, pendingCount)
                        })
                    }
                }
            }
        }

        fetchChecklist()
    }, [tripId, supabase])

    const toggleItem = async (itemId: string, currentStatus: boolean) => {
        // Optimistic UI update
        setItems(prev => prev.map((item: any) => item.id === itemId ? { ...item, is_checked: !currentStatus } : item))

        const { error } = await supabase
            .from('checklist_items')
            .update({ is_checked: !currentStatus })
            .eq('id', itemId)

        if (error) {
            console.error('Toggle error:', error)
            // Rollback
            setItems(prev => prev.map((item: any) => item.id === itemId ? { ...item, is_checked: currentStatus } : item))
        } else {
            // 리마인더 갱신
            if (tripInfo && tripId) {
                const updatedItems = items.map((item: any) => item.id === itemId ? { ...item, is_checked: !currentStatus } : item)
                const pendingCount = updatedItems.filter((i: any) => !i.is_checked).length
                import('@/services/NotificationService').then(({ NotificationService }) => {
                    NotificationService.scheduleChecklistReminder(tripId, tripInfo.destination, tripInfo.start_date, pendingCount)
                })
            }
        }
    }

    const addItem = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newItemName.trim() || !checklistId) return

        const { data, error } = await supabase
            .from('checklist_items')
            .insert({
                checklist_id: checklistId,
                item_name: newItemName.trim(),
                category: newItemCategory,
                is_checked: false
            })
            .select()
            .single()

        if (!error && data) {
            const updatedItems = [...items, data]
            setItems(updatedItems)
            setNewItemName('')
            // 카테고리는 유지하여 연속 추가 편의성 제공
            setIsAdding(false)

            // 리마인더 갱신
            if (tripInfo && tripId) {
                const pendingCount = updatedItems.filter((i: any) => !i.is_checked).length
                import('@/services/NotificationService').then(({ NotificationService }) => {
                    NotificationService.scheduleChecklistReminder(tripId, tripInfo.destination, tripInfo.start_date, pendingCount)
                })
            }
        }
    }

    const deleteItem = async (e: React.MouseEvent, itemId: string) => {
        e.stopPropagation()
        setItems(prev => prev.filter((item: any) => item.id !== itemId))
        await supabase.from('checklist_items').delete().eq('id', itemId)
    }

    const totalItems = items.length
    const checkedItems = items.filter((item: any) => item.is_checked).length
    const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0

    const templateGroups = items.reduce((acc: Record<string, any[]>, item) => {
        const grp = item.source_template_name || '직접 추가함'
        if (!acc[grp]) acc[grp] = []
        acc[grp].push(item)
        return acc
    }, {})

    return (
        <div className={css({ bg: 'white', p: { base: '16px', sm: '24px' }, borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' })}>
            
            {/* 1. 타이틀 & 보기 모드, 버튼 영역 (반응형 다중 구조) */}
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '16px', mb: '20px' })}>
                
                {/* 상단 라인: 타이틀 + 모바일 필터(드롭다운) */}
                <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                    <h2 className={css({ fontSize: { base: '18px', sm: '20px' }, fontWeight: 'bold' })}>
                        준비물 챙기기 {totalItems > 0 && <span className={css({ color: '#10B981', ml: '8px' })}>{progressPercent}%</span>}
                    </h2>
                    
                    {/* 모바일 전용 뷰 드롭다운 */}
                    {totalItems > 0 && (
                        <CustomViewDropdown groupBy={groupBy} setGroupBy={setGroupBy} />
                    )}
                </div>

                {/* PC/모바일 분기 액션 버튼 및 필터 라인 */}
                <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: { base: 'column', sm: 'row' }, gap: '16px' })}>
                    
                    {/* PC 좌측: 보기 옵션 토글 */}
                    <div className={css({ display: { base: 'none', sm: totalItems > 0 ? 'inline-flex' : 'none' }, bg: '#f1f3f4', p: '4px', borderRadius: '8px' })}>
                        <button
                            onClick={() => setGroupBy('category')}
                            className={css({ px: '16px', py: '6px', fontSize: '14px', fontWeight: groupBy === 'category' ? 'bold' : 'normal', bg: groupBy === 'category' ? 'white' : 'transparent', color: groupBy === 'category' ? '#111' : '#666', borderRadius: '6px', border: 'none', cursor: 'pointer', boxShadow: groupBy === 'category' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' })}
                        >
                            카테고리별 보기
                        </button>
                        <button
                            onClick={() => setGroupBy('template')}
                            className={css({ px: '16px', py: '6px', fontSize: '14px', fontWeight: groupBy === 'template' ? 'bold' : 'normal', bg: groupBy === 'template' ? 'white' : 'transparent', color: groupBy === 'template' ? '#111' : '#666', borderRadius: '6px', border: 'none', cursor: 'pointer', boxShadow: groupBy === 'template' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' })}
                        >
                            템플릿별 보기
                        </button>
                    </div>
                    {/* PC에서 totalItems === 0 일 때 우측 버튼들을 오른쪽으로 밀기 위한 빈 공간용 div */}
                    {totalItems === 0 && <div className={css({ display: { base: 'none', sm: 'block' } })}></div>}

                    {/* 모바일/PC 액션 버튼 */}
                    <div className={css({ display: 'flex', gap: '8px', w: { base: '100%', sm: 'auto' }, flexWrap: 'nowrap' })}>
                        {/* 항목 추가 버튼 (모바일: flex-1 맨왼쪽) */}
                        <button
                            onClick={() => setIsAdding(!isAdding)}
                            className={css({
                                order: { base: -1, sm: 1 },
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                bg: '#111', color: 'white', px: '16px', py: { base: '10px', sm: '8px' },
                                borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', border: 'none',
                                w: { base: '100%', sm: 'auto' }, flex: { base: 1, sm: 'none' },
                                _hover: { bg: '#333' }, whiteSpace: 'nowrap'
                            })}
                        >
                            <Plus size={16} /> 항목 추가
                        </button>

                        <button
                            onClick={() => setIsTemplateModalOpen(true)}
                            className={css({
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                px: '16px', py: { base: '10px', sm: '8px' },
                                bg: 'white', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '8px',
                                fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                                flex: { base: 'none', sm: 'none' }, flexShrink: 0,
                                whiteSpace: 'nowrap', transition: 'all 0.2s',
                                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.08)',
                                _hover: { bg: '#ECFDF5', borderColor: '#10B981', transform: 'translateY(-1px)', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.15)' },
                                _active: { transform: 'scale(0.98)' }
                            })}
                        >
                            <ListTodo size={15} />
                            <span>템플릿</span>
                        </button>
                    </div>
                </div>
            </div>

            {totalItems > 0 && (
                <div className={css({ w: '100%', bg: '#eee', h: '8px', borderRadius: '4px', mb: '24px', overflow: 'hidden' })}>
                    <div
                        className={css({ h: '100%', bg: 'linear-gradient(90deg, #10B981, #34A853)', transition: 'width 0.8s cubic-bezier(0.1, 0.7, 0.1, 1)' })}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            )}

            {isAdding && (
                <form onSubmit={addItem} className={css({ mb: '20px' })}>
                    <div className={css({ display: 'flex', gap: '8px', flexDirection: { base: 'column', sm: 'row' } })}>
                        {/* 1. 카테고리 (Mobile: 위에 독립적으로 배치됨, PC: 한 줄에 배치됨) */}
                        <div className={css({ position: 'relative', w: { base: '100%', sm: 'auto' }, flexShrink: 0 })}>
                            <select
                                value={newItemCategory}
                                onChange={e => setNewItemCategory(e.target.value)}
                                className={css({ w: '100%', p: '12px 30px 12px 12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', bg: 'white', minWidth: '120px', fontSize: '14px', fontWeight: '500', color: '#064E3B', cursor: 'pointer', appearance: 'none', _focus: { borderColor: '#10B981' } })}
                            >
                                {CATEGORIES.map((cat: any) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <div className={css({ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#888' })}>
                                <ChevronDown size={14} />
                            </div>
                        </div>

                        {/* 2. 입력창 및 액션 버튼들 (Mobile/PC 모두 1줄 구성) */}
                        <div className={css({ display: 'flex', gap: '8px', flex: 1, flexDirection: 'row', w: '100%' })}>
                            <input
                                type="text"
                                autoFocus
                                value={newItemName}
                                onChange={e => setNewItemName(e.target.value)}
                                placeholder="예: 여권, 충전기"
                                className={css({ w: '100%', flex: 1, minW: 0, p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', fontSize: '14px', _focus: { borderColor: '#10B981' } })}
                            />
                            <button
                                type="submit"
                                disabled={!newItemName.trim()}
                                className={css({ w: 'auto', p: { base: '12px 14px', sm: '12px 20px' }, bg: '#10B981', color: 'white', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', flexShrink: 0, textAlign: 'center', _disabled: { opacity: 0.5, cursor: 'not-allowed' }, _active: { transform: 'scale(0.98)' } })}
                            >
                                등록
                            </button>

                            <button
                                type="button"
                                onClick={() => { setIsAdding(false); setNewItemName(''); }}
                                className={css({ w: 'auto', p: { base: '12px 14px', sm: '12px 20px' }, bg: '#f1f3f4', color: '#555', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', flexShrink: 0, textAlign: 'center', _hover: { bg: '#e8eaed' }, _active: { transform: 'scale(0.98)' } })}
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {totalItems === 0 && !isAdding ? (
                <div className={css({ textAlign: 'center', py: '60px', color: '#888' })}>
                    <p className={css({ fontSize: '16px', mb: '8px' })}>등록된 준비물이 없습니다.</p>
                    <p className={css({ fontSize: '14px' })}>항목 추가 혹은 템플릿을 불러와 짐 싸기를 시작하세요.</p>
                </div>
            ) : (
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '24px' })}>
                    {groupBy === 'category' ? (
                        CATEGORIES.map((cat: any) => {
                            const categoryItems = items.filter((item: any) => item.category === cat || (!item.category && cat === '기타'))
                            if (categoryItems.length === 0) return null

                            return (
                                <div key={cat} className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                                    <h3 className={css({ fontSize: '15px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee', pb: '4px' })}>
                                        {cat} <span className={css({ color: '#888', fontWeight: 'normal', fontSize: '13px', ml: '4px' })}>{categoryItems.length}</span>
                                    </h3>
                                    <ul className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                                        {categoryItems.map((item) => (
                                            <li
                                                key={item.id}
                                                onClick={() => toggleItem(item.id, item.is_checked)}
                                                className={css({
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    p: '14px 16px',
                                                    border: '1px solid #eaeaea',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    transition: 'bg 0.2s',
                                                    _hover: { bg: '#fafafa', '& .delete-btn': { opacity: 1 } }
                                                })}
                                            >
                                                <div className={css({ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' })}>
                                                    {item.is_checked ? <CheckSquare color="#10B981" size={20} /> : <Square color="#ccc" size={20} />}
                                                    <span className={css({ fontSize: '15px', color: item.is_checked ? '#888' : '#333', textDecoration: item.is_checked ? 'line-through' : 'none' })}>
                                                        {item.item_name}
                                                    </span>
                                                    {/* 템플릿 배지 표시 */}
                                                    {item.source_template_name && (
                                                        <span className={css({ fontSize: '11px', bg: '#f1f3f4', color: '#666', px: '6px', py: '2px', borderRadius: '4px' })}>
                                                            {item.source_template_name}
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={(e) => deleteItem(e, item.id)}
                                                    className={`delete-btn ${css({ bg: 'transparent', border: 'none', color: { base: '#ff4d4f', sm: '#ccc' }, cursor: 'pointer', opacity: { base: 1, sm: 0 }, transition: 'all 0.2s', p: '8px', borderRadius: '4px', _hover: { color: '#dc2626', bg: '#ffeeee' } })}`}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )
                        })
                    ) : (
                        Object.entries(templateGroups).map(([grpName, grpItems]) => (
                            <div key={grpName} className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                                <h3 className={css({ fontSize: '15px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #eee', pb: '4px', display: 'flex', alignItems: 'center', gap: '6px' })}>
                                    {grpName === '직접 추가함' ? '✍️ 직접 추가함' : `📦 ${grpName}`}
                                    <span className={css({ color: '#888', fontWeight: 'normal', fontSize: '13px', ml: '4px' })}>{grpItems.length}</span>
                                </h3>
                                <ul className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                                    {grpItems.map((item) => (
                                        <li
                                            key={item.id}
                                            onClick={() => toggleItem(item.id, item.is_checked)}
                                            className={css({
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                p: '14px 16px',
                                                border: '1px solid #eaeaea',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                transition: 'bg 0.2s',
                                                _hover: { bg: '#fafafa', '& .delete-btn': { opacity: 1 } }
                                            })}
                                        >
                                            <div className={css({ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' })}>
                                                {item.is_checked ? <CheckSquare color="#10B981" size={20} /> : <Square color="#ccc" size={20} />}
                                                <span className={css({ fontSize: '15px', color: item.is_checked ? '#888' : '#333', textDecoration: item.is_checked ? 'line-through' : 'none' })}>
                                                    {item.item_name}
                                                </span>
                                                <span className={css({ fontSize: '11px', bg: '#f8f9fa', border: '1px solid #eee', color: '#888', px: '6px', py: '2px', borderRadius: '4px' })}>
                                                    {item.category || '기타'}
                                                </span>
                                            </div>
                                            <button
                                                onClick={(e) => deleteItem(e, item.id)}
                                                className={`delete-btn ${css({ bg: 'transparent', border: 'none', color: { base: '#ff4d4f', sm: '#ccc' }, cursor: 'pointer', opacity: { base: 1, sm: 0 }, transition: 'all 0.2s', p: '8px', borderRadius: '4px', _hover: { color: '#dc2626', bg: '#ffeeee' } })}`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    )}
                </div>
            )}

            {checklistId && (
                <TemplateModal
                    isOpen={isTemplateModalOpen}
                    onClose={() => setIsTemplateModalOpen(false)}
                    checklistId={checklistId}
                    onSuccess={(newItems) => {
                        setItems(prev => [...prev, ...newItems])
                    }}
                />
            )}
        </div>
    )
}
