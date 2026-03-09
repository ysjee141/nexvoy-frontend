'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { css } from 'styled-system/css'
import { createClient } from '@/utils/supabase/client'
import { LogOut, Home, User, Compass } from 'lucide-react'

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

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
                    <span className={css({ display: { base: 'none', sm: 'inline' } })}>Next Voyage</span>
                </Link>

                <div className={css({ display: 'flex', alignItems: 'center', gap: { base: '16px', md: '24px' } })}>
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
                                <Link
                                    href="/login"
                                    className={css({
                                        bg: '#111',
                                        color: 'white',
                                        px: '16px',
                                        py: '8px',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        transition: 'all 0.2s',
                                        _hover: { bg: '#333', transform: 'translateY(-1px)' }
                                    })}
                                >
                                    로그인
                                </Link>
                            )}
                        </>
                    )}
                </div>
            </div>
        </nav>
    )
}
