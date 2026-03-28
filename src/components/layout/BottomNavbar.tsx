'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { css } from 'styled-system/css'
import { Home, User, BookOpen, ListTodo } from 'lucide-react'

export default function BottomNavbar() {
    const pathname = usePathname()

    const navItems = [
        { icon: Home, label: '홈', href: '/' },
        { icon: ListTodo, label: '템플릿', href: '/templates' },
        { icon: User, label: '내 정보', href: '/profile' },
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
                bg: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                borderTop: '1px solid #eaeaea',
                paddingBottom: 'env(safe-area-inset-bottom)', // iOS Safe Area 대응
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
                {navItems.map((item) => {
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
                                color: isActive ? '#3B82F6' : '#666',
                                transition: 'all 0.2s',
                                _active: { transform: 'scale(0.9)' },
                            })}
                        >
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                            <span className={css({
                                fontSize: '10px',
                                fontWeight: isActive ? '700' : '500',
                            })}>
                                {item.label}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
