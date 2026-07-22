import type { SupabaseClient } from '@supabase/supabase-js'

export type DocumentInvitationRole = 'editor' | 'viewer'
export type DocumentShareType = 'public' | 'password'

export interface CreateDocumentInvitationInput {
  documentId: string
  role: DocumentInvitationRole
  expiresAt?: string | null
  maxUses?: number | null
  targetEmail?: string | null
  destination?: string | null
  startDate?: string | null
  endDate?: string | null
}

export interface CreatedDocumentInvitation {
  id: string
  documentId: string
  role: DocumentInvitationRole
  token: string
  inviteCode: string
  expiresAt: string | null
  maxUses: number | null
  targetEmail: string | null
  invitationKind: 'generic' | 'targeted'
}

export interface PendingDocumentInvitation {
  id: string
  documentId: string
  role: DocumentInvitationRole
  destination: string | null
  startDate: string | null
  endDate: string | null
  ownerNickname: string | null
  expiresAt: string | null
  createdAt: string
}

export interface DocumentCollaborator {
  memberId: string
  userId: string | null
  invitedEmail: string | null
  nickname: string | null
  email: string | null
  role: DocumentInvitationRole | 'owner'
  status: 'pending' | 'accepted' | 'revoked'
  createdAt: string
  updatedAt: string
}

export interface DocumentPendingInvitation {
  id: string
  documentId: string
  role: DocumentInvitationRole
  targetEmail: string
  expiresAt: string | null
  createdAt: string
}

export interface DocumentInvitationLookup {
  token?: string | null
  inviteCode?: string | null
}

export interface DocumentInvitationSummary {
  documentId: string
  documentType: string
  role: DocumentInvitationRole
  expiresAt: string | null
  destination: string | null
  startDate: string | null
  endDate: string | null
  ownerNickname: string | null
  memberCount: number
}

export interface AcceptedDocumentInvitation {
  documentId: string
  role: DocumentInvitationRole | 'owner'
  status: 'accepted'
  alreadyMember: boolean
}

export interface DocumentMemberRoleChange {
  memberId: string
  role: DocumentInvitationRole
}

export interface RevokedDocumentMember {
  documentId: string
  memberId: string
  userId: string | null
}

export interface CreateDocumentShareTokenInput {
  documentId: string
  shareType?: DocumentShareType
  password?: string | null
  expiresAt?: string | null
}

export interface CreatedDocumentShareToken {
  id: string
  documentId: string
  shareToken: string
  shareType: DocumentShareType
  expiresAt: string | null
}

export interface DocumentShareTokenSummary {
  documentId: string
  documentType: string
  shareType: DocumentShareType
  expiresAt: string | null
  destination: string | null
  startDate: string | null
  endDate: string | null
  ownerNickname: string | null
}

export interface InvitationRepository {
  createDocumentInvitationLink(input: CreateDocumentInvitationInput): Promise<CreatedDocumentInvitation>
  getDocumentInvitationSummary(input: DocumentInvitationLookup): Promise<DocumentInvitationSummary | null>
  acceptDocumentInvitation(input: DocumentInvitationLookup): Promise<AcceptedDocumentInvitation>
  listMyPendingDocumentInvitations(): Promise<PendingDocumentInvitation[]>
  acceptMyDocumentInvitation(invitationId: string): Promise<AcceptedDocumentInvitation>
  declineMyDocumentInvitation(invitationId: string): Promise<void>
  listDocumentCollaborators(documentId: string): Promise<DocumentCollaborator[]>
  listDocumentPendingInvitations(documentId: string): Promise<DocumentPendingInvitation[]>
  revokeDocumentInvitationLink(invitationId: string): Promise<void>
  setDocumentMemberRole(input: DocumentMemberRoleChange): Promise<void>
  revokeDocumentMember(memberId: string): Promise<RevokedDocumentMember>
  createDocumentShareToken(input: CreateDocumentShareTokenInput): Promise<CreatedDocumentShareToken>
  getDocumentShareTokenSummary(shareToken: string): Promise<DocumentShareTokenSummary | null>
  verifyDocumentShareToken(input: { shareToken: string; password: string }): Promise<DocumentShareTokenSummary | null>
  getDocumentShareTokenPlans(input: { shareToken: string; password?: string | null }): Promise<unknown[]>
  revokeDocumentShareToken(shareTokenId: string): Promise<void>
}

export function createInvitationRepository(sb: SupabaseClient): InvitationRepository {
  return {
    createDocumentInvitationLink: async (input) => {
      const { data, error } = await sb.rpc('create_document_invitation_link', {
        p_document_id: input.documentId,
        p_role: input.role,
        p_expires_at: input.expiresAt ?? null,
        p_max_uses: input.maxUses ?? 1,
        p_target_email: input.targetEmail ?? null,
        p_destination: input.destination ?? null,
        p_start_date: input.startDate ?? null,
        p_end_date: input.endDate ?? null,
      })
      if (error) throw error
      return toCreatedDocumentInvitation(data)
    },
    getDocumentInvitationSummary: async (input) => {
      const { data, error } = await sb.rpc('get_document_invitation_summary', {
        p_token: input.token ?? null,
        p_invite_code: input.inviteCode ?? null,
      })
      if (error) throw error
      return data ? toDocumentInvitationSummary(data) : null
    },
    acceptDocumentInvitation: async (input) => {
      const { data, error } = await sb.rpc('accept_document_invitation', {
        p_token: input.token ?? null,
        p_invite_code: input.inviteCode ?? null,
      })
      if (error) throw error
      return toAcceptedDocumentInvitation(data)
    },
    listMyPendingDocumentInvitations: async () => {
      const { data, error } = await sb.rpc('list_my_pending_document_invitations')
      if (error) throw error
      return (Array.isArray(data) ? data : []).map(toPendingDocumentInvitation)
    },
    acceptMyDocumentInvitation: async (invitationId) => {
      const { data, error } = await sb.rpc('accept_my_document_invitation', {
        p_invitation_id: invitationId,
      })
      if (error) throw error
      return toAcceptedDocumentInvitation(data)
    },
    declineMyDocumentInvitation: async (invitationId) => {
      const { error } = await sb.rpc('decline_my_document_invitation', {
        p_invitation_id: invitationId,
      })
      if (error) throw error
    },
    listDocumentCollaborators: async (documentId) => {
      const { data, error } = await sb.rpc('list_document_collaborators', {
        p_document_id: documentId,
      })
      if (error) throw error
      return (Array.isArray(data) ? data : []).map(toDocumentCollaborator)
    },
    listDocumentPendingInvitations: async (documentId) => {
      const { data, error } = await sb.rpc('list_document_pending_invitations', {
        p_document_id: documentId,
      })
      if (error) throw error
      return (Array.isArray(data) ? data : []).map(toDocumentPendingInvitation)
    },
    revokeDocumentInvitationLink: async (invitationId) => {
      const { error } = await sb.rpc('revoke_document_invitation_link', {
        p_invitation_id: invitationId,
      })
      if (error) throw error
    },
    setDocumentMemberRole: async (input) => {
      const { error } = await sb.rpc('set_document_member_role', {
        p_member_id: input.memberId,
        p_role: input.role,
      })
      if (error) throw error
    },
    revokeDocumentMember: async (memberId) => {
      const { data, error } = await sb.rpc('revoke_document_member', {
        p_member_id: memberId,
      })
      if (error) throw error
      return toRevokedDocumentMember(data)
    },
    createDocumentShareToken: async (input) => {
      const { data, error } = await sb.rpc('create_document_share_token', {
        p_document_id: input.documentId,
        p_share_type: input.shareType ?? 'public',
        p_password: input.password ?? null,
        p_expires_at: input.expiresAt ?? null,
      })
      if (error) throw error
      return toCreatedDocumentShareToken(data)
    },
    getDocumentShareTokenSummary: async (shareToken) => {
      const { data, error } = await sb.rpc('get_document_share_token_summary', {
        p_share_token: shareToken,
      })
      if (error) throw error
      return data ? toDocumentShareTokenSummary(data) : null
    },
    verifyDocumentShareToken: async (input) => {
      const { data, error } = await sb.rpc('verify_document_share_token', {
        p_share_token: input.shareToken,
        p_password: input.password,
      })
      if (error) throw error
      return data ? toDocumentShareTokenSummary(data) : null
    },
    getDocumentShareTokenPlans: async (input) => {
      const { data, error } = await sb.rpc('get_document_share_token_plans', {
        p_share_token: input.shareToken,
        p_password: input.password ?? null,
      })
      if (error) throw error
      return Array.isArray(data) ? data : []
    },
    revokeDocumentShareToken: async (shareTokenId) => {
      const { error } = await sb.rpc('revoke_document_share_token', {
        p_share_token_id: shareTokenId,
      })
      if (error) throw error
    },
  }
}

function toCreatedDocumentInvitation(value: unknown): CreatedDocumentInvitation {
  const row = expectRecord(value)
  return {
    id: expectString(row.id),
    documentId: expectString(row.document_id),
    role: expectInvitationRole(row.role),
    token: expectString(row.token),
    inviteCode: expectString(row.invite_code),
    expiresAt: nullableString(row.expires_at),
    maxUses: nullableNumber(row.max_uses),
    targetEmail: nullableString(row.target_email),
    invitationKind: row.invitation_kind === 'targeted' ? 'targeted' : 'generic',
  }
}

function toPendingDocumentInvitation(value: unknown): PendingDocumentInvitation {
  const row = expectRecord(value)
  return {
    id: expectString(row.id),
    documentId: expectString(row.document_id),
    role: expectInvitationRole(row.role),
    destination: nullableString(row.destination),
    startDate: nullableString(row.start_date),
    endDate: nullableString(row.end_date),
    ownerNickname: nullableString(row.owner_nickname),
    expiresAt: nullableString(row.expires_at),
    createdAt: expectString(row.created_at),
  }
}

function toDocumentCollaborator(value: unknown): DocumentCollaborator {
  const row = expectRecord(value)
  return {
    memberId: expectString(row.member_id),
    userId: nullableString(row.user_id),
    invitedEmail: nullableString(row.invited_email),
    nickname: nullableString(row.nickname),
    email: nullableString(row.email),
    role: row.role === 'owner' ? 'owner' : expectInvitationRole(row.role),
    status: row.status === 'pending' || row.status === 'revoked' ? row.status : 'accepted',
    createdAt: expectString(row.created_at),
    updatedAt: expectString(row.updated_at),
  }
}

function toDocumentPendingInvitation(value: unknown): DocumentPendingInvitation {
  const row = expectRecord(value)
  return {
    id: expectString(row.id),
    documentId: expectString(row.document_id),
    role: expectInvitationRole(row.role),
    targetEmail: expectString(row.target_email),
    expiresAt: nullableString(row.expires_at),
    createdAt: expectString(row.created_at),
  }
}

function toDocumentInvitationSummary(value: unknown): DocumentInvitationSummary {
  const row = expectRecord(normalizeNullable(value))
  return {
    documentId: expectString(row.document_id),
    documentType: expectString(row.document_type),
    role: expectInvitationRole(row.role),
    expiresAt: nullableString(row.expires_at),
    destination: nullableString(row.destination),
    startDate: nullableString(row.start_date),
    endDate: nullableString(row.end_date),
    ownerNickname: nullableString(row.owner_nickname),
    memberCount: expectNumber(row.member_count),
  }
}

function toAcceptedDocumentInvitation(value: unknown): AcceptedDocumentInvitation {
  const row = expectRecord(value)
  return {
    documentId: expectString(row.document_id),
    role: row.role === 'owner' ? 'owner' : expectInvitationRole(row.role),
    status: 'accepted',
    alreadyMember: Boolean(row.already_member),
  }
}

function toRevokedDocumentMember(value: unknown): RevokedDocumentMember {
  const row = expectRecord(value)
  return {
    documentId: expectString(row.document_id),
    memberId: expectString(row.member_id),
    userId: nullableString(row.user_id),
  }
}

function toCreatedDocumentShareToken(value: unknown): CreatedDocumentShareToken {
  const row = expectRecord(value)
  return {
    id: expectString(row.id),
    documentId: expectString(row.document_id),
    shareToken: expectString(row.share_token),
    shareType: expectShareType(row.share_type),
    expiresAt: nullableString(row.expires_at),
  }
}

function toDocumentShareTokenSummary(value: unknown): DocumentShareTokenSummary {
  const row = expectRecord(normalizeNullable(value))
  return {
    documentId: expectString(row.document_id),
    documentType: expectString(row.document_type),
    shareType: expectShareType(row.share_type),
    expiresAt: nullableString(row.expires_at),
    destination: nullableString(row.destination),
    startDate: nullableString(row.start_date),
    endDate: nullableString(row.end_date),
    ownerNickname: nullableString(row.owner_nickname),
  }
}

function normalizeNullable(value: unknown): unknown {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function expectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Unexpected invitation RPC response.')
  }
  return value as Record<string, unknown>
}

function expectString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Unexpected invitation RPC response.')
  return value
}

function nullableString(value: unknown): string | null {
  if (value == null) return null
  return expectString(value)
}

function expectNumber(value: unknown): number {
  if (typeof value !== 'number') throw new Error('Unexpected invitation RPC response.')
  return value
}

function nullableNumber(value: unknown): number | null {
  if (value == null) return null
  return expectNumber(value)
}

function expectInvitationRole(value: unknown): DocumentInvitationRole {
  if (value === 'editor' || value === 'viewer') return value
  throw new Error('Unexpected invitation role.')
}

function expectShareType(value: unknown): DocumentShareType {
  if (value === 'public' || value === 'password') return value
  throw new Error('Unexpected document share type.')
}
