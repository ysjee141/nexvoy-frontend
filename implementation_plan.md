# TASK-025 Implementation Plan

## Scope

Add a user-facing P2P connection status indicator and wire Web checklist screens to automatically attempt the optional WebRTC fast path where local-first checklist mode is enabled. Keep fallback behavior quiet and generic.

## Planned Changes

1. Add compact P2P status badge
   - States: connecting, connected, fallback.
   - Generic copy only; no WebRTC/signaling/ICE terminology.
   - Accessible `role=\"status\"` text and icon+text status.

2. Add Web checklist P2P connection adapter
   - Resolve membership from current user, trip owner, and accepted trip members.
   - Attempt connection only for accepted owner/editor.
   - Pick a deterministic initiator from writable member IDs.

3. Wire checklist page
   - Start P2P automatically in local-first checklist spike/dual-write modes.
   - Subscribe to local document updates in both spike and dual-write modes.
   - Render the status badge near checklist controls.

4. Make dual-write practical for P2P validation
   - Change dual-write `getChecklist` to read from the local writer first.
   - Local writer already hydrates from legacy rows on first read, preserving fallback compatibility.

5. Update docs and walkthrough
   - Mark TASK-025 complete.
   - Document verification limits: same-account two-tab P2P is still not supported because signaling ignores same `senderId`; use two accepted owner/editor accounts.

## Validation

- `pnpm --filter @nexvoy/core test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm build:mobile`
- `pnpm --filter nexvoy-app lint`

## Non-goals

- P2P lifecycle hardening/reconnect policy (TASK-026).
- Detailed developer diagnostics UI.
- Schedule/plans P2P write path.
- Mobile product UI wiring.
