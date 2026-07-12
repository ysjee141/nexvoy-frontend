import type { SignalingMessage } from '@nexvoy/core/sync/signalingChannel'
import { P2PUpdateReassembler } from '@nexvoy/core/sync/p2pUpdateProtocol'
import { createClient } from '@/lib/supabase/client'
import {
  createHandshakeDataChannel,
  createWebRtcProvider,
  sendP2PUpdateOverDataChannel,
  wireHandshakeDataChannel,
  type WebRtcDataChannelHandshakeResult,
} from './webRtcProvider'
import {
  joinWebSignalingChannel,
  type WebSignalingChannelMembership,
} from './signalingChannel'
import { fetchWebIceServerConfig } from './iceServers'
import { resolveWebOwnerContext } from './ownerNamespace'
import {
  applyRemoteTripDocumentUpdate,
  registerWebP2PUpdateSender,
} from './p2pUpdateBridge'

export interface ConnectWebP2PPeerInput {
  documentId: string
  userId: string
  membership: WebSignalingChannelMembership
  /** Caller decides which side offers; a viewer (canWrite=false) is never allowed to act as initiator. */
  isInitiator: boolean
  onHandshakeComplete?: (result: WebRtcDataChannelHandshakeResult) => void
  onUpdateApplied?: (input: { updateId: string; byteLength: number }) => void
}

export interface WebP2PConnection {
  readonly peerConnection: RTCPeerConnection
  sendUpdate(update: Uint8Array): boolean
  close(): Promise<void>
}

export class WebP2PSignalingDeniedError extends Error {
  constructor(readonly reason: string | null) {
    super(`web_p2p_signaling_denied:${reason ?? 'unknown'}`)
  }
}

/**
 * Ties the signaling channel (ADR-012) and the WebRTC peer connection
 * factory together for Web-to-Web P2P connections. TASK-024 extends the
 * original ping/pong proof by exchanging Yjs update payloads over the same
 * ordered reliable data channel.
 */
export async function connectWebP2PPeer(input: ConnectWebP2PPeerInput): Promise<WebP2PConnection> {
  let peerConnection: RTCPeerConnection | null = null
  let dataChannel: RTCDataChannel | null = null
  const pendingMessages: SignalingMessage[] = []
  const unregisterUpdateSenders: Array<() => void> = []
  const updateReassembler = new P2PUpdateReassembler()

  const signaling = await joinWebSignalingChannel({
    documentId: input.documentId,
    userId: input.userId,
    membership: input.membership,
    onMessage: (message) => {
      if (!peerConnection) {
        pendingMessages.push(message)
        return
      }
      void handleSignalingMessage(peerConnection, message)
    },
  })

  if (!signaling.decision.allowed) {
    throw new WebP2PSignalingDeniedError(signaling.decision.reason)
  }

  const ownerContext = await resolveWebOwnerContext(createClient())
  let provider: ReturnType<typeof createWebRtcProvider> | null = null

  try {
    const isInitiator = input.isInitiator && signaling.decision.canWrite
    const iceConfig = await fetchWebIceServerConfig()
    provider = createWebRtcProvider({ iceServers: iceConfig.iceServers })
    peerConnection = await provider.createPeerConnection()

    peerConnection.addEventListener('icecandidate', (event) => {
      if (!event.candidate) return
      signaling.send({
        type: 'ice-candidate',
        senderId: input.userId,
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      })
    })

    if (isInitiator) {
      dataChannel = createHandshakeDataChannel(peerConnection)
      attachDataChannel(dataChannel)

      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      signaling.send({ type: 'offer', senderId: input.userId, sdp: offer.sdp ?? '' })
    } else {
      peerConnection.addEventListener('datachannel', (event) => {
        dataChannel = event.channel
        attachDataChannel(event.channel)
      })
    }

    for (const message of pendingMessages.splice(0)) {
      void handleSignalingMessage(peerConnection, message)
    }
  } catch (error) {
    for (const unregister of unregisterUpdateSenders.splice(0)) {
      unregister()
    }
    updateReassembler.clear()
    await signaling.leave()
    await provider?.close()
    throw error
  }

  function attachDataChannel(channel: RTCDataChannel): void {
    wireHandshakeDataChannel(channel, {
      onHandshakeComplete: input.onHandshakeComplete,
      onUpdateMessage: (message) => {
        const reassembled = updateReassembler.ingest(message)
        if (!reassembled || reassembled.documentId !== input.documentId) return
        void applyRemoteTripDocumentUpdate({
          namespace: ownerContext.namespace,
          documentId: input.documentId,
          update: reassembled.update,
        }).then(() => {
          input.onUpdateApplied?.({
            updateId: reassembled.updateId,
            byteLength: reassembled.update.byteLength,
          })
        }).catch(() => undefined)
      },
    })
    unregisterUpdateSenders.push(registerWebP2PUpdateSender({
      documentId: input.documentId,
      send: (update) => sendP2PUpdateOverDataChannel({
        dataChannel: channel,
        documentId: input.documentId,
        update,
      }),
    }))
  }

  async function handleSignalingMessage(
    targetPeerConnection: RTCPeerConnection,
    message: SignalingMessage,
  ): Promise<void> {
    if (message.senderId === input.userId) return

    if (message.type === 'offer') {
      await targetPeerConnection.setRemoteDescription({ type: 'offer', sdp: message.sdp })
      const answer = await targetPeerConnection.createAnswer()
      await targetPeerConnection.setLocalDescription(answer)
      signaling.send({ type: 'answer', senderId: input.userId, sdp: answer.sdp ?? '' })
      return
    }

    if (message.type === 'answer') {
      await targetPeerConnection.setRemoteDescription({ type: 'answer', sdp: message.sdp })
      return
    }

    await targetPeerConnection.addIceCandidate({
      candidate: message.candidate,
      sdpMid: message.sdpMid,
      sdpMLineIndex: message.sdpMLineIndex ?? undefined,
    })
  }

  return {
    peerConnection,
    sendUpdate(update) {
      return dataChannel
        ? sendP2PUpdateOverDataChannel({
          dataChannel,
          documentId: input.documentId,
          update,
        })
        : false
    },
    async close() {
      for (const unregister of unregisterUpdateSenders.splice(0)) {
        unregister()
      }
      updateReassembler.clear()
      await signaling.leave()
      await provider?.close()
    },
  }
}
