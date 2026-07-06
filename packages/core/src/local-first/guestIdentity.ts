export type LocalOwnerId = `guest:${string}`
export type OwnerNamespace = `guest:${string}` | `user:${string}`

export type AuthRequiredAction = 'backup' | 'share' | 'sync' | 'accept_invitation'

export interface AuthRequiredResult {
  ok: false
  reason: 'login_required'
  action: AuthRequiredAction
}

export interface AuthAllowedResult {
  ok: true
  userId: string
}

export function createGuestLocalOwnerId(id: string): LocalOwnerId {
  return id.startsWith('guest:') ? id as LocalOwnerId : `guest:${id}`
}

export function createGuestOwnerNamespace(localOwnerId: LocalOwnerId): OwnerNamespace {
  return localOwnerId
}

export function createAuthOwnerNamespace(userId: string): OwnerNamespace {
  return `user:${userId}`
}

export function requiresAuthenticatedUser(
  action: AuthRequiredAction,
  userId: string | null | undefined,
): AuthAllowedResult | AuthRequiredResult {
  return userId
    ? { ok: true, userId }
    : { ok: false, reason: 'login_required', action }
}

export function isGuestOwnerId(ownerId: string): ownerId is LocalOwnerId {
  return ownerId.startsWith('guest:')
}
