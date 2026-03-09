'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { LogIn, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
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
            window.location.href = '/'
        }
    }

    return (
        <div className={css({
            minH: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            p: '20px'
        })}>
            <div className={css({
                bg: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                p: { base: '32px 24px', md: '48px' },
                borderRadius: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                maxW: '440px',
                w: '100%',
                border: '1px solid rgba(255, 255, 255, 0.3)'
            })}>
                <div className={css({ textAlign: 'center', mb: '32px' })}>
                    <div className={css({
                        w: '64px',
                        h: '64px',
                        bg: '#4285F4',
                        color: 'white',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: '20px',
                        boxShadow: '0 8px 16px rgba(66, 133, 244, 0.2)'
                    })}>
                        <LogIn size={32} />
                    </div>
                    <h1 className={css({ fontSize: '28px', fontWeight: '800', color: '#111', mb: '8px', letterSpacing: '-0.02em' })}>
                        반가워요! 다시 오셨네요.
                    </h1>
                    <p className={css({ fontSize: '15px', color: '#666', lineHeight: 1.5 })}>
                        Next Voyage와 함께 당신의 모험을 기록해 보세요.
                    </p>
                </div>

                <form onSubmit={handleLogin} className={css({ display: 'flex', flexDirection: 'column', gap: '20px' })}>
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
                                p: '14px 16px',
                                bg: '#f9f9f9',
                                border: '1px solid #eee',
                                borderRadius: '12px',
                                outline: 'none',
                                transition: 'all 0.2s',
                                fontSize: '15px',
                                _focus: { bg: 'white', borderColor: '#4285F4', boxShadow: '0 0 0 4px rgba(66, 133, 244, 0.1)' },
                            })}
                            placeholder="you@example.com"
                        />
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                        <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                            <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: '#444' })}>
                                <Lock size={16} /> 비밀번호
                            </label>
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className={css({
                                w: '100%',
                                p: '14px 16px',
                                bg: '#f9f9f9',
                                border: '1px solid #eee',
                                borderRadius: '12px',
                                outline: 'none',
                                transition: 'all 0.2s',
                                fontSize: '15px',
                                _focus: { bg: 'white', borderColor: '#4285F4', boxShadow: '0 0 0 4px rgba(66, 133, 244, 0.1)' },
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
                                _hover: { color: '#111' }
                            })}
                        >
                            <div className={css({
                                w: '18px',
                                h: '18px',
                                borderRadius: '4px',
                                border: '2px solid',
                                borderColor: rememberEmail ? '#4285F4' : '#ddd',
                                bg: rememberEmail ? '#4285F4' : 'transparent',
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
                            py: '16px',
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
                            mt: '8px',
                        })}
                    >
                        {loading ? <Loader2 size={20} className={css({ animation: 'spin 1s linear infinite' })} /> : (
                            <>로그인 <ArrowRight size={18} /></>
                        )}
                    </button>
                </form>

                <div className={css({
                    mt: '32px',
                    pt: '24px',
                    borderTop: '1px solid #eee',
                    textAlign: 'center',
                    fontSize: '15px',
                    color: '#666'
                })}>
                    계정이 없으신가요?{' '}
                    <Link
                        href="/signup"
                        className={css({
                            color: '#4285F4',
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
