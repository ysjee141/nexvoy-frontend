'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { LogIn, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [rememberEmail, setRememberEmail] = useState(false)
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
    const [loading, setLoading] = useState(false)

    // 페이지 로드 시 저장된 이메일 불러오기
    useEffect(() => {
        const savedEmail = localStorage.getItem('rememberedEmail')
        if (savedEmail) {
            setEmail(savedEmail)
            setRememberEmail(true)
        }
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)
        const supabase = createClient()

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setMessage({ type: 'error', text: error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호를 다시 한번 확인해 주시겠어요?' : error.message })
            setLoading(false)
        } else {
            // 로그인 성공 시 이메일 기억하기 처리
            if (rememberEmail) {
                localStorage.setItem('rememberedEmail', email)
            } else {
                localStorage.removeItem('rememberedEmail')
            }
            router.push('/')
            router.refresh()
        }
    }

    return (
        // 모바일(330px)에서는 배경과 카드를 통합: 전체 높이를 카드로 채워 여백 손실 최소화
        // sm(640px) 이상에서는 기존 그라디언트 배경 위에 카드를 띄우는 구조 유지
        <div className={css({
            width: '100vw',
            marginLeft: 'calc(-50vw + 50%)',
            mt: { base: '-80px', md: '-88px' },
            mb: '-24px',
            minH: '100vh',
            display: 'flex',
            alignItems: { base: 'flex-start', sm: 'center' },
            justifyContent: 'center',
            bg: { base: 'white', sm: '#F7F7F7' },
            p: { base: '0', sm: '20px' },
        })}>
            <div className={css({
                bg: 'white',
                p: { base: '80px 24px 40px', sm: '48px' },
                borderRadius: { base: '0', sm: '24px' },
                boxShadow: { base: 'none', sm: '0 8px 28px rgba(0,0,0,0.12)' },
                maxW: { base: '100%', sm: '480px' },
                w: '100%',
                minH: { base: '100vh', sm: 'auto' },
                border: { base: 'none', sm: '1px solid #DDDDDD' },
            })}>
                <div className={css({ textAlign: 'center', mb: '32px' })}>
                    <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', mb: '24px' })}>
                        <Image src="/logo.png" alt="온여정 로고" width={32} height={32} priority />
                        <span className={css({ fontSize: '20px', fontWeight: '900', color: '#2C3A47', letterSpacing: '-0.02em' })}>온여정</span>
                    </div>
                    <h1 className={css({
                        fontSize: { base: '26px', sm: '32px' },
                        fontWeight: '800',
                        color: '#222',
                        mb: '12px',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.2,
                    })}>
                        반가워요! 다시 오셨네요.
                    </h1>
                    <p className={css({ fontSize: '16px', color: '#717171', wordBreak: 'keep-all' })}>
                        소중한 여행의 모든 순간, 온여정이 동행할게요.
                    </p>
                </div>

                <form onSubmit={handleLogin} className={css({ display: 'flex', flexDirection: 'column' })}>
                    <div className={css({ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        border: '1px solid #B0B0B0',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        mb: '16px'
                    })}>
                        <div className={css({ 
                            borderBottom: '1px solid #B0B0B0',
                            p: '12px 16px',
                            transition: 'all 0.2s',
                            position: 'relative',
                            _focusWithin: { bg: '#F0F9F8' }
                        })}>
                            {/* Focus Indicator Bar */}
                            <div className={css({ 
                                position: 'absolute', left: 0, top: 0, bottom: 0, w: '4px', 
                                bg: 'brand.primary', opacity: 0, transition: 'opacity 0.2s',
                                '.group:focus-within &': { opacity: 1 } 
                            })} />
                            <div className="group">
                                <label className={css({ display: 'block', fontSize: '11px', fontWeight: '800', color: '#222', mb: '2px', textTransform: 'uppercase' })}>
                                    이메일
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className={css({
                                        w: '100%',
                                        outline: 'none',
                                        fontSize: '15px',
                                        color: '#222',
                                        bg: 'transparent',
                                    })}
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div className={css({ 
                            p: '12px 16px',
                            transition: 'all 0.2s',
                            position: 'relative',
                            _focusWithin: { bg: '#F0F9F8' }
                        })}>
                            {/* Focus Indicator Bar */}
                            <div className={css({ 
                                position: 'absolute', left: 0, top: 0, bottom: 0, w: '4px', 
                                bg: 'brand.primary', opacity: 0, transition: 'opacity 0.2s',
                                '.group:focus-within &': { opacity: 1 } 
                            })} />
                            <div className="group">
                                <label className={css({ display: 'block', fontSize: '11px', fontWeight: '800', color: '#222', mb: '2px', textTransform: 'uppercase' })}>
                                    비밀번호
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className={css({
                                        w: '100%',
                                        outline: 'none',
                                        fontSize: '15px',
                                        color: '#222',
                                        bg: 'transparent',
                                    })}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    </div>

                    <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                        <div
                            onClick={() => setRememberEmail(!rememberEmail)}
                            className={css({
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                userSelect: 'none',
                                fontSize: '14px',
                                color: '#666',
                                transition: 'all 0.2s',
                                _hover: { color: '#172554' }
                            })}
                        >
                            <div className={css({
                                w: '18px',
                                h: '18px',
                                borderRadius: '4px',
                                border: '2px solid',
                                borderColor: rememberEmail ? '#2EC4B6' : '#ddd',
                                bg: rememberEmail ? '#2EC4B6' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            })}>
                                {rememberEmail && <div className={css({
                                    w: '5px',
                                    h: '9px',
                                    borderStyle: 'solid',
                                    borderWidth: '0 2px 2px 0',
                                    borderColor: 'white',
                                    transform: 'rotate(45deg)',
                                    mt: '-1px'
                                })} />}
                            </div>
                            아이디 기억하기
                        </div>
                    </div>

                    {message && (
                        <div className={css({
                            p: '14px',
                            bg: message.type === 'error' ? '#fdecea' : '#EAF9F7',
                            color: message.type === 'error' ? '#d93025' : '#249E93',
                            fontSize: '14px',
                            fontWeight: '500',
                            borderRadius: '16px',
                            border: `1px solid ${message.type === 'error' ? '#fbd0cc' : '#EAF9F7'}`
                        })}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={css({
                            w: '100%',
                            py: '14px',
                            bg: 'brand.primary',
                            color: 'white',
                            fontWeight: '800',
                            fontSize: '16px',
                            borderRadius: '16px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            _hover: { bg: 'brand.primaryDark', boxShadow: '0 8px 20px rgba(46, 196, 182, 0.3)' },
                            _active: { transform: 'scale(0.96)', boxShadow: '0 4px 10px rgba(46, 196, 182, 0.2)' },
                            _disabled: { opacity: 0.7, transform: 'none' },
                            mt: '8px',
                        })}
                    >
                        {loading ? <Loader2 size={20} className={css({ animation: 'spin 1s linear infinite' })} /> : (
                            <>여정 시작하기</>
                        )}
                    </button>
                </form>

                <div className={css({
                    mt: '28px',
                    pt: '20px',
                    borderTop: '1px solid #eee',
                    textAlign: 'center',
                    fontSize: '15px',
                    color: '#666'
                })}>
                    계정이 없으신가요?{' '}
                    <Link
                        href="/signup"
                        className={css({
                            color: '#222',
                            fontWeight: '800',
                            textDecoration: 'underline',
                            _hover: { color: '#000' },
                        })}
                    >
                        회원가입하기
                    </Link>
                </div>
            </div>
        </div>
    )
}
