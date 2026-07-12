import type { SignalingMessage } from '@nexvoy/core/sync/signalingChannel'
import {
  createHandshakeDataChannel,
  createWebRtcProvider,
  wireHandshakeDataChannel,
  type WebRtcDataChannelHandshakeResult,
} from './webRtcProvider'
import {
  joinWebSignalingChannel,
  type WebSignalingChannelMembership,
} from './signalingChannel'
import { fetchWebIceServerConfig } from './iceServers'

export interface ConnectWebP2PPeerInput {
  documentId: string
  userId: string
  membership: WebSignalingChannelMembership
  /** Caller decides which side offers; a viewer (canWrite=false) is never allowed to act as initiator. */
  isInitiator: boolean
  onHandshakeComplete?: (result: WebRtcDataChannelHandshakeResult) => void
}

export interface WebP2PConnection {
  readonly peerConnection: RTCPeerConnection
  close(): Promise<void>
}

export class WebP2PSignalingDeniedError extends Error {
  constructor(readonly reason: string | null) {
    super(`web_p2p_signaling_denied:${reason ?? 'unknown'}`)
  }
}

/**
 * Ties the signaling channel (ADR-012) and the WebRTC peer connection
 * factory together to prove a real Web-to-Web P2P connection (TASK-021).
 * This is the first and only consumer of createWebRtcProvider() /
 * joinWebSignalingChannel() in the codebase. Yjs update exchange over the
 * resulting data channel is out of scope — this only proves connectivity.
 */
export async function connectWebP2PPeer(input: ConnectWebP2PPeerInput): Promise<WebP2PConnection> {
  const signaling = await joinWebSignalingChannel({
    documentId: input.documentId,
    userId: input.userId,
    membership: input.membership,
    onMessage: (message) => {
      void handleSignalingMessage(message)
    },
  })

  if (!signaling.decision.allowed) {
    throw new WebP2PSignalingDeniedError(signaling.decision.reason)
  }

  const isInitiator = input.isInitiator && signaling.decision.canWrite

  const iceConfig = await fetchWebIceServerConfig()
  const provider = createWebRtcProvider({ iceServers: iceConfig.iceServers })
  const peerConnection = await provider.createPeerConnection()

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
    const dataChannel = createHandshakeDataChannel(peerConnection)
    wireHandshakeDataChannel(dataChannel, { onHandshakeComplete: input.onHandshakeComplete })

    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)
    signaling.send({ type: 'offer', senderId: input.userId, sdp: offer.sdp ?? '' })
  } else {
    peerConnection.addEventListener('datachannel', (event) => {
      wireHandshakeDataChannel(event.channel, { onHandshakeComplete: input.onHandshakeComplete })
    })
  }

  async function handleSignalingMessage(message: SignalingMessage): Promise<void> {
    if (message.senderId === input.userId) return

    if (message.type === 'offer') {
      await peerConnection.setRemoteDescription({ type: 'offer', sdp: message.sdp })
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      signaling.send({ type: 'answer', senderId: input.userId, sdp: answer.sdp ?? '' })
      return
    }

    if (message.type === 'answer') {
      await peerConnection.setRemoteDescription({ type: 'answer', sdp: message.sdp })
      return
    }

    await peerConnection.addIceCandidate({
      candidate: message.candidate,
      sdpMid: message.sdpMid,
      sdpMLineIndex: message.sdpMLineIndex ?? undefined,
    })
  }

  return {
    peerConnection,
    async close() {
      await signaling.leave()
      await provider.close()
    },
  }
}
