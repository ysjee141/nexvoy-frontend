import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST() {
    try {
        // 1. 서버 클라이언트로 현재 세션 검증
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
        }

        // 2. Admin 클라이언트 (Service Role Key)
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // 3. app_metadata에서 kakao_id 제거 + provider 'email'로 복원
        //    카카오 연동 시 provider가 'kakao'로 덮어씌워지므로 원복 필요
        const updatedMeta = { ...user.app_metadata }
        delete updatedMeta.kakao_id
        if (updatedMeta.provider === 'kakao') {
            updatedMeta.provider = 'email'
        }

        const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
            app_metadata: updatedMeta,
        })
        if (metaError) {
            console.error('[unlink-kakao] app_metadata update error:', metaError.message)
            return NextResponse.json({ error: '연동 해제 중 오류가 발생했습니다.' }, { status: 500 })
        }

        // 4. profiles 테이블 kakao_id null 처리
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ kakao_id: null, updated_at: new Date().toISOString() })
            .eq('id', user.id)
        if (profileError) {
            console.error('[unlink-kakao] profiles update error:', profileError.message)
            return NextResponse.json({ error: '프로필 업데이트 중 오류가 발생했습니다.' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[unlink-kakao] unexpected error:', err)
        return NextResponse.json({ error: err.message ?? '알 수 없는 오류가 발생했습니다.' }, { status: 500 })
    }
}
