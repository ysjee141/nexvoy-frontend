'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')
        const supabase = createClient()

        if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${location.origin}/auth/callback`,
                },
            })
            if (error) {
                setMessage(error.message)
            } else {
                setMessage('가입 확인 이메일이 발송되었습니다. 이메일을 확인해 주세요.')
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) {
                setMessage(error.message)
            } else {
                window.location.href = '/'
            }
        }
        setLoading(false)
    }

    return (
        <div
            className={css({
                minH: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bg: '#f8f9fa',
            })}
        >
            <div
                className={css({
                    p: '40px',
                    bg: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    maxW: '400px',
                    w: '100%',
                })}
            >
                <h1
                    className={css({
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#333',
                        mb: '8px',
                        textAlign: 'center',
                    })}
                >
                    여행의 시작
                </h1>
                <p
                    className={css({
                        fontSize: '14px',
                        color: '#666',
                        mb: '32px',
                        textAlign: 'center',
                    })}
                >
                    Travel Planner와 함께 완벽한 일정을 만드세요
                </p>

                <form onSubmit={handleAuth} className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
                    <div>
                        <label className={css({ display: 'block', fontSize: '14px', mb: '4px', color: '#555' })}>이메일</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={css({
                                w: '100%',
                                p: '12px',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                outline: 'none',
                                _focus: { borderColor: '#4285F4' },
                            })}
                            placeholder="you@example.com"
                        />
                    </div>
                    <div>
                        <label className={css({ display: 'block', fontSize: '14px', mb: '4px', color: '#555' })}>비밀번호</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className={css({
                                w: '100%',
                                p: '12px',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                outline: 'none',
                                _focus: { borderColor: '#4285F4' },
                            })}
                            placeholder="••••••••"
                        />
                    </div>

                    {message && (
                        <div className={css({ p: '12px', bg: '#f1f3f4', color: '#333', fontSize: '14px', borderRadius: '8px' })}>
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={css({
                            w: '100%',
                            py: '12px',
                            bg: '#4285F4',
                            color: 'white',
                            fontWeight: 'bold',
                            borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1,
                            transition: 'background 0.2s',
                            _hover: { bg: '#3367D6' },
                            mt: '8px',
                        })}
                    >
                        {isSignUp ? '회원가입' : '로그인'}
                    </button>
                </form>

                <div className={css({ mt: '24px', textAlign: 'center', fontSize: '14px', color: '#666' })}>
                    {isSignUp ? '이미 계정이 있으신가요?' : '계정이 없으신가요?'}{' '}
                    <button
                        type="button"
                        onClick={() => {
                            setIsSignUp(!isSignUp)
                            setMessage('')
                        }}
                        className={css({
                            color: '#4285F4',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            bg: 'transparent',
                            border: 'none',
                            _hover: { textDecoration: 'underline' },
                        })}
                    >
                        {isSignUp ? '로그인하기' : '회원가입하기'}
                    </button>
                </div>
            </div>
        </div>
    )
}
