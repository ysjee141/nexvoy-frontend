# TASK-056 Production Rollout and Recovery Runbook

## Scope and Targets

This runbook promotes the authority-only data path from DEV to Production without deleting legacy
objects. DEV is `ivgkqzwosbjukonlpfdw`; Production is `runbcaegpefqnljsswhv`. Every command that
changes a remote project requires a second operator to confirm the project ref, release SHA, backup
timestamp, and migration list.

## Current Gate

The code and local database gates pass, but remote rollout is **NO-GO** until the unchecked items in
`TASK-056-production-go-no-go.md` have evidence. In particular, the linked DEV migration ledger has
nine historical gaps and the new TASK-056 migration is not deployed. Do not run `db push` until the
historical schema is fingerprinted and the ledger is repaired.

## DEV Migration Ledger Repair

`supabase migration list` on 2026-07-23 showed these local-only historical versions:

```text
20260712000001  20260713000001  20260714000001
20260716000003  20260717000001  20260717000002
20260718000001  20260718000002  20260723000001
```

The SQL may already have been applied manually. For each version, inspect the migration and verify
its tables, functions, grants, and policies in DEV. Record query output in the release ticket. A
missing object means the migration must be applied, not marked applied. Only when every fingerprint
matches may the operator repair history:

```bash
supabase link --project-ref ivgkqzwosbjukonlpfdw
supabase migration list
supabase migration repair --linked --status applied \
  20260712000001 20260713000001 20260714000001 \
  20260716000003 20260717000001 20260717000002 \
  20260718000001 20260718000002 20260723000001
supabase migration list
```

Do not include `20260723000002`: it is the new entity-version rebase migration and must be applied
normally. Repeat the audit independently for Production; never infer Production history from DEV.

## Pre-Deploy Backup

1. Record `git rev-parse HEAD`, project ref, migration list, and active client versions.
2. Create a linked logical database export and store it off-site with a checksum.
3. Export Storage objects separately. Supabase database backups contain Storage metadata, not the
   object bytes ([Supabase backup documentation](https://supabase.com/docs/guides/platform/backups)).

```bash
mkdir -p "backup/$PROJECT_REF/$RELEASE_SHA"
supabase db dump --linked --file "backup/$PROJECT_REF/$RELEASE_SHA/database.sql"
supabase storage ls --linked -r ss:///place-photos \
  > "backup/$PROJECT_REF/$RELEASE_SHA/place-photos.manifest"
supabase storage cp --linked -r ss:///place-photos \
  "backup/$PROJECT_REF/$RELEASE_SHA/place-photos"
shasum -a 256 "backup/$PROJECT_REF/$RELEASE_SHA/database.sql" \
  > "backup/$PROJECT_REF/$RELEASE_SHA/SHA256SUMS"
```

Backup output and credentials must remain outside the repository.

## Deployment Order

1. Repair and verify the DEV migration ledger.
2. Apply `20260723000002_task056_entity_version_rebase.sql` to DEV through the CLI migration path.
3. Run `task046`, `task049`, `task053`, `task054`, `task055`, and `task056` SQL tests.
4. Deploy Web and internal Mobile builds. Execute Web/Web, Web/Mobile, Mobile/Mobile smoke tests.
5. Observe at least seven consecutive days with no data-loss, cross-account, permission-bypass, or
   duplicate-row incident and with all thresholds below.
6. Audit Production history, take DB and Storage backups, then apply the same migration sequence.
7. Release Web first, then enforce the approved minimum Mobile version before broadening traffic.
8. Start at internal users, then 5%, 25%, and 100%. Hold each stage for at least one business day.

## Monitoring and Alerts

GA4/Firebase receive only aggregate, allowlisted events; IDs and user content are removed in Core.
Use Supabase Usage, Realtime Reports, API logs, and DB reports alongside these events.

| Signal | Event/report | Initial alert |
|---|---|---|
| Online outbox age | `authority_flush_started.queue_age_ms` | p95 > 30 s for 15 min |
| Command failure | `authority_batch_rejected` | any non-membership burst or > 0.1% |
| Retry pressure | `authority_batch_retryable` | > 2% for 15 min |
| User conflict | `authority_batch_conflict` | > 1% of applied commands |
| RPC latency | `authority_batch_applied.duration_ms` | p95 > 2 s for 15 min |
| Missed invalidation | `authority_invalidation_gap` | > 0.5% of received events |
| Bundle fallback | `authority_full_refresh` | > 5% of received invalidations |
| Realtime capacity | Supabase Realtime Reports | sustained > 70% quota |
| Egress/DB/Storage | Supabase Usage | forecast > 70% monthly quota |

Do not add the paid Log Drain initially. Add it when seven-day retention is insufficient for an
incident, event volume exceeds manual investigation, or an external audit requires centralized logs.

## Rollback

1. Freeze writes by pausing rollout or placing the app in maintenance mode.
2. Roll clients back to the last authority-only release. TASK-055 removed the legacy runtime, so
   disabling a retired feature flag is not a valid rollback.
3. `20260723000002` only replaces wrapper functions and adds private helpers. Restore the previous
   function definitions from `20260717000001` if command behavior must be rolled back; do not revert
   committed canonical rows.
4. If canonical data is damaged, restore the database to a new recovery project first. Validate
   owner/member counts, revisions, applied operation receipts, and sample bundles before cutover.
5. Restore `place-photos` object bytes from the matching Storage export, then compare the manifest
   and `trip_asset_objects` metadata. A DB-only restore is incomplete.
6. Re-run permission, duplicate, revision, asset, and invitation tests before reopening traffic.

PITR becomes mandatory when external MAU reaches 100, paid usage starts, monthly canonical mutations
exceed 50,000, or the accepted RPO becomes less than 24 hours, whichever happens first.

## Legacy Physical Cleanup

TASK-056 does not drop legacy tables/functions. Cleanup remains **NO-GO** until supported-client
enforcement, 30 days of zero legacy API traffic, successful DB plus Storage restore rehearsal, and a
separate destructive migration approval are all recorded.
