import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin: defaultOrigin } = new URL(request.url)
    
    // Determine the user-facing origin (handling reverse proxies/load balancers)
    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocalEnv = process.env.NODE_ENV === 'development'
    const origin = isLocalEnv ? defaultOrigin : (forwardedHost ? `https://${forwardedHost}` : defaultOrigin)
    
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/'

    // Handle Supabase errors passed via query params (e.g. invalid or expired token)
    const error_description = searchParams.get('error_description')
    if (error_description) {
        console.error('Supabase auth error:', error_description)
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error_description)}`)
    }

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
