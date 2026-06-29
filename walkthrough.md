# Walkthrough: TASK-002 Row to Document Converter

## Summary

기존 Supabase row bundle을 `TripDocumentV1`로 변환하는 순수 converter를 `@nexvoy/core`에 추가했다. 이번 변경은 repository나 UI에 연결하지 않고, read-through/migration bridge를 위한 플랫폼 독립 변환 계층만 제공한다.

## Artifacts

- GitHub Issue: `#256`
- `docs/refactor/tasks/TASK-002-row-to-document-converter.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/refactor/adrs/ADR-001-local-first-data-engine.md`

## Key Changes

- `packages/core/src/local-first/migrations.ts`에 `convertLegacyTripRowsToDocument()`를 추가했다.
- Trip, Plan, Plan URL, Checklist, Checklist Item, Category, Assignee, User Check, Member, Share, Invitation Link, Asset row를 document node로 변환한다.
- 기존 row id를 유지하고 `legacyRowMap` payload를 함께 반환한다.
- orphan row, null count normalization, unknown role/status/share/assignment type normalization을 validation warning으로 남긴다.
- checklist legacy `is_checked`는 `legacyIsChecked`로 보존하고 후속 user-check reconstruction 필요성을 warning으로 노출한다.
- checklist item legacy ordering comparator를 명시했다.
- typecheck 기반 fixture로 id 보존, plan ordering, orphan validation, mapping payload를 확인한다.

## Verification

- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- reviewer 최종 재검토 PASS

## Notes

- fixture smoke test는 repo에 standalone TS runner가 없어 `tsc --noEmit` 기반으로 검증한다.
- converter는 generated row의 string/null shape를 받아 document-safe union으로 normalize한다.
- UI 연결, materialized read model, repository boundary는 후속 task 범위다.
