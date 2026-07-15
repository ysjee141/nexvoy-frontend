import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createInvitationRepository } from '../invitationRepository'

const calls: Array<{ name: string; params?: Record<string, unknown> }> = []
const responses: Record<string, unknown> = {
  create_document_invitation_link: {
    id: 'invite-1', document_id: 'document-1', role: 'editor', token: 'token',
    invite_code: 'ABC123', expires_at: null, max_uses: 1,
    target_email: 'friend@example.com', invitation_kind: 'targeted',
  },
  list_my_pending_document_invitations: [{
    id: 'invite-1', document_id: 'document-1', role: 'editor', destination: '전주',
    start_date: '2026-07-20', end_date: '2026-07-24', owner_nickname: 'owner',
    expires_at: null, created_at: '2026-07-16T00:00:00.000Z',
  }],
  list_document_collaborators: [{
    member_id: 'member-1', user_id: 'user-1', invited_email: null, nickname: 'owner',
    email: 'owner@example.com', role: 'owner', status: 'accepted',
    created_at: '2026-07-16T00:00:00.000Z', updated_at: '2026-07-16T00:00:00.000Z',
  }],
}

const supabase = {
  rpc: async (name: string, params?: Record<string, unknown>) => {
    calls.push({ name, params })
    return { data: responses[name] ?? null, error: null }
  },
} as unknown as SupabaseClient

async function main(): Promise<void> {
  const repository = createInvitationRepository(supabase)
  const created = await repository.createDocumentInvitationLink({
    documentId: 'document-1', role: 'editor', targetEmail: 'friend@example.com',
    destination: '전주', startDate: '2026-07-20', endDate: '2026-07-24',
  })

  assert.equal(created.invitationKind, 'targeted')
  assert.equal(created.targetEmail, 'friend@example.com')
  assert.deepEqual(calls[0], {
    name: 'create_document_invitation_link',
    params: {
      p_document_id: 'document-1', p_role: 'editor', p_expires_at: null, p_max_uses: 1,
      p_target_email: 'friend@example.com', p_destination: '전주',
      p_start_date: '2026-07-20', p_end_date: '2026-07-24',
    },
  })

  const pending = await repository.listMyPendingDocumentInvitations()
  assert.equal(pending[0]?.destination, '전주')
  assert.equal(pending[0]?.ownerNickname, 'owner')

  const collaborators = await repository.listDocumentCollaborators('document-1')
  assert.equal(collaborators[0]?.role, 'owner')
  assert.equal(collaborators[0]?.status, 'accepted')
}

void main()
