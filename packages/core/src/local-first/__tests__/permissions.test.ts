import {
  canCreateInvitationLink,
  canJoinSignalingRoom,
  canManageDocumentMembers,
  canReadDocument,
  canUploadBackup,
  canWriteDocument,
  getDocumentPermissionPolicy,
} from '../permissions'

run()

function run(): void {
  assert(canReadDocument({ role: 'owner', status: 'accepted' }), 'owner can read')
  assert(canReadDocument({ role: 'editor', status: 'accepted' }), 'editor can read')
  assert(canReadDocument({ role: 'viewer', status: 'accepted' }), 'viewer can read')

  assert(canWriteDocument({ role: 'owner', status: 'accepted' }), 'owner can write')
  assert(canWriteDocument({ role: 'editor', status: 'accepted' }), 'editor can write')
  assert(!canWriteDocument({ role: 'viewer', status: 'accepted' }), 'viewer cannot write')

  assert(canUploadBackup({ role: 'editor', status: 'accepted' }), 'editor can upload backup')
  assert(!canUploadBackup({ role: 'viewer', status: 'accepted' }), 'viewer cannot upload backup')

  assert(canCreateInvitationLink({ role: 'owner', status: 'accepted' }), 'owner can invite')
  assert(canCreateInvitationLink({ role: 'editor', status: 'accepted' }), 'editor can invite')
  assert(!canCreateInvitationLink({ role: 'viewer', status: 'accepted' }), 'viewer cannot invite')

  assert(canJoinSignalingRoom({ role: 'viewer', status: 'accepted' }), 'viewer can join signaling')
  assert(!canJoinSignalingRoom({ role: 'editor', status: 'pending' }), 'pending cannot join')
  assert(canManageDocumentMembers({ role: 'owner', status: 'accepted' }), 'owner manages members')
  assert(!canManageDocumentMembers({ role: 'editor', status: 'accepted' }), 'editor cannot manage members')

  const revokedPolicy = getDocumentPermissionPolicy({ role: 'owner', status: 'revoked' })
  assert(
    Object.values(revokedPolicy).every((allowed) => allowed === false),
    'revoked members have no permissions',
  )
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}
