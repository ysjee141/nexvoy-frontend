import {
  createAuthOwnerNamespace,
  createGuestLocalOwnerId,
  createGuestOwnerNamespace,
  isGuestOwnerId,
  requiresAuthenticatedUser,
} from '../guestIdentity'

const guestOwnerId = createGuestLocalOwnerId('device-1')
if (guestOwnerId !== 'guest:device-1') {
  throw new Error('Guest owner id should be normalized.')
}

if (createGuestOwnerNamespace(guestOwnerId) !== 'guest:device-1') {
  throw new Error('Guest namespace should use the guest owner id.')
}

if (createAuthOwnerNamespace('user-1') !== 'user:user-1') {
  throw new Error('Auth namespace should include the auth user id.')
}

if (!isGuestOwnerId(guestOwnerId) || isGuestOwnerId('user-1')) {
  throw new Error('Guest owner detector should only match guest ids.')
}

const required = requiresAuthenticatedUser('backup', null)
if (required.ok || required.reason !== 'login_required') {
  throw new Error('Backup should require an authenticated user.')
}

const allowed = requiresAuthenticatedUser('share', 'user-1')
if (!allowed.ok || allowed.userId !== 'user-1') {
  throw new Error('Authenticated user should be allowed.')
}
