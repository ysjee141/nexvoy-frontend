import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

let supabaseNativeClient: any = null
let supabaseBrowserClient: any = null

export function createClient() {
    const isServer = typeof window === 'undefined';

    // 모바일 앱(Capacitor) 환경에서는 쿠키 저장이 불안정하므로 localStorage 기반의 기본 클라이언트 사용
    // 서버 환경에서는 Capacitor 로직을 스킵합니다.
    if (!isServer && Capacitor.isNativePlatform()) {
        if (!supabaseNativeClient) {
            supabaseNativeClient = createSupabaseClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    auth: {
                        flowType: 'pkce',
                        persistSession: true,
                        detectSessionInUrl: true,
                        autoRefreshToken: true,
                    }
                }
            )
        }
        return supabaseNativeClient
    }

    // 웹 환경에서는 브라우저인 경우에만 싱글톤 패턴을 적용하여 무한 루프를 방지합니다.
    // 서버 사이드 프리렌더링 시에는 매 요청마다 새로운 클라이언트를 생성하여 상태 누수(Memory Leak)를 차단합니다.
    if (!isServer) {
        if (!supabaseBrowserClient) {
            supabaseBrowserClient = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            )
        }
        return supabaseBrowserClient
    }

    // 서버 사이드 전용 클라이언트 생성 (익명)
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

/**
 * 네이티브 환경에서 클라이언트가 먹통이 되었을 때 강제 리셋하기 위한 함수
 */
export function resetNativeClient() {
    supabaseNativeClient = null;
}
