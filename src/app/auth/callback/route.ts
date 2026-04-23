import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const SUPABASE_FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/handle-kakao-oauth`
    : ''

export async function GET(request: Request) {
    const { searchParams, origin: defaultOrigin } = new URL(request.url)

    // Determine the user-facing origin (handling reverse proxies/load balancers)
    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocalEnv = process.env.NODE_ENV === 'development'
    const origin = isLocalEnv ? defaultOrigin : (forwardedHost ? `https://${forwardedHost}` : defaultOrigin)

    const code = searchParams.get('code')
    const provider = searchParams.get('provider') // Google 등 직접 provider 명시
    const state = searchParams.get('state')        // 카카오: state=provider=kakao 로 식별
    
    // state 파라미터가 쿼리 스트링 형태인 경우 (예: provider=kakao&platform=native) 파싱
    const stateParams = new URLSearchParams(state ?? '')
    const platformFromState = stateParams.get('platform')
    const providerFromState = stateParams.get('provider')
    const modeFromState = stateParams.get('mode')

    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/'

    // Handle Supabase errors passed via query params (e.g. invalid or expired token)
    const error_description = searchParams.get('error_description')
    if (error_description) {
        console.error('Supabase auth error:', error_description)
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error_description)}`)
    }

    // ─── 카카오 OAuth 콜백 처리 ────────────────────────────────────────
    // provider=kakao (직접 명시) 또는 state가 provider=kakao 형태인 경우 감지
    const isKakaoCallback = provider === 'kakao' || providerFromState === 'kakao' || state === 'provider=kakao'
    if (isKakaoCallback && code) {
        try {
            // 카카오 개발자 콘솔에 등록된 redirect_uri와 동일해야 함
            const redirectUri = `${origin}/auth/callback`

            // 서버에서 Supabase 세션 확인 (연동 모드용)
            const supabase = await createClient()
            const { data: { session: currentSession } } = await supabase.auth.getSession()
            
            const fetchHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
            }
            if (currentSession?.access_token) {
                fetchHeaders['Authorization'] = `Bearer ${currentSession.access_token}`
            }

            const res = await fetch(SUPABASE_FUNCTION_URL, {
                method: 'POST',
                headers: fetchHeaders,
                body: JSON.stringify({ code, redirect_uri: redirectUri }),
            })

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}))
                console.error('Kakao callback error:', errBody)
                const isConflict = res.status === 409
                const errorMsg = isConflict ? 'conflict' : (errBody?.error ?? '카카오 로그인에 실패했습니다.')
                
                const targetPath = (modeFromState === 'link') ? '/profile' : '/auth/error'
                return NextResponse.redirect(
                    `${origin}${targetPath}?error=${encodeURIComponent(errorMsg)}`
                )
            }

            const { access_token, refresh_token } = await res.json()

            // 서버에서 Supabase 세션 설정
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

            // 네이티브 플랫폼인 경우 딥링크로 세션 전달 (카카오 대응 브릿지)
            const platform = searchParams.get('platform') ?? platformFromState
            if (platform === 'native') {
                const params = new URLSearchParams()
                params.set('access_token', access_token)
                params.set('refresh_token', refresh_token)
                return NextResponse.redirect(`onvoy://auth/callback#${params.toString()}`)
            }

            // 만약 연동 모드였다면 세션을 다시 설정할 필요 없이 프로필로 이동 (성공 메시지 포함)
            if (modeFromState === 'link') {
                return NextResponse.redirect(`${origin}/profile?linked=kakao`)
            }

            return NextResponse.redirect(`${origin}${next}`)
        } catch (err) {
            console.error('Kakao OAuth unexpected error:', err)
            return NextResponse.redirect(`${origin}/auth/error?message=kakao_oauth_error`)
        }
    }

    const platform = searchParams.get('platform') ?? platformFromState

    // ─── 기존 이메일 인증 / Google OAuth 콜백 처리 ────────────────────
    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // 네이티브 플랫폼인 경우 딥링크로 세션 전달 (브릿지 방식)
            if (platform === 'native') {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) {
                    const params = new URLSearchParams()
                    params.set('access_token', session.access_token)
                    params.set('refresh_token', session.refresh_token)
                    
                    // onvoy://auth/callback#access_token=...&refresh_token=...
                    return NextResponse.redirect(`onvoy://auth/callback#${params.toString()}`)
                }
            }
            
            return NextResponse.redirect(`${origin}${next}`)
        }

        // --- Handle Exchange Error ---
        console.error('Auth exchange error:', error.message)

        // Check if we already have a session (in case of duplicate/pre-fetch requests)
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            return NextResponse.redirect(`${origin}${next}`)
        }

        // If this is a signup verification flow, the email is likely verified even if exchange failed (e.g. cross-device PKCE)
        // Redirect to success page instead of error page to avoid confusing the user.
        if (next === '/auth/success' || next.includes('success')) {
            return NextResponse.redirect(`${origin}/auth/success?verified=true`)
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/error?message=invalid_code`)
}
