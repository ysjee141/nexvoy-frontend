# Walkthrough: TASK-001 Trip Document Model

## Summary

Local-first 전환의 첫 구현 단위로 `@nexvoy/core`에 Trip 단위 document model을 추가했다. 이번 변경은 타입과 helper만 추가하며, Supabase row primary 동작이나 화면 동작은 변경하지 않는다.

## Artifacts

- GitHub Issue: `#254`
- `docs/refactor/tasks/TASK-001-trip-document-model.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/refactor/adrs/ADR-001-local-first-data-engine.md`
- `docs/refactor/adrs/ADR-005-document-granularity.md`

## Key Changes

- `packages/core/src/local-first/documentModel.ts`에 `TripDocumentV1`과 Plan, Checklist, Member, Share, Invitation, Asset, Tombstone node 타입을 추가했다.
- `TRIP_SUBDOCUMENT_BOUNDARIES`로 향후 subdocument 분리 후보(`plans`, `checklist`, `members`, `assets`)를 명시했다.
- 기존 row id를 document path로 연결하는 `getLegacyRowDocumentPath()` helper를 추가했다.
- `packages/core/src/local-first/tripDocument.ts`에 빈 Trip document 생성 helper와 타입 fixture를 추가했다.
- `@nexvoy/core` root export와 package export map에 local-first document model을 연결했다.

## Verification

- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- reviewer 재검토 PASS

## Notes

- `legacyIsChecked`는 기존 `checklist_items.is_checked` round-trip 호환을 위한 필드다.
- `invitationLinks`는 기존 `trip_invitation_links` token 호환을 위한 snapshot 영역이다.
- 런타임 persistence, Yjs provider, Supabase backup schema는 후속 task 범위다.
