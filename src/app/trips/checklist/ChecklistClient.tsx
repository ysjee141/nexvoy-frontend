'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { analytics } from '@/services/AnalyticsService'
import { css } from 'styled-system/css'
import { Plus, CheckSquare, Square, Trash2, Settings, ChevronDown, Check, ListTodo, Users, User, Info, X, SortAsc, Clock, CheckCircle, LayoutGrid, List, Download, Lock } from 'lucide-react'
import Link from 'next/link'
import { motion, useAnimation, PanInfo, AnimatePresence } from 'framer-motion'
import TemplateModal from '@/components/trips/TemplateModal'
import { CacheUtil } from '@/utils/cache'
import { DownloadService } from '@/services/DownloadService'
import { useNetworkStore } from '@/stores/useNetworkStore'
import { CATEGORIES } from '@/constants/checklist'
import ChecklistSkeleton from './ChecklistSkeleton'

const getMemberDisplayName = (p: any, isMe: boolean = false) => {
    if (!p) return isMe ? '나' : '동행자'
    const nickname = p.profiles?.nickname
    const email = p.email || p.profiles?.email
    const idPart = email?.split('@')[0]
    return nickname || idPart || email || (isMe ? '나' : '동행자')
}

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
                    display: 'flex', alignItems: 'center', gap: '6px',
                    bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px',
                    px: '16px', h: '42px', fontSize: '13px', fontWeight: '700', color: 'brand.ink', cursor: 'pointer',
                    transition: 'all 0.2s', _hover: { bg: 'bg.surfaceSoft', borderColor: 'brand.ink' },
                    _active: { transform: 'scale(0.98)' }
                })}
            >
                {selected.icon}
                <span className={css({ display: { base: 'none', sm: 'inline' } })}>{selected.label}</span>
                <ChevronDown size={14} className={css({ ml: '2px', color: 'brand.muted' })} />
            </button>
            {isOpen && (
                <>
                    <div className={css({ position: 'fixed', inset: 0, zIndex: 10 })} onClick={() => setIsOpen(false)} />
                    <div className={css({
                        position: 'absolute', top: '100%', left: 0, mt: '4px',
                        bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '12px',
                        boxShadow: 'airbnbHover', zIndex: 11, minW: '130px',
                        overflow: 'hidden'
                    })}>
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { setSortBy(opt.value); setIsOpen(false); }}
                                className={css({
                                    display: 'flex', alignItems: 'center', gap: '8px', w: '100%', textAlign: 'left', px: '14px', py: '12px', fontSize: '13px',
                                    bg: sortBy === opt.value ? 'brand.primary/5' : 'transparent',
                                    color: sortBy === opt.value ? 'brand.primary' : 'brand.body',
                                    fontWeight: sortBy === opt.value ? '700' : '500',
                                    border: 'none', cursor: 'pointer', _hover: { bg: 'bg.surfaceSoft' }
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
        { value: 'category', label: '카테고리별 보기', icon: <LayoutGrid size={14} /> },
        { value: 'template', label: '템플릿별 보기', icon: <List size={14} /> }
    ];
    const selected = options.find(o => o.value === groupBy) || options[0];

    return (
        <div className={css({ position: 'relative' })}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={css({
                    display: 'flex', alignItems: 'center', gap: '6px',
                    bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '12px',
                    px: { base: '12px', sm: '16px' }, 
                    h: '42px', 
                    fontSize: '13px', fontWeight: '700', color: 'brand.ink', cursor: 'pointer',
                    transition: 'all 0.2s', _hover: { bg: 'bg.surfaceSoft', borderColor: 'brand.ink' },
                    _active: { transform: 'scale(0.98)' }
                })}
            >
                {selected.icon}
                <span className={css({ display: { base: 'none', sm: 'inline' } })}>{selected.label}</span>
                <ChevronDown size={14} className={css({ ml: '2px', color: 'brand.muted' })} />
            </button>
            {isOpen && (
                <>
                    <div className={css({ position: 'fixed', inset: 0, zIndex: 10 })} onClick={() => setIsOpen(false)} />
                    <div className={css({
                        position: 'absolute', top: '100%', left: 0, mt: '4px',
                        bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '12px',
                        boxShadow: 'airbnbHover', zIndex: 11, minW: '140px',
                        overflow: 'hidden'
                    })}>
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { setGroupBy(opt.value); setIsOpen(false); }}
                                className={css({
                                    display: 'flex', alignItems: 'center', gap: '8px', w: '100%', textAlign: 'left', px: '14px', py: '12px', fontSize: '13px',
                                    bg: groupBy === opt.value ? 'brand.primary/5' : 'transparent',
                                    color: groupBy === opt.value ? 'brand.primary' : 'brand.body',
                                    fontWeight: groupBy === opt.value ? '700' : '500',
                                    border: 'none', cursor: 'pointer', _hover: { bg: 'bg.surfaceSoft' }
                                })}
                            >
                                {opt.icon}
                                <span className={css({ flex: 1, whiteSpace: 'nowrap' })}>{opt.label}</span>
                                {groupBy === opt.value && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

interface FilterBarProps {
    totalItems: number;
    isLoading: boolean;
    participants: any[];
    currentUser: any;
    filterMode: string;
    setFilterMode: (mode: string) => void;
}

const FilterBar = ({ totalItems, isLoading, participants, currentUser, filterMode, setFilterMode }: FilterBarProps) => {
    if (!isLoading && totalItems === 0) return null;
    
    const [isOthersOpen, setIsOthersOpen] = useState(false);
    const [dragY, setDragY] = useState(0);
    const [startY, setStartY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    // Scroll Lock
    useEffect(() => {
        if (isOthersOpen) {
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        } else {
            document.body.style.overflow = 'unset';
            document.body.style.position = 'unset';
            document.body.style.width = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
            document.body.style.position = 'unset';
            document.body.style.width = 'unset';
        };
    }, [isOthersOpen]);

    const handleTouchStart = (e: React.TouchEvent) => {
        setStartY(e.touches[0].clientY);
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - startY;
        if (deltaY > 0) {
            setDragY(deltaY);
        }
    };

    const handleTouchEnd = () => {
        if (dragY > 100) {
            setIsOthersOpen(false);
        }
        setIsDragging(false);
        setDragY(0);
    };

    const otherParticipants = participants.filter(p => p.user_id !== currentUser?.id);
    const selectedOther = otherParticipants.find(p => p.user_id === filterMode);

    return (
        <div className={css({ 
            display: 'flex', gap: '8px', alignItems: 'center', mb: '16px', px: { base: '20px', sm: 0 },
            position: 'relative',
            overflowX: { base: 'auto', sm: 'visible' },
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            '&::-webkit-scrollbar': { display: 'none' }
        })}>
            {/* 1. 전체 */}
            <button
                onClick={() => { setFilterMode('all'); setIsOthersOpen(false); }}
                className={css({
                    display: 'flex', alignItems: 'center', gap: '4px',
                    px: '14px', py: '8px', borderRadius: '20px',
                    fontSize: '13px', fontWeight: '700',
                    flexShrink: 0,
                    bg: filterMode === 'all' ? 'brand.ink' : 'bg.softCotton',
                    color: filterMode === 'all' ? 'white' : 'brand.muted',
                    border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                })}
            >
                <ListTodo size={14} /> 전체
            </button>

            {/* 2. 나 */}
            <button
                onClick={() => { setFilterMode('me'); setIsOthersOpen(false); }}
                className={css({
                    display: 'flex', alignItems: 'center', gap: '4px',
                    px: '14px', py: '8px', borderRadius: '20px',
                    fontSize: '13px', fontWeight: '700',
                    flexShrink: 0,
                    bg: filterMode === 'me' ? 'brand.primary' : 'bg.softCotton',
                    color: filterMode === 'me' ? 'white' : 'brand.muted',
                    border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                })}
            >
                <User size={14} /> 나
            </button>

            {/* 3. 다른 사람들 (드롭다운/바텀시트) */}
            {otherParticipants.length > 0 && (
                <div className={css({ position: { base: 'static', sm: 'relative' }, flexShrink: 0 })}>
                    <button
                        onClick={() => setIsOthersOpen(!isOthersOpen)}
                        className={css({
                            display: 'flex', alignItems: 'center', gap: '4px',
                            px: '14px', py: '8px', borderRadius: '20px',
                            fontSize: '13px', fontWeight: '700',
                            bg: selectedOther ? 'brand.primary' : 'bg.softCotton',
                            color: selectedOther ? 'white' : 'brand.muted',
                            border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                        })}
                    >
                        <Users size={14} />
                        <span className={css({ whiteSpace: 'nowrap' })}>
                            {getMemberDisplayName(selectedOther)}
                        </span>
                        <ChevronDown size={14} className={css({ transform: isOthersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' })} />
                    </button>

                    {isOthersOpen && (
                        <>
                            {/* Backdrop */}
                            <div 
                                className={css({ position: 'fixed', inset: 0, zIndex: 100, bg: 'bg.scrim/40', backdropFilter: 'blur(4px)' })} 
                                onClick={() => setIsOthersOpen(false)} 
                            />
                            
                            {/* Content Container */}
                            <div 
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                className={css({
                                    position: 'fixed', 
                                    bottom: { base: 0, sm: 'auto' }, 
                                    top: { base: 'auto', sm: '50%' },
                                    left: { base: 0, sm: '50%' },
                                    right: { base: 0, sm: 'auto' },
                                    transform: { 
                                        base: `translateY(${dragY}px)`, 
                                        sm: 'translate(-50%, -50%)' 
                                    },
                                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)',
                                    
                                    w: { base: '100%', sm: '320px' },
                                    maxH: { base: '92vh', sm: 'auto' },
                                    pb: { base: 'max(env(safe-area-inset-bottom), var(--safe-area-inset-bottom))', sm: 4 },
                                    bg: 'white', 
                                    borderRadius: { base: '24px 24px 0 0', sm: '16px' },
                                    boxShadow: 'airbnbHover', 
                                    zIndex: 101,
                                    overflow: 'hidden',
                                    animation: { base: 'slideUp 0.3s ease-out', sm: 'fadeIn 0.2s ease-out' }
                                })}
                            >
                                {/* Handle Area */}
                                <div className={css({ 
                                    display: { base: 'flex', sm: 'none' }, 
                                    flexDirection: 'column', 
                                    alignItems: 'center', 
                                    pt: '12px', pb: '8px', 
                                    cursor: 'ns-resize',
                                    touchAction: 'none' 
                                })}>
                                    <div className={css({ w: '40px', h: '5px', bg: 'brand.hairline', borderRadius: '10px' })} />
                                </div>

                                <div className={css({ px: '24px', py: '18px', borderBottom: '1px solid', borderColor: 'brand.hairline' })}>
                                    <h3 className={css({ fontSize: '17px', fontWeight: '700', color: 'brand.ink' })}>동행자 선택</h3>
                                </div>
                                
                                <div className={css({ maxHeight: { base: '60vh', sm: '400px' }, overflowY: 'auto' })}>
                                    {otherParticipants.map(p => {
                                        const label = getMemberDisplayName(p);
                                        return (
                                            <button
                                                key={p.user_id}
                                                onClick={() => { setFilterMode(p.user_id); setIsOthersOpen(false); }}
                                                className={css({
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', w: '100%', textAlign: 'left', 
                                                    px: '24px', py: { base: '18px', sm: '14px' }, fontSize: '15px',
                                                    bg: filterMode === p.user_id ? 'brand.primary/5' : 'transparent',
                                                    color: filterMode === p.user_id ? 'brand.primary' : 'brand.body',
                                                    fontWeight: filterMode === p.user_id ? '700' : '500',
                                                    border: 'none', cursor: 'pointer', _hover: { bg: 'bg.surfaceSoft' },
                                                    transition: 'all 0.15s'
                                                })}
                                            >
                                                <span className={css({ display: 'flex', alignItems: 'center', gap: '10px' })}>
                                                    <div className={css({ w: '8px', h: '8px', borderRadius: '50%', bg: filterMode === p.user_id ? 'brand.primary' : 'transparent', border: filterMode === p.user_id ? 'none' : '1px solid', borderColor: 'brand.hairline' })} />
                                                    {label}
                                                </span>
                                                {filterMode === p.user_id && <Check size={18} className={css({ color: 'brand.primary' })} />}
                                            </button>
                                        );
                                    })}
                                </div>
                                
                                <div className={css({ 
                                    p: '16px', 
                                    pb: { base: 'calc(16px + max(env(safe-area-inset-bottom), var(--safe-area-inset-bottom)))', sm: '16px' },
                                    bg: 'bg.surfaceSoft' 
                                })}>
                                    <button 
                                        onClick={() => setIsOthersOpen(false)}
                                        className={css({ 
                                            w: '100%', py: '14px', borderRadius: '12px',
                                            fontSize: '15px', color: 'brand.muted', fontWeight: '700', 
                                            bg: 'white', border: '1px solid', borderColor: 'brand.hairline',
                                            _active: { transform: 'scale(0.98)', bg: 'bg.surfaceSoft' } 
                                        })}
                                    >
                                        닫기
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ChecklistPage({ isActive = true, tripId: propsTripId, isOffline = false }: { isActive?: boolean; tripId?: string; isOffline?: boolean }) {
    const searchParams = useSearchParams()
    const tripId = propsTripId || searchParams.get('id')
    const supabase = createClient()
    const { isOnline } = useNetworkStore()

    const [isLoading, setIsLoading] = useState(true)
    const [checklistId, setChecklistId] = useState<string | null>(null)
    const [items, setItems] = useState<any[]>([])
    const [newItemName, setNewItemName] = useState('')
    const [newItemCategory, setNewItemCategory] = useState('기타')
    const [newItemIsPrivate, setNewItemIsPrivate] = useState(false)
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
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

    const [showTemplateModal, setShowTemplateModal] = useState(false)

    const handleAddItem = () => {
        setIsAdding(!isAdding)
    }

    const fetchChecklist = useCallback(async () => {
        if (!tripId) return

        try {
            if (isOffline) {
                const bundle = await DownloadService.getBundle(tripId)
                if (bundle) {
                    setItems(bundle.checklistItems || [])
                    setUserChecks(bundle.checklistChecks || [])
                    setMembers(bundle.members || [])
                    setTripInfo(bundle.trip)
                    if (bundle.trip?.user_id) {
                        setTripOwner({ id: bundle.trip.user_id, profiles: bundle.trip.profiles, email: bundle.trip.profiles?.email })
                    }
                }
                setIsLoading(false)
                return
            }

            // 2. 네트워크 확인
            const { isOfflineMode } = useNetworkStore.getState()
            if (!isOnline || isOfflineMode) {
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
                    // 명시적 다운로드 정책에 따라 자동 저장은 제거
                    
                    // 이미 다운로드된 여행이라면 백그라운드에서 전체 데이터 동기화
                    const bundle = await DownloadService.getBundle(tripId!)
                    if (bundle) {
                        DownloadService.downloadTrip(tripId!)
                    }
                    
                    const itemIds = itemsRes.data.map((i: any) => i.id)
                    if (itemIds.length > 0) {
                        const { data: checks } = await supabase
                            .from('checklist_item_user_checks')
                            .select('*')
                            .in('item_id', itemIds)
                        if (checks) {
                            setUserChecks(checks)
                            // 명시적 다운로드 정책에 따라 자동 저장은 제거
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

        // "나만 보기" 설정 시 담당자 강제 본인 지정
        const finalIsPrivate = newItemIsPrivate
        const finalAssignmentType = finalIsPrivate ? 'specific' : newItemAssignmentType
        const finalAssignedUserId = finalIsPrivate ? (currentUser?.id || null) : (newItemAssignmentType === 'specific' ? newItemAssignedUserId : null)

        const { data, error } = await supabase
            .from('checklist_items')
            .insert({
                checklist_id: checklistId,
                item_name: newItemName.trim(),
                category: newItemCategory,
                is_private: finalIsPrivate,
                assignment_type: finalAssignmentType,
                assigned_user_id: finalAssignedUserId
            })
            .select()
            .single()

        if (!error && data) {
            const updatedItems = [...items, data]
            setItems(updatedItems)
            setNewItemName('')
            setNewItemIsPrivate(false)
            setNewItemAssignmentType('anyone')
            setNewItemAssignedUserId('')
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
        const canCheck = (item.assignment_type === 'specific' ? isAssignedToMe : true) && isOnline && !isOffline

        const controls = useAnimation();
        const [isSwiping, setIsSwiping] = useState(false);

        const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
            setIsSwiping(false);
            if (typeof window !== 'undefined' && window.innerWidth > 768) return;

            if (info.offset.x < -60) {
                controls.start({ x: -120 });
            } else {
                controls.start({ x: 0 });
            }
        };

        const handleDragStart = () => {
            if (typeof window !== 'undefined' && window.innerWidth > 768) return;
            setIsSwiping(true);
        };

        const getAssignedUserLabel = () => {
            if (item.assigned_user_id === currentUser?.id) return '나'
            const p = participants.find(p => p.user_id === item.assigned_user_id)
            return getMemberDisplayName(p, item.assigned_user_id === currentUser?.id)
        }

        const assignedUser = item.assignment_type === 'specific' ? getAssignedUserLabel() : null

        return (
            <li className={css({ position: 'relative', overflow: 'hidden', borderBottom: '1px solid', borderColor: 'brand.hairlineSoft', bg: 'white' })}>
                {/* 배경 액션 버튼 (스와이프 시 보임) - 오프라인 모드에서는 숨김 */}
                {isOnline && !isOffline && (
                    <div className={css({
                        position: 'absolute', top: 0, right: 0, bottom: 0,
                        display: { base: 'flex', sm: 'none' }, // 모바일 전용
                        alignItems: 'stretch', gap: '0',
                        zIndex: 1
                    })}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setEditingItem(item); controls.start({ x: 0 }); }}
                            className={css({ 
                                h: '100%', w: '60px', bg: 'brand.primary', color: 'white', 
                                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer'
                            })}
                        >
                            <Settings size={22} strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={(e) => { deleteItem(e, item.id); controls.start({ x: 0 }); }}
                            className={css({ 
                                h: '100%', w: '60px', bg: 'brand.error', color: 'white', 
                                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer'
                            })}
                        >
                            <Trash2 size={22} strokeWidth={2.5} />
                        </button>
                    </div>
                )}

                {/* 메인 콘텐츠 영역 */}
                <motion.div
                    drag={typeof window !== 'undefined' && window.innerWidth <= 768 ? "x" : false}
                    dragConstraints={{ left: -120, right: 0 }}
                    dragElastic={0.1}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    animate={controls}
                    style={{ touchAction: 'pan-y' }}
                    className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: '18px 20px',
                        bg: 'white',
                        position: 'relative',
                        zIndex: 2,
                        transition: isSwiping ? 'none' : 'background 0.2s',
                        _active: { bg: 'bg.surfaceSoft' },
                        _hover: { bg: { base: 'white', sm: 'bg.softCotton' } }
                    })}
                >
                    <div 
                        onClick={() => canCheck && toggleItem(item.id, item.is_checked)}
                        className={css({ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, cursor: canCheck ? 'pointer' : 'not-allowed' })}
                    >
                        {/* 체크박스 */}
                        <div className={css({ 
                            w: '26px', h: '26px', 
                            border: '2px solid', 
                            borderColor: status.is_checked ? 'brand.muted' : (status.is_my_checked ? 'brand.primary' : 'brand.hairline'),
                            borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bg: status.is_checked ? 'brand.muted' : (status.is_my_checked ? 'brand.primary' : 'transparent'),
                            transition: 'all 0.2s',
                            opacity: !canCheck ? 0.3 : 1,
                            boxShadow: status.is_my_checked ? '0 2px 6px rgba(37, 99, 235, 0.15)' : 'none'
                        })}>
                            {(status.is_checked || status.is_my_checked) && <Check size={18} color="white" strokeWidth={3} />}
                        </div>

                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '2px' })}>
                            <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                                <span className={css({ 
                                    fontSize: '15px', 
                                    fontWeight: '600', 
                                    color: status.is_checked ? 'brand.muted' : 'brand.ink', 
                                    textDecoration: status.is_checked ? 'line-through' : 'none',
                                    transition: 'color 0.2s'
                                })}>
                                    {item.item_name}
                                </span>
                                
                                {/* 유형 배지 (Pastel style) */}
                                {item.assignment_type === 'specific' && (
                                    <span className={css({ 
                                        fontSize: '11px', px: '8px', py: '3px', borderRadius: '12px',
                                        bg: isAssignedToMe ? 'brand.primary/5' : 'bg.softCotton',
                                        color: isAssignedToMe ? 'brand.primary' : 'brand.muted',
                                        fontWeight: '700',
                                        display: 'flex', alignItems: 'center', gap: '4px'
                                    })}>
                                        {item.is_private && <Lock size={10} />}
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
                                            fontSize: '11px', px: '8px', py: '3px', borderRadius: '12px',
                                            bg: status.is_checked ? 'bg.softCotton' : 'brand.primary/8',
                                            color: status.is_checked ? 'brand.muted' : 'brand.primary',
                                            fontWeight: '700', border: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            transition: 'transform 0.2s',
                                            _active: { transform: 'scale(0.92)' }
                                        })}
                                    >
                                        <Users size={10} /> {status.checks_count}/{totalMembersCount}
                                    </button>
                                )}
                            </div>

                            <div className={css({ display: 'flex', gap: '8px', alignItems: 'center' })}>
                                {item.source_template_name && (
                                    <span className={css({ fontSize: '11px', color: 'brand.muted', fontWeight: '500' })}>
                                        {item.source_template_name}
                                    </span>
                                )}
                                {item.category && groupBy === 'template' && (
                                    <span className={css({ fontSize: '11px', color: 'brand.muted', bg: 'bg.surfaceSoft', px: '8px', py: '1px', borderRadius: '10px' })}>
                                        {item.category}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* PC에서만 보이는 우측 버튼 */}
                    {isOnline && !isOffline && (
                        <div className={css({ display: { base: 'none', sm: 'flex' }, gap: '8px' })}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setEditingItem(item); }}
                                className={css({ bg: 'transparent', border: 'none', color: 'brand.muted', cursor: 'pointer', p: '10px', borderRadius: '12px', _hover: { color: 'brand.primary', bg: 'brand.primary/8' } })}
                            >
                                <Settings size={18} />
                            </button>
                            <button
                                onClick={(e) => deleteItem(e, item.id)}
                                className={css({ bg: 'transparent', border: 'none', color: 'brand.muted', cursor: 'pointer', p: '10px', borderRadius: '12px', _hover: { color: 'brand.error', bg: 'brand.error/8' } })}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    )}
                </motion.div>
            </li>
        )
    }

    const ChecksModal = () => {
        if (!showChecksModal) return null
        const item = items.find(i => i.id === showChecksModal)
        if (!item) return null
        
        const checkedUserIds = userChecks.filter(c => c.item_id === item.id).map(c => c.user_id)
        
        return (
            <div className={css({ position: 'fixed', inset: 0, zIndex: 100, bg: 'bg.scrim/50', display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px' })} onClick={() => setShowChecksModal(null)}>
                <div className={css({ bg: 'white', w: '100%', maxW: '400px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.15)' })} onClick={e => e.stopPropagation()}>
                    <div className={css({ p: '20px', borderBottom: '1px solid', borderColor: 'brand.hairlineSoft', display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                        <h3 className={css({ fontSize: '18px', fontWeight: '700', color: 'brand.ink' })}>체크 현황</h3>
                        <button onClick={() => setShowChecksModal(null)} className={css({ border: 'none', bg: 'transparent', cursor: 'pointer', color: 'brand.muted' })}><X size={20} /></button>
                    </div>
                    <div className={css({ p: '20px', maxHeight: '300px', overflowY: 'auto' })}>
                        <div className={css({ mb: '16px', fontSize: '14px', color: 'brand.muted', fontWeight: '700' })}>
                            "{item.item_name}" 준비 완료 인원 ({checkedUserIds.length}/{totalMembersCount})
                        </div>
                        <ul className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                            {participants.map(p => {
                                return (
                                    <li key={p.user_id} className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
                                        <span className={css({ fontSize: '15px', fontWeight: '500', color: 'brand.ink' })}>
                                            {getMemberDisplayName(p, p.user_id === currentUser?.id)}
                                        </span>
                                        {checkedUserIds.includes(p.user_id) ? <Check size={18} color="var(--colors-brand-primary)" strokeWidth={3} /> : <div className={css({ w: '18px' })} />}
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
        const [isPrivate, setIsPrivate] = useState(editingItem.is_private || false)
        const [type, setType] = useState(editingItem.assignment_type || 'anyone')
        const [assignedTo, setAssignedTo] = useState(editingItem.assigned_user_id || '')

        return (
            <div className={css({ position: 'fixed', inset: 0, zIndex: 100, bg: 'bg.scrim/50', display: 'flex', alignItems: 'center', justifyContent: 'center', p: '20px' })} onClick={() => setEditingItem(null)}>
                <div className={css({ bg: 'white', w: '100%', maxW: '450px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.15)' })} onClick={e => e.stopPropagation()}>
                    <div className={css({ p: '24px', borderBottom: '1px solid', borderColor: 'brand.hairlineSoft', display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                        <h3 className={css({ fontSize: '20px', fontWeight: '700', color: 'brand.ink' })}>준비물 수정</h3>
                        <button onClick={() => setEditingItem(null)} className={css({ border: 'none', bg: 'transparent', cursor: 'pointer', color: 'brand.muted' })}><X size={24} /></button>
                    </div>
                    <div className={css({ p: '24px', display: 'flex', flexDirection: 'column', gap: '20px' })}>
                        <div>
                            <label className={css({ display: 'block', fontSize: '13px', fontWeight: '700', mb: '8px', color: 'brand.muted' })}>항목 이름</label>
                            <input 
                                type="text" value={name} onChange={(e) => setName(e.target.value)}
                                className={css({ w: '100%', p: '12px', border: '1px solid', borderColor: 'brand.hairlineSoft', borderRadius: '12px', fontSize: '16px', outline: 'none', _focus: { borderColor: 'brand.primary', boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.1)' } })}
                            />
                        </div>
                        <div className={css({ display: 'flex', gap: '12px' })}>
                            <div className={css({ flex: 1 })}>
                                <label className={css({ display: 'block', fontSize: '13px', fontWeight: '700', mb: '8px', color: 'brand.muted' })}>카테고리</label>
                                <select value={category} onChange={(e) => setCategory(e.target.value)} className={css({ w: '100%', p: '12px', border: '1px solid', borderColor: 'brand.hairlineSoft', borderRadius: '12px', bg: 'white', outline: 'none', _focus: { borderColor: 'brand.primary' } })}>
                                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        {/* 나만 보기 설정 */}
                        <div className={css({ mb: '24px' })}>
                            <label className={css({ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' })}>
                                <input
                                    type="checkbox"
                                    checked={isPrivate}
                                    onChange={e => {
                                        setIsPrivate(e.target.checked)
                                        if (e.target.checked) {
                                            setType('specific')
                                            setAssignedTo(currentUser?.id || '')
                                        }
                                    }}
                                    className={css({ accentColor: 'brand.primary', w: '18px', h: '18px' })}
                                />
                                <div className={css({ display: 'flex', flexDirection: 'column' })}>
                                    <span className={css({ fontSize: '15px', fontWeight: '700', color: 'brand.ink' })}>나만 보기</span>
                                    <span className={css({ fontSize: '12px', color: 'brand.muted' })}>담당자가 본인으로 고정되며, 다른 일행에게는 보이지 않아요.</span>
                                </div>
                            </label>
                        </div>

                        {/* 담당자 설정 */}
                        <div className={css({ mb: '24px', opacity: isPrivate ? 0.6 : 1, pointerEvents: isPrivate ? 'none' : 'auto' })}>
                            <label className={css({ display: 'block', fontSize: '15px', fontWeight: '700', mb: '12px', color: 'brand.ink' })}>누가 챙길까요?</label>
                            <select
                                value={type}
                                onChange={e => {
                                    setType(e.target.value as any)
                                    if (e.target.value === 'specific' && !assignedTo) {
                                        setAssignedTo(currentUser?.id || '')
                                    }
                                }}
                                className={css({ w: '100%', p: '14px', bg: 'bg.surfaceSoft', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '12px', outline: 'none', fontSize: '15px', fontWeight: '600' })}
                            >
                                <option value="anyone">한 명이라도 챙기기 (함께 준비)</option>
                                <option value="specific">담당자 지정하기</option>
                                <option value="everyone">모두가 각자 챙기기</option>
                            </select>

                            {type === 'specific' && (
                                <select
                                    value={assignedTo}
                                    onChange={e => setAssignedTo(e.target.value)}
                                    className={css({ w: '100%', mt: '12px', p: '14px', bg: 'bg.surfaceSoft', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '12px', outline: 'none', fontSize: '15px' })}
                                >
                                    {participants.map(p => (
                                        <option key={p.user_id} value={p.user_id}>
                                            {p.user_id === currentUser?.id ? `${getMemberDisplayName(p, true)} (나)` : getMemberDisplayName(p, false)}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                    <div className={css({ p: '24px', bg: 'bg.surfaceSoft', display: 'flex', gap: '12px' })}>
                        <button 
                            onClick={() => updateItem({ item_name: name, category, is_private: isPrivate, assignment_type: type, assigned_user_id: type === 'specific' ? assignedTo : null })}
                            className={css({ flex: 1, py: '14px', bg: 'brand.primary', color: 'white', borderRadius: '16px', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: 'shadow.primary', _hover: { opacity: 0.9, transform: 'translateY(-1px)' }, _active: { transform: 'translateY(0)' } })}
                        >
                            저장하기
                        </button>
                        <button onClick={() => setEditingItem(null)} className={css({ flex: 1, py: '14px', bg: 'white', color: 'brand.muted', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '16px', fontWeight: '700', cursor: 'pointer', _hover: { bg: 'bg.surfaceSoft', borderColor: 'brand.muted' } })}>
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
    const filteredItems = items.filter((item: any) => {
        // "나만 보기" 항목 필터링: 본인이 담당자가 아닌 비공개 항목은 절대 표시하지 않음
        if (item.is_private && item.assigned_user_id !== currentUser?.id) {
            return false
        }

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



    return (
        <div className={css({ bg: 'white', p: { base: '0', sm: '24px' }, borderRadius: { base: 0, sm: '16px' }, boxShadow: { base: 'none', sm: '0 4px 12px rgba(0,0,0,0.02)' }, pb: { base: '80px', sm: '24px' } })}>
            
            {/* 1. 타이틀 & 보기 모드, 버튼 영역 (반응형 다중 구조) */}
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '16px', mb: '20px', px: { base: '20px', sm: 0 }, pt: { base: '20px', sm: 0 } })}>
                
                {/* 상단 라인: 타이틀 + 모바일 필터(드롭다운) */}
                <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                    <h2 className={css({ fontSize: { base: '18px', sm: '22px' }, fontWeight: '700', color: 'brand.ink' })}>
                        {filterMode === 'all' ? '전체' : (filterMode === 'me' ? '내' : (getMemberDisplayName(participants.find(p => p.user_id === filterMode), filterMode === currentUser?.id)))} 준비물 {filterMode !== 'all' ? (
                            <span className={css({ color: 'brand.primary', ml: '8px', fontWeight: '700' })}>
                                {filteredProgressPercent}% <span className={css({ fontSize: '12px', fontWeight: '700', color: 'brand.muted' })}>(전체 {progressPercent}%)</span>
                            </span>
                        ) : (
                            totalItems > 0 && <span className={css({ color: 'brand.primary', ml: '8px' })}>{progressPercent}%</span>
                        )}
                    </h2>
                </div>

                {/* PC/모바일 분기 액션 버튼 및 필터 라인 */}
                <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: { base: 'column', sm: 'row' }, gap: '16px' })}>
                    
                    {/* PC 좌측: 그룹핑 + 정렬 컨트롤 그룹 */}
                    <div className={css({ display: { base: 'none', sm: 'flex' }, alignItems: 'center', gap: '12px' })}>
                        <div className={css({ display: totalItems > 0 ? 'inline-flex' : 'none', bg: 'bg.surfaceSoft', p: '4px', borderRadius: '8px' })}>
                            <button
                                onClick={() => setGroupBy('category')}
                                className={css({ px: '16px', py: '6px', fontSize: '14px', fontWeight: groupBy === 'category' ? '700' : 'normal', bg: groupBy === 'category' ? 'white' : 'transparent', color: groupBy === 'category' ? 'brand.ink' : 'brand.muted', borderRadius: '6px', border: 'none', cursor: 'pointer', boxShadow: groupBy === 'category' ? 'shadow.sm' : 'none', transition: 'all 0.2s' })}
                            >
                                카테고리별 보기
                            </button>
                            <button
                                onClick={() => setGroupBy('template')}
                                className={css({ px: '16px', py: '6px', fontSize: '14px', fontWeight: groupBy === 'template' ? '700' : 'normal', bg: groupBy === 'template' ? 'white' : 'transparent', color: groupBy === 'template' ? 'brand.ink' : 'brand.muted', borderRadius: '6px', border: 'none', cursor: 'pointer', boxShadow: groupBy === 'template' ? 'shadow.sm' : 'none', transition: 'all 0.2s' })}
                            >
                                템플릿별 보기
                            </button>
                        </div>

                        {totalItems > 0 && <SortDropdown sortBy={sortBy} setSortBy={setSortBy} />}
                    </div>

                    {/* PC에서 totalItems === 0 일 때 우측 버튼들을 오른쪽으로 밀기 위한 빈 공간용 div */}
                    {totalItems === 0 && <div className={css({ display: { base: 'none', sm: 'block' } })}></div>}

                    {/* 액션 및 필터 컨트롤 그룹 (주로 모바일/PC 액션) */}
                    {isOnline && !isOffline && (
                        <div className={css({ 
                            display: 'flex', 
                            flexDirection: { base: 'column', sm: 'row' },
                            gap: '8px', 
                            w: { base: '100%', sm: 'auto' },
                            alignItems: { base: 'stretch', sm: 'center' }
                        })}>
                            {/* 모바일 전용 필터 및 액션 통합 행 (그룹핑 | 정렬 | 템플릿) */}
                            <div className={css({ 
                                display: { base: 'flex', sm: 'none' }, 
                                gap: '8px',
                                w: '100%',
                                mb: '4px'
                            })}>
                                {totalItems > 0 && <CustomViewDropdown groupBy={groupBy} setGroupBy={setGroupBy} />}
                                {totalItems > 0 && <SortDropdown sortBy={sortBy} setSortBy={setSortBy} />}
                                
                                <button
                                    onClick={() => setIsTemplateModalOpen(true)}
                                    className={css({
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                        px: '12px', h: '42px',
                                        bg: 'white', color: 'brand.ink', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '12px',
                                        fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                                        flex: '1',
                                        whiteSpace: 'nowrap', transition: 'all 0.2s',
                                        _hover: { bg: 'bg.surfaceSoft', borderColor: 'brand.primary' },
                                        _active: { transform: 'scale(0.98)' }
                                    })}
                                >
                                    <ListTodo size={14} color="var(--colors-brand-primary)" /> 템플릿
                                </button>
                            </div>

                            <div className={css({ display: { base: 'none', sm: 'flex' }, gap: '8px', w: { base: '100%', sm: 'auto' } })}>
                                {/* 항목 추가 버튼 (PC에서만 보임, 모바일은 하단 Sticky) */}
                                <button
                                    onClick={() => setIsAdding(!isAdding)}
                                    className={css({
                                        display: { base: 'none', sm: 'flex' }, alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        bg: 'brand.ink', color: 'white', px: '16px', h: '42px',
                                        borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', border: 'none',
                                        _hover: { opacity: 0.9 }, whiteSpace: 'nowrap'
                                    })}
                                >
                                    <Plus size={16} /> 항목 추가
                                </button>

                                <button
                                    onClick={() => setIsTemplateModalOpen(true)}
                                    className={css({
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                        px: '16px', h: '42px',
                                        bg: 'white', color: 'brand.ink', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '12px',
                                        fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                                        w: { base: '100%', sm: 'auto' }, flex: { base: '1', sm: 'none' },
                                        flexShrink: '0',
                                        whiteSpace: 'nowrap', transition: 'all 0.2s',
                                        _hover: { bg: 'bg.surfaceSoft', borderColor: 'brand.primary' },
                                        _active: { transform: 'scale(0.98)' }
                                    })}
                                >
                                    <ListTodo size={14} color="var(--colors-brand-primary)" /> 템플릿 불러오기
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {totalItems > 0 && (
                <div className={css({ w: '100%', bg: 'bg.surfaceSoft', h: '12px', borderRadius: '16px', mb: '24px', overflow: 'hidden', border: '1px solid', borderColor: 'brand.hairlineSoft' })}>
                    <div
                        className={css({ h: '100%', bg: 'linear-gradient(90deg, #2563eb, #4f46e5, #6366f1)', borderRadius: '16px', transition: 'width 0.8s cubic-bezier(0.1, 0.7, 0.1, 1)' })}
                        style={{ width: `${filterMode !== 'all' ? filteredProgressPercent : progressPercent}%` }}
                    />
                </div>
            )}

            <FilterBar 
                totalItems={totalItems}
                isLoading={isLoading}
                participants={members}
                currentUser={currentUser}
                filterMode={filterMode}
                setFilterMode={setFilterMode}
            />

            {isAdding && (
                <form onSubmit={addItem} className={css({ mb: '24px', px: { base: '20px', sm: 0 } })}>
                    <div className={css({ 
                        display: 'flex', 
                        flexDirection: 'column',
                        bg: 'bg.surfaceSoft',
                        p: '16px',
                        borderRadius: '16px',
                        border: '1px solid', borderColor: 'brand.hairline'
                    })}>
                        <div className={css({ display: 'flex', gap: '8px', mb: '12px' })}>
                                <input
                                    type="text"
                                    autoFocus
                                    value={newItemName}
                                    onChange={e => setNewItemName(e.target.value)}
                                    placeholder="어떤 준비물인가요?"
                                    className={css({ flex: 1, p: '12px', bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', outline: 'none', fontSize: '15px' })}
                                />
                        </div>

                        {/* 나만 보기 (입력창 아래로 이동) */}
                        <div className={css({ mb: '12px', display: 'flex', px: '4px' })}>
                            <label className={css({ 
                                display: 'inline-flex', alignItems: 'center', gap: '8px', 
                                cursor: 'pointer', userSelect: 'none',
                                transition: 'opacity 0.2s',
                                _hover: { opacity: 0.8 }
                            })}>
                                <input
                                    type="checkbox"
                                    checked={newItemIsPrivate}
                                    onChange={e => {
                                        setNewItemIsPrivate(e.target.checked)
                                        if (e.target.checked) {
                                            setNewItemAssignmentType('specific')
                                            setNewItemAssignedUserId(currentUser?.id || '')
                                        }
                                    }}
                                    className={css({ accentColor: 'brand.primary', w: '18px', h: '18px' })}
                                />
                                <div className={css({ display: 'flex', flexDirection: 'column' })}>
                                    <span className={css({ fontSize: '14px', fontWeight: '700', color: 'brand.ink' })}>나만 보기</span>
                                    <span className={css({ fontSize: '11px', color: 'brand.muted' })}>담당자가 나로 지정되고, 일행에게는 안 보여요.</span>
                                </div>
                            </label>
                        </div>
                        {members.length > 0 && (
                            <div className={css({ 
                                display: 'flex', gap: '8px', mt: '12px', flexWrap: 'wrap',
                                opacity: newItemIsPrivate ? 0.6 : 1,
                                pointerEvents: newItemIsPrivate ? 'none' : 'auto'
                            })}>
                                <select
                                    value={newItemAssignmentType}
                                    onChange={e => {
                                        setNewItemAssignmentType(e.target.value as any)
                                        if (e.target.value === 'specific' && !newItemAssignedUserId) {
                                            setNewItemAssignedUserId(currentUser?.id || '')
                                        }
                                    }}
                                    className={css({ p: '8px', bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', outline: 'none', fontSize: '13px', fontWeight: '700' })}
                                >
                                    <option value="anyone">함께 준비해요</option>
                                    <option value="specific">담당자를 정해요</option>
                                    <option value="everyone">각자 꼭 챙겨요</option>
                                </select>

                                {newItemAssignmentType === 'specific' && (
                                    <select
                                        value={newItemAssignedUserId}
                                        onChange={e => setNewItemAssignedUserId(e.target.value)}
                                        className={css({ p: '8px', bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', outline: 'none', fontSize: '13px' })}
                                    >
                                        {participants.map(p => {
                                            const isMe = p.user_id === currentUser?.id
                                            const label = getMemberDisplayName(p, isMe)
                                            return (
                                                <option key={p.user_id} value={p.user_id}>
                                                    {isMe ? `${label} (나)` : label}
                                                </option>
                                            )
                                        })}
                                    </select>
                                )}
                                
                                <div className={css({ display: 'flex', alignItems: 'center', gap: '4px', color: 'brand.muted', fontSize: '12px' })}>
                                    <Info size={14} />
                                    {newItemIsPrivate ? '나만 보기 설정 중에는 담당자가 "나"로 고정돼요.' : (
                                        <>
                                            {newItemAssignmentType === 'anyone' && '한 명이라도 챙기면 완료된 것으로 표시돼요.'}
                                            {newItemAssignmentType === 'specific' && '정해진 담당자만 체크할 수 있어요.'}
                                            {newItemAssignmentType === 'everyone' && '참여자 모두가 각자 챙겨야 완료돼요.'}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className={css({ display: 'flex', gap: '8px', alignItems: 'center', mt: '16px' })}>
                             <select
                                value={newItemCategory}
                                onChange={e => setNewItemCategory(e.target.value)}
                                className={css({ flex: 1, p: '10px', bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', outline: 'none', fontSize: '14px' })}
                            >
                                {CATEGORIES.map((cat: any) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                disabled={!newItemName.trim()}
                                className={css({ py: '10px', px: '20px', bg: 'brand.primary', color: 'white', fontWeight: '700', borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: 'shadow.primary' })}
                            >
                                추가
                            </button>
                            <button
                                type="button"
                                onClick={() => { setIsAdding(false); setNewItemName(''); }}
                                className={css({ py: '10px', px: '16px', bg: 'white', color: 'brand.ink', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '8px', fontWeight: '700' })}
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {isLoading ? (
                <ChecklistSkeleton />
            ) : totalItems === 0 && !isAdding ? (
                <div className={css({ textAlign: 'center', py: '80px', color: 'brand.muted', px: '20px' })}>
                        <p className={css({ fontSize: '19px', fontWeight: '700', mb: '12px', color: 'brand.ink', letterSpacing: '-0.5px' })}>
                            여행을 완벽하게 해줄 준비물을 등록해 보세요! ✨
                        </p>
                        {isOnline && !isOffline && (
                            <p className={css({ fontSize: '15px', color: 'brand.muted', lineHeight: '1.6', wordBreak: 'keep-all', maxW: '320px', mx: 'auto' })}>
                                체크리스트로 꼼꼼하게 챙기면 여행의 설렘이 두 배가 됩니다. 🧳
                            </p>
                        )}
                </div>
            ) : totalItems > 0 && sortedFilteredItems.length === 0 ? (
                <div className={css({ textAlign: 'center', py: '60px', color: 'brand.muted' })}>
                        <p className={css({ fontSize: '16px', fontWeight: '700', mb: '8px', color: 'brand.ink' })}>
                            해당하는 준비물이 없어요 🕵️‍♂️
                        </p>
                        <p className={css({ fontSize: '14px', color: 'brand.muted' })}>
                            {filterMode === 'me' ? '내가 챙길 짐이 없습니다.' : '다른 필터를 선택해 보세요.'}
                        </p>
                        <button 
                            onClick={() => setFilterMode('all')}
                            className={css({ mt: '20px', bg: 'white', border: '1px solid', borderColor: 'brand.hairline', borderRadius: '12px', px: '20px', py: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', _hover: { bg: 'bg.surfaceSoft' }, transition: 'all 0.2s' })}
                        >
                            전체 준비물 보기
                        </button>
                </div>
            ) : (
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '24px' })}>
                    {groupBy === 'category' ? (
                        CATEGORIES.map(cat => {
                            const categoryItems = sortedFilteredItems.filter((i: any) => i.category === cat)
                            if (categoryItems.length === 0) return null
                            const isExpanded = expandedGroups[cat] !== false // Default to true

                            return (
                                <div key={cat} className={css({ 
                                    w: '100%', bg: 'white', border: '1px solid', borderColor: 'brand.hairlineSoft', borderRadius: '16px', overflow: 'hidden', mb: '16px' 
                                })}>
                                    <button 
                                        onClick={() => setExpandedGroups(prev => ({ ...prev, [cat]: !isExpanded }))}
                                        className={css({ 
                                            w: '100%', px: '20px', py: '14px', bg: 'bg.surfaceSoft', border: 'none', borderBottom: isExpanded ? '1px solid' : 'none', borderColor: 'brand.hairlineSoft',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left',
                                            transition: 'background 0.2s', _hover: { bg: 'bg.softCotton' }
                                        })}
                                    >
                                        <h3 className={css({ fontSize: '15px', fontWeight: '800', color: 'brand.ink', display: 'flex', alignItems: 'center', gap: '8px' })}>
                                            {cat} <span className={css({ color: 'brand.muted', fontWeight: '600', fontSize: '13px' })}>{categoryItems.length}</span>
                                        </h3>
                                        <ChevronDown size={18} className={css({ color: 'brand.muted', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' })} />
                                    </button>
                                    <AnimatePresence initial={false}>
                                        {isExpanded && (
                                            <motion.ul 
                                                initial={{ height: 0 }}
                                                animate={{ height: 'auto' }}
                                                exit={{ height: 0 }}
                                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                className={css({ w: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' })}
                                            >
                                                {categoryItems.map((item) => (
                                                    <ChecklistItem key={item.id} item={item} />
                                                ))}
                                            </motion.ul>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )
                        })
                    ) : (
                        Object.entries(templateGroups).map(([grpName, grpItems]) => {
                            const isExpanded = expandedGroups[grpName] !== false // Default to true
                            return (
                                <div key={grpName} className={css({ 
                                    w: '100%', bg: 'white', border: '1px solid', borderColor: 'brand.hairlineSoft', borderRadius: '16px', overflow: 'hidden', mb: '16px' 
                                })}>
                                    <button 
                                        onClick={() => setExpandedGroups(prev => ({ ...prev, [grpName]: !isExpanded }))}
                                        className={css({ 
                                            w: '100%', px: '20px', py: '14px', bg: 'bg.surfaceSoft', border: 'none', borderBottom: isExpanded ? '1px solid' : 'none', borderColor: 'brand.hairlineSoft',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left',
                                            transition: 'background 0.2s', _hover: { bg: 'bg.softCotton' }
                                        })}
                                    >
                                        <h3 className={css({ fontSize: '15px', fontWeight: '800', color: 'brand.ink', display: 'flex', alignItems: 'center', gap: '8px' })}>
                                            {grpName === '직접 추가함' ? '✍️ 직접 추가함' : `📦 ${grpName}`}
                                            <span className={css({ color: 'brand.muted', fontWeight: '600', fontSize: '13px' })}>{grpItems.length}</span>
                                        </h3>
                                        <ChevronDown size={18} className={css({ color: 'brand.muted', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' })} />
                                    </button>
                                    <AnimatePresence initial={false}>
                                        {isExpanded && (
                                            <motion.ul 
                                                initial={{ height: 0 }}
                                                animate={{ height: 'auto' }}
                                                exit={{ height: 0 }}
                                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                className={css({ w: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' })}
                                            >
                                                {grpItems.map((item) => (
                                                    <ChecklistItem key={item.id} item={item} />
                                                ))}
                                            </motion.ul>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )
                        })
                    )}
                </div>
            )}
            {/* 모바일 하단 플로팅 버튼 - + 항목 추가 - 오프라인 모드에서는 숨김 */}
            {isActive && !isAdding && !isTemplateModalOpen && isOnline && !isOffline && (
                <div
                    onClick={() => setIsAdding(true)}
                    className={css({
                        position: 'fixed', 
                        bottom: 'calc(90px + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom)))',
                        right: '24px',
                        w: '54px', h: '54px', borderRadius: '18px',
                        bg: 'brand.primary', color: 'white',
                        display: { base: 'flex', sm: 'none' }, 
                        alignItems: 'center', justifyContent: 'center',
                        boxShadow: 'shadow.primary',
                        cursor: 'pointer', zIndex: 100,
                        transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
                        _hover: { transform: 'translateY(-2px)', opacity: 0.9 },
                        _active: { transform: 'scale(0.9)' }
                    })}
                >
                    <Plus size={28} strokeWidth={2.5} />
                </div>
            )}

            {checklistId && (
                <TemplateModal
                    isOpen={isTemplateModalOpen}
                    onClose={() => setIsTemplateModalOpen(false)}
                    checklistId={checklistId}
                    currentUser={currentUser}
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
