'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { analytics } from '@/services/AnalyticsService'
import { css } from 'styled-system/css'
import { Plus, CheckSquare, Square, Trash2, Settings, ChevronDown, Check, ListTodo, Users, User, Info, X, SortAsc, Clock, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import TemplateModal from '@/components/trips/TemplateModal'
import { CacheUtil } from '@/utils/cache'
import { useNetworkStore } from '@/stores/useNetworkStore'
import { CATEGORIES } from '@/constants/checklist'

const SortDropdown = ({ sortBy, setSortBy }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = [
        { value: 'status', label: '상태순', icon: <CheckCircle size={14} /> },
        { value: 'alphabetical', label: '가나다순', icon: <SortAsc size={14} /> },
        { value: 'latest', label: '최신순', icon: <Clock size={14} /> }
    ];
    const selected = options.find(o => o.value === sortBy) || options[0];

    return (
        <div className={css({ position: 'relative' })}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={css({
                    display: 'flex', alignItems: 'center', gap: '4px',
                    bg: 'white', border: '1px solid #DDDDDD', borderRadius: '16px',
                    px: '12px', py: '6px', fontSize: '12px', fontWeight: '700', color: '#555', cursor: 'pointer',
                    transition: 'all 0.2s', _hover: { borderColor: '#999' }
                })}
            >
                {selected.icon}
                <span className={css({ display: { base: 'none', sm: 'inline' } })}>{selected.label}</span>
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
                                onClick={() => { setSortBy(opt.value); setIsOpen(false); }}
                                className={css({
                                    display: 'flex', alignItems: 'center', gap: '8px', w: '100%', textAlign: 'left', px: '14px', py: '10px', fontSize: '13px',
                                    bg: sortBy === opt.value ? '#EFF6FF' : 'transparent',
                                    color: sortBy === opt.value ? '#3B82F6' : '#555',
                                    fontWeight: sortBy === opt.value ? '700' : '500',
                                    border: 'none', cursor: 'pointer', _hover: { bg: '#f9f9f9' }
                                })}
                            >
                                {opt.icon}
                                <span className={css({ flex: 1, whiteSpace: 'nowrap' })}>{opt.label}</span>
                                {sortBy === opt.value && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

const CustomViewDropdown = ({ groupBy, setGroupBy }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = [
        { value: 'category', label: '카테고리별 보기' },
        { value: 'template', label: '템플릿별 보기' }
    ];
    const currentLabel = options.find(o => o.value === groupBy)?.label || '카테고리별 보기';

    return (
        <div className={css({ position: 'relative' })}>
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
    const { isOnline } = useNetworkStore()

    const [isLoading, setIsLoading] = useState(true)
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
    const [filterMode, setFilterMode] = useState<'all' | 'me' | string>('all')
    const [sortBy, setSortBy] = useState<'status' | 'alphabetical' | 'latest'>('status')



    const fetchChecklist = useCallback(async () => {
        if (!tripId) return

        try {
            // 1. 캐시에서 로드 (깜빡임 방지)
            const cachedItems = await CacheUtil.get<any[]>(`offline_checklist_items_${tripId}`)
            if (cachedItems) {
                setItems(cachedItems)
                setIsLoading(false)
            }
            const cachedChecks = await CacheUtil.get<any[]>(`offline_checklist_checks_${tripId}`)
            if (cachedChecks) setUserChecks(cachedChecks)

            // 2. 네트워크 확인
            if (!isOnline) {
                setIsLoading(false)
                return
            }

            let { data: checklists } = await supabase
                .from('checklists')
                .select('id, title')
                .eq('trip_id', tripId)
                .limit(1)

            let currentChecklistId = checklists?.[0]?.id

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
                    await CacheUtil.set(`offline_checklist_items_${tripId}`, itemsRes.data)
                    
                    const itemIds = itemsRes.data.map((i: any) => i.id)
                    if (itemIds.length > 0) {
                        const { data: checks } = await supabase
                            .from('checklist_item_user_checks')
                            .select('*')
                            .in('item_id', itemIds)
                        if (checks) {
                            setUserChecks(checks)
                            await CacheUtil.set(`offline_checklist_checks_${tripId}`, checks)
                        }
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
        } catch (error) {
            console.error('fetchChecklist error:', error)
        } finally {
            setIsLoading(false)
        }
    }, [tripId, supabase, isOnline])

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
        // 오프라인 상태이면 무조건 체크 토글 방지
        const canCheck = (item.assignment_type === 'specific' ? isAssignedToMe : true) && isOnline

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

                {isOnline && (
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
                )}
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

    // 필링 로직 적용
    const filteredItems = items.filter(item => {
        if (filterMode === 'all') return true;
        
        const targetUserId = filterMode === 'me' ? currentUser?.id : filterMode;
        
        // 1. 담당자가 지정된 경우 (specific)
        if (item.assignment_type === 'specific') {
            return item.assigned_user_id === targetUserId;
        }
        
        // 2. 공통 준비물 (anyone) - '전체' 보기가 아닐 때는 제외 (사용자 요청)
        if (item.assignment_type === 'anyone') {
            return false;
        }
        
        if (item.assignment_type === 'everyone') {
            return true;
        }
        
        return true;
    });

    // 필터링된 항목 정렬
    const sortedFilteredItems = [...filteredItems].sort((a, b) => {
        // 1. 최신순 처리 (가장 뒤에 추가된 항목이 위로)
        if (sortBy === 'latest') {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }

        const getStatus = (item: any) => {
            const s = getItemStatus(item);
            if (filterMode === 'all') return s.is_checked;
            const targetUserId = filterMode === 'me' ? currentUser?.id : filterMode;
            if (item.assignment_type === 'everyone') {
                return userChecks.some(c => c.item_id === item.id && c.user_id === targetUserId);
            }
            return item.is_checked;
        };

        const isDoneA = getStatus(a);
        const isDoneB = getStatus(b);

        // 2. 상태순 정렬 (미완료 항목 우선)
        if (sortBy === 'status') {
            if (isDoneA !== isDoneB) return isDoneA ? 1 : -1;
        }

        // 3. 공통: 가나다순 정렬 (상태순일 때도 2차 정렬로 사용)
        return (a.item_name || '').localeCompare(b.item_name || '', 'ko');
    });

    const filteredTotalItems = sortedFilteredItems.length
    const filteredCheckedItems = sortedFilteredItems.filter((item: any) => {
        const status = getItemStatus(item);
        if (filterMode === 'all') return status.is_checked;
        
        // 개인/멤버 필터에서는 해당 인원의 체크 여부를 기준으로 진척도 계산
        const targetUserId = filterMode === 'me' ? currentUser?.id : filterMode;
        if (item.assignment_type === 'everyone') {
            return userChecks.some(c => c.item_id === item.id && c.user_id === targetUserId);
        }
        return item.is_checked;
    }).length
    const filteredProgressPercent = filteredTotalItems > 0 ? Math.round((filteredCheckedItems / filteredTotalItems) * 100) : 0

    const templateGroups = sortedFilteredItems.reduce((acc: Record<string, any[]>, item) => {
        const grp = item.source_template_name || '직접 추가함'
        if (!acc[grp]) acc[grp] = []
        acc[grp].push(item)
        return acc
    }, {})

    const FilterBar = () => {
        if (totalItems === 0) return null;
        const [isOthersOpen, setIsOthersOpen] = useState(false);

        const otherParticipants = participants.filter(p => p.user_id !== currentUser?.id);
        const selectedOther = otherParticipants.find(p => p.user_id === filterMode);

        return (
            <div className={css({ 
                display: 'flex', gap: '8px', alignItems: 'center', mb: '16px', px: { base: '20px', sm: 0 },
                position: 'relative'
            })}>
                {/* 1. 전체 */}
                <button
                    onClick={() => { setFilterMode('all'); setIsOthersOpen(false); }}
                    className={css({
                        display: 'flex', alignItems: 'center', gap: '6px',
                        px: '16px', py: '8px', borderRadius: '20px',
                        fontSize: '14px', fontWeight: '800',
                        bg: filterMode === 'all' ? '#222' : '#F1F3F4',
                        color: filterMode === 'all' ? 'white' : '#666',
                        border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                    })}
                >
                    <ListTodo size={14} /> 전체
                </button>

                {/* 2. 나 */}
                <button
                    onClick={() => { setFilterMode('me'); setIsOthersOpen(false); }}
                    className={css({
                        display: 'flex', alignItems: 'center', gap: '6px',
                        px: '16px', py: '8px', borderRadius: '20px',
                        fontSize: '14px', fontWeight: '800',
                        bg: filterMode === 'me' ? '#3B82F6' : '#F1F3F4',
                        color: filterMode === 'me' ? 'white' : '#666',
                        border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                    })}
                >
                    <User size={14} /> 나
                </button>

                {/* 3. 다른 사람들 (드롭다운) */}
                {otherParticipants.length > 0 && (
                    <div className={css({ position: 'relative' })}>
                        <button
                            onClick={() => setIsOthersOpen(!isOthersOpen)}
                            className={css({
                                display: 'flex', alignItems: 'center', gap: '6px',
                                px: '16px', py: '8px', borderRadius: '20px',
                                fontSize: '14px', fontWeight: '800',
                                bg: selectedOther ? '#3B82F6' : '#F1F3F4',
                                color: selectedOther ? 'white' : '#666',
                                border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                            })}
                        >
                            <Users size={14} />
                            {selectedOther ? (selectedOther.profiles?.nickname || selectedOther.email?.split('@')[0] || '동행자') : '동행자'}
                            <ChevronDown size={14} className={css({ transform: isOthersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' })} />
                        </button>

                        {isOthersOpen && (
                            <>
                                <div className={css({ position: 'fixed', inset: 0, zIndex: 10 })} onClick={() => setIsOthersOpen(false)} />
                                <div className={css({
                                    position: 'absolute', top: '100%', left: 0, mt: '4px',
                                    bg: 'white', border: '1px solid #eee', borderRadius: '12px',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 11, minW: '140px',
                                    overflow: 'hidden'
                                })}>
                                    {otherParticipants.map(p => {
                                        const label = p.profiles?.nickname || p.email?.split('@')[0] || '동행자';
                                        return (
                                            <button
                                                key={p.user_id}
                                                onClick={() => { setFilterMode(p.user_id); setIsOthersOpen(false); }}
                                                className={css({
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', w: '100%', textAlign: 'left', px: '14px', py: '10px', fontSize: '13px',
                                                    bg: filterMode === p.user_id ? '#EFF6FF' : 'transparent',
                                                    color: filterMode === p.user_id ? '#3B82F6' : '#555',
                                                    fontWeight: filterMode === p.user_id ? '700' : '500',
                                                    border: 'none', cursor: 'pointer', _hover: { bg: '#f9f9f9' }
                                                })}
                                            >
                                                {label}
                                                {filterMode === p.user_id && <Check size={14} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={css({ bg: 'white', p: { base: '0', sm: '24px' }, borderRadius: { base: 0, sm: '16px' }, boxShadow: { base: 'none', sm: '0 4px 12px rgba(0,0,0,0.03)' }, pb: { base: '80px', sm: '24px' } })}>
            
            {/* 1. 타이틀 & 보기 모드, 버튼 영역 (반응형 다중 구조) */}
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '16px', mb: '20px', px: { base: '20px', sm: 0 }, pt: { base: '20px', sm: 0 } })}>
                
                {/* 상단 라인: 타이틀 + 모바일 필터(드롭다운) */}
                <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                    <h2 className={css({ fontSize: { base: '18px', sm: '22px' }, fontWeight: '800', color: '#222' })}>
                        {filterMode === 'all' ? '전체' : (filterMode === 'me' ? '내' : (participants.find(p => p.user_id === filterMode)?.profiles?.nickname || participants.find(p => p.user_id === filterMode)?.email?.split('@')[0] || '동행자'))} 준비물 {filterMode !== 'all' ? (
                            <span className={css({ color: '#3B82F6', ml: '8px' })}>
                                {filteredProgressPercent}% <span className={css({ fontSize: '11px', fontWeight: 'normal', color: '#888' })}>(전체 {progressPercent}%)</span>
                            </span>
                        ) : (
                            totalItems > 0 && <span className={css({ color: 'brand.primary', ml: '8px' })}>{progressPercent}%</span>
                        )}
                    </h2>
                    
                    <div className={css({ display: 'flex', gap: '8px' })}>
                        {totalItems > 0 && <SortDropdown sortBy={sortBy} setSortBy={setSortBy} />}
                        {totalItems > 0 && <CustomViewDropdown groupBy={groupBy} setGroupBy={setGroupBy} />}
                    </div>
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
                    {isOnline && (
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
                    )}
                </div>
            </div>

            {totalItems > 0 && (
                <div className={css({ w: '100%', bg: '#F7F7F7', h: '6px', borderRadius: '3px', mb: '24px', overflow: 'hidden', px: { base: '20px', sm: 0 } })}>
                    <div
                        className={css({ h: '100%', bg: filterMode !== 'all' ? '#3B82F6' : '#222', transition: 'width 0.8s cubic-bezier(0.1, 0.7, 0.1, 1)' })}
                        style={{ width: `${filterMode !== 'all' ? filteredProgressPercent : progressPercent}%` }}
                    />
                </div>
            )}

            <FilterBar />

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

            {isLoading ? (
                <div className={css({ textAlign: 'center', py: '60px', color: '#888' })}>
                    <div className={css({ w: '100%', h: '60px', bg: '#f1f3f4', borderRadius: '12px', animation: 'pulse 1.5s infinite' })}></div>
                    <div className={css({ w: '100%', h: '60px', bg: '#f1f3f4', borderRadius: '12px', mt: '12px', animation: 'pulse 1.5s infinite' })}></div>
                </div>
            ) : totalItems === 0 && !isAdding ? (
                <div className={css({ textAlign: 'center', py: '80px', color: '#666' })}>
                        <p className={css({ fontSize: '18px', fontWeight: '700', mb: '12px', color: '#333' })}>
                            아직 등록된 준비물이 없어요. 🧳
                        </p>
                        {isOnline && (
                            <p className={css({ fontSize: '15px', color: '#666', lineHeight: '1.6' })}>항목을 추가하거나 템플릿을 불러와서 짐 싸기를 시작해 보세요!</p>
                        )}
                </div>
            ) : totalItems > 0 && sortedFilteredItems.length === 0 ? (
                <div className={css({ textAlign: 'center', py: '60px', color: '#666' })}>
                        <p className={css({ fontSize: '16px', fontWeight: '800', mb: '8px', color: '#222' })}>
                            해당하는 준비물이 없어요 🕵️‍♂️
                        </p>
                        <p className={css({ fontSize: '14px', color: '#888' })}>
                            {filterMode === 'me' ? '내가 챙길 짐이 없습니다.' : '다른 필터를 선택해 보세요.'}
                        </p>
                        <button 
                            onClick={() => setFilterMode('all')}
                            className={css({ mt: '20px', bg: 'white', border: '1px solid #DDDDDD', borderRadius: '12px', px: '20px', py: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', _hover: { bg: '#F7F7F7' }, transition: 'all 0.2s' })}
                        >
                            전체 준비물 보기
                        </button>
                </div>
            ) : (
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '24px' })}>
                    {groupBy === 'category' ? (
                        CATEGORIES.map((cat: any) => {
                            const categoryItems = sortedFilteredItems.filter((item: any) => item.category === cat || (!item.category && cat === '기타'))
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

            {isActive && !isAdding && !isTemplateModalOpen && isOnline && (
                <button
                    onClick={() => setIsAdding(true)}
                    className={css({
                        position: 'fixed',
                        bottom: 'calc(90px + env(safe-area-inset-bottom))',
                        right: '20px',
                        w: '48px',
                        h: '48px',
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
                    aria-label="준비물 항목 추가"
                >
                    <Plus size={24} />
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
