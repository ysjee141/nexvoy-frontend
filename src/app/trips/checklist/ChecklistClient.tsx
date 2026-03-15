'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { Plus, CheckSquare, Square, Trash2, Settings } from 'lucide-react'
import Link from 'next/link'
import TemplateModal from '@/components/trips/TemplateModal'

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
        <div className={css({ bg: 'white', p: '24px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' })}>
            <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: { base: 'flex-start', sm: 'center' }, mb: '16px', flexDirection: { base: 'column', sm: 'row' }, gap: '16px' })}>
                <h2 className={css({ fontSize: '20px', fontWeight: 'bold' })}>
                    준비물 챙기기 {totalItems > 0 && <span className={css({ color: '#4285F4', ml: '8px' })}>{progressPercent}%</span>}
                </h2>

                <div className={css({ display: 'flex', gap: '8px', w: { base: '100%', sm: 'auto' }, flexWrap: 'wrap' })}>
                    <Link
                        href="/templates"
                        className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            px: '12px',
                            py: '8px',
                            bg: 'white',
                            color: '#4285F4',
                            border: '1px solid #4285F4',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '600',
                            textDecoration: 'none',
                            flex: { base: 1, sm: 'none' },
                            whiteSpace: 'nowrap',
                            _hover: { bg: '#e8f0fe' },
                        })}
                    >
                        <Settings size={14} /> 템플릿
                    </Link>
                    <button
                        onClick={() => setIsTemplateModalOpen(true)}
                        className={css({
                            px: '12px',
                            py: '8px',
                            bg: '#f1f3f4',
                            color: '#333',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            border: 'none',
                            flex: { base: 1, sm: 'none' },
                            whiteSpace: 'nowrap',
                            _hover: { bg: '#e8eaed' },
                        })}
                    >
                        불러오기
                    </button>
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            bg: '#111',
                            color: 'white',
                            px: '16px',
                            py: '8px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '13px',
                            cursor: 'pointer',
                            border: 'none',
                            w: { base: '100%', sm: 'auto' },
                            _hover: { bg: '#333' },
                        })}
                    >
                        <Plus size={16} /> 항목 추가
                    </button>
                </div>
            </div>

            {/* 보기 옵션 토글 */}
            {totalItems > 0 && (
                <div className={css({ display: 'inline-flex', mb: '20px', bg: '#f1f3f4', p: '4px', borderRadius: '8px' })}>
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
            )}

            {totalItems > 0 && (
                <div className={css({ w: '100%', bg: '#eee', h: '8px', borderRadius: '4px', mb: '24px', overflow: 'hidden' })}>
                    <div
                        className={css({ h: '100%', bg: 'linear-gradient(90deg, #4285F4, #34A853)', transition: 'width 0.8s cubic-bezier(0.1, 0.7, 0.1, 1)' })}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            )}

            {isAdding && (
                <form onSubmit={addItem} className={css({ mb: '20px' })}>
                    <div className={css({ display: 'flex', gap: '8px', flexDirection: { base: 'column', sm: 'row' } })}>
                        <div className={css({ display: 'flex', gap: '8px', flex: 1 })}>
                            <select
                                value={newItemCategory}
                                onChange={e => setNewItemCategory(e.target.value)}
                                className={css({ p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', bg: 'white', minWidth: '100px', fontSize: '14px' })}
                            >
                                {CATEGORIES.map((cat: any) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                autoFocus
                                value={newItemName}
                                onChange={e => setNewItemName(e.target.value)}
                                placeholder="예: 여권, 충전기"
                                className={css({ flex: 1, p: '12px', border: '1px solid #ddd', borderRadius: '8px', outline: 'none', fontSize: '14px', _focus: { borderColor: '#4285F4' } })}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!newItemName.trim()}
                            className={css({ p: '12px 24px', bg: '#4285F4', color: 'white', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', _disabled: { opacity: 0.5, cursor: 'not-allowed' }, _active: { transform: 'scale(0.98)' } })}
                        >
                            등록
                        </button>
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
                                                    {item.is_checked ? <CheckSquare color="#4285F4" size={20} /> : <Square color="#ccc" size={20} />}
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
                                                {item.is_checked ? <CheckSquare color="#4285F4" size={20} /> : <Square color="#ccc" size={20} />}
                                                <span className={css({ fontSize: '15px', color: item.is_checked ? '#888' : '#333', textDecoration: item.is_checked ? 'line-through' : 'none' })}>
                                                    {item.item_name}
                                                </span>
                                                <span className={css({ fontSize: '11px', bg: '#f8f9fa', border: '1px solid #eee', color: '#888', px: '6px', py: '2px', borderRadius: '4px' })}>
                                                    {item.category || '기타'}
                                                </span>
                                            </div>
                                            <button
                                                onClick={(e) => deleteItem(e, item.id)}
                                                className={`delete-btn ${css({ bg: 'transparent', border: 'none', color: '#ccc', cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s', _hover: { color: '#dc2626' } })}`}
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
