# TASK-028 Implementation Plan

## Scope

Implement rotating signaling room topic hardening for P2P:

1. Add a server-issued active signaling topic table and RPC.
2. Replace Realtime Authorization policies so P2P signaling only works on active server-issued topics.
3. Update Web and Mobile signaling adapters to fetch the topic before joining the private Realtime channel.
4. Keep topic/secret/document content out of logs and observability.

## Design

The client should not derive a joinable topic from the raw document id anymore. The server issues an opaque topic per
document and time window. The topic is stored server-side for Realtime Authorization comparison, returned only through
an authenticated RPC, and never logged by the adapters.

Data model:

- `document_signaling_room_topics`
  - `document_id`
  - `room_topic`
  - `active_from`
  - `expires_at`
  - `revoked_at`
  - `created_by`

RPC:

- `issue_document_signaling_room_topic(p_document_id uuid)`
  - accepted `document_members` can fetch a topic
  - legacy trip owner/member compatibility is preserved while the transition still depends on legacy trip snapshots
  - reuses an unexpired active topic; creates a new one if needed
  - returns `{ room_topic, expires_at }`

Realtime Authorization:

- SELECT: accepted member or legacy trip member can receive only when `realtime.topic()` equals an active topic for that document.
- INSERT: owner/editor or legacy owner/editor can send only when `realtime.topic()` equals an active topic for that document.
- deterministic `signaling:<sha256(documentId)>` topics are no longer authorized.

## Rollout Boundary

This PR updates Web and Mobile adapters in the same change as the RLS migration. Older clients using deterministic
topics will fail P2P signaling and fall back to Supabase backup/legacy sync. That is acceptable for the refactor branch
because P2P remains optional fast path.

## Verification

- `pnpm --filter @nexvoy/core test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter nexvoy-app lint`
- `pnpm build:mobile`

## Rollback

Revert this PR to restore deterministic topic derivation and the TASK-025 Realtime Authorization policies. The new
topic table is independent of document content and can be left unused if rollback is needed.
