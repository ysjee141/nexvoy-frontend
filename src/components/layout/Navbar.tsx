'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { css } from 'styled-system/css'
import { createClient } from '@/utils/supabase/client'
import { LogOut, Home, User, Compass } from 'lucide-react'

export default function Navbar() {
    const router = useRouter()
    const supabase = createClient()

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    return (
        <nav
            className={css({
                position: 'sticky',
                top: 0,
                zIndex: 50,
                w: '100%',
                bg: 'white',
                borderBottom: '1px solid #eaeaea',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
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
                    <span className={css({ display: { base: 'none', sm: 'inline' } })}>Nexvoy</span>
                </Link>

                <div className={css({ display: 'flex', alignItems: 'center', gap: { base: '16px', md: '24px' } })}>
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
                </div>
            </div>
        </nav>
    )
}
