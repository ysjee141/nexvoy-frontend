import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|otf)$).*)',
  ],
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // [OPTIMIZATION] 이미 공개된 경로(Public paths)인 경우, 세션 체크 없이 즉시 통과
    const isPublicPath = 
        request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/signup') ||
        request.nextUrl.pathname.startsWith('/auth') ||
        request.nextUrl.pathname.startsWith('/share') ||
        request.nextUrl.pathname.startsWith('/api') ||
        request.nextUrl.pathname.startsWith('/_next') ||
        request.nextUrl.pathname.startsWith('/sw.js') ||
        request.nextUrl.pathname.startsWith('/workbox') ||
        request.nextUrl.pathname === '/';

    if (isPublicPath) {
        return supabaseResponse;
    }

    const isDev = process.env.NODE_ENV === 'development';
    
    let user = null;
    if (isDev) {
        const { data: { session } } = await supabase.auth.getSession();
        user = session?.user || null;
    } else {
        const { data: { user: prodUser } } = await supabase.auth.getUser();
        user = prodUser;
    }

    if (!user) {
        const url = request.nextUrl.clone()
        const nextUrl = request.nextUrl.pathname + request.nextUrl.search
        url.pathname = '/login'
        url.search = '' // Clear existing search params before setting next
        url.searchParams.set('next', nextUrl)
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
