# Walkthrough: TASK-003 Document Materialized Read Model

## Summary

`TripDocumentV1` 원본에서 기존 화면과 repository 계층이 소비하기 쉬운 materialized read model을 생성하는 순수 계층을 `@nexvoy/core`에 추가했다. 이번 변경은 UI 연결 없이 trip summary/detail, plan timeline, checklist progress/status, tombstone filtering, 계측 payload만 제공한다.

## Artifacts

- GitHub Issue: `#258`
- `docs/refactor/tasks/TASK-003-document-materialized-read-model.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/refactor/adrs/ADR-005-document-granularity.md`

## Key Changes

- `packages/core/src/local-first/materialize.ts`에 trip summary/detail, checklist, checklist item, plan timeline materializer를 추가했다.
- `packages/core/src/local-first/tombstone.ts`에 entity tombstone filtering helper를 추가했다.
- checklist item status는 기존 Supabase `getChecklistItemStatus()` 의미에 맞춰 `anyone`, `specific`, `everyone`별 `isChecked`, `isMyChecked`, count, permission을 계산한다.
- plan timeline은 `planOrder`를 우선하고 누락된 plan은 start time, created time, id 순으로 안정 정렬한다.
- document size와 materialize duration을 `MaterializeMetrics`로 반환해 후속 ADR-005 검토에 사용할 수 있게 했다.
- `@nexvoy/core` 루트 export와 subpath export에 materializer/tombstone 모듈을 등록했다.
- typecheck 기반 fixture로 legacy converter 결과, tombstone 숨김, checklist progress, plan URL 보존, Storage photo reference 숨김, 계측 값을 확인한다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- reviewer 재검토 PASS
- QA 재검토 PASS

## Notes

- fixture smoke test는 `@nexvoy/core`의 `test` 스크립트에서 `tsx`로 실행한다.
- UI 연결과 repository boundary 적용은 후속 task 범위다.
