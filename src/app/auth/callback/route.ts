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
    const provider = searchParams.get('provider') // kakao 콜백 시 provider=kakao 포함
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/'

    // Handle Supabase errors passed via query params (e.g. invalid or expired token)
    const error_description = searchParams.get('error_description')
    if (error_description) {
        console.error('Supabase auth error:', error_description)
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error_description)}`)
    }

    // ─── 카카오 OAuth 콜백 처리 ────────────────────────────────────────
    if (provider === 'kakao' && code) {
        try {
            const redirectUri = `${origin}/auth/callback?provider=kakao`

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
                console.error('Kakao callback error:', errBody)
                return NextResponse.redirect(
                    `${origin}/auth/error?message=${encodeURIComponent(errBody?.error ?? '카카오 로그인에 실패했습니다.')}`
                )
            }

            const { access_token, refresh_token } = await res.json()

            // 서버에서 Supabase 세션 설정
            const supabase = await createClient()
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

            return NextResponse.redirect(`${origin}${next}`)
        } catch (err) {
            console.error('Kakao OAuth unexpected error:', err)
            return NextResponse.redirect(`${origin}/auth/error?message=kakao_oauth_error`)
        }
    }

    // ─── 기존 이메일 인증 / Google OAuth 콜백 처리 ────────────────────
    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
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
