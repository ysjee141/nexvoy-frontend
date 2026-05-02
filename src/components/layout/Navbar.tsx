'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { css } from 'styled-system/css'
import { createClient } from '@/utils/supabase/client'
import { LogOut, Home, User, BookOpen, LogIn, UserPlus, ListTodo, ChevronLeft, ChevronDown, MessageSquareText } from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'
import { CacheUtil } from '@/utils/cache'
import TripSwitcherModal from '@/components/trips/TripSwitcherModal'
import { useBugReport } from '@/hooks/useBugReport'
import BugReportModal from '../profile/BugReportModal'

const PAGE_TITLES: Record<string, string> = {
    '/': '온여정',
    '/templates': '체크리스트 템플릿',
    '/templates/': '체크리스트 템플릿',
    '/profile': '내 정보',
    '/trips/new': '새 여행 만들기',
    '/templates/new': '새 템플릿 만들기',
    '/trips/detail': '여행 상세',
    '/templates/detail': '템플릿 수정',
    '/trips/checklist': '준비물 체크리스트',
    '/login': '로그인',
    '/signup': '회원가입',
    '/profile/travel-log': '나의 여정 기록',
    '/profile/places-visited': '내가 머문 발자취',
    '/profile/withdrawal': '회원 탈퇴',
    '/profile/licenses': '오픈 소스 라이선스'
}

export default function Navbar() {
    const router = useRouter()
    const pathname = usePathname() || '/'
    const normalizedPath = pathname.replace(/\/$/, '') || '/'
    const supabase = createClient()
    const { mobileTitle, setMobileTitle, setIsTripSwitcherOpen } = useUIStore()
    const isRootPage = normalizedPath === '/'
    const isTripDetailPage = normalizedPath === '/trips/detail'
    const pageTitle = mobileTitle || PAGE_TITLES[normalizedPath] || PAGE_TITLES[pathname] || '온여정'
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    // 버그 제보 공유 훅
    const { 
        isOpen: isBugModalOpen, 
        setIsOpen: setIsBugModalOpen, 
        isVisible: isBugReportVisible 
    } = useBugReport()

    useEffect(() => {
        const fetchUser = async () => {
            // 1. 캐시에서 먼저 로드 (오프라인/즉각 응답)
            const cachedUser = await CacheUtil.getAuthUser()
            if (cachedUser) {
                setUser(cachedUser)
            }

            // 2. 서버에서 최신 정보 세션 동기화 (SWR)
            const { data: { user: networkUser } } = await supabase.auth.getUser()
            setUser(networkUser)
            if (networkUser) {
                await CacheUtil.setAuthUser(networkUser)
            } else {
                await CacheUtil.remove('auth_last_user')
            }
            setLoading(false)
        }
        fetchUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
            const currentUser = session?.user ?? null
            setUser(currentUser)
            if (currentUser) {
                await CacheUtil.setAuthUser(currentUser)
            } else {
                await CacheUtil.remove('auth_last_user')
            }
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    // 페이지 이동 시 모바일 타이틀 리셋
    useEffect(() => {
        setMobileTitle(null)
    }, [pathname, setMobileTitle])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        await CacheUtil.remove('auth_last_user')
        router.push('/')
        router.refresh()
    }

    return (
        <nav
            className={css({
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                w: '100%',
                display: 'block',
                bg: 'bg.canvas',
                borderBottom: '1px solid',
                borderBottomColor: 'brand.hairline',
                paddingTop: 'max(env(safe-area-inset-top), var(--safe-area-inset-top))',
                transition: 'transform 0.3s ease',
            })}
        >
            {/* ── 데스크톱 버전 (sm 이상) ── */}
            <div
                className={css({
                    display: { base: 'none', sm: 'flex' },
                    maxW: 'screen-xl',
                    mx: 'auto',
                    px: '20px',
                    h: '64px',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                })}
            >
                {/* 왼쪽: 로고 + 가이드 */}
                <div className={css({ display: 'flex', alignItems: 'center', gap: '20px' })}>
                    <Link href="/" className={css({ fontSize: 'xl', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: 'brand.ink' })}>
                        <Image src="/logo.png" alt="온여정 로고" width={28} height={28} priority />
                        <span>온여정</span>
                    </Link>
                </div>

                {/* 오른쪽: 메뉴 */}
                <div className={css({ display: 'flex', alignItems: 'center', gap: '24px' })}>
                    {!loading && (
                        <>
                            {user ? (
                                <>
                                    <Link href="/" className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '500', color: 'brand.muted', _hover: { color: 'brand.ink' } })}>
                                        <Home size={18} />
                                        <span className={css({ display: { base: 'none', md: 'inline' } })}>홈</span>
                                    </Link>
                                    <Link href="/templates" className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '500', color: 'brand.muted', _hover: { color: 'brand.ink' } })}>
                                        <ListTodo size={18} />
                                        <span className={css({ display: { base: 'none', md: 'inline' } })}>템플릿</span>
                                    </Link>
                                    <Link href="/profile" className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '500', color: 'brand.muted', _hover: { color: 'brand.ink' } })}>
                                        <User size={18} />
                                        <span className={css({ display: { base: 'none', md: 'inline' } })}>마이페이지</span>
                                    </Link>
                                    <button onClick={handleSignOut} className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '500', color: 'brand.error', ml: '12px', cursor: 'pointer', bg: 'transparent', border: 'none', _hover: { textDecoration: 'underline' } })}>
                                        <LogOut size={18} />
                                        <span>로그아웃</span>
                                    </button>
                                </>
                            ) : (
                                <div className={css({ display: 'flex', alignItems: 'center', gap: '12px' })}>
                                    <Link href="/signup" className={css({ display: 'flex', alignItems: 'center', gap: '8px', bg: 'transparent', color: 'brand.ink', px: '12px', py: '10px', borderRadius: '24px', fontSize: '14px', fontWeight: '600', _hover: { bg: 'bg.surfaceSoft' } })}>
                                        회원가입
                                    </Link>
                                    <Link href="/login" className={css({ display: 'flex', alignItems: 'center', gap: '8px', bg: 'brand.primary', color: 'white', px: '24px', py: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: '500', transition: 'all 0.2s ease', _hover: { transform: 'scale(0.96)' } })}>
                                        로그인
                                    </Link>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── 모바일 헤더 버전 (base) ── */}
            <div
                className={css({
                    display: { base: 'flex', sm: 'none' },
                    h: '56px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: '16px',
                    position: 'relative',
                })}
            >
                {/* 왼쪽: 뒤로가기 (Root 페이지가 아닐 때만 노출) */}
                {!isRootPage && (
                    <button
                        onClick={() => router.back()}
                        className={css({
                            position: 'absolute',
                            left: '8px',
                            p: '8px',
                            bg: 'transparent',
                            border: 'none',
                            color: 'brand.ink',
                            cursor: 'pointer',
                        })}
                    >
                        <ChevronLeft size={24} />
                    </button>
                )}

                {/* 중앙: 페이지 타이틀 */}
                {isTripDetailPage ? (
                    <button
                        onClick={() => setIsTripSwitcherOpen(true)}
                        className={css({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            bg: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            p: '8px',
                            borderRadius: '8px',
                            transition: 'background 0.2s',
                            _active: { bg: 'bg.softCotton' }
                        })}
                    >
                        {pageTitle === '온여정' && (
                            <Image src="/logo.png" alt="온여정 로고" width={20} height={20} priority />
                        )}
                        <h1 className={css({ fontSize: '17px', fontWeight: 'bold', color: 'brand.ink', letterSpacing: '-0.01em' })}>
                            {pageTitle}
                        </h1>
                        <ChevronDown size={18} className={css({ color: 'brand.ink' })} />
                    </button>
                ) : (
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '6px' })}>
                        {pageTitle === '온여정' && (
                            <Image src="/logo.png" alt="온여정 로고" width={20} height={20} priority />
                        )}
                        <h1 className={css({ fontSize: '17px', fontWeight: 'bold', color: 'brand.ink', letterSpacing: '-0.01em' })}>
                            {pageTitle}
                        </h1>
                    </div>
                )}

                {/* 오른쪽: 피드백 버튼 (베타 테스터 전용) */}
                {isBugReportVisible && (
                    <button
                        onClick={() => setIsBugModalOpen(true)}
                        className={css({
                            position: 'absolute',
                            right: '8px',
                            p: '10px',
                            bg: 'transparent',
                            border: 'none',
                            color: 'brand.primary',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            _active: { transform: 'scale(0.9)', opacity: 0.7 }
                        })}
                        title="피드백 보내기"
                    >
                        <div className={css({ position: 'relative' })}>
                            <MessageSquareText size={22} />
                            <span className={css({
                                position: 'absolute', top: '-2px', right: '-2px',
                                w: '7px', h: '7px', bg: 'orange.500', borderRadius: '50%',
                                border: '1.5px solid white'
                            })} />
                        </div>
                    </button>
                )}
            </div>
            
            {/* 여행 전환 모달 */}
            <Suspense fallback={null}>
                <TripSwitcherModal />
            </Suspense>

            {/* 피드백 모달 */}
            <BugReportModal 
                isOpen={isBugModalOpen} 
                onClose={() => setIsBugModalOpen(false)} 
                user={{ id: user?.id, email: user?.email }} 
            />
        </nav>
    )
}
