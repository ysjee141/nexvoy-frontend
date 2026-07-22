# TASK-055 Legacy Runtime Retirement Runbook

## Purpose

Deploy the authority-only client and revoke legacy Yjs/P2P/key/backup APIs without deleting
rollback data. DEV is `ivgkqzwosbjukonlpfdw`; Production is `runbcaegpefqnljsswhv`.

## Release Order

1. Export the target database and record the release SHA and migration history.
2. Deploy authority-only Web/Mobile clients. Enforce the minimum supported Mobile version before
   revoking APIs used by an older binary.
3. Run `20260723000001_task055_revoke_legacy_sync_runtime.sql` on DEV.
4. Verify trip/template CRUD, offline outbox recovery, invitation accept/revoke, Realtime refresh,
   and asset upload on DEV. Confirm no request reaches legacy key, update, or signaling endpoints.
5. Optionally run `supabase/maintenance/task055_reset_legacy_v1_dev.sql` against DEV only after a
   fresh export. The script aborts unless the confirmed project ID is the DEV ID.
6. Observe one release window. Check rejected command, revision gap, queue age, 4xx, Realtime, DB,
   and Storage metrics.
7. Repeat export, migration, smoke test, and monitoring steps for Production. Do not run the DEV
   reset script against Production.

## Verification Queries

- `supabase/tests/task055_revoke_legacy_sync.sql` proves API-role revocation while canonical
  authority operations remain available.
- Confirm `document_updates`, document key/material/request tables, signaling RPCs/topics, and
  legacy invitation RPCs cannot be used by `anon` or `authenticated`.
- Confirm `documents` and `document_members` remain readable through canonical permission flows;
  direct client writes stay revoked.
- Confirm the private authority Broadcast policy filters by `extension = 'broadcast'` and topic
  membership only. An `event` predicate rejects Realtime's authorization probe before delivery.

## Rollback

1. Stop rollout and restore the prior supported client release.
2. Restore grants/policies/functions from the pre-migration schema or database export. Physical
   tables remain intact in TASK-055.
3. Re-run authority and invitation smoke tests before reopening traffic.
4. Use managed backup/export only if canonical rows were damaged; a grant rollback does not need
   data restoration.

## Physical Cleanup Gate

TASK-055 does not drop legacy tables, columns, or functions. TASK-056 may perform physical cleanup
only after minimum-version enforcement, zero legacy traffic for the agreed observation window,
successful restore rehearsal, explicit DEV/Production target confirmation, and rollback approval.
