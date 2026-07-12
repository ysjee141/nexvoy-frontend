# TASK-024 Implementation Plan

## Scope

Implement P2P Yjs update exchange for Web-to-Web sessions only. Mobile remains at TASK-023 signaling/data-channel handshake capability because RN cannot currently apply Yjs/lib0 updates in-bundle.

## Planned Changes

1. Add `@nexvoy/core/sync/p2pUpdateProtocol`
   - Message envelope for Yjs update transfer.
   - Chunk splitting/reassembly utilities.
   - Tests for single update, chunked update, invalid payload rejection.

2. Extend WebRTC data channel wiring
   - Keep existing ping/pong handshake.
   - Parse update protocol messages on the same channel.
   - Expose a safe `sendUpdate(documentId, update)` API from `connectWebP2PPeer()`.

3. Add Web local-first P2P bridge
   - Track active document connections in memory.
   - Publish local encoded Yjs updates after local mutation.
   - Apply remote updates to IndexedDB without echoing them back to the same channel.

4. Wire checklist writer
   - After local checklist mutation, publish the encoded Yjs update to active P2P peers.
   - Remote P2P update application updates IndexedDB and triggers existing local document broadcast.

5. Update docs and walkthrough
   - Mark TASK-024 complete.
   - Explicitly document Web-only implementation and Mobile follow-up.

## Validation

- `pnpm --filter @nexvoy/core test`
- `pnpm --filter @nexvoy/core typecheck`
- `pnpm --filter nexvoy-app typecheck`
- `pnpm typecheck`
- `pnpm build`
- `pnpm build:mobile`

## Non-goals

- Product UI for connection status.
- Retry queue for disconnected P2P updates.
- Mobile Yjs update parsing/applying.
- Awareness/presence synchronization.
