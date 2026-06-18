import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SUPABASE_FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/handle-kakao-oauth`
  : ''

/**
 * open redirect 방어: `next` 값은 동일 출처 내 경로만 허용한다.
 * 절대 URL(`http(s)://...`)이나 protocol-relative(`//evil.com`)는 거부하고 `/`로 폴백.
 */
function safeNext(next: string | null | undefined): string {
  if (!next) return '/'
  // protocol-relative(`//host`) 또는 절대 URL은 거부
  if (next.startsWith('//') || /^https?:\/\//i.test(next)) return '/'
  // 반드시 단일 슬래시로 시작하는 상대 경로만 허용
  return next.startsWith('/') ? next : '/'
}

export async function GET(request: Request) {
  const { searchParams, origin: defaultOrigin } = new URL(request.url)

  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'
  const origin = isLocalEnv
    ? defaultOrigin
    : forwardedHost
      ? `https://${forwardedHost}`
      : defaultOrigin

  const code = searchParams.get('code')
  const provider = searchParams.get('provider')
  const state = searchParams.get('state')
  const modeParam = searchParams.get('mode')

  const stateParams = new URLSearchParams(state ?? '')
  const providerFromState = stateParams.get('provider')
  const modeFromState = stateParams.get('mode')
  const nextFromState = stateParams.get('next')

  const next = safeNext(searchParams.get('next') ?? nextFromState)

  const error_description = searchParams.get('error_description')
  if (error_description) {
    console.error('Supabase auth error:', error_description)
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent(error_description)}`
    )
  }

  // ─── 카카오 OAuth 콜백 ────────────────────────────────────────────────
  const isKakaoCallback =
    provider === 'kakao' || providerFromState === 'kakao' || state === 'provider=kakao'
  if (isKakaoCallback && code) {
    try {
      const redirectUri = `${origin}/auth/callback`
      const supabase = await createClient()
      const {
        data: { user: currentUser },
        error: authUserErr,
      } = await supabase.auth.getUser()

      if (authUserErr) console.error('[AuthCallback] getUser Error:', authUserErr)

      if (modeFromState === 'link' && !currentUser) {
        console.error('[AuthCallback] Link mode but no session found!')
        return NextResponse.redirect(`${origin}/login?error=session_lost`)
      }

      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      }

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()
      if (currentSession?.access_token) {
        fetchHeaders['Authorization'] = `Bearer ${currentSession.access_token}`
      }
      if (process.env.INTERNAL_SECRET) {
        fetchHeaders['x-internal-secret'] = process.env.INTERNAL_SECRET
      }

      const res = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify({
          code,
          redirect_uri: redirectUri,
          mode: modeFromState,
          targetUserId: currentUser?.id,
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        console.error('Kakao callback error:', errBody)
        const isConflict = res.status === 409
        const errorMsg = isConflict ? 'conflict' : (errBody?.error ?? '카카오 로그인에 실패했습니다.')
        const targetPath = modeFromState === 'link' ? '/profile' : '/auth/error'
        return NextResponse.redirect(`${origin}${targetPath}?error=${encodeURIComponent(errorMsg)}`)
      }

      const { access_token, refresh_token } = await res.json()

      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        })
        if (sessionError) {
          console.error('Kakao setSession error:', sessionError.message)
          return NextResponse.redirect(
            `${origin}/auth/error?message=${encodeURIComponent(sessionError.message)}`
          )
        }
      }

      if (modeFromState === 'link') {
        return NextResponse.redirect(`${origin}/profile?linked=kakao`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    } catch (err) {
      console.error('Kakao OAuth unexpected error:', err)
      return NextResponse.redirect(`${origin}/auth/error?message=kakao_oauth_error`)
    }
  }

  // ─── Google / 이메일 OAuth 콜백 ─────────────────────────────────────
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const isGoogleLinkMode =
        (provider === 'google' || providerFromState === 'google') &&
        (modeParam === 'link' || modeFromState === 'link')
      if (isGoogleLinkMode) {
        return NextResponse.redirect(`${origin}/profile?linked=google`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('Auth exchange error:', error.message)

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) {
      return NextResponse.redirect(`${origin}${next}`)
    }

    if (next === '/auth/success' || next.includes('success')) {
      return NextResponse.redirect(`${origin}/auth/success?verified=true`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error?message=invalid_code`)
}
