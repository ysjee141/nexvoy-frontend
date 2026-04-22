import { createClient } from '@/utils/supabase/client'
import { Capacitor } from '@capacitor/core'

const KAKAO_AUTH_URL = 'https://kauth.kakao.com/oauth/authorize'
const SUPABASE_FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/handle-kakao-oauth`
  : ''

/**
 * OAuth 리다이렉트 URL을 플랫폼(Web/Capacitor)에 따라 자동 분기합니다.
 */
function getOAuthRedirectUrl(): string {
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()
  if (isNative) {
    return 'onvoy://auth/callback'
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (
    typeof window !== 'undefined' ? window.location.origin : 'https://app.nexvoy.xyz'
  )
  return `${appUrl}/auth/callback`
}

/**
 * 카카오 OAuth 인가 코드 요청 URL을 생성합니다.
 * redirect_uri는 /auth/callback (웹) 또는 onvoy://auth/callback (네이티브)으로 분기됩니다.
 */
function buildKakaoAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID ?? ''
  const redirectUri = getOAuthRedirectUrl()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'profile_nickname profile_image account_email',
  })
  return `${KAKAO_AUTH_URL}?${params.toString()}`
}

export const AuthService = {
  /**
   * Google OAuth 로그인을 시작합니다.
   * Supabase 네이티브 지원 방식을 사용합니다.
   */
  async signInWithGoogle(): Promise<void> {
    const supabase = createClient()
    const redirectTo = getOAuthRedirectUrl()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('[AuthService] Google OAuth error:', error.message)
      throw new Error(error.message)
    }
  },

  /**
   * 카카오 OAuth 로그인을 시작합니다.
   * 카카오 인가 URL로 브라우저를 이동시킵니다.
   * 콜백 처리는 handleKakaoCallback()에서 수행합니다.
   */
  signInWithKakao(): void {
    const kakaoUrl = buildKakaoAuthUrl()
    if (typeof window !== 'undefined') {
      window.location.href = kakaoUrl
    }
  },

  /**
   * 카카오 OAuth 콜백에서 인가 코드를 받아 Supabase 세션으로 교환합니다.
   * Edge Function `handle-kakao-oauth`를 호출합니다.
   */
  async handleKakaoCallback(code: string): Promise<void> {
    const supabase = createClient()
    const redirectUri = getOAuthRedirectUrl()

    const res = await fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      console.error('[AuthService] Kakao callback error:', errBody)
      throw new Error(errBody?.error ?? '카카오 로그인 처리 중 오류가 발생했습니다.')
    }

    const { access_token, refresh_token } = await res.json()

    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })

    if (error) {
      console.error('[AuthService] setSession error:', error.message)
      throw new Error(error.message)
    }
  },

  /**
   * 소셜 로그인 에러 메시지를 사용자 친화적인 한국어로 변환합니다.
   */
  normalizeOAuthError(error: unknown): string {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('popup_closed')) return '로그인 창이 닫혔습니다. 다시 시도해 주세요.'
      if (msg.includes('access_denied')) return '로그인이 취소되었습니다.'
      if (msg.includes('network')) return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      return error.message
    }
    return '알 수 없는 오류가 발생했습니다.'
  },
}
