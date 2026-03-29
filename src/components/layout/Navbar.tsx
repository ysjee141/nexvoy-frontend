'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { css } from 'styled-system/css'
import { createClient } from '@/utils/supabase/client'
import { LogOut, Home, User, BookOpen, LogIn, UserPlus, ListTodo, ChevronLeft } from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'

const PAGE_TITLES: Record<string, string> = {
    '/': '온여정(OnVoy)',
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
    '/profile/withdrawal': '회원 탈퇴',
    '/profile/licenses': '오픈 소스 라이선스'
}

export default function Navbar() {
    const router = useRouter()
    const pathname = usePathname() || '/'
    const normalizedPath = pathname.replace(/\/$/, '') || '/'
    const supabase = createClient()
    const { mobileTitle } = useUIStore()

    const isRootPage = normalizedPath === '/'
    const pageTitle = mobileTitle || PAGE_TITLES[normalizedPath] || PAGE_TITLES[pathname] || 'OnVoy'
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            setLoading(false)
        }
        fetchUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
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
                zIndex: 50,
                w: '100%',
                display: 'block',
                bg: '#FFFFFF',
                borderBottom: '1px solid #EBEBEB',
                boxShadow: '0 1px 12px rgba(0,0,0,0.08)',
                paddingTop: 'env(safe-area-inset-top)',
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
                    <Link href="/" className={css({ fontSize: 'xl', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: '#172554' })}>
                        <Image src="/logo.png" alt="OnVoy Logo" width={28} height={28} priority />
                        <span>OnVoy</span>
                    </Link>
                </div>

                {/* 오른쪽: 메뉴 */}
                <div className={css({ display: 'flex', alignItems: 'center', gap: '24px' })}>
                    {!loading && (
                        <>
                            {user ? (
                                <>
                                    <Link href="/" className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '500', color: '#555', _hover: { color: '#172554' } })}>
                                        <Home size={18} />
                                        <span className={css({ display: { base: 'none', md: 'inline' } })}>홈</span>
                                    </Link>
                                    <Link href="/templates" className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '500', color: '#555', _hover: { color: '#172554' } })}>
                                        <ListTodo size={18} />
                                        <span className={css({ display: { base: 'none', md: 'inline' } })}>템플릿</span>
                                    </Link>
                                    <Link href="/profile" className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '500', color: '#555', _hover: { color: '#172554' } })}>
                                        <User size={18} />
                                        <span className={css({ display: { base: 'none', md: 'inline' } })}>마이페이지</span>
                                    </Link>
                                    <button onClick={handleSignOut} className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '500', color: '#d32f2f', ml: '12px', cursor: 'pointer', bg: 'transparent', border: 'none', _hover: { textDecoration: 'underline' } })}>
                                        <LogOut size={18} />
                                        <span>로그아웃</span>
                                    </button>
                                </>
                            ) : (
                                <div className={css({ display: 'flex', alignItems: 'center', gap: '12px' })}>
                                    <Link href="/signup" className={css({ display: 'flex', alignItems: 'center', gap: '8px', bg: 'transparent', color: '#222', px: '12px', py: '10px', borderRadius: '24px', fontSize: '14px', fontWeight: '600', _hover: { bg: '#F7F7F7' } })}>
                                        회원가입
                                    </Link>
                                    <Link href="/login" className={css({ display: 'flex', alignItems: 'center', gap: '8px', bg: 'brand.primary', color: 'white', px: '24px', py: '12px', borderRadius: '32px', fontSize: '14px', fontWeight: '800', transition: 'all 0.2s ease', _hover: { transform: 'scale(1.02)', boxShadow: '0 6px 20px rgba(59, 130, 246, 0.3)' } })}>
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
                            color: '#172554',
                            cursor: 'pointer',
                        })}
                    >
                        <ChevronLeft size={24} />
                    </button>
                )}

                {/* 중앙: 페이지 타이틀 */}
                <h1 className={css({ fontSize: '17px', fontWeight: 'bold', color: '#172554', letterSpacing: '-0.01em' })}>
                    {pageTitle}
                </h1>
            </div>
        </nav>
    )
}
