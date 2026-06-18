'use client'

import { css } from 'styled-system/css'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ErrorContent() {
    const searchParams = useSearchParams()
    const message = searchParams.get('message')

    let displayMessage = '인증 링크가 유효하지 않거나 만료되었습니다.'
    if (message === 'invalid_code') {
        displayMessage = '인증 코드가 유효하지 않습니다.'
    } else if (message) {
        // Supabase sends error_description which could be in english, but we can display it directly
        // However, usually we can map known errors
        displayMessage = message
    }

    return (
        <div className={css({
            minH: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: '#fbfbfb',
            p: '20px',
            mt: { base: '-80px', md: '-88px' }, // Navbar offset
            width: '100vw',
            marginLeft: 'calc(-50vw + 50%)',
        })}>
            <div className={css({
                bg: 'white',
                p: { base: '40px 24px', sm: '48px' },
                borderRadius: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.06)',
                textAlign: 'center',
                maxW: '400px',
                w: '100%'
            })}>
                <div className={css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    w: '64px',
                    h: '64px',
                    bg: '#fee2e2',
                    color: '#dc2626',
                    borderRadius: '50%',
                    mx: 'auto',
                    mb: '24px'
                })}>
                    <AlertCircle size={32} />
                </div>
                <h1 className={css({
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#172554',
                    mb: '12px'
                })}>
                    인증 실패
                </h1>
                <p className={css({
                    fontSize: '15px',
                    color: '#666',
                    mb: '32px',
                    lineHeight: 1.5,
                    wordBreak: 'keep-all'
                })}>
                    {displayMessage}
                    <br />
                    가입을 다시 시도하시거나 로그인해 주세요.
                </p>
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                    <Link
                        href="/login"
                        className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            w: '100%',
                            py: '16px',
                            bg: '#111',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            borderRadius: '14px',
                            textDecoration: 'none',
                            transition: 'all 0.2s',
                            _hover: { bg: '#333', transform: 'translateY(-2px)' },
                            _active: { transform: 'scale(0.98)' }
                        })}
                    >
                        로그인 하기
                    </Link>
                    <Link
                        href="/"
                        className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            w: '100%',
                            py: '16px',
                            bg: '#f1f3f4',
                            color: '#555',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            borderRadius: '14px',
                            textDecoration: 'none',
                            transition: 'all 0.2s',
                            _hover: { bg: '#e8eaed' }
                        })}
                    >
                        홈으로 돌아가기
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={<div className={css({ minH: '100vh', bg: '#fbfbfb' })} />}>
            <ErrorContent />
        </Suspense>
    )
}
