'use client'

import { useEffect, useMemo, useState } from 'react'
import type { P2PConnectionStatus } from '@/components/trips/P2PConnectionStatusBadge'
import {
  connectWebP2PPeer,
  type WebP2PConnection,
} from './webP2PConnection'
import type { WebSignalingChannelMembership } from './signalingChannel'

export interface WebP2PChecklistMember {
  user_id?: string | null
  role?: string | null
  status?: string | null
}

export interface UseWebP2PChecklistConnectionInput {
  enabled: boolean
  documentId: string | null
  currentUserId: string | null
  ownerId: string | null
  members: WebP2PChecklistMember[]
}

const CONNECTION_TIMEOUT_MS = 15_000

export function useWebP2PChecklistConnection(
  input: UseWebP2PChecklistConnectionInput,
): P2PConnectionStatus {
  const [status, setStatus] = useState<P2PConnectionStatus>('idle')
  const memberSignature = useMemo(() => createMemberSignature(input.members), [input.members])

  const plan = useMemo(() => createConnectionPlan(input), [
    input.currentUserId,
    input.documentId,
    input.enabled,
    memberSignature,
    input.ownerId,
  ])

  useEffect(() => {
    if (!plan) {
      setStatus(canResolvePlanInput(input) ? 'fallback' : 'idle')
      return
    }

    let closed = false
    let connection: WebP2PConnection | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    setStatus('connecting')
    timeoutId = setTimeout(() => {
      if (!closed) setStatus('fallback')
    }, CONNECTION_TIMEOUT_MS)

    void connectWebP2PPeer({
      documentId: plan.documentId,
      userId: plan.currentUserId,
      membership: plan.membership,
      isInitiator: plan.isInitiator,
      onHandshakeComplete: () => {
        if (!closed) setStatus('connected')
      },
      onUpdateApplied: () => {
        if (!closed) setStatus('connected')
      },
    }).then((nextConnection) => {
      if (closed) {
        void nextConnection.close()
        return
      }
      connection = nextConnection
      const peerConnection = nextConnection.peerConnection
      peerConnection.addEventListener('connectionstatechange', () => {
        if (closed) return
        if (peerConnection.connectionState === 'connected') {
          setStatus('connected')
        }
        if (
          peerConnection.connectionState === 'failed'
          || peerConnection.connectionState === 'disconnected'
          || peerConnection.connectionState === 'closed'
        ) {
          setStatus('fallback')
        }
      })
    }).catch(() => {
      if (!closed) setStatus('fallback')
    })

    return () => {
      closed = true
      if (timeoutId) clearTimeout(timeoutId)
      void connection?.close()
    }
  }, [input.currentUserId, input.documentId, input.enabled, input.ownerId, plan])

  return status
}

interface ConnectionPlan {
  documentId: string
  currentUserId: string
  membership: WebSignalingChannelMembership
  isInitiator: boolean
}

function createConnectionPlan(
  input: UseWebP2PChecklistConnectionInput,
): ConnectionPlan | null {
  if (!canResolvePlanInput(input)) return null

  const membership = resolveMembership(input)
  if (!membership || membership.status !== 'accepted') return null
  if (membership.role !== 'owner' && membership.role !== 'editor') return null

  const writableMemberIds = getWritableMemberIds(input)
  if (writableMemberIds.length < 2) return null

  return {
    documentId: input.documentId,
    currentUserId: input.currentUserId,
    membership,
    isInitiator: writableMemberIds[0] === input.currentUserId,
  }
}

function canResolvePlanInput(
  input: UseWebP2PChecklistConnectionInput,
): input is UseWebP2PChecklistConnectionInput & {
  documentId: string
  currentUserId: string
  ownerId: string
} {
  return Boolean(input.enabled && input.documentId && input.currentUserId && input.ownerId)
}

function resolveMembership(
  input: UseWebP2PChecklistConnectionInput,
): WebSignalingChannelMembership | null {
  if (input.currentUserId === input.ownerId) {
    return { role: 'owner', status: 'accepted' }
  }

  const member = input.members.find((candidate) => candidate.user_id === input.currentUserId)
  if (!member) return null
  if (!isDocumentRole(member.role) || member.status !== 'accepted') return null
  return { role: member.role, status: 'accepted' }
}

function getWritableMemberIds(input: UseWebP2PChecklistConnectionInput): string[] {
  const ids = new Set<string>()
  if (input.ownerId) ids.add(input.ownerId)

  for (const member of input.members) {
    if (
      member.user_id
      && member.status === 'accepted'
      && (member.role === 'owner' || member.role === 'editor')
    ) {
      ids.add(member.user_id)
    }
  }

  return Array.from(ids).sort()
}

function createMemberSignature(members: WebP2PChecklistMember[]): string {
  return members
    .map((member) => [
      member.user_id ?? '',
      member.role ?? '',
      member.status ?? '',
    ].join(':'))
    .sort()
    .join('|')
}

function isDocumentRole(role: unknown): role is WebSignalingChannelMembership['role'] {
  return role === 'owner' || role === 'editor' || role === 'viewer'
}
