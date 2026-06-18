import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 비밀번호 보호 공유의 비밀번호를 서버 사이드에서 검증한다.
 * `password_hash`는 절대 클라이언트로 내려보내지 않으며, 비교는 서버에서만 수행한다.
 *
 * 요청: { token: string, password: string }
 * 응답: { authorized: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: shareData, error } = await supabase
      .from('trip_shares')
      .select('share_type, password_hash, expires_at')
      .eq('share_token', token)
      .single()

    if (error || !shareData) {
      return NextResponse.json({ authorized: false }, { status: 404 })
    }

    // 만료 확인
    if (shareData.expires_at && new Date(shareData.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ authorized: false }, { status: 410 })
    }

    // 공개 공유는 비밀번호 없이 통과
    if (shareData.share_type === 'public') {
      return NextResponse.json({ authorized: true })
    }

    // 비밀번호 보호 공유: 서버에서만 비교 (값은 응답에 포함하지 않음)
    const authorized = Boolean(shareData.password_hash) && password === shareData.password_hash

    return NextResponse.json({ authorized })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
