'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  canAttemptP2PReconnect,
  getP2PReconnectDelayMs,
  normalizeP2PReconnectPolicy,
} from '@nexvoy/core/sync/p2pLifecycle'
import type { P2PConnectionStatus } from '@/components/trips/P2PConnectionStatusBadge'
import {
  connectWebP2PPeer,
  type WebP2PConnection,
} from './webP2PConnection'
import type { WebSignalingChannelMembership } from './signalingChannel'
import { logP2PEvent } from './iceServers'

export interface WebP2PDocumentMember {
  user_id?: string | null
  role?: string | null
  status?: string | null
}

export interface UseWebP2PDocumentConnectionInput {
  enabled: boolean
  documentId: string | null
  currentUserId: string | null
  ownerId: string | null
  members: WebP2PDocumentMember[]
}

const CONNECTION_TIMEOUT_MS = 15_000
const RECONNECT_POLICY = normalizeP2PReconnectPolicy({
  maxAttempts: 3,
  initialDelayMs: 1_000,
  maxDelayMs: 8_000,
  multiplier: 2,
})

export function useWebP2PDocumentConnection(
  input: UseWebP2PDocumentConnectionInput,
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
    let reconnectId: ReturnType<typeof setTimeout> | null = null
    let reconnectPending = false
    let reconnectAttempts = 0

    const clearConnectionTimeout = () => {
      if (!timeoutId) return
      clearTimeout(timeoutId)
      timeoutId = null
    }

    const clearReconnectTimeout = () => {
      if (!reconnectId) return
      clearTimeout(reconnectId)
      reconnectId = null
      reconnectPending = false
    }

    const closeCurrentConnection = () => {
      const currentConnection = connection
      connection = null
      void currentConnection?.close()
    }

    const startConnectionTimeout = () => {
      clearConnectionTimeout()
      timeoutId = setTimeout(() => {
        if (!closed) scheduleReconnect('timeout')
      }, CONNECTION_TIMEOUT_MS)
    }

    const setConnected = () => {
      if (closed) return
      clearConnectionTimeout()
      clearReconnectTimeout()
      reconnectPending = false
      reconnectAttempts = 0
      setStatus('connected')
    }

    const scheduleReconnect = (reason: string) => {
      if (closed || reconnectPending) return
      reconnectPending = true
      clearConnectionTimeout()
      closeCurrentConnection()
      const nextAttempt = reconnectAttempts + 1

      if (!canAttemptP2PReconnect(nextAttempt, RECONNECT_POLICY)) {
        logP2PEvent({
          name: 'p2p_reconnect_exhausted',
          platform: 'web',
          reason,
          count: reconnectAttempts,
        })
        reconnectPending = false
        setStatus('fallback')
        return
      }

      reconnectAttempts = nextAttempt
      const delayMs = getP2PReconnectDelayMs(nextAttempt, RECONNECT_POLICY)
      logP2PEvent({
        name: 'p2p_reconnect_scheduled',
        platform: 'web',
        reason,
        count: nextAttempt,
      })
      setStatus('connecting')
      reconnectId = setTimeout(() => {
        reconnectId = null
        reconnectPending = false
        connect()
      }, delayMs)
    }

    const connect = () => {
      if (closed) return
      clearConnectionTimeout()
      setStatus('connecting')
      startConnectionTimeout()
      if (reconnectAttempts > 0) {
        logP2PEvent({
          name: 'p2p_reconnect_attempted',
          platform: 'web',
          count: reconnectAttempts,
        })
      }

      void connectWebP2PPeer({
        documentId: plan.documentId,
        userId: plan.currentUserId,
        membership: plan.membership,
        isInitiator: plan.isInitiator,
        onHandshakeComplete: setConnected,
        onUpdateApplied: setConnected,
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
            setConnected()
          }
          if (
            peerConnection.connectionState === 'failed'
            || peerConnection.connectionState === 'disconnected'
            || peerConnection.connectionState === 'closed'
          ) {
            scheduleReconnect(peerConnection.connectionState)
          }
        })
      }).catch((error) => {
        if (!closed) {
          scheduleReconnect(error instanceof Error ? error.name : 'connect_failed')
        }
      })
    }

    const handlePageLifecycleCleanup = () => {
      if (closed) return
      logP2PEvent({ name: 'p2p_lifecycle_cleanup', platform: 'web', reason: 'pagehide' })
      closed = true
      clearConnectionTimeout()
      clearReconnectTimeout()
      closeCurrentConnection()
    }

    connect()
    window.addEventListener('pagehide', handlePageLifecycleCleanup)
    window.addEventListener('beforeunload', handlePageLifecycleCleanup)

    return () => {
      closed = true
      window.removeEventListener('pagehide', handlePageLifecycleCleanup)
      window.removeEventListener('beforeunload', handlePageLifecycleCleanup)
      clearConnectionTimeout()
      clearReconnectTimeout()
      closeCurrentConnection()
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
  input: UseWebP2PDocumentConnectionInput,
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
  input: UseWebP2PDocumentConnectionInput,
): input is UseWebP2PDocumentConnectionInput & {
  documentId: string
  currentUserId: string
  ownerId: string
} {
  return Boolean(input.enabled && input.documentId && input.currentUserId && input.ownerId)
}

function resolveMembership(
  input: UseWebP2PDocumentConnectionInput,
): WebSignalingChannelMembership | null {
  if (input.currentUserId === input.ownerId) {
    return { role: 'owner', status: 'accepted' }
  }

  const member = input.members.find((candidate) => candidate.user_id === input.currentUserId)
  if (!member) return null
  if (!isDocumentRole(member.role) || member.status !== 'accepted') return null
  return { role: member.role, status: 'accepted' }
}

function getWritableMemberIds(input: UseWebP2PDocumentConnectionInput): string[] {
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

function createMemberSignature(members: WebP2PDocumentMember[]): string {
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
