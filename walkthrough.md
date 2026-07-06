# Walkthrough: TASK-011 Dual-write and Mismatch Detector

## Summary

Checklist domain에서 legacy Supabase row와 local-first document에 mutation을 동시에 반영하는 dual-write 경로를 추가했다. 전환 기간 동안 legacy row를 source of truth로 유지하고, local document와의 불일치는 `local_first_dual_write_mismatch` 이벤트로 관측한다.

## Artifacts

- `docs/refactor/tasks/TASK-011-dual-write-and-mismatch-detector.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- GitHub Issue: `#279`

## Key Changes

- `packages/core/src/repositories/dualWriteChecklistRepository.ts`에 platform-free dual-write repository decorator를 추가했다.
- `packages/core/src/repositories/checklistMismatchDetector.ts`에 legacy/local checklist snapshot canonical 비교기를 추가했다.
- `apps/web/lib/local-first/checklistDocumentWriter.ts`는 Supabase legacy row id를 local document entity id로 재사용해 create 중복을 방지한다.
- `apps/web/lib/local-first/dualWriteChecklistRepository.ts`는 legacy repository, local document writer, Analytics reporter를 조립한다.
- `apps/web/lib/local-first/repositoryFactory.ts`에 `local-first-checklist-dual-write` mode와 env/query/localStorage feature flag를 추가했다.
- `apps/web/services/AnalyticsService.ts`에 `local_first_dual_write_mismatch` helper를 추가했다.
- local write/detector/reporter 실패는 사용자 mutation 결과를 깨지 않고 mismatch 이벤트로만 관측한다.
- `docs/refactor/tasks/README.md`를 갱신해 다음 task를 `TASK-012: Guest Auth Promotion`으로 조정했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공

## Rollback

문제 발생 시 dual-write feature flag를 끄면 `legacy-supabase` repository가 기본값으로 유지된다. 코드 롤백은 `apps/web/lib/local-first/dualWriteChecklistRepository.ts`, `apps/web/lib/local-first/checklistDocumentWriter.ts`, core dual-write/detector 파일, repositoryFactory mode 추가분을 제거하면 된다.

## Notes

- Legacy Supabase row는 전환 기간 source of truth다.
- Local document update 실패는 legacy rollback을 강제하지 않는다.
- Mismatch 이벤트에는 item name, email, document content, CRDT payload를 포함하지 않는다.
- Supabase row 자체 idempotency key/unique constraint는 이번 PR 범위 밖이며 후속 안정화 과제로 둔다.
