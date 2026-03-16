'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { css } from 'styled-system/css'
import { createClient } from '@/utils/supabase/client'
import { LogOut, Home, User, Compass, BookOpen, LogIn, UserPlus } from 'lucide-react'

export default function Navbar() {
    const router = useRouter()
    const supabase = createClient()

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
                bg: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                borderBottom: '1px solid #eaeaea',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                paddingTop: 'env(safe-area-inset-top)', // iOS Safe Area (Notch / Dynamic Island) 하단으로 밀어내기
            })}
        >
            <div
                className={css({
                    maxW: 'screen-xl',
                    mx: 'auto',
                    px: '20px',
                    h: '64px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                })}
            >
                {/* ── 왼쪽: 로고 + 가이드(PC) ── */}
                <div className={css({ display: 'flex', alignItems: 'center', gap: { base: '0', sm: '20px' } })}>
                    <Link
                        href="/"
                        className={css({
                            fontSize: 'xl',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#111',
                        })}
                    >
                        <Compass size={24} color="#4285F4" />
                        <span className={css({ display: { base: 'none', sm: 'inline' } })}>Onvoy</span>
                    </Link>

                    {/* 소개 — PC에서는 로고 바로 오른쪽 */}
                    <Link
                        href="/guide"
                        className={css({
                            display: { base: 'none', sm: 'flex' },
                            alignItems: 'center', gap: '5px',
                            fontSize: '14px', fontWeight: '500', color: '#555',
                            _hover: { color: '#4285F4' }, transition: 'color 0.15s',
                        })}
                    >
                        <BookOpen size={16} />
                        소개
                    </Link>
                </div>

                {/* ── 오른쪽: 가이드(모바일) + 로그인/로그아웃 등 ── */}
                <div className={css({ display: 'flex', alignItems: 'center', gap: { base: '12px', md: '24px' } })}>
                    {/* 가이드 — 모바일에서는 로그인 버튼 왼쪽 */}
                    <Link
                        href="/guide"
                        className={css({
                            display: { base: 'flex', sm: 'none' },
                            alignItems: 'center', gap: '4px',
                            fontSize: '13px', fontWeight: '500', color: '#555',
                            _hover: { color: '#4285F4' },
                        })}
                    >
                        <BookOpen size={16} />
                    </Link>

                    {!loading && (
                        <>
                            {user ? (
                                <>
                                    <Link
                                        href="/"
                                        className={css({
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            color: '#555',
                                            _hover: { color: '#111' },
                                        })}
                                    >
                                        <Home size={18} />
                                        <span className={css({ display: { base: 'none', sm: 'inline' } })}>홈</span>
                                    </Link>
                                    <Link
                                        href="/profile"
                                        className={css({
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            color: '#555',
                                            _hover: { color: '#111' },
                                        })}
                                    >
                                        <User size={18} />
                                        <span className={css({ display: { base: 'none', sm: 'inline' } })}>마이페이지</span>
                                    </Link>
                                    <button
                                        onClick={handleSignOut}
                                        className={css({
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            color: '#d32f2f',
                                            ml: { base: '4px', sm: '12px' },
                                            cursor: 'pointer',
                                            bg: 'transparent',
                                            border: 'none',
                                            _hover: { textDecoration: 'underline' },
                                        })}
                                    >
                                        <LogOut size={18} />
                                        <span className={css({ display: { base: 'none', sm: 'inline' } })}>로그아웃</span>
                                    </button>
                                </>
                            ) : (
                                <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                                    {/* 회원가입 — 아웃라인 스타일 */}
                                    <Link
                                        href="/signup"
                                        className={css({
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                            bg: 'transparent',
                                            color: '#333',
                                            px: { base: '10px', sm: '14px' },
                                            py: '8px',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            border: '1px solid #ddd',
                                            transition: 'all 0.2s',
                                            _hover: { bg: '#f5f5f5', borderColor: '#bbb' },
                                        })}
                                    >
                                        <UserPlus size={15} />
                                        <span className={css({ display: { base: 'none', sm: 'inline' } })}>회원가입</span>
                                    </Link>
                                    {/* 로그인 — 채움 스타일 */}
                                    <Link
                                        href="/login"
                                        className={css({
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                            bg: '#111',
                                            color: 'white',
                                            px: { base: '10px', sm: '14px' },
                                            py: '8px',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            transition: 'all 0.2s',
                                            _hover: { bg: '#333', transform: 'translateY(-1px)' },
                                        })}
                                    >
                                        <LogIn size={15} />
                                        <span className={css({ display: { base: 'none', sm: 'inline' } })}>로그인</span>
                                    </Link>
                                </div>
                            )}

                        </>
                    )}
                </div>
            </div>
        </nav>
    )
}
