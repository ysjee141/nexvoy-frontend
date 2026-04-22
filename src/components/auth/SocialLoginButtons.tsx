'use client'

import { useState } from 'react'
import { css } from 'styled-system/css'
import { Loader2 } from 'lucide-react'
import { AuthService } from '@/services/AuthService'

interface SocialLoginButtonsProps {
  disabled?: boolean
  onError?: (message: string) => void
}

// Google 공식 SVG 아이콘
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

// 카카오 공식 SVG 아이콘
const KakaoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.73 1.6 5.13 4.02 6.6L5.1 21l4.46-2.95c.79.13 1.61.2 2.44.2 5.52 0 10-3.48 10-7.8C22 6.48 17.52 3 12 3z" fill="#371D1E" />
  </svg>
)

export default function SocialLoginButtons({ disabled = false, onError }: SocialLoginButtonsProps) {
  const [googleLoading, setGoogleLoading] = useState(false)
  const [kakaoLoading, setKakaoLoading] = useState(false)

  const handleGoogle = async () => {
    if (googleLoading || disabled) return
    setGoogleLoading(true)
    try {
      await AuthService.signInWithGoogle()
    } catch (err) {
      const msg = AuthService.normalizeOAuthError(err)
      onError?.(msg)
      setGoogleLoading(false)
    }
  }

  const handleKakao = () => {
    if (kakaoLoading || disabled) return
    setKakaoLoading(true)
    try {
      AuthService.signInWithKakao()
      // 페이지 이동 후 로딩 해제 불필요 (리다이렉트됨)
    } catch (err) {
      const msg = AuthService.normalizeOAuthError(err)
      onError?.(msg)
      setKakaoLoading(false)
    }
  }

  const buttonBase = css({
    w: '100%',
    h: '50px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    borderRadius: '14px',
    fontWeight: '600',
    fontSize: '15px',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
    _active: { transform: 'scale(0.97)' },
    _disabled: { opacity: 0.5, cursor: 'not-allowed', transform: 'none', pointerEvents: 'none' },
  })

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '10px' })}>
      {/* Google 버튼 */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={disabled || googleLoading}
        aria-label="Google로 계속하기"
        className={css({
          w: '100%',
          h: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          borderRadius: '14px',
          fontWeight: '600',
          fontSize: '15px',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
          bg: 'white',
          color: '#3c4043',
          border: '1.5px solid',
          borderColor: 'brand.border',
          _hover: { bg: '#f8f9fa', borderColor: '#c6c6c6', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
          _active: { transform: 'scale(0.97)' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed', transform: 'none', pointerEvents: 'none' },
        })}
      >
        {googleLoading
          ? <Loader2 size={20} className={css({ animation: 'spin 1s linear infinite' })} />
          : <GoogleIcon />
        }
        Google로 계속하기
      </button>

      {/* 카카오 버튼 */}
      <button
        type="button"
        onClick={handleKakao}
        disabled={disabled || kakaoLoading}
        aria-label="카카오로 계속하기"
        className={css({
          w: '100%',
          h: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          borderRadius: '14px',
          fontWeight: '600',
          fontSize: '15px',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
          bg: '#FEE500',
          color: '#191919',
          border: 'none',
          _hover: { bg: '#F5DC00', boxShadow: '0 2px 8px rgba(254,229,0,0.4)' },
          _active: { transform: 'scale(0.97)' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed', transform: 'none', pointerEvents: 'none' },
        })}
      >
        {kakaoLoading
          ? <Loader2 size={20} className={css({ animation: 'spin 1s linear infinite' })} />
          : <KakaoIcon />
        }
        카카오로 계속하기
      </button>
    </div>
  )
}
