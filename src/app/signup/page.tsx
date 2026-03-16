'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { UserPlus, Mail, Lock, Sparkles, Loader2, CheckCircle2 } from 'lucide-react'

export default function SignUpPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
    const [loading, setLoading] = useState(false)

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)
        const supabase = createClient()

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                // 앱 빌드 시에는 Vercel (NEXT_PUBLIC_APP_URL)로 리다이렉트 하여 서버 라우트(/auth/callback)를 타도록 함
                emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || location.origin}/auth/callback`,
            },
        })

        if (error) {
            setMessage({ type: 'error', text: error.message })
        } else {
            setMessage({ type: 'success', text: '가입 확인 이메일이 발송되었습니다. 이메일을 확인해 주세요!' })
        }
        setLoading(false)
    }

    return (
        // 로그인 페이지와 동일한 전략
        // sm 미만(모바일): 배경/카드 통합, 전체 화면 사용
        // sm 이상(데스크탑): 기존 그라디언트 배경 + 카드 구조 유지
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
            bg: { base: 'white', sm: 'linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%)' },
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
                        bg: '#34A853',
                        color: 'white',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: '16px',
                        boxShadow: '0 8px 16px rgba(52, 168, 83, 0.2)'
                    })}>
                        <UserPlus size={28} />
                    </div>
                    <h1 className={css({
                        fontSize: { base: '24px', sm: '28px' },
                        fontWeight: '800',
                        color: '#111',
                        mb: '8px',
                        letterSpacing: '-0.02em',
                        wordBreak: 'keep-all',
                        lineHeight: 1.3,
                    })}>
                        새로운 여행의 시작 🌿
                    </h1>
                    <p className={css({ fontSize: { base: '14px', sm: '15px' }, color: '#666', lineHeight: 1.5, wordBreak: 'keep-all' })}>
                        Onvoy와 함께 당신만의 특별한 일정을 만들어보세요.
                    </p>
                </div>

                <form onSubmit={handleSignUp} className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
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
                                _focus: { bg: 'white', borderColor: '#34A853', boxShadow: '0 0 0 4px rgba(52, 168, 83, 0.1)' },
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
                            minLength={6}
                            className={css({
                                w: '100%',
                                p: '13px 16px',
                                bg: '#f9f9f9',
                                border: '1px solid #eee',
                                borderRadius: '12px',
                                outline: 'none',
                                transition: 'all 0.2s',
                                fontSize: '15px',
                                _focus: { bg: 'white', borderColor: '#34A853', boxShadow: '0 0 0 4px rgba(52, 168, 83, 0.1)' },
                            })}
                            placeholder="6자리 이상 입력해 주세요"
                        />
                    </div>

                    {message && (
                        <div className={css({
                            p: '14px',
                            bg: message.type === 'error' ? '#fdecea' : '#e6f4ea',
                            color: message.type === 'error' ? '#d93025' : '#1e8e3e',
                            fontSize: '14px',
                            fontWeight: '500',
                            borderRadius: '10px',
                            border: `1px solid ${message.type === 'error' ? '#fbd0cc' : '#ceead6'}`,
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'flex-start'
                        })}>
                            {message.type === 'success' && <CheckCircle2 size={18} className={css({ flexShrink: 0 })} />}
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={css({
                            w: '100%',
                            py: '15px',
                            bg: '#34A853',
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
                            _hover: { bg: '#2d8a45', transform: 'translateY(-2px)', boxShadow: '0 8px 20px rgba(52, 168, 83, 0.2)' },
                            _active: { transform: 'translateY(0)' },
                            _disabled: { opacity: 0.7, transform: 'none' },
                            mt: '4px',
                        })}
                    >
                        {loading ? <Loader2 size={20} className={css({ animation: 'spin 1s linear infinite' })} /> : (
                            <>무료로 시작하기 <Sparkles size={18} /></>
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
                    이미 계정이 있으신가요?{' '}
                    <Link
                        href="/login"
                        className={css({
                            color: '#34A853',
                            fontWeight: '700',
                            textDecoration: 'none',
                            _hover: { textDecoration: 'underline' },
                        })}
                    >
                        로그인하기
                    </Link>
                </div>
            </div>
        </div>
    )
}
