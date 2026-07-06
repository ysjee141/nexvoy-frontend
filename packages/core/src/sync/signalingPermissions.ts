import type { DocumentMemberStatus, DocumentRole } from '../local-first/permissions'
import {
  canCreateInvitationLink,
  canJoinSignalingRoom,
  canReadDocument,
  canWriteSignalingUpdates,
  isAcceptedDocumentMember,
  isDocumentRole,
} from '../local-first/permissions'

export type SignalingJoinDenyReason =
  | 'missing_identity'
  | 'invalid_membership'
  | 'invalid_room_secret_proof'

export interface SignalingJoinRequest {
  documentId: string
  userId: string
  role: DocumentRole | null | undefined
  status: DocumentMemberStatus | null | undefined
  hasValidRoomSecretProof: boolean
}

export interface SignalingJoinDecision {
  allowed: boolean
  canRead: boolean
  canWrite: boolean
  canInvite: boolean
  reason: SignalingJoinDenyReason | null
}

export interface SignalingPermissionProvider {
  resolveJoinRequest(input: {
    documentId: string
    userId: string
  }): Promise<Omit<SignalingJoinRequest, 'documentId' | 'userId'>>
}

export function validateSignalingJoinPolicy(
  request: SignalingJoinRequest,
): SignalingJoinDecision {
  if (!request.documentId || !request.userId) {
    return deny('missing_identity')
  }

  if (!isDocumentRole(request.role) || !isAcceptedDocumentMember(request)) {
    return deny('invalid_membership')
  }

  if (!request.hasValidRoomSecretProof) {
    return deny('invalid_room_secret_proof')
  }

  return {
    allowed: canJoinSignalingRoom(request),
    canRead: canReadDocument(request),
    canWrite: canWriteSignalingUpdates(request),
    canInvite: canCreateInvitationLink(request),
    reason: null,
  }
}

function deny(reason: SignalingJoinDenyReason): SignalingJoinDecision {
  return {
    allowed: false,
    canRead: false,
    canWrite: false,
    canInvite: false,
    reason,
  }
}
