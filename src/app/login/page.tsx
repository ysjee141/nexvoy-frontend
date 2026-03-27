'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import Link from 'next/link'
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
            setMessage({ type: 'error', text: error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 일치하지 않습니다.' : error.message })
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
            // 1280px max-width 컨테이너를 완전히 탈출하여 뷰포트 전체 너비를 채움
            width: '100vw',
            marginLeft: 'calc(-50vw + 50%)',
            mt: { base: '-80px', md: '-88px' },
            mb: '-24px',
            minH: '100vh',
            display: 'flex',
            alignItems: { base: 'flex-start', sm: 'center' },
            justifyContent: 'center',
            bg: { base: 'white', sm: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' },
            p: { base: '0', sm: '20px' },
        })}>
            <div className={css({
                bg: { base: 'white', sm: 'rgba(255, 255, 255, 0.9)' },
                backdropFilter: { base: 'none', sm: 'blur(10px)' },
                p: { base: '80px 20px 40px', sm: '40px 32px', md: '48px' },
                borderRadius: { base: '0', sm: '24px' },
                boxShadow: { base: 'none', sm: '0 20px 40px rgba(0,0,0,0.1)' },
                maxW: { base: '100%', sm: '440px' },
                w: '100%',
                minH: { base: '100vh', sm: 'auto' },
                border: { base: 'none', sm: '1px solid rgba(255, 255, 255, 0.3)' },
            })}>
                <div className={css({ textAlign: 'center', mb: '28px' })}>
                    <div className={css({
                        w: '60px',
                        h: '60px',
                        bg: '#10B981',
                        color: 'white',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: '16px',
                        boxShadow: '0 8px 16px rgba(66, 133, 244, 0.2)'
                    })}>
                        <LogIn size={28} />
                    </div>
                    <h1 className={css({
                        fontSize: { base: '24px', sm: '28px' },
                        fontWeight: '800',
                        color: '#022C22',
                        mb: '8px',
                        letterSpacing: '-0.02em',
                        wordBreak: 'keep-all',
                        lineHeight: 1.3,
                    })}>
                        반가워요! 다시 오셨네요.
                    </h1>
                    <p className={css({ fontSize: { base: '14px', sm: '15px' }, color: '#666', lineHeight: 1.5, wordBreak: 'keep-all' })}>
                        OnVoy와 함께 당신의 모험을 기록해 보세요.
                    </p>
                </div>

                <form onSubmit={handleLogin} className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                        <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: '#444' })}>
                            <Mail size={16} /> 이메일
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={css({
                                w: '100%',
                                p: '13px 16px',
                                bg: '#f9f9f9',
                                border: '1px solid #eee',
                                borderRadius: '12px',
                                outline: 'none',
                                transition: 'all 0.2s',
                                fontSize: '15px',
                                _focus: { bg: 'white', borderColor: '#10B981', boxShadow: '0 0 0 4px rgba(66, 133, 244, 0.1)' },
                            })}
                            placeholder="you@example.com"
                        />
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                        <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: '#444' })}>
                            <Lock size={16} /> 비밀번호
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className={css({
                                w: '100%',
                                p: '13px 16px',
                                bg: '#f9f9f9',
                                border: '1px solid #eee',
                                borderRadius: '12px',
                                outline: 'none',
                                transition: 'all 0.2s',
                                fontSize: '15px',
                                _focus: { bg: 'white', borderColor: '#10B981', boxShadow: '0 0 0 4px rgba(66, 133, 244, 0.1)' },
                            })}
                            placeholder="••••••••"
                        />
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
                                _hover: { color: '#022C22' }
                            })}
                        >
                            <div className={css({
                                w: '18px',
                                h: '18px',
                                borderRadius: '4px',
                                border: '2px solid',
                                borderColor: rememberEmail ? '#10B981' : '#ddd',
                                bg: rememberEmail ? '#10B981' : 'transparent',
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
                            bg: message.type === 'error' ? '#fdecea' : '#e6f4ea',
                            color: message.type === 'error' ? '#d93025' : '#1e8e3e',
                            fontSize: '14px',
                            fontWeight: '500',
                            borderRadius: '10px',
                            border: `1px solid ${message.type === 'error' ? '#fbd0cc' : '#ceead6'}`
                        })}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={css({
                            w: '100%',
                            py: '15px',
                            bg: '#111',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            borderRadius: '12px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            _hover: { bg: '#333', transform: 'translateY(-2px)', boxShadow: '0 8px 20px rgba(0,0,0,0.15)' },
                            _active: { transform: 'translateY(0)' },
                            _disabled: { opacity: 0.7, transform: 'none' },
                            mt: '4px',
                        })}
                    >
                        {loading ? <Loader2 size={20} className={css({ animation: 'spin 1s linear infinite' })} /> : (
                            <>로그인 <ArrowRight size={18} /></>
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
                            color: '#10B981',
                            fontWeight: '700',
                            textDecoration: 'none',
                            _hover: { textDecoration: 'underline' },
                        })}
                    >
                        회원가입하기
                    </Link>
                </div>
            </div>
        </div>
    )
}
