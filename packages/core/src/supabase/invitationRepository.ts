import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createKeyProvisioningStatusRecord,
  sanitizeKeyProvisioningErrorCode,
  sortKeyProvisioningRequests,
  type BegunDocumentKeyProvisioningRequest,
  type DocumentKeyProvisioningRequest,
  type DocumentKeyProvisioningStatus,
  type DocumentKeyProvisioningStatusRecord,
  type SafeKeyProvisioningErrorCode,
  type UserKeyMaterialRegistration,
} from '../sync/keyProvisioning'

export type DocumentInvitationRole = 'editor' | 'viewer'
export type DocumentShareType = 'public' | 'password'

export interface CreateDocumentInvitationInput {
  documentId: string
  role: DocumentInvitationRole
  expiresAt?: string | null
  maxUses?: number | null
}

export interface CreatedDocumentInvitation {
  id: string
  documentId: string
  role: DocumentInvitationRole
  token: string
  inviteCode: string
  expiresAt: string | null
  maxUses: number | null
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
  requiresKeyProvisioning: boolean
  keyProvisioningStatus: DocumentKeyProvisioningStatus
  queuedRequestCount: number
}

export interface DocumentMemberRoleChange {
  memberId: string
  role: DocumentInvitationRole
}

export interface RevokedDocumentMember {
  documentId: string
  memberId: string
  userId: string | null
  revokedKeyCount: number
}

export interface ProvisionAcceptedMemberKeyInput {
  requestId: string
  documentId: string
  userId: string
  deviceId: string
  keyVersion: number
  wrappedDek: Uint8Array
  wrappingAlg?: 'RSA-OAEP-256'
}

export interface RegisterUserKeyMaterialInput {
  deviceId: string
  publicKeyJwk: Record<string, unknown>
  materialVersion?: number
  wrappingAlg?: 'RSA-OAEP-256'
}

export interface RequestDocumentKeyProvisioningInput {
  documentId: string
  deviceId: string
  keyVersion?: number
}

export interface ListDocumentKeyProvisioningRequestsInput {
  documentId?: string | null
  limit?: number
}

export interface CompleteDocumentKeyProvisioningInput {
  requestId: string
  wrappedDek: Uint8Array
  keyVersion?: number
  wrappingAlg?: 'RSA-OAEP-256'
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

export interface LegacyTripInvitationSummary {
  trip_id: string
  destination: string
  start_date: string
  end_date: string
  owner_nickname: string | null
  member_count: number
}

export interface InvitationRepository {
  createDocumentInvitationLink(input: CreateDocumentInvitationInput): Promise<CreatedDocumentInvitation>
  getDocumentInvitationSummary(input: DocumentInvitationLookup): Promise<DocumentInvitationSummary | null>
  acceptDocumentInvitation(input: DocumentInvitationLookup): Promise<AcceptedDocumentInvitation>
  registerUserKeyMaterial(input: RegisterUserKeyMaterialInput): Promise<UserKeyMaterialRegistration>
  requestDocumentKeyProvisioning(input: RequestDocumentKeyProvisioningInput): Promise<DocumentKeyProvisioningStatusRecord>
  getMyDocumentKeyProvisioningStatus(input: RequestDocumentKeyProvisioningInput): Promise<DocumentKeyProvisioningStatusRecord>
  listPendingDocumentKeyProvisioningRequests(input?: ListDocumentKeyProvisioningRequestsInput): Promise<DocumentKeyProvisioningRequest[]>
  beginDocumentKeyProvisioning(requestId: string): Promise<BegunDocumentKeyProvisioningRequest | DocumentKeyProvisioningStatusRecord>
  completeDocumentKeyProvisioning(input: CompleteDocumentKeyProvisioningInput): Promise<DocumentKeyProvisioningStatusRecord>
  markDocumentKeyProvisioningFailed(input: { requestId: string; errorCode: SafeKeyProvisioningErrorCode }): Promise<DocumentKeyProvisioningStatusRecord>
  revokeDocumentInvitationLink(invitationId: string): Promise<void>
  setDocumentMemberRole(input: DocumentMemberRoleChange): Promise<void>
  revokeDocumentMember(memberId: string): Promise<RevokedDocumentMember>
  provisionAcceptedMemberKey(input: ProvisionAcceptedMemberKeyInput): Promise<void>
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
    registerUserKeyMaterial: async (input) => {
      const { data, error } = await sb.rpc('register_user_key_material', {
        p_device_id: input.deviceId,
        p_wrapping_alg: input.wrappingAlg ?? 'RSA-OAEP-256',
        p_public_key_jwk: input.publicKeyJwk,
        p_material_version: input.materialVersion ?? 1,
      })
      if (error) throw error
      return toUserKeyMaterialRegistration(data)
    },
    requestDocumentKeyProvisioning: async (input) => {
      const { data, error } = await sb.rpc('request_document_key_provisioning', {
        p_document_id: input.documentId,
        p_device_id: input.deviceId,
        p_key_version: input.keyVersion ?? 1,
      })
      if (error) throw error
      return toDocumentKeyProvisioningStatus(data, input.documentId, input.deviceId)
    },
    getMyDocumentKeyProvisioningStatus: async (input) => {
      const { data, error } = await sb.rpc('get_my_document_key_provisioning_status', {
        p_document_id: input.documentId,
        p_device_id: input.deviceId,
        p_key_version: input.keyVersion ?? 1,
      })
      if (error) throw error
      return toDocumentKeyProvisioningStatus(data, input.documentId, input.deviceId)
    },
    listPendingDocumentKeyProvisioningRequests: async (input = {}) => {
      const { data, error } = await sb.rpc('list_pending_document_key_provisioning_requests', {
        p_document_id: input.documentId ?? null,
        p_limit: input.limit ?? 50,
      })
      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      return sortKeyProvisioningRequests(rows.map(toDocumentKeyProvisioningRequest))
    },
    beginDocumentKeyProvisioning: async (requestId) => {
      const { data, error } = await sb.rpc('begin_document_key_provisioning', {
        p_request_id: requestId,
      })
      if (error) throw error
      const row = expectRecord(data)
      if (row.status === 'processing') return toBegunDocumentKeyProvisioningRequest(row)
      return toDocumentKeyProvisioningStatus(row, nullableString(row.document_id) ?? '', nullableString(row.device_id))
    },
    completeDocumentKeyProvisioning: async (input) => {
      const { data, error } = await sb.rpc('complete_document_key_provisioning', {
        p_request_id: input.requestId,
        p_wrapped_dek: input.wrappedDek,
        p_wrapping_alg: input.wrappingAlg ?? 'RSA-OAEP-256',
        p_key_version: input.keyVersion ?? null,
      })
      if (error) throw error
      return toDocumentKeyProvisioningStatus(data, '', null)
    },
    markDocumentKeyProvisioningFailed: async (input) => {
      const { data, error } = await sb.rpc('mark_document_key_provisioning_failed', {
        p_request_id: input.requestId,
        p_error_code: input.errorCode,
      })
      if (error) throw error
      return toDocumentKeyProvisioningStatus(data, '', null)
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
    provisionAcceptedMemberKey: async (input) => {
      const { error } = await sb.rpc('complete_document_key_provisioning', {
        p_request_id: input.requestId,
        p_wrapped_dek: input.wrappedDek,
        p_wrapping_alg: input.wrappingAlg ?? 'RSA-OAEP-256',
        p_key_version: input.keyVersion,
      })
      if (error) throw error
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

export async function getInvitationSummaryWithLegacyFallback(
  sb: SupabaseClient,
  input: DocumentInvitationLookup,
): Promise<
  | { source: 'document'; summary: DocumentInvitationSummary | null }
  | { source: 'legacy'; summary: LegacyTripInvitationSummary | null }
> {
  if (input.inviteCode) {
    return {
      source: 'document',
      summary: await createInvitationRepository(sb).getDocumentInvitationSummary(input),
    }
  }

  try {
    return {
      source: 'document',
      summary: await createInvitationRepository(sb).getDocumentInvitationSummary(input),
    }
  } catch (error) {
    if (!input.token) throw error
    const { data, error: legacyError } = await sb.rpc('get_trip_summary_by_token', {
      p_token: input.token,
    })
    if (legacyError) throw legacyError
    return { source: 'legacy', summary: normalizeNullable(data) as LegacyTripInvitationSummary | null }
  }
}

export async function acceptInvitationWithLegacyFallback(
  sb: SupabaseClient,
  input: DocumentInvitationLookup,
): Promise<
  | { source: 'document'; result: AcceptedDocumentInvitation }
  | { source: 'legacy'; tripId: string | null }
> {
  if (input.inviteCode) {
    return {
      source: 'document',
      result: await createInvitationRepository(sb).acceptDocumentInvitation(input),
    }
  }

  try {
    return {
      source: 'document',
      result: await createInvitationRepository(sb).acceptDocumentInvitation(input),
    }
  } catch (error) {
    if (!input.token) throw error
    const { data, error: legacyError } = await sb.rpc('join_trip_via_token', {
      p_token: input.token,
    })
    if (legacyError) throw legacyError
    return { source: 'legacy', tripId: data ? String(data) : null }
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
    requiresKeyProvisioning: Boolean(row.requires_key_provisioning),
    keyProvisioningStatus: row.key_provisioning_status
      ? createKeyProvisioningStatusRecord({
        documentId: expectString(row.document_id),
        deviceId: null,
        status: row.key_provisioning_status,
        hasActiveKey: !Boolean(row.requires_key_provisioning),
      }).status
      : (Boolean(row.requires_key_provisioning) ? 'pending' : 'completed'),
    queuedRequestCount: nullableNumber(row.queued_request_count) ?? 0,
  }
}

function toUserKeyMaterialRegistration(value: unknown): UserKeyMaterialRegistration {
  const row = expectRecord(value)
  return {
    id: expectString(row.id),
    userId: expectString(row.user_id),
    deviceId: expectString(row.device_id),
    wrappingAlg: expectRsaWrappingAlg(row.wrapping_alg),
    materialVersion: expectNumber(row.material_version),
    status: expectMaterialStatus(row.status),
    queuedRequestCount: nullableNumber(row.queued_request_count) ?? 0,
    createdAt: expectString(row.created_at),
    updatedAt: expectString(row.updated_at),
  }
}

function toDocumentKeyProvisioningStatus(
  value: unknown,
  fallbackDocumentId: string,
  fallbackDeviceId: string | null,
): DocumentKeyProvisioningStatusRecord {
  const row = expectRecord(value)
  return createKeyProvisioningStatusRecord({
    id: nullableString(row.id) ?? undefined,
    documentId: nullableString(row.document_id) ?? fallbackDocumentId,
    userId: nullableString(row.user_id) ?? undefined,
    deviceId: nullableString(row.device_id) ?? fallbackDeviceId,
    keyVersion: nullableNumber(row.key_version) ?? 1,
    status: row.status,
    errorCode: row.error_code,
    attemptCount: nullableNumber(row.attempt_count) ?? 0,
    hasActiveKey: row.has_active_key == null ? undefined : Boolean(row.has_active_key),
    requestedAt: nullableString(row.requested_at),
    updatedAt: nullableString(row.updated_at),
  })
}

function toDocumentKeyProvisioningRequest(value: unknown): DocumentKeyProvisioningRequest {
  const row = expectRecord(value)
  return {
    id: expectString(row.id),
    documentId: expectString(row.document_id),
    userId: expectString(row.user_id),
    deviceId: expectString(row.device_id),
    materialId: expectString(row.material_id),
    wrappingAlg: expectRsaWrappingAlg(row.wrapping_alg),
    publicKeyJwk: expectJsonObject(row.public_key_jwk),
    materialVersion: expectNumber(row.material_version),
    memberRole: expectMemberRole(row.member_role),
    status: expectProcessableProvisioningStatus(row.status),
    keyVersion: expectNumber(row.key_version),
    errorCode: row.error_code == null ? null : sanitizeKeyProvisioningErrorCode(row.error_code),
    attemptCount: expectNumber(row.attempt_count),
    requestedAt: expectString(row.requested_at),
    updatedAt: expectString(row.updated_at),
  }
}

function toBegunDocumentKeyProvisioningRequest(value: unknown): BegunDocumentKeyProvisioningRequest {
  const request = toDocumentKeyProvisioningRequest(value)
  if (request.status !== 'processing') throw new Error('Unexpected key provisioning RPC response.')
  return request as BegunDocumentKeyProvisioningRequest
}

function toRevokedDocumentMember(value: unknown): RevokedDocumentMember {
  const row = expectRecord(value)
  return {
    documentId: expectString(row.document_id),
    memberId: expectString(row.member_id),
    userId: nullableString(row.user_id),
    revokedKeyCount: expectNumber(row.revoked_key_count),
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

function expectMemberRole(value: unknown): 'owner' | 'editor' | 'viewer' {
  if (value === 'owner' || value === 'editor' || value === 'viewer') return value
  throw new Error('Unexpected member role.')
}

function expectMaterialStatus(value: unknown): 'active' | 'revoked' {
  if (value === 'active' || value === 'revoked') return value
  throw new Error('Unexpected key material status.')
}

function expectRsaWrappingAlg(value: unknown): 'RSA-OAEP-256' {
  if (value === 'RSA-OAEP-256') return value
  throw new Error('Unexpected key wrapping algorithm.')
}

function expectProcessableProvisioningStatus(value: unknown): 'pending' | 'failed' | 'processing' {
  if (value === 'pending' || value === 'failed' || value === 'processing') return value
  throw new Error('Unexpected key provisioning status.')
}

function expectJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Unexpected key material payload.')
  }
  return value as Record<string, unknown>
}

function expectShareType(value: unknown): DocumentShareType {
  if (value === 'public' || value === 'password') return value
  throw new Error('Unexpected document share type.')
}
