# Walkthrough: TASK-004 Repository Abstraction

## Summary

UI가 Supabase row query를 직접 호출하지 않도록 `@nexvoy/core`에 Repository interface와 legacy Supabase 구현체를 추가했다. 이번 변경은 Web checklist 화면을 repository factory 경유로 연결하되, 실제 data source는 기존 Supabase row helper를 유지해 동작 동일성을 우선한다.

## Artifacts

- GitHub Issue: `#260`
- `docs/refactor/tasks/TASK-004-repository-abstraction.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/develop-context/architecture.md`
- `docs/develop-context/conventions.md`

## Key Changes

- `packages/core/src/repositories/types.ts`에 `TripRepository`, `ChecklistRepository` 계약을 추가했다.
- `packages/core/src/supabase/legacyRepository.ts`에 기존 Supabase query helper를 감싸는 legacy repository 구현체를 추가했다.
- `apps/web/lib/local-first/repositoryFactory.ts`에서 Web repository factory 경계를 만들었다.
- `apps/web/app/trips/checklist/ChecklistClient.tsx`의 온라인 checklist 조회/생성/수정/삭제/체크 토글을 repository 호출로 전환했다.
- 기존 `@nexvoy/core/supabase/queries` helper는 제거하지 않고 fallback/legacy adapter 내부에서 계속 사용한다.
- `apps/mobile/app/trip/[id].tsx`는 이미 core query helper 주입 경계가 있어, Web checklist spike 이후 별도 repository factory 적용 대상으로 TODO를 남겼다.
- repository mock smoke test를 추가해 interface 소비가 data source와 독립적으로 가능한지 확인한다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm build` 성공
- `pnpm --filter nexvoy-app lint` 성공 (기존 warning 6건)
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm build:mobile` 성공
- reviewer 재검토 PASS
- QA 재검토 PASS

## Notes

- 이번 단계에서는 Supabase row가 계속 primary data source다.
- `LocalFirstRepository`와 dual-write 전환은 후속 task에서 factory 뒤에 추가한다.
