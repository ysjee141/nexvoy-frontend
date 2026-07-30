import type { CreatedDocumentInvitation } from '@nexvoy/core/supabase/invitationRepository'

export interface InviteApiSuccess {
  invitation: Pick<CreatedDocumentInvitation, 'id' | 'role' | 'inviteCode' | 'expiresAt'>
  inviteUrl: string
}

interface InviteHttpResponse {
  ok: boolean
  status: number
  text(): Promise<string>
}

export async function readInviteApiPayload(response: InviteHttpResponse): Promise<unknown> {
  const text = await response.text()
  if (!text.trim()) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export async function getInviteFunctionErrorMessage(error: unknown): Promise<string> {
  const record = asRecord(error)
  const context = record?.context
  if (isInviteHttpResponse(context)) {
    return getInviteApiErrorMessage(
      await readInviteApiPayload(context),
      context.status,
    )
  }

  return readString(record?.message) ?? '초대에 실패했어요. 잠시 후 다시 시도해 주세요.'
}

export function isInviteApiSuccess(value: unknown): value is InviteApiSuccess {
  const response = asRecord(value)
  const invitation = asRecord(response?.invitation)
  if (!response || !invitation) return false

  return (
    typeof invitation.id === 'string'
    && (invitation.role === 'editor' || invitation.role === 'viewer')
    && typeof invitation.inviteCode === 'string'
    && (invitation.expiresAt === null || typeof invitation.expiresAt === 'string')
    && typeof response.inviteUrl === 'string'
  )
}

export function getInviteApiErrorMessage(value: unknown, status: number): string {
  const response = asRecord(value)
  const error = asRecord(response?.error)
  const protection = asRecord(response?.protection)
  const nestedMessage = readString(error?.message)

  if (
    (status === 401 && protection?.vercel_auth_enabled === true)
    || nestedMessage === 'Protected deployment'
  ) {
    return '초대 서버에 연결할 수 없습니다. 앱의 API 환경 설정을 확인해 주세요.'
  }

  return (
    readString(response?.error)
    ?? nestedMessage
    ?? readString(response?.message)
    ?? (typeof value === 'string' && value.length <= 200 ? value : null)
    ?? '초대에 실패했어요. 잠시 후 다시 시도해 주세요.'
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isInviteHttpResponse(value: unknown): value is InviteHttpResponse {
  const response = asRecord(value)
  return Boolean(
    response
    && typeof response.ok === 'boolean'
    && typeof response.status === 'number'
    && typeof response.text === 'function'
  )
}
