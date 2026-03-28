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
    '/templates': '체크리스트',
    '/profile': '내 정보',
    '/trips/new': '새 여행 만들기',
    '/templates/new': '새 템플릿 만들기',
    '/trips/detail': '여행 상세',
    '/trips/checklist': '준비물 체크리스트',
    '/guide': '소개',
    '/login': '로그인',
    '/signup': '회원가입',
    '/profile/withdrawal': '회원 탈퇴',
    '/profile/licenses': '오픈 소스 라이선스'
}

export default function Navbar() {
    const router = useRouter()
    const pathname = usePathname()
    const supabase = createClient()
    const { mobileTitle } = useUIStore()

    const isRootPage = ['/', '/templates', '/profile'].includes(pathname)
    const pageTitle = mobileTitle || PAGE_TITLES[pathname] || 'OnVoy'
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
                display: 'block', // 항상 표시 (내부에서 모드 전환)
                bg: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid #eaeaea',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                paddingTop: 'env(safe-area-inset-top)',
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
                    <Link href="/guide" className={css({ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', fontWeight: '500', color: '#555', _hover: { color: '#3B82F6' }, transition: 'color 0.15s' })}>
                        <BookOpen size={16} /> 소개
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
                                <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                                    <Link href="/signup" className={css({ display: 'flex', alignItems: 'center', gap: '5px', bg: 'transparent', color: '#1E3A8A', px: '14px', py: '8px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: '1px solid #ddd', _hover: { bg: '#f5f5f5' } })}>
                                        <UserPlus size={15} /> 회원가입
                                    </Link>
                                    <Link href="/login" className={css({ display: 'flex', alignItems: 'center', gap: '5px', bg: '#111', color: 'white', px: '14px', py: '8px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', _hover: { bg: '#333' } })}>
                                        <LogIn size={15} /> 로그인
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
