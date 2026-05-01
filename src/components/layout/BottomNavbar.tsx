'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { css } from 'styled-system/css'
import { Home, UserCircle, ListTodo, WifiOff } from 'lucide-react'
import { useNetworkStore } from '@/stores/useNetworkStore'

export default function BottomNavbar() {
    const pathname = usePathname()
    const { isOfflineMode } = useNetworkStore()

    const navItems = [
        { icon: Home, label: '홈', href: '/' },
        { icon: ListTodo, label: '템플릿', href: '/templates' },
        { icon: UserCircle, label: '프로필', href: '/profile' },
    ]

    return (
        <nav
            className={css({
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 50,
                display: { base: 'block', sm: 'none' }, // 모바일(sm 미만)에서만 표시
                bg: 'white/90',
                backdropFilter: 'blur(10px)',
                borderTop: '1px solid',
                borderTopColor: 'brand.border',
                paddingBottom: 'max(env(safe-area-inset-bottom), var(--safe-area-inset-bottom))', // iOS/Android Safe Area 대응
                boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
            })}
        >
            <div
                className={css({
                    display: 'flex',
                    height: '64px',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                })}
            >
                {isOfflineMode ? (
                    <Link
                        href="/offline"
                        className={css({
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            flex: 1,
                            color: pathname === '/offline' ? 'brand.primary' : 'brand.muted',
                            transition: 'all 0.2s',
                            _active: { transform: 'scale(0.92)' }
                        })}
                    >
                        <WifiOff size={24} strokeWidth={pathname === '/offline' ? 2.8 : 2} />
                        <span className={css({
                            fontSize: '10px',
                            fontWeight: pathname === '/offline' ? '700' : '500',
                        })}>
                            오프라인 홈
                        </span>
                    </Link>
                ) : (
                    navItems.map((item) => {
                        const isActive = item.href === '/' 
                            ? pathname === '/' 
                            : pathname.startsWith(item.href)
                        const Icon = item.icon

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={css({
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '4px',
                                    flex: 1,
                                    color: isActive ? 'brand.primary' : 'brand.muted',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    _active: { transform: 'scale(0.92)' },
                                    _hover: { color: isActive ? 'brand.primary' : 'brand.secondary' },
                                })}
                            >
                                <Icon size={24} strokeWidth={isActive ? 2.8 : 2} />
                                <span className={css({
                                    fontSize: '10px',
                                    fontWeight: isActive ? '700' : '500',
                                })}>
                                    {item.label}
                                </span>
                            </Link>
                        )
                    })
                )}
            </div>
        </nav>
    )
}
