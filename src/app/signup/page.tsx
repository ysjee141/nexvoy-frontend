'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import Link from 'next/link'
import { UserPlus, Mail, Lock, Sparkles, Loader2, CheckCircle2, Eye, EyeOff, Check, ArrowRight } from 'lucide-react'
import TermsModal from './TermsModal'

export default function SignUpPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [termsAgreed, setTermsAgreed] = useState(false)
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false)
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    // Inline validations
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    const isPasswordValid = password.length >= 6
    const isConfirmPasswordValid = isPasswordValid && password === confirmPassword

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isEmailValid || !isConfirmPasswordValid) return
        
        setLoading(true)
        setMessage(null)
        const supabase = createClient()

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                // 앱 빌드 시에는 Vercel (NEXT_PUBLIC_APP_URL)로 리다이렉트 하여 서버 라우트(/auth/callback)를 타도록 함
                // 모바일 환경(Capacitor)에서 location.origin이 http://localhost로 잡히는 문제를 방지하기 위해 명시적 폴백을 둡니다.
                emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' && location.origin.includes('localhost:3000') ? location.origin : 'https://app.nexvoy.xyz')}/auth/callback?next=/auth/success`,
            },
        })

        if (error) {
            setMessage({ type: 'error', text: error.message })
        } else if (data?.user?.identities && data.user.identities.length === 0) {
            setMessage({ type: 'error', text: '이미 가입된 이메일 주소입니다. 로그인하거나 다른 이메일을 사용해 주세요.' })
        } else {
            setIsSuccess(true)
        }
        setLoading(false)
    }

    if (isSuccess) {
        return (
            <div className={css({ width: '100vw', marginLeft: 'calc(-50vw + 50%)', mt: { base: '-80px', md: '-88px' }, mb: '-24px', minH: '100vh', display: 'flex', alignItems: { base: 'flex-start', sm: 'center' }, justifyContent: 'center', bg: '#f9f9fc', p: { base: '0', sm: '20px' } })}>
                <div className={css({ bg: 'white', p: { base: '80px 20px 40px', sm: '48px' }, borderRadius: { base: '0', sm: '24px' }, boxShadow: { base: 'none', sm: '0 20px 40px rgba(0,0,0,0.08)' }, maxW: '440px', w: '100%', minH: { base: '100vh', sm: 'auto' }, textAlign: 'center' })}>
                    <div className={css({ w: '80px', h: '80px', bg: '#e6f4ea', color: '#34A853', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: '24px' })}>
                        <Mail size={40} />
                    </div>
                    <h2 className={css({ fontSize: '24px', fontWeight: '800', color: '#111', mb: '12px' })}>이메일함을 확인해주세요</h2>
                    <p className={css({ fontSize: '15px', color: '#666', lineHeight: 1.6, mb: '32px', wordBreak: 'keep-all' })}>
                        <strong>{email}</strong> 주소로 가입 인증 메일을 발송했습니다.<br />메일 내의 인증 링크를 클릭하시면 가입이 완료됩니다.
                    </p>
                    <Link href="/login" className={css({ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#4285F4', fontWeight: '600', fontSize: '15px', _hover: { textDecoration: 'underline' } })}>
                        로그인 페이지로 돌아가기 <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        )
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
                        <div className={css({ position: 'relative' })}>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className={css({
                                    w: '100%',
                                    p: '13px 16px',
                                    pr: '40px',
                                    bg: '#f9f9f9',
                                    border: '1px solid',
                                    borderColor: email.length > 0 ? (isEmailValid ? '#34A853' : '#eee') : '#eee',
                                    borderRadius: '12px',
                                    outline: 'none',
                                    transition: 'all 0.2s',
                                    fontSize: '15px',
                                    _focus: { bg: 'white', borderColor: '#34A853', boxShadow: '0 0 0 4px rgba(52, 168, 83, 0.1)' },
                                })}
                                placeholder="you@example.com"
                            />
                            {isEmailValid && <Check size={18} color="#34A853" className={css({ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' })} />}
                        </div>
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                        <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: '#444' })}>
                            <Lock size={16} /> 비밀번호
                        </label>
                        <div className={css({ position: 'relative' })}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className={css({
                                    w: '100%',
                                    p: '13px 16px',
                                    pr: '44px',
                                    bg: '#f9f9f9',
                                    border: '1px solid',
                                    borderColor: password.length > 0 ? (isPasswordValid ? '#34A853' : '#d93025') : '#eee',
                                    borderRadius: '12px',
                                    outline: 'none',
                                    transition: 'all 0.2s',
                                    fontSize: '15px',
                                    _focus: { bg: 'white', borderColor: '#34A853', boxShadow: '0 0 0 4px rgba(52, 168, 83, 0.1)' },
                                })}
                                placeholder="6자리 이상 입력해 주세요"
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className={css({ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', bg: 'transparent', border: 'none', cursor: 'pointer', p: '4px', color: '#666', _hover: { color: '#111' } })}>
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
                        <label className={css({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: '#444' })}>
                            <CheckCircle2 size={16} /> 비밀번호 확인
                        </label>
                        <div className={css({ position: 'relative' })}>
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                className={css({
                                    w: '100%',
                                    p: '13px 16px',
                                    pr: '44px',
                                    bg: '#f9f9f9',
                                    border: '1px solid',
                                    borderColor: confirmPassword.length > 0 ? (isConfirmPasswordValid ? '#34A853' : '#d93025') : '#eee',
                                    borderRadius: '12px',
                                    outline: 'none',
                                    transition: 'all 0.2s',
                                    fontSize: '15px',
                                    _focus: { bg: 'white', borderColor: '#34A853', boxShadow: '0 0 0 4px rgba(52, 168, 83, 0.1)' },
                                })}
                                placeholder="비밀번호를 다시 한 번 입력해 주세요"
                            />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={css({ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', bg: 'transparent', border: 'none', cursor: 'pointer', p: '4px', color: '#666', _hover: { color: '#111' } })}>
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
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
                            border: `1px solid ${message.type === 'error' ? '#fbd0cc' : '#ceead6'}`,
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'flex-start'
                        })}>
                            {message.type === 'success' && <CheckCircle2 size={18} className={css({ flexShrink: 0 })} />}
                            {message.text}
                        </div>
                    )}

                    <div className={css({ mt: '4px', mb: '8px', display: 'flex', alignItems: 'center', gap: '8px' })}>
                        <input
                            type="checkbox"
                            id="terms"
                            checked={termsAgreed}
                            onChange={(e) => setTermsAgreed(e.target.checked)}
                            className={css({ w: '18px', h: '18px', cursor: 'pointer', accentColor: '#34A853', flexShrink: 0 })}
                        />
                        <div className={css({ fontSize: '14px', color: '#555', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' })}>
                            <button type="button" onClick={() => setIsTermsModalOpen(true)} className={css({ color: '#34A853', fontWeight: '600', textDecoration: 'underline', bg: 'transparent', border: 'none', cursor: 'pointer', p: 0 })}>
                                이용약관 및 개인정보 처리방침
                            </button>
                            <label htmlFor="terms" className={css({ cursor: 'pointer', userSelect: 'none' })}>
                                에 동의합니다. (필수)
                            </label>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !termsAgreed || !isEmailValid || !isConfirmPasswordValid}
                        className={css({
                            w: '100%',
                            py: '15px',
                            bg: '#34A853',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            _hover: { bg: '#2d8a45', transform: 'translateY(-2px)', boxShadow: '0 8px 20px rgba(52, 168, 83, 0.2)' },
                            _active: { transform: 'translateY(0)' },
                            _disabled: { opacity: 0.5, cursor: 'not-allowed', bg: '#a5d6a7', transform: 'none', boxShadow: 'none', pointerEvents: 'none' },
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

            <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />
        </div>
    )
}
