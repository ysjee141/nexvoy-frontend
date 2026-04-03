'use client'

import { css } from 'styled-system/css'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SuccessContent() {
    const searchParams = useSearchParams()
    const isVerifiedOnly = searchParams.get('verified') === 'true'

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
            marginLeft: 'calc(-50vw + 50%)', // full viewport width escape
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
                    bg: '#EFF6FF',
                    color: '#2563EB',
                    borderRadius: '50%',
                    mx: 'auto',
                    mb: '24px'
                })}>
                    <CheckCircle2 size={32} />
                </div>
                <h1 className={css({
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#172554',
                    mb: '12px'
                })}>
                    이메일 인증 성공!
                </h1>
                <p className={css({
                    fontSize: '15px',
                    color: '#666',
                    mb: '32px',
                    lineHeight: 1.5,
                    wordBreak: 'keep-all'
                })}>
                    {isVerifiedOnly 
                        ? '이메일 인증이 완료되었습니다. 보안을 위해 다시 한 번 로그인해 주세요.'
                        : '환영합니다. 계정 인증이 성공적으로 완료되었습니다. 이제 온여정의 모든 기능을 이용하실 수 있습니다.'}
                </p>
                <Link
                    href={isVerifiedOnly ? '/login' : '/'}
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
                        _hover: { bg: '#333', transform: 'translateY(-2px)', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' },
                        _active: { transform: 'scale(0.98)' }
                    })}
                >
                    {isVerifiedOnly ? '로그인하러 가기' : '홈으로 이동'}
                </Link>
            </div>
        </div>
    )
}

export default function AuthSuccessPage() {
    return (
        <Suspense fallback={<div className={css({ minH: '100vh', bg: '#fbfbfb' })} />}>
            <SuccessContent />
        </Suspense>
    )
}
