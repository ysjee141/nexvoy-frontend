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
            {/* 헤더 */}
            <div className={css({ display: 'flex', alignItems: 'center', gap: '16px', mb: '4px' })}>
                <div className={css({
                    w: { base: '64px', sm: '72px' }, h: { base: '64px', sm: '72px' }, borderRadius: '50%',
                    bg: '#222',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: { base: '26px', sm: '30px' }, fontWeight: '800', flexShrink: 0
                })}>
                    {displayName.charAt(0).toUpperCase()}
                </div>
                <div className={css({ flex: 1, minW: 0 })}>
                    {isEditingNickname ? (
                        <div className={css({ display: 'flex', flexDirection: 'column', w: '100%', gap: '4px' })}>
                            <div className={css({ display: 'flex', gap: '8px', flexDirection: 'row', alignItems: 'center', w: '100%' })}>
                                <input
                                    value={nickname}
                                    onChange={e => { setNickname(e.target.value); setNicknameError('') }}
                                    autoFocus
                                    className={css({ 
                                        flex: 1, minW: 0, p: '10px 14px', 
                                        bg: '#F9F9F9',
                                        border: nicknameError ? '2px solid #EF4444' : '2px solid #2EC4B6', 
                                        borderRadius: '12px', fontSize: { base: '18px', sm: '20px' }, fontWeight: 'bold', outline: 'none',
                                        transition: 'all 0.2s',
                                        _focus: { bg: 'white', boxShadow: '0 0 0 3px rgba(46, 196, 182, 0.1)' }
                                    })}
                                />
                                <div className={css({ display: 'flex', gap: '4px', flexShrink: 0 })}>
                                    <button
                                        onClick={saveNickname}
                                        disabled={isSavingNickname}
                                        className={css({ p: '6px', bg: '#2EC4B6', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', _hover: { bg: '#249E93' }, _disabled: { opacity: 0.6 } })}
                                        title="저장"
                                    >
                                        {isSavingNickname ? <span className={css({ fontSize: '12px', fontWeight: 'bold', px: '2px' })}>...</span> : <Check size={18} />}
                                    </button>
                                    <button
                                        onClick={() => { setIsEditingNickname(false); setNickname(profile?.nickname || ''); setNicknameError('') }}
                                        className={css({ p: '6px', bg: '#F7F7F7', color: '#555', borderRadius: '8px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', _hover: { bg: '#eee' } })}
                                        title="취소"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                            {nicknameError && (
                                <p className={css({ fontSize: '12px', color: '#dc2626', fontWeight: '600', mt: '2px' })}>{nicknameError}</p>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                                <h1 className={css({ fontSize: { base: '24px', sm: '28px' }, fontWeight: '900', color: '#2C3A47', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', letterSpacing: '-0.5px' })}>
                                    {displayName}
                                </h1>
                                <button
                                    onClick={() => setIsEditingNickname(true)}
                                    className={css({ bg: 'transparent', border: 'none', color: '#717171', cursor: 'pointer', p: '4px', borderRadius: '4px', _hover: { bg: '#F7F7F7', color: '#222' }, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' })}
                                    aria-label="닉네임 수정"
                                >
                                    <Edit2 size={16} />
                                </button>
                            </div>
                            <p className={css({ color: '#717171', fontSize: '15px', mt: '2px', fontWeight: '500', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' })}>{user.email}</p>
                        </>
                    )}
                </div>
            </div>

            {/* 활동 통계 */}
            <section className={css({ bg: 'white', borderRadius: '24px', p: { base: '20px', sm: '32px' }, border: '1px solid #eee', boxShadow: '0 6px 16px rgba(0,0,0,0.04)' })}>
                <h2 className={css({ fontSize: '18px', fontWeight: '800', mb: '24px', color: '#2C3A47' })}>나의 여정 기록</h2>
                {/* 모바일: 2x2 grid / 데스크탑: 4열 */}
                <div className={css({ display: 'grid', gridTemplateColumns: { base: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: '12px', textAlign: 'center' })}>
                    {[
                        { label: '다녀온 여행', value: stats.completedTrips, icon: '📸', href: '/?tab=completed' },
                        { label: '다가올 여행', value: stats.upcomingTrips, icon: '✈️', href: '/?tab=upcoming' },
                        { label: '함께한 날들', value: `${stats.totalDays}일`, icon: '📅', href: '/profile/travel-log' },
                        { label: '기록한 장소들', value: stats.totalPlans, icon: '📍', href: '/profile/places-visited' },
                    ].map(item => (
                        <Link 
                            key={item.label} 
                            href={item.href}
                            className={css({ 
                                p: { base: '16px 8px', sm: '20px' }, 
                                bg: '#F7F7F7', 
                                borderRadius: '16px', 
                                border: '1px solid #EEEEEE',
                                textDecoration: 'none',
                                transition: 'all 0.2s',
                                _hover: { 
                                    bg: 'white', 
                                    transform: 'translateY(-2px)', 
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                    borderColor: '#ddd'
                                },
                                _active: { transform: 'scale(0.98)' }
                            })}
                        >
                            <div className={css({ fontSize: '24px', mb: '8px' })}>{item.icon}</div>
                            <div className={css({ fontSize: { base: '22px', sm: '26px' }, fontWeight: '900', color: '#222', letterSpacing: '-0.5px' })}>{item.value}</div>
                            <div className={css({ fontSize: '13px', color: '#717171', mt: '4px', whiteSpace: 'nowrap', fontWeight: '600' })}>{item.label}</div>
                        </Link>
                    ))}
                </div>
            </section>



            {/* 비밀번호 변경 */}
            <section className={css({ bg: 'white', borderRadius: '24px', p: { base: '20px', sm: '32px' }, border: '1px solid #eee', boxShadow: '0 6px 16px rgba(0,0,0,0.04)' })}>
                <h2 className={css({ fontSize: '17px', fontWeight: '800', mb: '24px', color: '#2C3A47', display: 'flex', alignItems: 'center', gap: '8px' })}>
                    <Lock size={18} />비밀번호 변경
                </h2>
                <form onSubmit={changePassword} className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                    {/* 새 비밀번호 */}
                    <div>
                        <label className={css({ fontSize: '13px', fontWeight: '600', color: '#555', mb: '6px', display: 'block' })}>새 비밀번호</label>
                        <div className={css({ position: 'relative' })}>
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => { setNewPassword(e.target.value); setPasswordError(''); setPasswordSuccess('') }}
                                placeholder="6자 이상 입력해 주세요"
                                className={css({ 
                                    w: '100%', p: '14px 48px 14px 16px', bg: '#F9F9F9', border: '1px solid #EEEEEE', borderRadius: '14px', fontSize: '15px', fontWeight: '600', color: '#2C3A47', outline: 'none', 
                                    transition: 'all 0.2s',
                                    _placeholder: { color: '#CCC', fontWeight: '400' },
                                    _focus: { borderColor: '#2EC4B6', bg: 'white', boxShadow: '0 0 0 3px rgba(46, 196, 182, 0.1)' } 
                                })}
                            />
                            <button type="button" onClick={() => setShowNew(!showNew)}
                                className={css({ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', bg: 'transparent', border: 'none', cursor: 'pointer', color: '#aaa' })}>
                                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {/* 최소 길이 안내 */}
                        {newPassword.length > 0 && newPassword.length < 6 && (
                            <p className={css({ fontSize: '12px', color: '#f59e0b', mt: '4px', display: 'flex', alignItems: 'center', gap: '4px' })}>
                                <XCircle size={13} /> 6자 이상으로 조금 더 튼튼하게 만들어 주세요! ({newPassword.length}/6)
                            </p>
                        )}
                        {newPassword.length >= 6 && (
                            <p className={css({ fontSize: '12px', color: '#16a34a', mt: '4px', display: 'flex', alignItems: 'center', gap: '4px' })}>
                                <CheckCircle2 size={13} /> 아주 좋은 비밀번호예요!
                            </p>
                        )}
                    </div>

                    {/* 새 비밀번호 확인 */}
                    <div>
                        <label className={css({ fontSize: '13px', fontWeight: '600', color: '#555', mb: '6px', display: 'block' })}>새 비밀번호 확인</label>
                        <div className={css({ position: 'relative' })}>
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={e => { setConfirmPassword(e.target.value); setPasswordError(''); setPasswordSuccess('') }}
                                placeholder="한 번 더 입력해 주세요"
                                className={css({
                                    w: '100%', p: '14px 48px 14px 16px', bg: '#F9F9F9', fontSize: '15px', fontWeight: '600', color: '#2C3A47', outline: 'none', borderRadius: '14px',
                                    transition: 'all 0.2s',
                                    border: confirmPassword.length === 0
                                        ? '1px solid #EEEEEE'
                                        : confirmPassword === newPassword
                                            ? '1px solid #10B981'
                                            : '1px solid #EF4444',
                                    _placeholder: { color: '#CCC', fontWeight: '400' },
                                    _focus: { bg: 'white', borderColor: confirmPassword === newPassword ? '#10B981' : '#EF4444' }
                                })}
                            />
                            <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                className={css({ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', bg: 'transparent', border: 'none', cursor: 'pointer', color: '#aaa' })}>
                                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {/* 실시간 일치 여부 피드백 */}
                        {confirmPassword.length > 0 && (
                            confirmPassword === newPassword ? (
                                <p className={css({ fontSize: '12px', color: '#16a34a', mt: '4px', display: 'flex', alignItems: 'center', gap: '4px' })}>
                                    <CheckCircle2 size={13} /> 완벽해요! 비밀번호가 일치합니다.
                                </p>
                            ) : (
                                <p className={css({ fontSize: '12px', color: '#dc2626', mt: '4px', display: 'flex', alignItems: 'center', gap: '4px' })}>
                                    <XCircle size={13} /> 비밀번호가 달라요. 다시 한번 확인해 볼까요?
                                </p>
                            )
                        )}
                    </div>

                    {passwordError && (
                        <p className={css({ fontSize: '13px', color: '#EF4444', bg: '#fef2f2', p: '12px 16px', borderRadius: '12px', fontWeight: '600' })}>{passwordError}</p>
                    )}
                    {passwordSuccess && (
                        <p className={css({ fontSize: '13px', color: '#2EC4B6', bg: '#EAF9F7', p: '12px 16px', borderRadius: '12px', fontWeight: '600' })}>{passwordSuccess}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isChangingPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6}
                        className={css({ mt: '8px', py: '14px', bg: '#2EC4B6', color: 'white', borderRadius: '16px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '15px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(46,196,182,0.2)', _disabled: { opacity: 0.5, cursor: 'not-allowed', boxShadow: 'none' }, _hover: { bg: '#249E93', transform: 'translateY(-1px)' } })}
                    >
                        {isChangingPassword ? '안전하게 바꾸는 중...' : '비밀번호 변경할게요'}
                    </button>
                </form>
            </section>

            {/* 바로가기 링크 */}
            <section className={css({ bg: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #eee', boxShadow: '0 6px 16px rgba(0,0,0,0.04)' })}>
                <h2 className={css({ fontSize: '18px', fontWeight: '800', p: '24px 24px 16px', color: '#2C3A47' })}>바로가기</h2>
                {[
                    { href: '/templates', icon: '📦', label: '나만의 템플릿', desc: '자주 쓰는 준비물을 미리 만들어 보세요' },
                    { href: '/', icon: '✈️', label: '내 여행 목록', desc: '지금까지의 모든 여행을 확인해 보세요' },
                ].map((item, i, arr) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: '24px',
                            py: '20px',
                            borderTop: '1px solid #EEEEEE',
                            textDecoration: 'none',
                            color: '#222',
                            transition: 'all 0.2s',
                            _hover: { bg: '#F7F7F7' },
                            _active: { transform: 'scale(0.98)' }
                        })}
                    >
                        <div className={css({ display: 'flex', alignItems: 'center', gap: '14px' })}>
                            <span className={css({ fontSize: '20px' })}>{item.icon}</span>
                            <div>
                                <div className={css({ fontSize: '16px', fontWeight: '700' })}>{item.label}</div>
                                <div className={css({ fontSize: '13px', color: '#717171', mt: '2px' })}>{item.desc}</div>
                            </div>
                        </div>
                        <ChevronRight size={18} color="#B0B0B0" />
                    </Link>
                ))}
            </section>

            {/* 기타 메뉴 */}
            <section className={css({ bg: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #eee', boxShadow: '0 6px 16px rgba(0,0,0,0.04)' })}>
                <button
                    onClick={() => setShowTerms(true)}
                    className={css({
                        w: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: '24px',
                        py: '20px',
                        bg: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#222',
                        transition: 'all 0.2s',
                        _hover: { bg: '#F7F7F7' },
                        _active: { transform: 'scale(0.98)' },
                        borderBottom: '1px solid #EEEEEE'
                    })}
                >
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '14px' })}>
                        <ShieldCheck size={20} color="#717171" />
                        <div className={css({ textAlign: 'left' })}>
                            <div className={css({ fontSize: '16px', fontWeight: '700' })}>이용약관 및 개인정보 처리방침</div>
                            <div className={css({ fontSize: '13px', color: '#717171', mt: '2px' })}>온여정의 정책을 확인합니다</div>
                        </div>
                    </div>
                    <ChevronRight size={18} color="#B0B0B0" />
                </button>
                <Link
                    href="/profile/licenses"
                    className={css({
                        w: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: '24px',
                        py: '20px',
                        textDecoration: 'none',
                        color: '#222',
                        transition: 'all 0.2s',
                        _hover: { bg: '#F7F7F7' },
                        _active: { transform: 'scale(0.98)' }
                    })}
                >
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '14px' })}>
                        <Edit2 size={20} color="#717171" />
                        <div className={css({ textAlign: 'left' })}>
                            <div className={css({ fontSize: '16px', fontWeight: '700' })}>오픈 소스 라이선스</div>
                            <div className={css({ fontSize: '13px', color: '#717171', mt: '2px' })}>라이브러리 목록 확인</div>
                        </div>
                    </div>
                    <ChevronRight size={18} color="#B0B0B0" />
                </Link>
            </section>

            {/* 로그아웃 & 탈퇴 */}
            <div className={css({ mt: '20px', mb: '40px', display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' })}>
                <button
                    onClick={handleLogout}
                    className={css({
                        bg: 'transparent', border: 'none', cursor: 'pointer', p: 0,
                        fontSize: '13px', color: '#aaa', textDecoration: 'none', 
                        transition: 'all 0.2s', 
                        _hover: { color: '#888', textDecoration: 'underline' }
                    })}
                >
                    로그아웃
                </button>
                
                <Link href="/profile/withdrawal" className={css({ fontSize: '13px', color: '#aaa', textDecoration: 'none', transition: 'color 0.2s', _hover: { color: '#888', textDecoration: 'underline' } })}>
                    회원 탈퇴
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
