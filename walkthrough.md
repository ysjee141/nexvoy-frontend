# Walkthrough: TASK-007 Document Key Model 및 암호화 PoC

## Summary

Server-wrapped key 모델을 기준으로 document snapshot/update 암호화 PoC와 `document_keys` schema/RLS를 추가했다. 서버에는 plain DEK/KEK를 저장하지 않고, member별 wrapped DEK만 저장하는 경로를 검증했다.

## Artifacts

- `docs/refactor/tasks/TASK-007-document-key-model.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/refactor/adrs/ADR-001-local-first-data-engine.md`
- `docs/refactor/adrs/ADR-003-backup-encryption-key-management.md`

## Key Changes

- `packages/core/src/sync/backupTypes.ts`에 encrypted payload, wrapped key, restore error code 타입을 추가했다.
- `packages/core/src/sync/encryption.ts`에 provider 기반 Web Crypto helper를 추가했다. `packages/core`는 Web/RN/Node platform API를 직접 import하지 않는다.
- 암호화 PoC는 snapshot/update payload에 AES-GCM-256, DEK wrapping에 AES-KW-256을 사용한다.
- `supabase/migrations/20260630000002_document_keys.sql`에 `document_keys` table과 RLS를 추가했다.
- owner는 wrapped key를 발급/폐기할 수 있고, accepted member는 자신의 active wrapped key만 읽을 수 있다.
- `supabase/tests/task007_document_keys_rls.sql`에 key read/insert/revoke/member revoke RLS 검증을 추가했다.
- `docs/refactor/adrs/ADR-003-backup-encryption-key-management.md`에 PoC 알고리즘, provider 요구사항, restore error code를 보강했다.

## Verification

- `supabase db reset --local` 성공
- `docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task006_backup_rls.sql` 성공
- `docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task007_document_keys_rls.sql` 성공
  - owner: member별 wrapped key 발급 및 revoke 가능
  - editor/viewer: 자신의 active wrapped key만 read 가능
  - editor: key 발급 insert 차단
  - revoked key 및 revoked member key read 차단
- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공

## Rollback

문제 발생 시 `document_keys` table과 관련 policy/index만 제거하는 보상 migration을 작성한다. `documents`, `document_updates`, `document_members` 등 `TASK-006` backup schema는 유지할 수 있다. 암호화 helper는 backup queue 기본값을 켜기 전까지 import 경로에서 제거하거나 feature flag off 상태로 유지한다.

## Notes

- RN은 `crypto.subtle` 호환 provider 또는 native crypto adapter를 platform layer에서 주입해야 한다.
- KEK 복구 UX, OAuth 계정 복구 시 unwrap 절차, multi-device key provisioning은 아직 남은 질문으로 ADR-003에 유지했다.
- `packages/types/src/database.generated.ts`는 이번 작업에서 최종 변경하지 않았다. backup repository 구현에서 DB 타입을 실제로 소비하기 시작할 때 local schema drift와 함께 재생성한다.
