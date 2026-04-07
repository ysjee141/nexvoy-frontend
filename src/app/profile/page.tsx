'use client'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { User, Mail, Lock, ChevronRight, Save, Eye, EyeOff, CheckCircle2, XCircle, Edit2, Check, X, ShieldCheck, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import TermsModal from '../signup/TermsModal'
import ProfileSkeleton from './ProfileSkeleton'

function ProfileContent() {
    const supabase = createClient()
    const router = useRouter()

    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [nickname, setNickname] = useState('')
    const [isEditingNickname, setIsEditingNickname] = useState(false)
    const [isSavingNickname, setIsSavingNickname] = useState(false)
    const [nicknameError, setNicknameError] = useState('')
    const [loading, setLoading] = useState(true)

    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [passwordError, setPasswordError] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')

    const [stats, setStats] = useState({ 
        completedTrips: 0, 
        upcomingTrips: 0, 
        totalDays: 0, 
        totalPlans: 0 
    })
    const [showTerms, setShowTerms] = useState(false)
    const searchParams = useSearchParams()

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }
            setUser(user)

            // 프로필 가져오기
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            if (profileData) {
                setProfile(profileData)
                setNickname(profileData.nickname || user.email?.split('@')[0] || '')
            }

            // 통계 가져오기
            const { data: trips } = await supabase
                .from('trips')
                .select('id, start_date, end_date')
                .eq('user_id', user.id)

            const allTrips = trips || []
            const tripIds = allTrips.map((t: any) => t.id)

            let totalPlans = 0
            let totalChecked = 0
            let totalItems = 0

            if (tripIds.length > 0) {
                const { count: planCount } = await supabase
                    .from('plans')
                    .select('id', { count: 'exact', head: true })
                    .in('trip_id', tripIds)
                totalPlans = planCount || 0

                const { data: checklists } = await supabase
                    .from('checklists')
                    .select('id')
                    .in('trip_id', tripIds)

                const checklistIds = checklists?.map((c: any) => c.id) || []
                if (checklistIds.length > 0) {
                    const { data: checkItems } = await supabase
                        .from('checklist_items')
                        .select('is_checked')
                        .in('checklist_id', checklistIds)

                    totalItems = checkItems?.length || 0
                    totalChecked = checkItems?.filter((i: any) => i.is_checked).length || 0
                }
            }

            const today = new Date()
            today.setHours(0, 0, 0, 0)

            let completedCount = 0
            let upcomingCount = 0
            let totalDaysResult = 0

            allTrips.forEach((t: any) => {
                const start = new Date(t.start_date)
                const end = new Date(t.end_date)
                start.setHours(0, 0, 0, 0)
                end.setHours(23, 59, 59, 999)

                if (end < today) {
                    completedCount++
                } else {
                    upcomingCount++
                }

                // 여행 일수 계산 (시작/종료일 포함)
                const diffTime = end.getTime() - start.getTime()
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
                totalDaysResult += diffDays
            })

            setStats({
                completedTrips: completedCount,
                upcomingTrips: upcomingCount,
                totalDays: totalDaysResult,
                totalPlans,
            })
            setLoading(false)
        }

        fetchData()

        if (searchParams.get('edit') === 'nickname') {
            setIsEditingNickname(true)
        }
    }, [supabase, searchParams, router])

    const saveNickname = async () => {
        if (!nickname.trim() || !user) return
        setNicknameError('')
        setIsSavingNickname(true)

        // 닉네임 중복 체크
        const { data: existingNickname } = await supabase
            .from('profiles')
            .select('nickname')
            .ilike('nickname', nickname.trim())
            .neq('id', user.id)
            .maybeSingle()

        if (existingNickname) {
            setNicknameError('아쉽게도 이 이름은 이미 쓰고 계신 분이 있네요!')
            setIsSavingNickname(false)
            return
        }

        const { error } = await supabase
            .from('profiles')
            .update({ nickname: nickname.trim(), updated_at: new Date().toISOString() })
            .eq('id', user.id)

        if (!error) {
            setIsEditingNickname(false)
            setProfile({ ...profile, nickname: nickname.trim() })
        }
        setIsSavingNickname(false)
    }

    const cancelEditingNickname = () => {
        setIsEditingNickname(false)
        setNickname(profile?.nickname || user?.email?.split('@')[0] || '')
        setNicknameError('')
    }

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setPasswordError('')
        setPasswordSuccess('')

        if (newPassword.length < 6) {
            setPasswordError('새 비밀번호는 6자 이상으로 더 튼튼하게 만들어 주세요.')
            return
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('비밀번호가 서로 달라서 다시 한번 확인이 필요해요.')
            return
        }

        setIsChangingPassword(true)

        // Supabase의 updateUser로 비밀번호 변경 (이메일 인증 기반이면 현재 세션으로 바로 가능)
        const { error } = await supabase.auth.updateUser({ password: newPassword })

        if (error) {
            setPasswordError(error.message || '비밀번호를 바꾸는 중에 잠시 문제가 생겼어요. 다시 한번 시도해 주시겠어요?')
        } else {
            setPasswordSuccess('비밀번호가 안전하게 변경되었어요. 이제 안심하고 준비하세요! ✅')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        }
        setIsChangingPassword(false)
    }
    
    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut()
        if (!error) {
            router.push('/')
            router.refresh()
        }
    }
    
    if (loading) {
        return <ProfileSkeleton />
    }

    const displayName = nickname || user.email?.split('@')[0] || '여행자'

    return (
        <div className={css({ maxW: '720px', mx: 'auto', py: { base: '20px', sm: '40px' }, px: { base: '0', sm: '0' }, display: 'flex', flexDirection: 'column', gap: '16px' })}>
            {/* 프리미엄 헤더: 히어로 배경 & 아바타 */}
            <div className={css({ 
                position: 'relative', 
                mb: '12px',
                pt: { base: '40px', sm: '60px' },
                pb: '24px',
                px: { base: '20px', sm: '32px' },
                background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
                borderRadius: '32px',
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '20px'
            })}>
                {/* 아바타 영역 */}
                <div className={css({
                    position: 'relative',
                    w: { base: '88px', sm: '100px' }, 
                    h: { base: '88px', sm: '100px' }, 
                    borderRadius: '32px',
                    bg: 'brand.secondary',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'white', 
                    fontSize: { base: '36px', sm: '42px' }, 
                    fontWeight: '800', 
                    flexShrink: 0,
                    boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                    transform: 'rotate(-2deg)',
                    transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                    _hover: { transform: 'rotate(0deg) scale(1.05)' }
                })}>
                    {displayName.charAt(0).toUpperCase()}
                    <div className={css({
                        position: 'absolute',
                        bottom: '-4px',
                        right: '-4px',
                        w: '32px',
                        h: '32px',
                        bg: 'brand.primary',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: '0 4px 8px rgba(37, 99, 235, 0.2)',
                        border: '3px solid white'
                    })}>
                        <Check size={16} strokeWidth={3} />
                    </div>
                </div>

                <div className={css({ w: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' })}>
                    {isEditingNickname ? (
                        <div className={css({ display: 'flex', flexDirection: 'column', w: '100%', maxW: '320px', gap: '8px' })}>
                            <div className={css({ display: 'flex', gap: '8px', alignItems: 'center' })}>
                                <input
                                    value={nickname}
                                    onChange={e => { setNickname(e.target.value); setNicknameError('') }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') saveNickname()
                                        if (e.key === 'Escape') cancelEditingNickname()
                                    }}
                                    autoFocus
                                    className={css({ 
                                        flex: 1, minW: 0, p: '12px 16px', 
                                        bg: 'white',
                                        border: nicknameError ? '2px solid #EF4444' : '2px solid #2563EB', 
                                        borderRadius: '16px', fontSize: '18px', fontWeight: 'bold', outline: 'none',
                                        textAlign: 'center',
                                        boxShadow: 'floating',
                                        transition: 'all 0.2s'
                                    })}
                                />
                                <div className={css({ display: 'flex', gap: '6px' })}>
                                    <button
                                        onClick={cancelEditingNickname}
                                        className={css({ 
                                            w: '44px', h: '44px', 
                                            bg: 'bg.softCotton', color: 'brand.muted', 
                                            borderRadius: '12px', border: 'none', cursor: 'pointer', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                            transition: 'all 0.2s', 
                                            _hover: { bg: '#FEE2E2', color: '#EF4444', transform: 'translateY(-2px)' } 
                                        })}
                                        title="취소"
                                    >
                                        <X size={20} strokeWidth={3} />
                                    </button>
                                    <button
                                        onClick={saveNickname}
                                        disabled={isSavingNickname}
                                        className={css({ 
                                            w: '44px', h: '44px', 
                                            bg: 'brand.primary', color: 'white', 
                                            borderRadius: '12px', border: 'none', cursor: 'pointer', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                            transition: 'all 0.2s', 
                                            _hover: { bg: '#1D4ED8', transform: 'translateY(-2px)' }, 
                                            _disabled: { opacity: 0.6 } 
                                        })}
                                        title="저장"
                                    >
                                        {isSavingNickname ? '...' : <Check size={20} strokeWidth={3} />}
                                    </button>
                                </div>
                            </div>
                            {nicknameError && (
                                <p className={css({ fontSize: '13px', color: '#dc2626', fontWeight: '600' })}>{nicknameError}</p>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className={css({ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' })}>
                                <h1 className={css({ fontSize: { base: '26px', sm: '32px' }, fontWeight: '850', color: '#2C3A47', letterSpacing: '-0.03em' })}>
                                    {displayName}
                                </h1>
                                <button
                                    onClick={() => setIsEditingNickname(true)}
                                    className={css({ bg: 'rgba(37, 99, 235, 0.1)', border: 'none', color: 'brand.primary', cursor: 'pointer', p: '6px', borderRadius: '8px', _hover: { bg: 'brand.primary', color: 'white' }, transition: 'all 0.3s' })}
                                >
                                    <Edit2 size={16} strokeWidth={2.5} />
                                </button>
                            </div>
                            <p className={css({ color: 'brand.muted', fontSize: '15px', mt: '4px', fontWeight: '600', opacity: 0.8 })}>{user.email}</p>
                        </>
                    )}
                </div>
            </div>

            {/* 프리미엄 여정 기록 대시보드 */}
            <section className={css({ bg: 'white', borderRadius: '32px', p: { base: '24px', sm: '32px' }, boxShadow: '0 8px 30px rgba(0,0,0,0.03)', border: '1px solid #F0F0F0' })}>
                <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '24px' })}>
                    <h2 className={css({ fontSize: '20px', fontWeight: '850', color: '#2C3A47', letterSpacing: '-0.02em' })}>나의 여정 대시보드</h2>
                    <span className={css({ fontSize: '13px', px: '10px', py: '4px', bg: 'rgba(37,99,235,0.08)', color: 'brand.primary', borderRadius: '10px', fontWeight: '800' })}>전체 통계</span>
                </div>
                
                <div className={css({ display: 'grid', gridTemplateColumns: { base: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: '16px' })}>
                    {[
                        { label: '완료한 여행', value: stats.completedTrips, sub: '번의 추억', icon: '📸', href: '/?tab=completed', color: '#FFF5F0' },
                        { label: '다가올 여행', value: stats.upcomingTrips, sub: '번의 설렘', icon: '✈️', href: '/?tab=upcoming', color: 'rgba(37, 99, 235, 0.05)' },
                        { label: '함께한 날들', value: stats.totalDays, sub: '일 동안', icon: '📅', href: '/profile/travel-log', color: '#F0F4FF' },
                        { label: '기록한 장소', value: stats.totalPlans, sub: '곳의 흔적', icon: '📍', href: '/profile/places-visited', color: '#FFF9E5' },
                    ].map(item => (
                        <Link 
                            key={item.label} 
                            href={item.href}
                            className={css({ 
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                p: { base: '20px 12px', sm: '24px 16px' }, 
                                bg: 'white', 
                                borderRadius: '24px', 
                                border: '1px solid #F5F5F5',
                                textDecoration: 'none',
                                transition: 'all 0.4s cubic-bezier(0.2, 0, 0, 1)',
                                boxShadow: 'dimensional',
                                _hover: { 
                                    transform: 'translateY(-6px)', 
                                    boxShadow: 'floating',
                                    borderColor: 'brand.primary',
                                    '& [data-stat-icon]': { transform: 'scale(1.2) rotate(5deg)' }
                                },
                                _active: { transform: 'scale(0.97)' }
                            })}
                        >
                            <div 
                                data-stat-icon
                                className={css({ 
                                    fontSize: '28px', 
                                    mb: '14px', 
                                    w: '52px', h: '52px', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    bg: item.color, 
                                    borderRadius: '16px',
                                    transition: 'all 0.3s ease'
                                })}
                            >
                                {item.icon}
                            </div>
                            <div className={css({ fontSize: '24px', fontWeight: '900', color: '#2C3A47', letterSpacing: '-0.5px' })}>{item.value}</div>
                            <div className={css({ fontSize: '13px', color: '#828D99', mt: '4px', fontWeight: '700', opacity: 0.9 })}>{item.label}</div>
                            <div className={css({ fontSize: '11px', color: '#AAA', mt: '2px', fontWeight: '600' })}>{item.sub}</div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* 계정 보안 설정 */}
            <section className={css({ bg: 'white', borderRadius: '32px', p: { base: '24px', sm: '32px' }, boxShadow: '0 8px 30px rgba(0,0,0,0.03)', border: '1px solid #F0F0F0' })}>
                <h2 className={css({ fontSize: '18px', fontWeight: '850', mb: '24px', color: '#2C3A47', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.02em' })}>
                    <div className={css({ w: '36px', h: '36px', bg: 'rgba(37, 99, 235, 0.08)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'brand.primary' })}>
                        <Lock size={18} strokeWidth={2.5} />
                    </div>
                    계정 보안 설정
                </h2>
                
                <form onSubmit={changePassword} className={css({ display: 'flex', flexDirection: 'column', gap: '20px' })}>
                    <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' }, gap: '16px' })}>
                        {/* 새 비밀번호 */}
                        <div>
                            <label className={css({ fontSize: '14px', fontWeight: '700', color: 'brand.secondary', mb: '8px', display: 'block', ml: '4px' })}>새 비밀번호</label>
                            <div className={css({ position: 'relative' })}>
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={e => { setNewPassword(e.target.value); setPasswordError(''); setPasswordSuccess('') }}
                                    placeholder="6자 이상 입력"
                                    className={css({ 
                                        w: '100%', p: '16px 48px 16px 16px', bg: 'bg.softCotton', border: '2px solid transparent', borderRadius: '18px', fontSize: '15px', fontWeight: '600', color: 'brand.secondary', outline: 'none', 
                                        transition: 'all 0.2s',
                                        _placeholder: { color: '#BBB', fontWeight: '500' },
                                        _focus: { borderColor: 'brand.primary', bg: 'white', boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.08)' } 
                                    })}
                                />
                                <button type="button" onClick={() => setShowNew(!showNew)}
                                    className={css({ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', bg: 'transparent', border: 'none', cursor: 'pointer', color: '#BBB', transition: 'color 0.2s', _hover: { color: 'brand.primary' } })}>
                                    {showNew ? <EyeOff size={20} strokeWidth={2} /> : <Eye size={20} strokeWidth={2} />}
                                </button>
                            </div>
                            {newPassword.length > 0 && (
                                <div className={css({ mt: '8px', ml: '4px' })}>
                                    {newPassword.length < 6 ? (
                                        <p className={css({ fontSize: '12px', color: '#F59E0B', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' })}>
                                            <XCircle size={14} /> 6자 이상 작성이 필요해요 ({newPassword.length}/6)
                                        </p>
                                    ) : (
                                        <p className={css({ fontSize: '12px', color: 'brand.success', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' })}>
                                            <CheckCircle2 size={14} /> 안전한 비밀번호입니다!
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 새 비밀번호 확인 */}
                        <div>
                            <label className={css({ fontSize: '14px', fontWeight: '700', color: 'brand.secondary', mb: '8px', display: 'block', ml: '4px' })}>비밀번호 확인</label>
                            <div className={css({ position: 'relative' })}>
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={e => { setConfirmPassword(e.target.value); setPasswordError(''); setPasswordSuccess('') }}
                                    placeholder="다시 한번 입력"
                                    className={css({
                                        w: '100%', p: '16px 48px 16px 16px', bg: 'bg.softCotton', border: '2px solid transparent', fontSize: '15px', fontWeight: '600', color: 'brand.secondary', outline: 'none', borderRadius: '18px',
                                        transition: 'all 0.2s',
                                        _placeholder: { color: '#BBB', fontWeight: '500' },
                                        _focus: { 
                                            bg: 'white', 
                                            borderColor: confirmPassword === newPassword && confirmPassword !== '' ? 'brand.success' : 'brand.primary',
                                            boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.08)'
                                        },
                                        ...(confirmPassword !== '' && {
                                            borderColor: confirmPassword === newPassword ? 'brand.success' : 'brand.error',
                                            bg: 'white'
                                        })
                                    })}
                                />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                    className={css({ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', bg: 'transparent', border: 'none', cursor: 'pointer', color: '#BBB', transition: 'color 0.2s', _hover: { color: 'brand.primary' } })}>
                                    {showConfirm ? <EyeOff size={20} strokeWidth={2} /> : <Eye size={20} strokeWidth={2} />}
                                </button>
                            </div>
                            {confirmPassword.length > 0 && (
                                <div className={css({ mt: '8px', ml: '4px' })}>
                                    {confirmPassword === newPassword ? (
                                        <p className={css({ fontSize: '12px', color: 'brand.success', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' })}>
                                            <CheckCircle2 size={14} /> 일치합니다.
                                        </p>
                                    ) : (
                                        <p className={css({ fontSize: '12px', color: 'brand.error', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' })}>
                                            <XCircle size={14} /> 비밀번호가 서로 달라요.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {passwordError && (
                        <div className={css({ fontSize: '14px', color: 'brand.error', bg: 'brand.errorLight', p: '14px 18px', borderRadius: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' })}>
                            <XCircle size={16} /> {passwordError}
                        </div>
                    )}
                    {passwordSuccess && (
                        <div className={css({ fontSize: '14px', color: 'brand.primary', bg: 'rgba(37,99,235,0.08)', p: '14px 18px', borderRadius: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' })}>
                            <CheckCircle2 size={16} /> {passwordSuccess}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isChangingPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6}
                        className={css({ 
                            mt: '4px', py: '18px', 
                            bg: 'brand.primary', color: 'white', borderRadius: '20px', border: 'none', 
                            cursor: 'pointer', fontWeight: '850', fontSize: '16px', 
                            transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)', 
                                    boxShadow: '0 8px 16px rgba(37, 99, 235, 0.15)', 
                                    _disabled: { opacity: 0.3, cursor: 'not-allowed', boxShadow: 'none' }, 
                                    _hover: { bg: '#1D4ED8', transform: 'translateY(-2px)', boxShadow: '0 12px 20px rgba(37, 99, 235, 0.25)' },
                            _active: { transform: 'scale(0.98)' }
                        })}
                    >
                        {isChangingPassword ? '비밀번호 변경 처리 중...' : '비밀번호 업데이트'}
                    </button>
                </form>
            </section>

            {/* 바로가기: 서비스 메뉴 */}
            <section className={css({ bg: 'white', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.03)', border: '1px solid #F0F0F0' })}>
                <div className={css({ p: '24px 24px 12px' })}>
                    <h2 className={css({ fontSize: '18px', fontWeight: '850', color: '#2C3A47', letterSpacing: '-0.02em' })}>마이페이지 메뉴</h2>
                </div>
                
                <div className={css({ display: 'flex', flexDirection: 'column' })}>
                    {[
                        { href: '/templates', icon: '📦', label: '준비물 템플릿 관리', desc: '나만의 체크리스트를 미리 구성해 두세요' },
                        { href: '/profile/travel-log', icon: '📖', label: '여행 발자취 (Travel Log)', desc: '지금까지 다녀온 모든 여행의 기록입니다' },
                        { href: '/feedback', icon: '💬', label: '건의 및 버그 제보', desc: '온여정을 더 좋게 만드는 소중한 의견을 주세요' },
                    ].map((item, i) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={css({
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                px: '24px',
                                py: '20px',
                                borderTop: '1px solid #F5F5F5',
                                textDecoration: 'none',
                                transition: 'all 0.25s ease',
                                _hover: { bg: 'rgba(37, 99, 235, 0.04)', px: '28px' },
                                _active: { bg: 'rgba(37, 99, 235, 0.08)' }
                            })}
                        >
                            <div className={css({ display: 'flex', alignItems: 'center', gap: '16px' })}>
                                <div className={css({ fontSize: '22px', w: '40px', h: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', bg: 'bg.softCotton', borderRadius: '12px' })}>
                                    {item.icon}
                                </div>
                                <div>
                                    <div className={css({ fontSize: '16px', fontWeight: '750', color: 'brand.secondary' })}>{item.label}</div>
                                    <div className={css({ fontSize: '13px', color: 'brand.muted', mt: '2px', fontWeight: '600' })}>{item.desc}</div>
                                </div>
                            </div>
                            <ChevronRight size={20} className={css({ color: '#CCC', transition: 'all 0.2s' })} />
                        </Link>
                    ))}
                </div>
            </section>

            {/* 기타 지원 및 법률 히스토리 */}
            <section className={css({ bg: 'white', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.03)', border: '1px solid #F0F0F0' })}>
                <div className={css({ display: 'flex', flexDirection: 'column' })}>
                    <button
                        onClick={() => setShowTerms(true)}
                        className={css({
                            w: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            px: '24px', py: '18px', bg: 'transparent', border: 'none', cursor: 'pointer',
                            transition: 'all 0.25s ease',
                            _hover: { bg: 'rgba(37, 99, 235, 0.04)', px: '28px' }
                        })}
                    >
                        <div className={css({ display: 'flex', alignItems: 'center', gap: '16px' })}>
                            <div className={css({ w: '40px', h: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', bg: '#F0F4FF', borderRadius: '12px', color: '#4F46E5' })}>
                                <ShieldCheck size={20} strokeWidth={2.5} />
                            </div>
                            <div className={css({ textAlign: 'left' })}>
                                <div className={css({ fontSize: '15px', fontWeight: '750', color: 'brand.secondary' })}>약관 및 개인정보 정책</div>
                            </div>
                        </div>
                        <ChevronRight size={20} color="#CCC" />
                    </button>
                    
                    <Link
                        href="/profile/licenses"
                        className={css({
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            px: '24px', py: '18px', borderTop: '1px solid #F5F5F5', textDecoration: 'none',
                            transition: 'all 0.25s ease',
                            _hover: { bg: 'rgba(37, 99, 235, 0.04)', px: '28px' }
                        })}
                    >
                        <div className={css({ display: 'flex', alignItems: 'center', gap: '16px' })}>
                            <div className={css({ w: '40px', h: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', bg: '#FFF9E5', borderRadius: '12px', color: '#FABC2A' })}>
                                <Edit2 size={20} strokeWidth={2.5} />
                            </div>
                            <div className={css({ textAlign: 'left' })}>
                                <div className={css({ fontSize: '15px', fontWeight: '750', color: 'brand.secondary' })}>오픈 소스 라이선스</div>
                            </div>
                        </div>
                        <ChevronRight size={20} color="#CCC" />
                    </Link>
                </div>
            </section>

            {/* 로그아웃 & 탈퇴 푸터 */}
            <div className={css({ mt: '24px', mb: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' })}>
                <button
                    onClick={handleLogout}
                    className={css({
                        display: 'flex', alignItems: 'center', gap: '8px',
                        px: '24px', py: '12px', bg: 'white', border: '1px solid #EEE', borderRadius: '16px',
                        fontSize: '14px', fontWeight: '700', color: 'brand.muted', cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                        _hover: { bg: '#FFF1F0', color: '#FF4D4F', borderColor: '#FFCCC7', transform: 'translateY(-2px)' }
                    })}
                >
                    <LogOut size={16} /> 안전하게 로그아웃
                </button>
                
                <Link 
                    href="/profile/withdrawal" 
                    className={css({ 
                        fontSize: '13px', color: '#BBB', textDecoration: 'none', fontWeight: '600',
                        transition: 'color 0.2s', _hover: { color: 'brand.secondary', textDecoration: 'underline' } 
                    })}
                >
                    회원 탈퇴는 여기서 하실 수 있어요
                </Link>
            </div>
            <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
        </div>
    )
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<ProfileSkeleton />}>
            <ProfileContent />
        </Suspense>
    )
}
