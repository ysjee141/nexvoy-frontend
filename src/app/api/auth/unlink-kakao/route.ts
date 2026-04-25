import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST() {
    try {
        // 1. 서버 측 Supabase 클라이언트로 현재 세션 검증
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
        }

        // 2. profiles 테이블의 kakao_id 컬럼 null 처리 (RLS: 본인만 수정 가능)
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ kakao_id: null, updated_at: new Date().toISOString() })
            .eq('id', user.id)

        if (profileError) {
            console.error('[unlink-kakao] profiles update error:', profileError.message)
            return NextResponse.json({ error: '프로필 업데이트 중 오류가 발생했습니다.' }, { status: 500 })
        }

        // 3. (선택) app_metadata.kakao_id 제거 — Service Role Key가 있을 때만 수행
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (serviceRoleKey) {
            try {
                const supabaseAdmin = createAdminClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    serviceRoleKey,
                    { auth: { autoRefreshToken: false, persistSession: false } }
                )
                const updatedMeta = { ...user.app_metadata }
                delete updatedMeta.kakao_id

                await supabaseAdmin.auth.admin.updateUserById(user.id, {
                    app_metadata: updatedMeta,
                })
            } catch (metaErr: any) {
                // app_metadata 업데이트 실패는 치명적이지 않으므로 warn만 기록
                console.warn('[unlink-kakao] app_metadata update skipped:', metaErr?.message)
            }
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[unlink-kakao] unexpected error:', err)
        return NextResponse.json({ error: err.message ?? '알 수 없는 오류가 발생했습니다.' }, { status: 500 })
    }
}

