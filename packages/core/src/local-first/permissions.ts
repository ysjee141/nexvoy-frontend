import type { TripMemberRole, TripMemberStatus } from './documentModel'

export type DocumentRole = TripMemberRole
export type DocumentMemberStatus = TripMemberStatus

export interface DocumentPermissionSubject {
  role: DocumentRole | null | undefined
  status: DocumentMemberStatus | null | undefined
}

export interface DocumentPermissionPolicy {
  canRead: boolean
  canRestoreBackup: boolean
  canWrite: boolean
  canUploadBackup: boolean
  canInvite: boolean
  canJoinSignaling: boolean
  canWriteSignaling: boolean
  canManageMembers: boolean
}

export function isAcceptedDocumentMember(subject: DocumentPermissionSubject): boolean {
  return subject.status === 'accepted' && isDocumentRole(subject.role)
}

export function isDocumentRole(role: unknown): role is DocumentRole {
  return role === 'owner' || role === 'editor' || role === 'viewer'
}

export function isWritableDocumentRole(role: unknown): role is Extract<DocumentRole, 'owner' | 'editor'> {
  return role === 'owner' || role === 'editor'
}

export function canReadDocument(subject: DocumentPermissionSubject): boolean {
  return isAcceptedDocumentMember(subject)
}

export function canRestoreBackup(subject: DocumentPermissionSubject): boolean {
  return canReadDocument(subject)
}

export function canWriteDocument(subject: DocumentPermissionSubject): boolean {
  return isAcceptedDocumentMember(subject) && isWritableDocumentRole(subject.role)
}

export function canUploadBackup(subject: DocumentPermissionSubject): boolean {
  return canWriteDocument(subject)
}

export function canCreateInvitationLink(subject: DocumentPermissionSubject): boolean {
  return canWriteDocument(subject)
}

export function canJoinSignalingRoom(subject: DocumentPermissionSubject): boolean {
  return canReadDocument(subject)
}

export function canWriteSignalingUpdates(subject: DocumentPermissionSubject): boolean {
  return canWriteDocument(subject)
}

export function canManageDocumentMembers(subject: DocumentPermissionSubject): boolean {
  return isAcceptedDocumentMember(subject) && subject.role === 'owner'
}

export function getDocumentPermissionPolicy(
  subject: DocumentPermissionSubject,
): DocumentPermissionPolicy {
  const canRead = canReadDocument(subject)
  const canWrite = canWriteDocument(subject)

  return {
    canRead,
    canRestoreBackup: canRead,
    canWrite,
    canUploadBackup: canWrite,
    canInvite: canCreateInvitationLink(subject),
    canJoinSignaling: canRead,
    canWriteSignaling: canWrite,
    canManageMembers: canManageDocumentMembers(subject),
  }
}
