'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { analytics } from '@/services/AnalyticsService'
import { css } from 'styled-system/css'
import { Plus, CheckSquare, Square, Trash2, Settings, ChevronDown, Check, ListTodo, Users, User, Info, X } from 'lucide-react'
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
                    bg: 'white', border: '1px solid #3B82F6', borderRadius: '16px',
                    px: '12px', py: '6px', fontSize: '12px', fontWeight: '700', color: '#3B82F6', cursor: 'pointer',
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
                                    bg: groupBy === opt.value ? '#EFF6FF' : 'transparent',
                                    color: groupBy === opt.value ? '#3B82F6' : '#555',
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

export default function ChecklistPage({ isActive = true }: { isActive?: boolean }) {
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
    const [members, setMembers] = useState<any[]>([])
    const [userChecks, setUserChecks] = useState<any[]>([])
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [tripOwner, setTripOwner] = useState<any>(null)
    const [newItemAssignmentType, setNewItemAssignmentType] = useState<'anyone' | 'specific' | 'everyone'>('anyone')
    const [newItemAssignedUserId, setNewItemAssignedUserId] = useState<string>('')
    const [editingItem, setEditingItem] = useState<any | null>(null)

    const CATEGORIES = ['필수', '의류', '세면도구', '전자기기', '상비약', '음식', '기타']

    const fetchChecklist = useCallback(async () => {
        if (!tripId) return

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

            // 2. 여행 정보, 항목, 멤버, 개별 체크 내역 병렬 조회
            const [tripRes, itemsRes, membersRes] = await Promise.all([
                supabase.from('trips').select('*, profiles(nickname, email)').eq('id', tripId).single(),
                supabase.from('checklist_items').select('*').eq('checklist_id', currentChecklistId).order('created_at', { ascending: true }),
                supabase.from('trip_members').select('user_id, invited_email, role, status, profiles(nickname, email)').eq('trip_id', tripId).eq('status', 'accepted'),
            ])

            if (tripRes.data) {
                setTripInfo(tripRes.data)
                setTripOwner({ id: tripRes.data.user_id, profiles: tripRes.data.profiles, email: tripRes.data.profiles?.email })
            }
            
            if (itemsRes.data) {
                setItems(itemsRes.data)
                
                // 항목이 로드된 후 개별 체크 내역 다시 조회 (ID 리스트 필요)
                const itemIds = itemsRes.data.map((i: any) => i.id)
                if (itemIds.length > 0) {
                    const { data: checks } = await supabase
                        .from('checklist_item_user_checks')
                        .select('*')
                        .in('item_id', itemIds)
                    if (checks) setUserChecks(checks)
                }

                if (tripRes.data) {
                    const pendingCount = itemsRes.data.filter((i: any) => !i.is_checked).length
                    import('@/services/NotificationService').then(({ NotificationService }) => {
                        NotificationService.scheduleChecklistReminder(tripId!, tripRes.data.destination, tripRes.data.start_date, pendingCount)
                    })
                }
            }

            if (membersRes.data) {
                setMembers(membersRes.data)
            }
        }
    }, [tripId, supabase])

    useEffect(() => {
        if (isActive) {
            fetchChecklist()
            supabase.auth.getUser().then(({ data }: { data: { user: any } }) => setCurrentUser(data.user))
        }
    }, [isActive, fetchChecklist])

    const toggleItem = async (itemId: string, currentStatus: boolean) => {
        const item = items.find(i => i.id === itemId)
        if (!item) return

        // 1. 유형별 처리
        if (item.assignment_type === 'specific') {
            if (currentUser?.id !== item.assigned_user_id) {
                alert('이 항목은 담당자님이 따로 있어요! 내 준비물을 멋지게 챙겨볼까요?')
                return
            }
        }

        if (item.assignment_type === 'everyone') {
            const myCheck = userChecks.find(c => c.item_id === itemId && c.user_id === currentUser?.id)
            if (myCheck) {
                // 체크 해제 (Optimistic)
                setUserChecks(prev => prev.filter(c => c.id !== myCheck.id))
                const { error } = await supabase.from('checklist_item_user_checks').delete().eq('id', myCheck.id)
                if (error) {
                    setUserChecks(prev => [...prev, myCheck]) // Rollback
                }
            } else {
                // 체크 추가 (Optimistic)
                const tempId = Math.random().toString()
                const optimisticCheck = { id: tempId, item_id: itemId, user_id: currentUser?.id }
                setUserChecks(prev => [...prev, optimisticCheck])
                const { data, error } = await supabase.from('checklist_item_user_checks').insert({
                    item_id: itemId,
                    user_id: currentUser?.id
                }).select().single()
                
                if (error || !data) {
                    setUserChecks(prev => prev.filter(c => c.id !== tempId)) // Rollback
                } else {
                    setUserChecks(prev => prev.map(c => c.id === tempId ? data : c))
                }
            }
            
            // 리마인더 갱신
            if (tripInfo && tripId) {
                const pendingCount = items.filter((i: any) => !getItemStatus(i).is_checked).length
                import('@/services/NotificationService').then(({ NotificationService }) => {
                    NotificationService.scheduleChecklistReminder(tripId, tripInfo.destination, tripInfo.start_date, pendingCount)
                })
            }
            return
        }

        // '누구라도' 또는 '특정인' (자신인 경우)
        // Optimistic UI update
        setItems(prev => prev.map((item: any) => item.id === itemId ? { ...item, is_checked: !currentStatus } : item))

        if (item) {
            analytics.logChecklistCheck(item.item_name, !currentStatus)
        }

        const { error } = await supabase
            .from('checklist_items')
            .update({ is_checked: !currentStatus })
            .eq('id', itemId)

        if (error) {
            console.error('Toggle error:', error)
            // Rollback
            setItems(prev => prev.map((item: any) => item.id === itemId ? { ...item, is_checked: currentStatus } : item))
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
                is_checked: false,
                assignment_type: newItemAssignmentType,
                assigned_user_id: newItemAssignmentType === 'specific' ? newItemAssignedUserId : null
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

    const updateItem = async (updatedFields: any) => {
        if (!editingItem) return

        const { data, error } = await supabase
            .from('checklist_items')
            .update(updatedFields)
            .eq('id', editingItem.id)
            .select()
            .single()

        if (!error && data) {
            setItems(prev => prev.map(item => item.id === data.id ? data : item))
            setEditingItem(null)
        }
    }

    const deleteItem = async (e: React.MouseEvent, itemId: string) => {
        e.stopPropagation()
        setItems(prev => prev.filter((item: any) => item.id !== itemId))
        await supabase.from('checklist_items').delete().eq('id', itemId)
    }

    const getParticipants = () => {
        const list = []
        if (tripOwner) {
            list.push({ user_id: tripOwner.id, profiles: tripOwner.profiles, email: tripOwner.email })
        }
        members.forEach(m => {
            if (m.user_id !== tripOwner?.id) {
                list.push({ user_id: m.user_id, profiles: m.profiles, email: m.invited_email })
            }
        })
        return list
    }

    const participants = getParticipants()
    const totalMembersCount = participants.length
    
    const getItemStatus = (item: any): { is_checked: boolean, checks_count: number, is_my_checked: boolean } => {
        if (item.assignment_type === 'everyone') {
            const checks = userChecks.filter(c => c.item_id === item.id)
            const checksCount = checks.length
            const isMyChecked = checks.some(c => c.user_id === currentUser?.id)
            return {
                is_checked: checksCount >= totalMembersCount,
                checks_count: checksCount,
                is_my_checked: isMyChecked
            }
        }
        return {
            is_checked: item.is_checked,
            checks_count: item.is_checked ? 1 : 0,
            is_my_checked: item.is_checked
        }
    }

    const [showChecksModal, setShowChecksModal] = useState<string | null>(null)

    const ChecklistItem = ({ item }: { item: any }) => {
        const status = getItemStatus(item)
        const isAssignedToMe = item.assignment_type === 'specific' ? item.assigned_user_id === currentUser?.id : true
        const canCheck = item.assignment_type === 'specific' ? isAssignedToMe : true

        const getAssignedUserLabel = () => {
            if (item.assigned_user_id === currentUser?.id) return '나'
            const p = participants.find(p => p.user_id === item.assigned_user_id)
            if (!p) return '담당자'
            return p.profiles?.nickname || p.email?.split('@')[0] || '동행자'
        }

        const assignedUser = item.assignment_type === 'specific' ? getAssignedUserLabel() : null

        return (
            <li
                className={css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: '16px 20px',
                    borderBottom: '1px solid #EEEEEE',
                    transition: 'bg 0.1s',
                    _active: { bg: '#F7F7F7' },
                    _hover: { bg: { base: 'transparent', sm: '#fafafa' }, '& .action-btns': { opacity: 1 } }
                })}
            >
                <div 
                    onClick={() => canCheck && toggleItem(item.id, item.is_checked)}
                    className={css({ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, cursor: canCheck ? 'pointer' : 'not-allowed' })}
                >
                    {/* 체크박스 */}
                    <div className={css({ 
                        w: '24px', h: '24px', 
                        border: '2px solid', 
                        borderColor: status.is_checked ? '#222' : (status.is_my_checked ? '#3B82F6' : '#B0B0B0'),
                        borderRadius: '4px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bg: status.is_checked ? '#222' : (status.is_my_checked ? '#3B82F6' : 'transparent'),
                        transition: 'all 0.2s',
                        opacity: !canCheck ? 0.3 : 1
                    })}>
                        {(status.is_checked || status.is_my_checked) && <Check size={16} color="white" />}
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '2px' })}>
                        <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                            <span className={css({ 
                                fontSize: '16px', 
                                fontWeight: '500', 
                                color: status.is_checked ? '#B0B0B0' : '#222', 
                                textDecoration: status.is_checked ? 'line-through' : 'none' 
                            })}>
                                {item.item_name}
                            </span>
                            
                            {/* 유형 배지 */}
                            {item.assignment_type === 'specific' && (
                                <span className={css({ 
                                    fontSize: '11px', px: '6px', py: '2px', borderRadius: '4px',
                                    bg: isAssignedToMe ? '#EFF6FF' : '#f1f3f4',
                                    color: isAssignedToMe ? '#3B82F6' : '#666',
                                    fontWeight: '700',
                                    display: 'flex', alignItems: 'center', gap: '3px'
                                })}>
                                    <User size={10} /> {assignedUser}
                                </span>
                            )}

                            {item.assignment_type === 'everyone' && (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setShowChecksModal(item.id)
                                    }}
                                    className={css({ 
                                        fontSize: '11px', px: '6px', py: '2px', borderRadius: '4px',
                                        bg: status.is_checked ? '#f1f3f4' : '#EFF6FF',
                                        color: status.is_checked ? '#666' : '#3B82F6',
                                        fontWeight: '800', border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '3px'
                                    })}
                                >
                                    <Users size={10} /> {status.checks_count}/{totalMembersCount}
                                </button>
                            )}
                        </div>

                        <div className={css({ display: 'flex', gap: '6px', alignItems: 'center' })}>
                            {item.source_template_name && (
                                <span className={css({ fontSize: '11px', color: '#888' })}>
                                    {item.source_template_name}
                                </span>
                            )}
                            {item.category && groupBy === 'template' && (
                                <span className={css({ fontSize: '11px', color: '#888', bg: '#f1f3f4', px: '6px', py: '1px', borderRadius: '4px' })}>
                                    {item.category}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className={`action-btns ${css({ display: 'flex', gap: '4px', opacity: { base: 1, sm: 0 }, transition: 'all 0.2s' })}`}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setEditingItem(item); }}
                        className={css({ bg: 'transparent', border: 'none', color: '#888', cursor: 'pointer', p: '8px', borderRadius: '4px', _hover: { color: '#222', bg: '#f1f3f4' } })}
                    >
                        <Settings size={16} />
                    </button>
                    <button
                        onClick={(e) => deleteItem(e, item.id)}
                        className={css({ bg: 'transparent', border: 'none', color: { base: '#ff4d4f', sm: '#ccc' }, cursor: 'pointer', p: '8px', borderRadius: '4px', _hover: { color: '#dc2626', bg: '#ffeeee' } })}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </li>
        )
    }

    const ChecksModal = () => {
        if (!showChecksModal) return null
        const item = items.find(i => i.id === showChecksModal)
        if (!item) return null
        
        const checkedUserIds = userChecks.filter(c => c.item_id === item.id).map(c => c.user_id)
        
        return (
            <div className={css({ position: 'fixed', inset: 0, zIndex: 100, bg: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px' })} onClick={() => setShowChecksModal(null)}>
                <div className={css({ bg: 'white', w: '100%', maxW: '400px', borderRadius: '20px', overflow: 'hidden' })} onClick={e => e.stopPropagation()}>
                    <div className={css({ p: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                        <h3 className={css({ fontSize: '18px', fontWeight: '800' })}>체크 현황</h3>
                        <button onClick={() => setShowChecksModal(null)} className={css({ border: 'none', bg: 'transparent', cursor: 'pointer' })}><X size={20} /></button>
                    </div>
                    <div className={css({ p: '20px', maxHeight: '300px', overflowY: 'auto' })}>
                        <div className={css({ mb: '16px', fontSize: '14px', color: '#666', fontWeight: '700' })}>
                            "{item.item_name}" 준비 완료 인원 ({checkedUserIds.length}/{totalMembersCount})
                        </div>
                        <ul className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                            {participants.map(p => {
                                const isMe = p.user_id === currentUser?.id
                                const name = p.profiles?.nickname || p.email || '동행자'
                                return (
                                    <li key={p.user_id} className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
                                        <span className={css({ fontSize: '15px' })}>
                                            {isMe ? `나 (${name})` : name}
                                        </span>
                                        {checkedUserIds.includes(p.user_id) ? <Check size={18} color="#3B82F6" /> : <div className={css({ w: '18px' })} />}
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                </div>
            </div>
        )
    }

    const EditItemModal = () => {
        if (!editingItem) return null

        const [name, setName] = useState(editingItem.item_name)
        const [category, setCategory] = useState(editingItem.category || '기타')
        const [type, setType] = useState(editingItem.assignment_type || 'anyone')
        const [assignedTo, setAssignedTo] = useState(editingItem.assigned_user_id || '')

        return (
            <div className={css({ position: 'fixed', inset: 0, zIndex: 100, bg: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px' })} onClick={() => setEditingItem(null)}>
                <div className={css({ bg: 'white', w: '100%', maxW: '450px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' })} onClick={e => e.stopPropagation()}>
                    <div className={css({ p: '24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                        <h3 className={css({ fontSize: '20px', fontWeight: '800' })}>항목 수정</h3>
                        <button onClick={() => setEditingItem(null)} className={css({ border: 'none', bg: 'transparent', cursor: 'pointer', color: '#666' })}><X size={24} /></button>
                    </div>
                    <div className={css({ p: '24px', display: 'flex', flexDirection: 'column', gap: '20px' })}>
                        <div>
                            <label className={css({ display: 'block', fontSize: '13px', fontWeight: '700', mb: '8px', color: '#444' })}>항목 이름</label>
                            <input 
                                type="text" value={name} onChange={e => setName(e.target.value)}
                                className={css({ w: '100%', p: '12px', border: '1px solid #DDDDDD', borderRadius: '12px', fontSize: '16px', outline: 'none', _focus: { borderColor: '#222' } })}
                            />
                        </div>
                        <div className={css({ display: 'flex', gap: '12px' })}>
                            <div className={css({ flex: 1 })}>
                                <label className={css({ display: 'block', fontSize: '13px', fontWeight: '700', mb: '8px', color: '#444' })}>카테고리</label>
                                <select value={category} onChange={e => setCategory(e.target.value)} className={css({ w: '100%', p: '12px', border: '1px solid #DDDDDD', borderRadius: '12px', bg: 'white' })}>
                                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className={css({ display: 'block', fontSize: '13px', fontWeight: '700', mb: '8px', color: '#444' })}>완료 조건 유형</label>
                            <select value={type} onChange={e => {
                                const newType = e.target.value as any
                                setType(newType)
                                if (newType === 'specific' && !assignedTo) {
                                    setAssignedTo(currentUser?.id || '')
                                }
                            }} className={css({ w: '100%', p: '12px', border: '1px solid #DDDDDD', borderRadius: '12px', bg: 'white', mb: '8px' })}>
                                <option value="anyone">함께 준비해요</option>
                                {members.length > 0 && <option value="specific">담당자를 정해요</option>}
                                {members.length > 0 && <option value="everyone">각자 꼭 챙겨요</option>}
                            </select>
                            
                            {type === 'specific' && (
                                <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className={css({ w: '100%', p: '12px', border: '1px solid #DDDDDD', borderRadius: '12px', bg: 'white', mt: '8px' })}>
                                    {participants.map(p => {
                                        const isMe = p.user_id === currentUser?.id
                                        const label = p.profiles?.nickname || p.email || (isMe ? '나' : '동행자')
                                        return (
                                            <option key={p.user_id} value={p.user_id}>
                                                {isMe ? `${label} (나)` : label}
                                            </option>
                                        )
                                    })}
                                </select>
                            )}
                        </div>
                    </div>
                    <div className={css({ p: '24px', bg: '#F9F9F9', display: 'flex', gap: '12px' })}>
                        <button 
                            onClick={() => updateItem({ item_name: name, category, assignment_type: type, assigned_user_id: type === 'specific' ? assignedTo : null })}
                            className={css({ flex: 1, py: '14px', bg: '#222', color: 'white', borderRadius: '12px', fontWeight: '800', border: 'none', cursor: 'pointer', _hover: { bg: '#000' } })}
                        >
                            저장하기
                        </button>
                        <button onClick={() => setEditingItem(null)} className={css({ flex: 1, py: '14px', bg: 'white', color: '#222', border: '1px solid #DDDDDD', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' })}>
                            취소
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const totalItems = items.length
    const checkedItems = items.filter((item: any) => getItemStatus(item).is_checked).length
    const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0

    const templateGroups = items.reduce((acc: Record<string, any[]>, item) => {
        const grp = item.source_template_name || '직접 추가함'
        if (!acc[grp]) acc[grp] = []
        acc[grp].push(item)
        return acc
    }, {})

    return (
        <div className={css({ bg: 'white', p: { base: '0', sm: '24px' }, borderRadius: { base: 0, sm: '16px' }, boxShadow: { base: 'none', sm: '0 4px 12px rgba(0,0,0,0.03)' }, pb: { base: '80px', sm: '24px' } })}>
            
            {/* 1. 타이틀 & 보기 모드, 버튼 영역 (반응형 다중 구조) */}
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '16px', mb: '20px', px: { base: '20px', sm: 0 }, pt: { base: '20px', sm: 0 } })}>
                
                {/* 상단 라인: 타이틀 + 모바일 필터(드롭다운) */}
                <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                    <h2 className={css({ fontSize: { base: '18px', sm: '22px' }, fontWeight: '800', color: '#222' })}>
                        준비물 챙기기 {totalItems > 0 && <span className={css({ color: 'brand.primary', ml: '8px' })}>{progressPercent}%</span>}
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
                        {/* 항목 추가 버튼 (PC에서만 보임, 모바일은 하단 Sticky) */}
                        <button
                            onClick={() => setIsAdding(!isAdding)}
                            className={css({
                                display: { base: 'none', sm: 'flex' }, alignItems: 'center', justifyContent: 'center', gap: '6px',
                                bg: '#222', color: 'white', px: '16px', py: '10px',
                                borderRadius: '8px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', border: 'none',
                                _hover: { bg: '#000' }, whiteSpace: 'nowrap'
                            })}
                        >
                            <Plus size={16} /> 항목 추가
                        </button>

                        <button
                            onClick={() => setIsTemplateModalOpen(true)}
                            className={css({
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                px: '16px', py: { base: '10px', sm: '10px' },
                                bg: 'white', color: '#222', border: '1px solid #DDDDDD', borderRadius: '8px',
                                fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                                w: { base: '100%', sm: 'auto' }, flex: { base: 1, sm: 'none' },
                                flexShrink: 0,
                                whiteSpace: 'nowrap', transition: 'all 0.2s',
                                _hover: { bg: '#F7F7F7', borderColor: '#222' },
                                _active: { transform: 'scale(0.98)' }
                            })}
                        >
                            <ListTodo size={15} />
                            <span>템플릿 불러오기</span>
                        </button>
                    </div>
                </div>
            </div>

            {totalItems > 0 && (
                <div className={css({ w: '100%', bg: '#F7F7F7', h: '6px', borderRadius: '3px', mb: '24px', overflow: 'hidden', px: { base: '20px', sm: 0 } })}>
                    <div
                        className={css({ h: '100%', bg: '#222', transition: 'width 0.8s cubic-bezier(0.1, 0.7, 0.1, 1)' })}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            )}

            {isAdding && (
                <form onSubmit={addItem} className={css({ mb: '24px', px: { base: '20px', sm: 0 } })}>
                    <div className={css({ 
                        display: 'flex', 
                        flexDirection: 'column',
                        bg: '#F7F7F7',
                        p: '16px',
                        borderRadius: '16px',
                        border: '1px solid #DDDDDD'
                    })}>
                        <div className={css({ display: 'flex', gap: '8px', mb: '12px' })}>
                            <input
                                type="text"
                                autoFocus
                                value={newItemName}
                                onChange={e => setNewItemName(e.target.value)}
                                placeholder="어떤 준비물인가요?"
                                className={css({ flex: 1, p: '12px', bg: 'white', border: '1px solid #DDDDDD', borderRadius: '8px', outline: 'none', fontSize: '15px' })}
                            />
                        </div>
                        {members.length > 0 && (
                            <div className={css({ display: 'flex', gap: '8px', mt: '12px', flexWrap: 'wrap' })}>
                                <select
                                    value={newItemAssignmentType}
                                    onChange={e => {
                                        setNewItemAssignmentType(e.target.value as any)
                                        if (e.target.value === 'specific' && !newItemAssignedUserId) {
                                            setNewItemAssignedUserId(currentUser?.id || '')
                                        }
                                    }}
                                    className={css({ p: '8px', bg: 'white', border: '1px solid #DDDDDD', borderRadius: '8px', outline: 'none', fontSize: '13px', fontWeight: '600' })}
                                >
                                    <option value="anyone">함께 준비해요</option>
                                    <option value="specific">담당자를 정해요</option>
                                    <option value="everyone">각자 꼭 챙겨요</option>
                                </select>

                                {newItemAssignmentType === 'specific' && (
                                    <select
                                        value={newItemAssignedUserId}
                                        onChange={e => setNewItemAssignedUserId(e.target.value)}
                                        className={css({ p: '8px', bg: 'white', border: '1px solid #DDDDDD', borderRadius: '8px', outline: 'none', fontSize: '13px' })}
                                    >
                                        {participants.map(p => {
                                            const isMe = p.user_id === currentUser?.id
                                            const label = p.profiles?.nickname || p.email || (isMe ? '나' : '동행자')
                                            return (
                                                <option key={p.user_id} value={p.user_id}>
                                                    {isMe ? `${label} (나)` : label}
                                                </option>
                                            )
                                        })}
                                    </select>
                                )}
                                
                                <div className={css({ display: 'flex', alignItems: 'center', gap: '4px', color: '#717171', fontSize: '12px' })}>
                                    <Info size={14} />
                                    {newItemAssignmentType === 'anyone' && '한 명이라도 챙기면 완료된 것으로 표시돼요.'}
                                    {newItemAssignmentType === 'specific' && '정해진 담당자만 체크할 수 있어요.'}
                                    {newItemAssignmentType === 'everyone' && '참여자 모두가 각자 챙겨야 완료돼요.'}
                                </div>
                            </div>
                        )}

                        <div className={css({ display: 'flex', gap: '8px', alignItems: 'center', mt: '16px' })}>
                             <select
                                value={newItemCategory}
                                onChange={e => setNewItemCategory(e.target.value)}
                                className={css({ flex: 1, p: '10px', bg: 'white', border: '1px solid #DDDDDD', borderRadius: '8px', outline: 'none', fontSize: '14px' })}
                            >
                                {CATEGORIES.map((cat: any) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                disabled={!newItemName.trim()}
                                className={css({ py: '10px', px: '20px', bg: 'brand.primary', color: 'white', fontWeight: '800', borderRadius: '8px', border: 'none', cursor: 'pointer' })}
                            >
                                추가
                            </button>
                            <button
                                type="button"
                                onClick={() => { setIsAdding(false); setNewItemName(''); }}
                                className={css({ py: '10px', px: '16px', bg: 'white', color: '#222', border: '1px solid #DDDDDD', borderRadius: '8px', fontWeight: '800' })}
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {totalItems === 0 && !isAdding ? (
                <div className={css({ textAlign: 'center', py: '80px', color: '#666' })}>
                        <p className={css({ fontSize: '18px', fontWeight: '700', mb: '12px', color: '#333' })}>
                            아직 등록된 준비물이 없어요. 🧳
                        </p>
                        <p className={css({ fontSize: '15px', color: '#666', lineHeight: '1.6' })}>항목을 추가하거나 템플릿을 불러와서 짐 싸기를 시작해 보세요!</p>
                </div>
            ) : (
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '24px' })}>
                    {groupBy === 'category' ? (
                        CATEGORIES.map((cat: any) => {
                            const categoryItems = items.filter((item: any) => item.category === cat || (!item.category && cat === '기타'))
                            if (categoryItems.length === 0) return null

                            return (
                                <div key={cat} className={css({ display: 'flex', flexDirection: 'column' })}>
                                    <h3 className={css({ px: '20px', fontSize: '14px', fontWeight: '800', color: '#222', bg: '#F7F7F7', py: '10px', borderBottom: '1px solid #EEEEEE' })}>
                                        {cat} <span className={css({ color: '#717171', fontWeight: 'normal', fontSize: '12px', ml: '4px' })}>{categoryItems.length}</span>
                                    </h3>
                                    <ul className={css({ display: 'flex', flexDirection: 'column' })}>
                                        {categoryItems.map((item) => (
                                            <ChecklistItem key={item.id} item={item} />
                                        ))}
                                    </ul>
                                </div>
                            )
                        })
                    ) : (
                        Object.entries(templateGroups).map(([grpName, grpItems]) => (
                            <div key={grpName} className={css({ display: 'flex', flexDirection: 'column' })}>
                                <h3 className={css({ px: '20px', fontSize: '14px', fontWeight: '800', color: '#222', bg: '#F7F7F7', py: '10px', borderBottom: '1px solid #EEEEEE', display: 'flex', alignItems: 'center', gap: '6px' })}>
                                    {grpName === '직접 추가함' ? '✍️ 직접 추가함' : `📦 ${grpName}`}
                                    <span className={css({ color: '#717171', fontWeight: 'normal', fontSize: '12px', ml: '4px' })}>{grpItems.length}</span>
                                </h3>
                                <ul className={css({ display: 'flex', flexDirection: 'column' })}>
                                    {grpItems.map((item) => (
                                        <ChecklistItem key={item.id} item={item} />
                                    ))}
                                </ul>
                            </div>
                        ))
                    )}
                </div>
            )}

            {isActive && !isAdding && !isTemplateModalOpen && (
                <button
                    onClick={() => setIsAdding(true)}
                    className={css({
                        position: 'fixed',
                        bottom: '90px',
                        right: '20px',
                        w: '56px',
                        h: '56px',
                        bg: '#222',
                        color: 'white',
                        borderRadius: '50%',
                        display: { base: 'flex', sm: 'none' },
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                        zIndex: 40,
                        transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
                        _active: { transform: 'scale(0.88)' },
                        _hover: { bg: '#000' }
                    })}
                    aria-label="준비물 추가"
                >
                    <Plus size={28} />
                </button>
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

            <ChecksModal />
            <EditItemModal />
        </div>
    )
}
