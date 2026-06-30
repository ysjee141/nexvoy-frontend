# Walkthrough: TASK-008 Backup Queue 및 Restore Flow

## Summary

Local-first write 이후 Supabase backup/update log로 업로드하고 snapshot + updates로 복원하는 기본 sync/restore foundation을 추가했다. 이번 단계는 platform adapter가 사용할 `@nexvoy/core` queue/state/restore/repository 기반이며, local write 실패와 backup upload 실패를 분리한다.

## Artifacts

- `docs/refactor/tasks/TASK-008-backup-queue-and-restore.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/refactor/adrs/ADR-001-local-first-data-engine.md`
- `docs/refactor/adrs/ADR-004-p2p-signaling-strategy.md`

## Key Changes

- `packages/core/src/sync/backupTypes.ts`에 pending update, snapshot/update record, queue state, restore plan 타입을 추가했다.
- `packages/core/src/sync/syncState.ts`에 queue enqueue, upload start/success/failure, retry state, snapshot threshold, restore plan ordering, hash mismatch validation을 추가했다.
- `packages/core/src/sync/restore.ts`에 encrypted snapshot/update replay helper를 추가했다. Hash 검증 후 Yjs update를 순서대로 적용해 `TripDocumentV1`을 복원한다.
- `packages/core/src/supabase/backupRepository.ts`에 `documents` snapshot upsert, `document_updates` upload/list, restore plan download repository를 추가했다.
- `packages/core` subpath export에 `sync/syncState`, `sync/restore`, `supabase/backupRepository`를 추가했다.
- `packages/core/src/sync/__tests__/syncState.test.ts`와 `restore.test.ts`로 queue retry, snapshot threshold, restore ordering, hash mismatch, encrypted replay를 검증했다.

## Verification

- `supabase db reset --local` 성공
- `docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task006_backup_rls.sql` 성공
- `docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task007_document_keys_rls.sql` 성공
- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공

## Rollback

문제 발생 시 local-first repository 기본값을 Supabase legacy repository로 유지하고, 새 `@nexvoy/core` sync helper import를 제거한다. Supabase backup table에 쌓인 테스트 document/update row는 cleanup script 또는 SQL로 삭제하며, 기존 row 기반 서비스 테이블은 유지한다.

## Notes

- `packages/core`는 IndexedDB/SQLite/WebRTC/Next.js/RN API를 직접 import하지 않는다.
- Web/RN platform adapters는 다음 단계에서 local persistence와 network 상태에 맞춰 `BackupQueueState`를 저장하고 `SupabaseBackupRepository`를 호출하면 된다.
- Snapshot/update payload는 `TASK-007` encryption helper의 serialized encrypted payload를 저장하는 전제로 설계했다.
- `packages/types/src/database.generated.ts`는 이번 작업에서 최종 변경하지 않았다. backup repository가 app layer에서 본격 소비될 때 local schema drift와 함께 재생성한다.
