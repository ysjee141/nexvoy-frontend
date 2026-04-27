import { createClient } from '@/utils/supabase/client'
import { Capacitor } from '@capacitor/core'

const KAKAO_AUTH_URL = 'https://kauth.kakao.com/oauth/authorize'
const SUPABASE_FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/handle-kakao-oauth`
  : 'account_email'

/**
 * OAuth 리다이렉트 URL을 플랫폼(Web/Capacitor)에 따라 자동 분기합니다.
 * @param forceWeb true인 경우 네이티브 플랫폼이어도 웹 URL을 반환합니다. (카카오 등 커스텀 스킴 미지원 대응)
 */
function getOAuthRedirectUrl(forceWeb = false): string {
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()
  if (isNative && !forceWeb) {
    return 'onvoy://auth/callback'
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (
    typeof window !== 'undefined' ? window.location.origin : 'https://app.nexvoy.xyz'
  )
  return `${appUrl}/auth/callback`
}

/**
 * 카카오 OAuth 인가 코드 요청 URL을 생성합니다.
 * @param mode 'login' | 'link' (기본값 'login')
 * @param next 로그인 후 이동할 URL
 */
function buildKakaoAuthUrl(mode: 'login' | 'link' = 'login', next?: string): string {
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()
  const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID ?? ''

  // 카카오는 웹 리다이렉트 URL만 허용함
  const redirectUri = getOAuthRedirectUrl(true)

  const stateParams = new URLSearchParams()
  stateParams.set('provider', 'kakao')
  stateParams.set('mode', mode)
  if (isNative) {
    stateParams.set('platform', 'native')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: stateParams.toString(),
  })
  
  // redirectUri에 next를 직접 포함하지 못하므로, 콜백 측에서 처리될 수 있도록 redirectUri 또는 다른 방법에 next를 담을 수 있지만
  // 카카오는 인가 코드 요청시 redirect_uri가 앱 설정과 정확히 일치해야 합니다.
  // 따라서 next 파라미터가 있다면 state 파라미터에 추가하여 넘겨주는 방식이 일반적입니다.
  // 이 프로젝트에서는 카카오의 `state` 파라미터를 사용하여 플랫폼이나 모드를 넘기고 있으므로 `next`도 추가합니다.
  if (next) {
    stateParams.set('next', next)
    params.set('state', stateParams.toString())
  }
  
  return `${KAKAO_AUTH_URL}?${params.toString()}`
}

export const AuthService = {
  /**
   * Google OAuth 로그인을 시작합니다.
   * 서버 API Route(/api/auth/google)로 리다이렉트하여
   * PKCE verifier를 서버 쿠키에 안전하게 저장합니다.
   * @param next 로그인 후 이동할 URL
   */
  async signInWithGoogle(next?: string): Promise<void> {
    if (typeof window !== 'undefined') {
      const isNative = Capacitor.isNativePlatform()
      let authUrl = ''
      if (isNative) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
        authUrl = `${appUrl}/api/auth/google?platform=native`
      } else {
        authUrl = '/api/auth/google'
      }
      
      if (next) {
        authUrl += authUrl.includes('?') ? `&next=${encodeURIComponent(next)}` : `?next=${encodeURIComponent(next)}`
      }
      
      window.location.href = authUrl
    }
  },

  /**
   * 카카오 OAuth 로그인을 시작합니다.
   * @param next 로그인 후 이동할 URL
   */
  signInWithKakao(next?: string): void {
    const kakaoUrl = buildKakaoAuthUrl('login', next)
    if (typeof window !== 'undefined') {
      window.location.href = kakaoUrl
    }
  },

  /**
   * 로그인된 상태에서 카카오 계정 연동을 시작합니다.
   */
  linkKakaoAccount(): void {
    const kakaoUrl = buildKakaoAuthUrl('link')
    if (typeof window !== 'undefined') {
      window.location.href = kakaoUrl
    }
  },

  /**
   * 로그인된 상태에서 구글 계정 연동을 시작합니다.
   * /api/auth/google?mode=link 로 리다이렉트하여 PKCE 흐름을 서버에서 처리합니다.
   */
  linkGoogleAccount(): void {
    if (typeof window !== 'undefined') {
      const isNative = Capacitor.isNativePlatform()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const base = isNative ? appUrl : ''
      window.location.href = `${base}/api/auth/google?mode=link`
    }
  },

  /**
   * 구글 계정 연동을 해제합니다.
   * Supabase native unlinkIdentity API를 사용합니다.
   */
  async unlinkGoogleAccount(): Promise<void> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('로그인이 필요합니다.')

    const googleIdentity = user.identities?.find((id: any) => id.provider === 'google')
    if (!googleIdentity) throw new Error('연동된 구글 계정이 없습니다.')

    const { error } = await supabase.auth.unlinkIdentity(googleIdentity)
    if (error) throw new Error(error.message)
  },

  /**
   * 카카오 계정 연동을 해제합니다.
   * 커스텀 API Route(/api/auth/unlink-kakao)를 호출하여 서버 측에서 처리합니다.
   */
  async unlinkKakaoAccount(): Promise<void> {
    const res = await fetch('/api/auth/unlink-kakao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error ?? '카카오 연동 해제 중 오류가 발생했습니다.')
    }
  },

  /**
   * 카카오 OAuth 콜백에서 인가 코드를 받아 Supabase 세션으로 교환합니다.
   * Edge Function `handle-kakao-oauth`를 호출합니다.
   */
  async handleKakaoCallback(code: string): Promise<void> {
    const supabase = createClient()
    const redirectUri = getOAuthRedirectUrl()

    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    }

    // 세션이 있는 경우 Authorization 헤더 추가 (연동 모드용)
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }

    const res = await fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      console.error('[AuthService] Kakao callback error:', errBody)

      if (res.status === 409) {
        throw new Error('conflict')
      }
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
      if (msg.includes('conflict')) return '이미 다른 계정에 연동된 카카오 계정입니다. 해당 계정에서 연동 해제 후 다시 시도해 주세요.'
      if (msg.includes('pop_up_closed')) return '로그인 창이 닫혔습니다. 다시 시도해 주세요.'
      if (msg.includes('access_denied')) return '로그인이 취소되었습니다.'
      if (msg.includes('network')) return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      return error.message
    }
    if (typeof error === 'string' && error === 'conflict') {
      return '이미 다른 계정에 연동된 카카오 계정입니다.'
    }
    return '알 수 없는 오류가 발생했습니다.'
  },
}
