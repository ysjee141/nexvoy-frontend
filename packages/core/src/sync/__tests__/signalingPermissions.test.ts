import { validateSignalingJoinPolicy } from '../signalingPermissions'

run()

function run(): void {
  const owner = validateSignalingJoinPolicy({
    documentId: 'document-1',
    userId: 'user-1',
    role: 'owner',
    status: 'accepted',
    hasValidRoomSecretProof: true,
  })
  assert(owner.allowed && owner.canRead && owner.canWrite && owner.canInvite, 'owner can join/write/invite')

  const editor = validateSignalingJoinPolicy({
    documentId: 'document-1',
    userId: 'user-2',
    role: 'editor',
    status: 'accepted',
    hasValidRoomSecretProof: true,
  })
  assert(editor.allowed && editor.canWrite && editor.canInvite, 'editor can join/write/invite')

  const viewer = validateSignalingJoinPolicy({
    documentId: 'document-1',
    userId: 'user-3',
    role: 'viewer',
    status: 'accepted',
    hasValidRoomSecretProof: true,
  })
  assert(viewer.allowed && viewer.canRead && !viewer.canWrite && !viewer.canInvite, 'viewer is read-only')

  const pending = validateSignalingJoinPolicy({
    documentId: 'document-1',
    userId: 'user-4',
    role: 'editor',
    status: 'pending',
    hasValidRoomSecretProof: true,
  })
  assert(!pending.allowed && pending.reason === 'invalid_membership', 'pending member cannot join')

  const badProof = validateSignalingJoinPolicy({
    documentId: 'document-1',
    userId: 'user-5',
    role: 'viewer',
    status: 'accepted',
    hasValidRoomSecretProof: false,
  })
  assert(!badProof.allowed && badProof.reason === 'invalid_room_secret_proof', 'room proof is required')
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}
