# TASK-026 Implementation Plan

## Scope

Implement the lifecycle hardening part of TASK-026 first:

1. Web P2P reconnect/backoff for checklist connections.
2. Web page lifecycle cleanup for active signaling/data-channel/peer connections.
3. Mobile P2P adapter cleanup/reconnect primitives around background/foreground lifecycle.
4. P2P lifecycle observability events without document content, raw document id, or signaling room id.
5. Document the rotating room secret rollout boundary. Do not switch production signaling topics to secret-based derivation in the same change unless the RLS/RPC compatibility path is complete.

## Rationale

Web-to-Web checklist P2P is now manually verified. The next highest-risk area is keeping that path stable under common lifecycle events. Rotating room secret changes require coordinated changes across topic derivation, Realtime Authorization RLS, server-issued secret proof, Web, and Mobile. Combining that with reconnect changes would make rollback and debugging difficult.

## Planned Changes

### Core

- Add platform-independent retry/backoff policy helpers.
- Extend P2P observability event names for reconnect and lifecycle cleanup.
- Keep `packages/core` free of DOM/RN/Supabase client APIs.

### Web

- Add bounded reconnect loop to `useWebP2PChecklistConnection`.
- Ensure connection cleanup cancels retry timers and offer retry timers.
- Add page lifecycle cleanup (`pagehide`/`beforeunload`) for active Web P2P connection.
- Preserve current status UI contract: `connecting`, `connected`, `fallback`.

### Mobile

- Make mobile P2P connection close idempotent.
- Add lifecycle-safe hook points around AppState transitions where current adapter users can close/reconnect without leaking channels.
- Avoid adding screen UI in this task.

### Rotating Room Secret

- Keep current deterministic topic plus Realtime Authorization RLS active for this PR.
- Add design notes in TASK-026/README for the required future migration path:
  - server-issued room secret,
  - topic derivation `hash(documentId + secret)`,
  - RLS validation against active secret window,
  - overlap window for old/new topics.

## Verification

- `pnpm --filter @nexvoy/core test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm build:mobile`
- `pnpm --filter nexvoy-app lint`

## Rollback

Remove the reconnect/lifecycle helpers and return to TASK-025 behavior. Since no production topic derivation change is planned in this PR, rollback does not require data migration.
