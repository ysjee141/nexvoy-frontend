import { RTCPeerConnection } from 'react-native-webrtc'
import type { SignalingMessage } from '@nexvoy/core/sync/signalingChannel'
import {
  createMobileHandshakeDataChannel,
  createMobileWebRtcProvider,
  wireMobileHandshakeDataChannel,
  type MobileWebRtcDataChannelHandshakeResult,
} from './webRtcProvider.native'
import {
  joinMobileSignalingChannel,
  type MobileSignalingChannelMembership,
} from './signalingChannel'
import { fetchMobileIceServerConfig } from './iceServers'

export interface ConnectMobileP2PPeerInput {
  documentId: string
  userId: string
  membership: MobileSignalingChannelMembership
  /** Caller decides which side offers; a viewer (canWrite=false) is never allowed to act as initiator. */
  isInitiator: boolean
  onHandshakeComplete?: (result: MobileWebRtcDataChannelHandshakeResult) => void
}

export interface MobileP2PConnection {
  readonly peerConnection: RTCPeerConnection
  close(): Promise<void>
}

export class MobileP2PSignalingDeniedError extends Error {
  constructor(readonly reason: string | null) {
    super(`mobile_p2p_signaling_denied:${reason ?? 'unknown'}`)
  }
}

/**
 * Ties the mobile signaling channel and native WebRTC provider together for
 * Web-Mobile and Mobile-Mobile connectivity validation. Yjs update exchange is
 * intentionally out of scope for TASK-023.
 */
export async function connectMobileP2PPeer(
  input: ConnectMobileP2PPeerInput,
): Promise<MobileP2PConnection> {
  let peerConnection: RTCPeerConnection | null = null
  let sendSignalingMessage: (message: SignalingMessage) => void = () => {}
  const pendingMessages: SignalingMessage[] = []

  const signaling = await joinMobileSignalingChannel({
    documentId: input.documentId,
    userId: input.userId,
    membership: input.membership,
    onMessage: (message) => {
      if (!peerConnection) {
        pendingMessages.push(message)
        return
      }
      void handleSignalingMessage(peerConnection, sendSignalingMessage, input.userId, message)
    },
  })

  if (!signaling.decision.allowed) {
    throw new MobileP2PSignalingDeniedError(signaling.decision.reason)
  }

  sendSignalingMessage = signaling.send
  let provider: ReturnType<typeof createMobileWebRtcProvider> | null = null

  try {
    const isInitiator = input.isInitiator && signaling.decision.canWrite
    const iceConfig = await fetchMobileIceServerConfig()
    provider = createMobileWebRtcProvider({ iceServers: iceConfig.iceServers })
    peerConnection = await provider.createPeerConnection() as RTCPeerConnection

    const peerConnectionEvents = peerConnection as unknown as {
      addEventListener?: (
        eventName: 'icecandidate' | 'datachannel',
        listener: (event: {
          candidate?: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null }
          channel?: Parameters<typeof wireMobileHandshakeDataChannel>[0]
        }) => void,
      ) => void
    }

    peerConnectionEvents.addEventListener?.('icecandidate', (event) => {
      if (!event.candidate) return
      signaling.send({
        type: 'ice-candidate',
        senderId: input.userId,
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid ?? null,
        sdpMLineIndex: event.candidate.sdpMLineIndex ?? null,
      })
    })

    if (isInitiator) {
      const dataChannel = createMobileHandshakeDataChannel(peerConnection)
      wireMobileHandshakeDataChannel(dataChannel, {
        onHandshakeComplete: input.onHandshakeComplete,
      })

      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      signaling.send({ type: 'offer', senderId: input.userId, sdp: offer.sdp ?? '' })
    } else {
      peerConnectionEvents.addEventListener?.('datachannel', (event) => {
        if (!event.channel) return
        wireMobileHandshakeDataChannel(event.channel, {
          onHandshakeComplete: input.onHandshakeComplete,
        })
      })
    }

    for (const message of pendingMessages.splice(0)) {
      void handleSignalingMessage(peerConnection, sendSignalingMessage, input.userId, message)
    }
  } catch (error) {
    await signaling.leave()
    await provider?.close()
    throw error
  }

  return {
    peerConnection,
    async close() {
      await signaling.leave()
      await provider.close()
    },
  }
}

async function handleSignalingMessage(
  peerConnection: RTCPeerConnection,
  send: (message: SignalingMessage) => void,
  userId: string,
  message: SignalingMessage,
): Promise<void> {
  if (message.senderId === userId) return

  if (message.type === 'offer') {
    await peerConnection.setRemoteDescription({ type: 'offer', sdp: message.sdp })
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    send({ type: 'answer', senderId: userId, sdp: answer.sdp ?? '' })
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
