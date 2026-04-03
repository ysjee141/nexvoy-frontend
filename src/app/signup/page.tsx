'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { css } from 'styled-system/css'
import Link from 'next/link'
import Image from 'next/image'
import { UserPlus, Mail, Lock, Sparkles, Loader2, CheckCircle2, Eye, EyeOff, Check, ArrowRight } from 'lucide-react'
import TermsModal from './TermsModal'

export default function SignUpPage() {
    const [email, setEmail] = useState('')
    const [nickname, setNickname] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [termsAgreed, setTermsAgreed] = useState(false)
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false)
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [touched, setTouched] = useState({ email: false, password: false, confirmPassword: false })

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

        // 닉네임 중복 체크 (입력한 경우에만)
        if (nickname.trim()) {
            const { data: existingNickname } = await supabase
                .from('profiles')
                .select('nickname')
                .ilike('nickname', nickname.trim())
                .maybeSingle()

            if (existingNickname) {
                setMessage({ type: 'error', text: '아쉽게도 이 멋진 이름은 이미 다른 분이 쓰고 있네요! 다른 이름을 시도해 볼까요?' })
                setLoading(false)
                return
            }
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: nickname.trim() || null
                },
                // 앱 빌드 시에는 Vercel (NEXT_PUBLIC_APP_URL)로 리다이렉트 하여 서버 라우트(/auth/callback)를 타도록 함
                // 모바일 환경(Capacitor)에서 location.origin이 http://localhost로 잡히는 문제를 방지하기 위해 명시적 폴백을 둡니다.
                emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' && location.origin.includes('localhost:3000') ? location.origin : 'https://app.nexvoy.xyz')}/auth/callback?next=/auth/success`,
            },
        })

        if (error) {
            setMessage({ type: 'error', text: error.message })
        } else if (data?.user?.identities && data.user.identities.length === 0) {
            setMessage({ type: 'error', text: '이미 온여정의 식구인 이메일이에요! 로그인하시거나 다른 메일을 사용해 주세요.' })
        } else {
            setIsSuccess(true)
        }
        setLoading(false)
    }

    if (isSuccess) {
        return (
            <div className={css({ width: '100vw', marginLeft: 'calc(-50vw + 50%)', mt: { base: '-80px', md: '-88px' }, mb: '-24px', minH: '100vh', display: 'flex', alignItems: { base: 'flex-start', sm: 'center' }, justifyContent: 'center', bg: '#F7F7F7', p: { base: '0', sm: '20px' } })}>
                <div className={css({ bg: 'white', p: { base: '80px 24px 40px', sm: '48px' }, borderRadius: { base: '0', sm: '24px' }, boxShadow: { base: 'none', sm: '0 8px 28px rgba(0,0,0,0.12)' }, maxW: '480px', w: '100%', minH: { base: '100vh', sm: 'auto' }, textAlign: 'center', border: { base: 'none', sm: '1px solid #DDDDDD' } })}>
                    <div className={css({ w: '80px', h: '80px', bg: '#F7F7F7', color: '#222', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: '24px' })}>
                        <Mail size={40} />
                    </div>
                    <h2 className={css({ fontSize: '26px', fontWeight: '700', color: '#222', mb: '12px', letterSpacing: '-0.02em' })}>메일함을 확인해 주세요! 💌</h2>
                    <p className={css({ fontSize: '15px', color: '#666', lineHeight: 1.6, mb: '32px', wordBreak: 'keep-all' })}>
                        <strong>{email}</strong> 주소로 소중한 인증 메일을 보냈어요.<br />메일함에서 확인 버튼만 누르면, 우리는 이제 소중한 인연이에요!
                    </p>
                    <Link href="/login" className={css({ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#222', fontWeight: '700', fontSize: '15px', textDecoration: 'underline' })}>
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
                        <span className={css({ fontSize: '20px', fontWeight: '700', color: '#172554', letterSpacing: '-0.02em' })}>온여정</span>
                    </div>
                    <h1 className={css({
                        fontSize: { base: '26px', sm: '32px' },
                        fontWeight: '700',
                        color: '#222',
                        mb: '12px',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.2,
                    })}>
                        함께 떠날 준비가 되셨나요?
                    </h1>
                    <p className={css({ fontSize: '16px', color: '#717171', wordBreak: 'keep-all' })}>
                        설레는 여행의 첫 걸음, 온여정과 함께 시작해 보세요.
                    </p>
                </div>

                <form onSubmit={handleSignUp} className={css({ display: 'flex', flexDirection: 'column' })}>
                    <div className={css({ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        border: '1px solid #B0B0B0',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        mb: '16px'
                    })}>
                        {/* 닉네임 필드 (선택 사항) */}
                        <div className={css({ 
                            borderBottom: '1px solid #B0B0B0',
                            p: '12px 16px',
                            transition: 'all 0.2s',
                            position: 'relative',
                            _focusWithin: { bg: 'blue.50' }
                        })}>
                            <div className={css({ 
                                position: 'absolute', left: 0, top: 0, bottom: 0, w: '4px', 
                                bg: 'brand.primary', 
                                opacity: 0, 
                                transition: 'all 0.2s',
                                '.nick-group:focus-within &': { opacity: 1 } 
                            })} />
                            <div className="nick-group">
                                <label className={css({ display: 'block', fontSize: '11px', fontWeight: '700', color: '#222', mb: '2px', textTransform: 'uppercase' })}>
                                    닉네임 <span className={css({ fontWeight: '400', color: '#717171', ml: '4px' })}>(선택 사항)</span>
                                </label>
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    className={css({
                                        w: '100%',
                                        outline: 'none',
                                        fontSize: '15px',
                                        color: '#222',
                                        bg: 'transparent',
                                    })}
                                    placeholder="별명을 입력해 주세요"
                                />
                            </div>
                        </div>

                        <div className={css({ 
                            borderBottom: '1px solid #B0B0B0',
                            p: '12px 16px',
                            transition: 'all 0.2s',
                            position: 'relative',
                            _focusWithin: { bg: touched.email && !isEmailValid ? '#fff1f0' : 'blue.50' }
                        })}>
                            {/* Focus/Error Indicator Bar */}
                            <div className={css({ 
                                position: 'absolute', left: 0, top: 0, bottom: 0, w: '4px', 
                                bg: touched.email && !isEmailValid ? '#ff4d4f' : 'brand.primary', 
                                opacity: (touched.email && !isEmailValid) ? 1 : 0, 
                                transition: 'all 0.2s',
                                '.email-group:focus-within &': { opacity: 1 } 
                            })} />
                            <div className="email-group">
                                <label className={css({ display: 'block', fontSize: '11px', fontWeight: '700', color: touched.email && !isEmailValid ? '#ff4d4f' : '#222', mb: '2px', textTransform: 'uppercase' })}>
                                    이메일
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
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
                                {touched.email && !isEmailValid && (
                                    <p className={css({ fontSize: '11px', color: '#ff4d4f', mt: '4px', fontWeight: '600' })}>유효한 이메일 주소를 입력해 주세요.</p>
                                )}
                            </div>
                        </div>

                        <div className={css({ 
                            borderBottom: '1px solid #B0B0B0',
                            p: '12px 16px',
                            transition: 'all 0.2s',
                            position: 'relative',
                            _focusWithin: { bg: touched.password && !isPasswordValid ? '#fff1f0' : 'blue.50' }
                        })}>
                            {/* Focus/Error Indicator Bar */}
                            <div className={css({ 
                                position: 'absolute', left: 0, top: 0, bottom: 0, w: '4px', 
                                bg: touched.password && !isPasswordValid ? '#ff4d4f' : 'brand.primary', 
                                opacity: (touched.password && !isPasswordValid) ? 1 : 0, 
                                transition: 'all 0.2s',
                                '.pw-group:focus-within &': { opacity: 1 } 
                            })} />
                            <div className="pw-group">
                                <label className={css({ display: 'block', fontSize: '11px', fontWeight: '700', color: touched.password && !isPasswordValid ? '#ff4d4f' : '#222', mb: '2px', textTransform: 'uppercase' })}>
                                    비밀번호
                                </label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                                    required
                                    minLength={6}
                                    className={css({
                                        w: '100%',
                                        outline: 'none',
                                        fontSize: '15px',
                                        color: '#222',
                                        bg: 'transparent',
                                    })}
                                    placeholder="6자리 이상 입력해 주세요"
                                />
                                {touched.password && !isPasswordValid && (
                                    <p className={css({ fontSize: '11px', color: '#ff4d4f', mt: '4px', fontWeight: '600' })}>6자리 이상 입력해 주세요.</p>
                                )}
                            </div>
                        </div>

                        <div className={css({ 
                            p: '12px 16px',
                            transition: 'all 0.2s',
                            position: 'relative',
                            _focusWithin: { bg: touched.confirmPassword && !isConfirmPasswordValid ? '#fff1f0' : 'blue.50' }
                        })}>
                            {/* Focus/Error Indicator Bar */}
                            <div className={css({ 
                                position: 'absolute', left: 0, top: 0, bottom: 0, w: '4px', 
                                bg: touched.confirmPassword && !isConfirmPasswordValid ? '#ff4d4f' : 'brand.primary', 
                                opacity: (touched.confirmPassword && !isConfirmPasswordValid) ? 1 : 0, 
                                transition: 'all 0.2s',
                                '.cpw-group:focus-within &': { opacity: 1 } 
                            })} />
                            <div className="cpw-group">
                                <label className={css({ display: 'block', fontSize: '11px', fontWeight: '700', color: touched.confirmPassword && !isConfirmPasswordValid ? '#ff4d4f' : '#222', mb: '2px', textTransform: 'uppercase' })}>
                                    비밀번호 확인
                                </label>
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))}
                                    required
                                    minLength={6}
                                    className={css({
                                        w: '100%',
                                        outline: 'none',
                                        fontSize: '15px',
                                        color: '#222',
                                        bg: 'transparent',
                                    })}
                                    placeholder="비밀번호를 다시 한 번 입력해 주세요"
                                />
                                {touched.confirmPassword && !isConfirmPasswordValid && (
                                    <p className={css({ fontSize: '11px', color: '#ff4d4f', mt: '4px', fontWeight: '600' })}>비밀번호가 일치하지 않습니다.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {message && (
                        <div className={css({
                            p: '14px',
                            bg: message.type === 'error' ? '#fdecea' : '#EFF6FF',
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

                    <div className={css({ mb: '16px', display: 'flex', alignItems: 'center', gap: '10px' })}>
                        <input
                            type="checkbox"
                            id="terms"
                            checked={termsAgreed}
                            onChange={(e) => setTermsAgreed(e.target.checked)}
                            className={css({ w: '20px', h: '20px', cursor: 'pointer', accentColor: '#222', flexShrink: 0 })}
                        />
                        <div className={css({ fontSize: '14px', color: '#484848', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' })}>
                            <button type="button" onClick={() => setIsTermsModalOpen(true)} className={css({ color: '#222', fontWeight: '700', textDecoration: 'underline', bg: 'transparent', border: 'none', cursor: 'pointer', p: 0 })}>
                                이용약관 및 개인정보 처리방침
                            </button>
                            <label htmlFor="terms" className={css({ cursor: 'pointer', userSelect: 'none' })}>
                                에 동의해요 (필수)
                            </label>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !termsAgreed || !isEmailValid || !isConfirmPasswordValid}
                        className={css({
                            w: '100%',
                            py: '14px',
                            bg: 'brand.primary',
                            color: 'white',
                            fontWeight: '700',
                            fontSize: '16px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            _hover: { bg: 'brand.primaryDark', boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)' },
                            _active: { transform: 'scale(0.96)', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)' },
                            _disabled: { opacity: 0.5, cursor: 'not-allowed', bg: '#DDDDDD', transform: 'none', boxShadow: 'none', pointerEvents: 'none' },
                            mt: '8px',
                        })}
                    >
                        {loading ? <Loader2 size={20} className={css({ animation: 'spin 1s linear infinite' })} /> : (
                            <>회원가입하기</>
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
                            color: '#222',
                            fontWeight: '700',
                            textDecoration: 'underline',
                            _hover: { color: '#000' },
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
