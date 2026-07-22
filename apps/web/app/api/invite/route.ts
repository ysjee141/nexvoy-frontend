import { NextRequest, NextResponse } from 'next/server'
import { createInvitationRepository } from '@nexvoy/core/supabase/invitationRepository'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@nexvoy/types'

interface InviteRequestBody {
  documentId?: unknown
  email?: unknown
  role?: unknown
  destination?: unknown
  startDate?: unknown
  endDate?: unknown
}

export async function POST(req: NextRequest) {
  let invitationId: string | null = null

  try {
    const body = await req.json() as InviteRequestBody
    const documentId = requiredString(body.documentId)
    const email = normalizeEmail(body.email)
    const role = body.role === 'viewer' ? 'viewer' : body.role === 'editor' ? 'editor' : null
    const destination = optionalString(body.destination, 120)
    const startDate = optionalDate(body.startDate)
    const endDate = optionalDate(body.endDate)

    if (!documentId || !email || !role) {
      return NextResponse.json({ error: '초대 정보를 확인해 주세요.' }, { status: 400 })
    }

    const supabase = await createRequestClient(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    if (user.email?.toLowerCase() === email) {
      return NextResponse.json({ error: '본인에게는 초대를 보낼 수 없습니다.' }, { status: 400 })
    }

    const repository = createInvitationRepository(supabase)
    const invitation = await repository.createDocumentInvitationLink({
      documentId,
      role,
      maxUses: 1,
      targetEmail: email,
      destination,
      startDate,
      endDate,
    })
    invitationId = invitation.id

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('Resend API Key is not configured')

    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    const inviteUrl = new URL('/join', appOrigin)
    inviteUrl.searchParams.set('token', invitation.token)
    const title = '새 여행'
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '온여정 <onboarding@nexvoy.xyz>',
        to: [email],
        subject: `[온여정] ${title} 동행 초대`,
        html: createInviteEmailHtml({
          title,
          inviteUrl: inviteUrl.toString(),
          inviteCode: invitation.inviteCode,
          role,
        }),
      }),
    })

    const resendResult = await response.json() as { message?: string; code?: number }
    if (!response.ok) {
      throw new Error(resendResult.message || '초대 메일을 보내지 못했습니다.')
    }

    return NextResponse.json({ invitation, inviteUrl: inviteUrl.toString() })
  } catch (error) {
    if (invitationId) {
      try {
        const supabase = await createRequestClient(req)
        await createInvitationRepository(supabase).revokeDocumentInvitationLink(invitationId)
      } catch {
        // The original failure remains the actionable error.
      }
    }
    const message = error instanceof Error ? error.message : '초대 중 오류가 발생했습니다.'
    const status = message === '권한이 없습니다.' ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

async function createRequestClient(req: NextRequest) {
  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return createServerClient()

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    },
  )
}

function createInviteEmailHtml(input: {
  title: string
  inviteUrl: string
  inviteCode: string
  role: 'editor' | 'viewer'
}): string {
  const title = escapeHtml(input.title)
  const inviteUrl = escapeHtml(input.inviteUrl)
  const inviteCode = escapeHtml(input.inviteCode)
  const roleLabel = input.role === 'viewer' ? '조회 전용' : '편집 가능'
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
    <h2 style="color:#2563eb">온여정 초대</h2>
    <p><strong>${title}</strong> 여정의 동행자로 초대받았습니다.</p>
    <p>권한: <strong>${roleLabel}</strong></p>
    <p><a href="${inviteUrl}" style="background:#2563eb;color:white;padding:12px 20px;text-decoration:none;border-radius:8px;display:inline-block">초대 확인하기</a></p>
    <p style="color:#6b7280;font-size:14px">링크가 열리지 않으면 초대 코드 <strong>${inviteCode}</strong>를 입력해 주세요.</p>
  </div>`
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function optionalString(value: unknown, maxLength: number): string | null {
  const normalized = requiredString(value)
  return normalized ? normalized.slice(0, maxLength) : null
}

function normalizeEmail(value: unknown): string | null {
  const email = requiredString(value)?.toLowerCase() ?? null
  return email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null
}

function optionalDate(value: unknown): string | null {
  const date = requiredString(value)
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
