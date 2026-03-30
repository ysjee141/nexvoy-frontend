'use client'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import { User, Mail, Lock, ChevronRight, Save, Eye, EyeOff, CheckCircle2, XCircle, Edit2, Check, X, ShieldCheck, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import TermsModal from '../signup/TermsModal'

function ProfileContent() {
    const supabase = createClient()

    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [nickname, setNickname] = useState('')
    const [isEditingNickname, setIsEditingNickname] = useState(false)
    const [isSavingNickname, setIsSavingNickname] = useState(false)
    const [nicknameError, setNicknameError] = useState('')

    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [passwordError, setPasswordError] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')

    const [stats, setStats] = useState({ totalTrips: 0, totalPlans: 0, totalTemplates: 0, totalChecked: 0, totalItems: 0 })
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
                .select('id')
                .eq('user_id', user.id)

            const tripIds = trips?.map((t: any) => t.id) || []

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

            const { count: templateCount } = await supabase
                .from('checklist_templates')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)

            setStats({
                totalTrips: tripIds.length,
                totalPlans,
                totalTemplates: templateCount || 0,
                totalChecked,
                totalItems,
            })
        }

        fetchData()

        if (searchParams.get('edit') === 'nickname') {
            setIsEditingNickname(true)
        }
    }, [supabase, searchParams])

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
            setNicknameError('이미 사용 중인 닉네임입니다.')
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
            setPasswordError('새 비밀번호는 6자 이상이어야 합니다.')
            return
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.')
            return
        }

        setIsChangingPassword(true)

        // Supabase의 updateUser로 비밀번호 변경 (이메일 인증 기반이면 현재 세션으로 바로 가능)
        const { error } = await supabase.auth.updateUser({ password: newPassword })

        if (error) {
            setPasswordError(error.message || '비밀번호 변경에 실패했습니다.')
        } else {
            setPasswordSuccess('비밀번호가 성공적으로 변경되었습니다.')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        }
        setIsChangingPassword(false)
    }
    
    const router = useRouter()
    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut()
        if (!error) {
            router.push('/')
            router.refresh()
        }
    }

    if (!user) {
        return (
            <div className={css({ textAlign: 'center', py: '80px', color: '#888' })}>
                불러오는 중...
            </div>
        )
    }

    const displayName = nickname || user.email?.split('@')[0] || '여행자'
    const packingRate = stats.totalItems > 0 ? Math.round((stats.totalChecked / stats.totalItems) * 100) : 0

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
                                        flex: 1, minW: 0, p: '6px 10px', 
                                        border: nicknameError ? '1.5px solid #dc2626' : '1.5px solid #3B82F6', 
                                        borderRadius: '6px', fontSize: { base: '18px', sm: '20px' }, fontWeight: 'bold', outline: 'none' 
                                    })}
                                />
                                <div className={css({ display: 'flex', gap: '4px', flexShrink: 0 })}>
                                    <button
                                        onClick={saveNickname}
                                        disabled={isSavingNickname}
                                        className={css({ p: '6px', bg: '#3B82F6', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', _disabled: { opacity: 0.6 } })}
                                        title="저장"
                                    >
                                        {isSavingNickname ? <span className={css({ fontSize: '12px', fontWeight: 'bold', px: '2px' })}>...</span> : <Check size={18} />}
                                    </button>
                                    <button
                                        onClick={() => { setIsEditingNickname(false); setNickname(profile?.nickname || ''); setNicknameError('') }}
                                        className={css({ p: '6px', bg: '#f1f3f4', color: '#555', borderRadius: '6px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', _hover: { bg: '#e8eaed' } })}
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
                                <h1 className={css({ fontSize: { base: '24px', sm: '28px' }, fontWeight: '900', color: '#222', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', letterSpacing: '-0.5px' })}>
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
            <section className={css({ bg: 'white', borderRadius: '24px', p: { base: '20px', sm: '32px' }, border: '1px solid #DDDDDD', boxShadow: '0 6px 16px rgba(0,0,0,0.06)' })}>
                <h2 className={css({ fontSize: '18px', fontWeight: '800', mb: '24px', color: '#222' })}>활동 요약</h2>
                {/* 모바일: 2x2 grid / 데스크탑: 4열 */}
                <div className={css({ display: 'grid', gridTemplateColumns: { base: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: '12px', textAlign: 'center' })}>
                    {[
                        { label: '총 여행', value: stats.totalTrips, icon: '✈️' },
                        { label: '일정 수', value: stats.totalPlans, icon: '📅' },
                        { label: '내 템플릿', value: stats.totalTemplates, icon: '📦' },
                        { label: '짐 준비율', value: `${packingRate}%`, icon: '🧳' },
                    ].map(item => (
                        <div key={item.label} className={css({ p: { base: '16px 8px', sm: '20px' }, bg: '#F7F7F7', borderRadius: '16px', border: '1px solid #EEEEEE' })}>
                            <div className={css({ fontSize: '24px', mb: '8px' })}>{item.icon}</div>
                            <div className={css({ fontSize: { base: '22px', sm: '26px' }, fontWeight: '900', color: '#222', letterSpacing: '-0.5px' })}>{item.value}</div>
                            <div className={css({ fontSize: '13px', color: '#717171', mt: '4px', whiteSpace: 'nowrap', fontWeight: '600' })}>{item.label}</div>
                        </div>
                    ))}
                </div>
            </section>



            {/* 비밀번호 변경 */}
            <section className={css({ bg: 'white', borderRadius: '16px', p: { base: '16px', sm: '24px' }, boxShadow: '0 4px 12px rgba(0,0,0,0.04)' })}>
                <h2 className={css({ fontSize: '16px', fontWeight: 'bold', mb: '20px', color: '#222', display: 'flex', alignItems: 'center', gap: '8px' })}>
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
                                placeholder="6자 이상 입력"
                                className={css({ w: '100%', p: '12px 48px 12px 16px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '15px', outline: 'none', _focus: { borderColor: '#3B82F6' } })}
                            />
                            <button type="button" onClick={() => setShowNew(!showNew)}
                                className={css({ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', bg: 'transparent', border: 'none', cursor: 'pointer', color: '#aaa' })}>
                                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {/* 최소 길이 안내 */}
                        {newPassword.length > 0 && newPassword.length < 6 && (
                            <p className={css({ fontSize: '12px', color: '#f59e0b', mt: '4px', display: 'flex', alignItems: 'center', gap: '4px' })}>
                                <XCircle size={13} /> 6자 이상 입력해주세요 ({newPassword.length}/6)
                            </p>
                        )}
                        {newPassword.length >= 6 && (
                            <p className={css({ fontSize: '12px', color: '#16a34a', mt: '4px', display: 'flex', alignItems: 'center', gap: '4px' })}>
                                <CheckCircle2 size={13} /> 사용 가능한 비밀번호입니다
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
                                placeholder="비밀번호를 다시 입력"
                                className={css({
                                    w: '100%', p: '12px 48px 12px 16px', fontSize: '15px', outline: 'none', borderRadius: '8px',
                                    border: confirmPassword.length === 0
                                        ? '1px solid #ddd'
                                        : confirmPassword === newPassword
                                            ? '1px solid #16a34a'
                                            : '1px solid #dc2626',
                                    _focus: { borderColor: confirmPassword === newPassword ? '#16a34a' : '#dc2626' }
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
                                    <CheckCircle2 size={13} /> 비밀번호가 일치합니다
                                </p>
                            ) : (
                                <p className={css({ fontSize: '12px', color: '#dc2626', mt: '4px', display: 'flex', alignItems: 'center', gap: '4px' })}>
                                    <XCircle size={13} /> 비밀번호가 일치하지 않습니다
                                </p>
                            )
                        )}
                    </div>

                    {passwordError && (
                        <p className={css({ fontSize: '13px', color: '#dc2626', bg: '#fef2f2', p: '10px 14px', borderRadius: '8px' })}>{passwordError}</p>
                    )}
                    {passwordSuccess && (
                        <p className={css({ fontSize: '13px', color: '#16a34a', bg: '#EFF6FF', p: '10px 14px', borderRadius: '8px' })}>{passwordSuccess}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isChangingPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6}
                        className={css({ mt: '4px', py: '12px', bg: '#111', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', _disabled: { opacity: 0.5, cursor: 'not-allowed' }, _hover: { bg: '#333' } })}
                    >
                        {isChangingPassword ? '변경 중...' : '비밀번호 변경하기'}
                    </button>
                </form>
            </section>

            {/* 바로가기 링크 */}
            <section className={css({ bg: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #DDDDDD', boxShadow: '0 6px 16px rgba(0,0,0,0.06)' })}>
                <h2 className={css({ fontSize: '18px', fontWeight: '800', p: '24px 24px 16px', color: '#222' })}>바로가기</h2>
                {[
                    { href: '/templates', icon: '📦', label: '나만의 템플릿 관리', desc: '체크리스트 템플릿을 관리합니다' },
                    { href: '/', icon: '✈️', label: '내 여행 목록', desc: '등록한 여행들을 확인합니다' },
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
            <section className={css({ bg: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #DDDDDD', boxShadow: '0 6px 16px rgba(0,0,0,0.06)' })}>
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
        <Suspense fallback={
            <div className={css({ textAlign: 'center', py: '80px', color: '#888' })}>
                불러오는 중...
            </div>
        }>
            <ProfileContent />
        </Suspense>
    )
}
