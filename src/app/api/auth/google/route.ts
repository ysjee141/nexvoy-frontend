import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const platform = searchParams.get('platform')
    const cookieStore = await cookies()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    )
                },
            },
        }
    )

    // 리다이렉트 경로 구성 (플랫폼 정보 포함)
    const callbackUrl = new URL(`${origin}/auth/callback`)
    if (platform) {
        callbackUrl.searchParams.set('platform', platform)
    }

    // 서버에서 signInWithOAuth 호출 → PKCE verifier가 서버 쿠키에 안전하게 저장됨
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: callbackUrl.toString(),
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        },
    })

    if (error || !data?.url) {
        console.error('[Google OAuth] initiation error:', error?.message)
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error?.message ?? 'google_oauth_error')}`)
    }

    // Google 인가 페이지로 리다이렉트 (PKCE verifier는 쿠키에 저장된 상태)
    return NextResponse.redirect(data.url)
}
