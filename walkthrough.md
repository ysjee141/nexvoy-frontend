# Walkthrough: TASK-008a Web Checklist Read-through Hydration

## Summary

`localFirstChecklist=1` 최초 진입 시 IndexedDB에 local-first 문서가 없으면 기존 Supabase row bundle을 읽어 `TripDocumentV1`로 변환하고 Yjs update로 저장하도록 연결했다. 이제 기존 체크리스트가 local-first mode에서도 빈 화면이 아니라 read-through hydrated document로 표시된다.

## Artifacts

- `docs/refactor/tasks/TASK-008a-web-checklist-read-through-hydration.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/refactor/adrs/ADR-001-local-first-data-engine.md`

## Key Changes

- `packages/core/src/supabase/legacyRepository.ts`에 `getLegacyTripRowBundle()`을 추가해 Trip, Plan, Checklist, Member, Share row를 hydration용 bundle로 조회한다.
- `apps/web/lib/local-first/localFirstChecklistRepository.ts`가 IndexedDB에 문서가 없을 때 `convertLegacyTripRowsToDocument()`로 Supabase row를 hydrate한다.
- hydration validation warning은 code만 로그에 남기고 document payload는 기록하지 않는다.
- hydration 실패 시 기존 spike 빈 문서 생성 fallback을 유지한다.
- 기존 UUID 기반 checklist/item도 local mutation이 가능하도록 IndexedDB 문서에서 checklist/item id → trip id를 찾는 resolver를 추가했다.
- `apps/web/lib/local-first/indexedDbStore.ts`에 저장된 trip document update 전체를 조회하는 helper를 추가했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공

## Rollback

문제 발생 시 `localFirstChecklist` flag를 off로 유지하면 기존 Supabase repository 화면으로 돌아간다. 잘못 생성된 spike 문서는 DevTools에서 IndexedDB `onvoy-local-first-spike` DB를 삭제해 초기화할 수 있다.

## Notes

- 이미 빈 spike 문서가 IndexedDB에 저장된 브라우저에서는 legacy hydration이 다시 실행되지 않는다. 해당 DB를 삭제한 뒤 `?localFirstChecklist=1`로 재진입해야 한다.
- 이 단계는 Web checklist spike의 read-through hydration이며, 아직 document-primary 또는 dual-write 전환은 아니다.
