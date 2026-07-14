'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { connectWebP2PPeer, type WebP2PConnection } from '@/lib/local-first/webP2PConnection'

/**
 * Temporary manual verification harness for TASK-021 (not a product page).
 * Open this in two browser sessions logged in as two different accepted
 * members of the same document, then compare connection state on both.
 * Safe to delete once manual verification is done.
 */
export default function P2PTestPage() {
  const [documentId, setDocumentId] = useState('')
  const [isInitiator, setIsInitiator] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [connection, setConnection] = useState<WebP2PConnection | null>(null)

  function appendLog(line: string) {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} ${line}`])
  }

  async function handleConnect() {
    setLog([])
    try {
      const supabase = createClient()
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        appendLog(`ERROR: not logged in (${userError?.message ?? 'no user'})`)
        return
      }
      const userId = userData.user.id
      appendLog(`userId=${userId}`)

      // @nexvoy/types' generated Database type predates document_members
      // (pre-existing gap, unrelated to TASK-021) — cast for this scratch query only.
      const { data: member, error: memberError } = await (supabase as unknown as {
        from: (table: 'document_members') => {
          select: (columns: 'role,status') => {
            eq: (column: string, value: string) => {
              eq: (column: string, value: string) => {
                maybeSingle: () => Promise<{
                  data: { role: string; status: string } | null
                  error: { message: string } | null
                }>
              }
            }
          }
        }
      })
        .from('document_members')
        .select('role,status')
        .eq('document_id', documentId)
        .eq('user_id', userId)
        .maybeSingle()
      if (memberError) {
        appendLog(`ERROR fetching membership: ${memberError.message}`)
        return
      }
      appendLog(`membership: role=${member?.role ?? 'none'} status=${member?.status ?? 'none'}`)

      const conn = await connectWebP2PPeer({
        documentId,
        userId,
        membership: {
          role: (member?.role ?? null) as 'owner' | 'editor' | 'viewer' | null,
          status: (member?.status ?? null) as 'pending' | 'accepted' | 'revoked' | null,
        },
        isInitiator,
        onHandshakeComplete: (result) => {
          appendLog(`HANDSHAKE COMPLETE rttMs=${result.rttMs}`)
        },
      })
      setConnection(conn)
      appendLog('signaling channel joined, peer connection created')

      conn.peerConnection.addEventListener('connectionstatechange', () => {
        appendLog(`connectionState=${conn.peerConnection.connectionState}`)
      })
      conn.peerConnection.addEventListener('iceconnectionstatechange', () => {
        appendLog(`iceConnectionState=${conn.peerConnection.iceConnectionState}`)
      })
    } catch (error) {
      appendLog(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function handleClose() {
    await connection?.close()
    setConnection(null)
    appendLog('closed')
  }

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', maxWidth: 720 }}>
      <h1>TASK-021 P2P manual test (temporary)</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <label>
          documentId (= trip id):{' '}
          <input
            value={documentId}
            onChange={(event) => setDocumentId(event.target.value)}
            style={{ width: 360 }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={isInitiator}
            onChange={(event) => setIsInitiator(event.target.checked)}
          />{' '}
          isInitiator (check on exactly one of the two sessions)
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleConnect} disabled={!documentId}>Connect</button>
          <button onClick={handleClose} disabled={!connection}>Close</button>
        </div>
      </div>
      <pre style={{ background: '#111', color: '#0f0', padding: 12, minHeight: 200, whiteSpace: 'pre-wrap' }}>
        {log.join('\n')}
      </pre>
    </div>
  )
}
