import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

let supabaseNativeClient: any = null

export function createClient() {
    // 모바일 앱(Capacitor) 환경에서는 쿠키 저장이 불안정하므로 localStorage 기반의 기본 클라이언트 사용
    if (Capacitor.isNativePlatform()) {
        if (!supabaseNativeClient) {
            supabaseNativeClient = createSupabaseClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            )
        }
        return supabaseNativeClient
    }

    // 웹 환경에서는 SSR 지원을 위해 쿠키 기반 클라이언트 사용
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
