# TASK-027 Implementation Plan

## Scope

Introduce a Mobile Yjs runtime adapter so Web and Mobile use the same Yjs update format for local storage, encrypted restore, and P2P data-channel exchange. Keep RN/Expo APIs inside `apps/mobile/lib/local-first`; do not add platform dependencies to `packages/core`.

## Planned Changes

1. Add `apps/mobile/lib/local-first/mobileYjsTripDocument.ts`
   - Wrap `@nexvoy/core/local-first/yjsTripDocument`.
   - Persist encoded Yjs updates in AsyncStorage.
   - Expose Mobile-specific create/read/write/apply/encode helpers.

2. Add Mobile P2P update bridge
   - Track active document senders in memory.
   - Publish local encoded Yjs updates to active peers.
   - Apply remote data-channel updates to the Mobile Yjs store without writing document content to logs/signaling metadata.

3. Extend Mobile native data channel
   - Keep TASK-023 ping/pong handshake.
   - Parse and send TASK-024 `yjs-update` / `yjs-update-chunk` protocol messages.
   - Reassemble chunks in `connectMobileP2PPeer()` before applying them locally.

4. Connect backup bootstrap/restore
   - Mobile owner bootstrap creates an encrypted Yjs snapshot instead of a JSON marker.
   - Mobile restore applies opaque Web/Yjs snapshot plaintext to the local Mobile Yjs store after decrypt/hash verification.

5. Dependency and docs
   - Add `yjs` as an explicit `nexvoy-app` dependency for Metro resolution.
   - Update task status, walkthrough, and phase artifacts.

## Validation

- `pnpm --filter @nexvoy/core test`
- `pnpm --filter nexvoy-app typecheck`
- `pnpm typecheck`
- `pnpm build`
- `pnpm build:mobile`

## Non-goals

- Product UI for connection status.
- Background/reconnect lifecycle hardening.
- Server-side Yjs interpretation.
- Full Mobile checklist repository migration to document-primary writes.
