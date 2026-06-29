# Walkthrough: TASK-006 Supabase Backup Schema 및 RLS

## Summary

Local-first Phase 2의 첫 단계로 암호화된 CRDT snapshot/update backup을 저장할 Supabase schema와 최소 RLS 기반을 추가했다. 기존 Supabase row 테이블은 그대로 유지하며, document backup/restore 경로가 준비될 때까지 fallback 역할을 계속한다.

## Artifacts

- `docs/refactor/tasks/TASK-006-backup-schema-and-rls.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/refactor/adrs/ADR-001-local-first-data-engine.md`
- `docs/refactor/adrs/ADR-003-backup-encryption-key-management.md`

## Key Changes

- `supabase/migrations/20260630000001_local_first_backup_schema.sql`에 `documents`, `document_updates`, `document_devices`, `legacy_row_map`을 추가했다.
- owner/editor/viewer RLS를 강제하기 위해 최소 authority table인 `document_members`도 함께 추가했다. 초대 링크/RPC와 세부 permission registry는 `TASK-013` 범위로 남겨두었다.
- `documents.encrypted` 기본값은 `true`이며, `snapshot`과 `document_updates.update_blob`은 `TASK-007` 암호화 PoC 이후 암호문 저장 경로로 사용된다.
- `check_is_document_owner`, `check_is_document_member`, `check_is_document_editor` security-definer helper를 추가해 RLS 재귀를 피했다.
- `supabase/tests/task006_backup_rls.sql`에 local-only owner/editor/viewer/outsider RLS 검증 스크립트를 추가했다.

## Verification

- `supabase db reset --local` 성공
- `docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task006_backup_rls.sql` 성공
  - owner: document 생성 및 member 등록 가능
  - editor: `document_updates` insert/read 가능
  - viewer: `document_updates` read 가능, insert 차단
  - outsider: document read 차단
- `pnpm build` 성공
- `pnpm build:mobile` 성공

## Rollback

문제 발생 시 신규 backup schema만 제거하는 보상 migration을 작성한다. 제거 대상은 `legacy_row_map`, `document_devices`, `document_updates`, `document_members`, `documents` 및 `check_is_document_*` helper 함수이며, 기존 row 기반 서비스 테이블은 건드리지 않는다.

## Notes

- `document_keys` schema와 암호화 helper는 계획대로 `TASK-007-document-key-model.md`에서 처리한다.
- `packages/types/src/database.generated.ts`는 이번 작업에서 최종 변경하지 않았다. 새 backup table 타입은 실제 repository/backup 구현에서 소비하기 시작할 때 local schema drift를 함께 정리해 재생성한다.
