import { createClient } from 'npm:@supabase/supabase-js@2'

type InvitationRole = 'editor' | 'viewer'

interface InvitationRequest {
  documentId?: unknown
  email?: unknown
  role?: unknown
  destination?: unknown
  startDate?: unknown
  endDate?: unknown
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
const resendApiKey = Deno.env.get('RESEND_API_KEY')
const appOrigin = Deno.env.get('ONVOY_APP_ORIGIN')
const inviteFrom = Deno.env.get('ONVOY_INVITE_FROM') ?? '온여정 <onboarding@nexvoy.xyz>'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse({}, 200)
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  if (!supabaseUrl || !supabaseAnonKey || !resendApiKey || !appOrigin) {
    console.error('[send-document-invitation] Required server configuration is missing.')
    return jsonResponse({ error: '초대 서버 설정을 확인할 수 없습니다.' }, 500)
  }

  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: '로그인이 필요합니다.' }, 401)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  })
  let invitationId: string | null = null

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return jsonResponse({ error: '로그인이 필요합니다.' }, 401)

    const body = await req.json() as InvitationRequest
    const documentId = requiredString(body.documentId)
    const email = normalizeEmail(body.email)
    const role = normalizeRole(body.role)
    const destination = optionalString(body.destination, 120)
    const startDate = optionalDate(body.startDate)
    const endDate = optionalDate(body.endDate)

    if (!documentId || !email || !role) {
      return jsonResponse({ error: '초대 정보를 확인해 주세요.' }, 400)
    }
    if (user.email?.toLowerCase() === email) {
      return jsonResponse({ error: '본인에게는 초대를 보낼 수 없습니다.' }, 400)
    }

    const { data, error } = await supabase.rpc('create_document_invitation_link', {
      p_document_id: documentId,
      p_role: role,
      p_expires_at: null,
      p_max_uses: 1,
      p_target_email: email,
      p_destination: destination,
      p_start_date: startDate,
      p_end_date: endDate,
    })
    if (error) {
      const status = error.message === '권한이 없습니다.' ? 403 : 400
      return jsonResponse({ error: error.message }, status)
    }

    const invitation = normalizeCreatedInvitation(data)
    invitationId = invitation.id
    const inviteUrl = new URL('/join', appOrigin)
    inviteUrl.searchParams.set('token', invitation.token)

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: inviteFrom,
        to: [email],
        subject: `[온여정] ${destination ?? '새 여행'} 동행 초대`,
        html: createInviteEmailHtml({
          title: destination ?? '새 여행',
          inviteUrl: inviteUrl.toString(),
          inviteCode: invitation.inviteCode,
          role,
        }),
      }),
    })
    if (!resendResponse.ok) {
      console.error('[send-document-invitation] Resend rejected the request.', {
        status: resendResponse.status,
      })
      throw new Error('초대 메일을 보내지 못했습니다.')
    }

    return jsonResponse({
      invitation: {
        id: invitation.id,
        role: invitation.role,
        inviteCode: invitation.inviteCode,
        expiresAt: invitation.expiresAt,
      },
      inviteUrl: inviteUrl.toString(),
    }, 200)
  } catch (error) {
    if (invitationId) {
      const { error: revokeError } = await supabase.rpc('revoke_document_invitation_link', {
        p_invitation_id: invitationId,
      })
      if (revokeError) {
        console.error('[send-document-invitation] Failed to revoke invitation after email failure.', {
          code: revokeError.code,
        })
      }
    }

    console.error('[send-document-invitation] Invitation delivery failed.', {
      errorName: error instanceof Error ? error.name : 'unknown',
    })
    return jsonResponse({
      error: error instanceof Error ? error.message : '초대 중 오류가 발생했습니다.',
    }, 500)
  }
})

function normalizeCreatedInvitation(value: unknown): {
  id: string
  role: InvitationRole
  token: string
  inviteCode: string
  expiresAt: string | null
} {
  const row = asRecord(value)
  if (
    !row
    || typeof row.id !== 'string'
    || (row.role !== 'editor' && row.role !== 'viewer')
    || typeof row.token !== 'string'
    || typeof row.invite_code !== 'string'
    || (row.expires_at !== null && typeof row.expires_at !== 'string')
  ) {
    throw new Error('초대 서버 응답을 확인할 수 없습니다.')
  }

  return {
    id: row.id,
    role: row.role,
    token: row.token,
    inviteCode: row.invite_code,
    expiresAt: row.expires_at,
  }
}

function createInviteEmailHtml(input: {
  title: string
  inviteUrl: string
  inviteCode: string
  role: InvitationRole
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

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  })
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

function normalizeRole(value: unknown): InvitationRole | null {
  return value === 'editor' || value === 'viewer' ? value : null
}

function optionalDate(value: unknown): string | null {
  const date = requiredString(value)
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
