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
    const modeParam = searchParams.get('mode')     // 'link' | null (Google 연동 모드)
    
    // state 파라미터가 쿼리 스트링 형태인 경우 (예: provider=kakao&platform=native) 파싱
    const stateParams = new URLSearchParams(state ?? '')
    const platformFromState = stateParams.get('platform')
    const providerFromState = stateParams.get('provider')
    const modeFromState = stateParams.get('mode')
    const nextFromState = stateParams.get('next')

    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? nextFromState ?? '/'

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
            // getSession 대신 getUser를 사용하여 더 정확한 유저 상태 확인
            const supabase = await createClient()
            const { data: { user: currentUser }, error: authUserErr } = await supabase.auth.getUser()
            
            console.log('[AuthCallback] Mode:', modeFromState)
            console.log('[AuthCallback] Current User Exists:', !!currentUser)
            if (authUserErr) console.error('[AuthCallback] getUser Error:', authUserErr)

            // 만약 연동 모드로 진입했는데 세션이 없다면 에러 처리 (로그인 페이지로 유도)
            if (modeFromState === 'link' && !currentUser) {
                console.error('[AuthCallback] Link mode but no session found!')
                return NextResponse.redirect(`${origin}/login?error=session_lost`)
            }

            const fetchHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
            }
            
            // 현재 유저의 세션 토큰 가져오기 (getUser로 확인되었으므로 getSession은 안전함)
            const { data: { session: currentSession } } = await supabase.auth.getSession()
            if (currentSession?.access_token) {
                fetchHeaders['Authorization'] = `Bearer ${currentSession.access_token}`
            }
            
            // 서버 간 보안 인증을 위한 비밀 키 추가
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
                    targetUserId: currentUser?.id // 검증된 유저 ID 전달
                }),
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

            const responseData = await res.json()
            const { access_token, refresh_token } = responseData

            // 서버에서 Supabase 세션 설정 (토큰이 있는 경우에만)
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

            // 네이티브 플랫폼인 경우 딥링크로 세션 전달 (카카오 대응 브릿지)
            const platform = searchParams.get('platform') ?? platformFromState
            if (platform === 'native' && access_token && refresh_token) {
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
            // Google 연동 모드: 코드 교환 성공 후 프로필 페이지로 복귀
            const isGoogleLinkMode = (provider === 'google' || providerFromState === 'google') && (modeParam === 'link' || modeFromState === 'link')
            if (isGoogleLinkMode) {
                return NextResponse.redirect(`${origin}/profile?linked=google`)
            }

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
