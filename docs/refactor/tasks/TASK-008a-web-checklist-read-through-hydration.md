# TASK-008a: Web Checklist Read-through Hydration

## 목적

`localFirstChecklist=1` 최초 진입 시 IndexedDB에 local-first 문서가 없으면 기존 Supabase row 데이터를 읽어 `TripDocumentV1`로 변환하고, Yjs update로 IndexedDB에 저장해 기존 체크리스트가 local-first mode에서도 보이게 한다.

## 범위

- Web checklist local-first spike의 최초 hydration
- Supabase legacy row bundle 조회
- `convertLegacyTripRowsToDocument()` 연결
- 변환된 `TripDocumentV1`을 Yjs document/update로 저장
- 이후 local-first mutation은 IndexedDB/Yjs 문서를 우선 사용
- hydration 실패 시 legacy Supabase repository fallback 또는 명확한 에러 처리

## 선행 조건

- `TASK-002-row-to-document-converter.md`
- `TASK-003-document-materialized-read-model.md`
- `TASK-005-web-indexeddb-yjs-checklist-spike.md`
- `TASK-008-backup-queue-and-restore.md`

## 변경 대상

- `apps/web/lib/local-first/localFirstChecklistRepository.ts`
- `apps/web/lib/local-first/indexedDbStore.ts` 필요 시
- `packages/core/src/supabase/legacyRepository.ts` 또는 legacy row bundle query helper
- `packages/core/src/local-first/migrations.ts` 필요 시 보강
- Web local-first hydration 테스트 또는 수동 검증 문서

## 구현 단계

1. IndexedDB에 해당 `tripId` Yjs update가 있는지 확인한다.
2. 없으면 Supabase legacy row bundle을 조회한다.
3. legacy row bundle을 `convertLegacyTripRowsToDocument()`로 변환한다.
4. 변환 validation warning을 로그에 남기되 document payload 전체는 기록하지 않는다.
5. 변환된 document를 Yjs update로 encode해 IndexedDB에 저장한다.
6. materialized read model로 기존 checklist item, check state, assignee가 화면에 보이는지 확인한다.
7. hydration 실패 시 기존 Supabase repository로 되돌릴 수 있는 fallback 기준을 명시한다.

## 데이터 호환성 고려사항

- 기존 `trips.id`, `checklists.id`, `checklist_items.id`를 document 내부 id로 유지한다.
- 기존 Supabase row table은 계속 fallback이며 이 단계에서는 document-primary로 전환하지 않는다.
- `localFirstChecklist=1`에서만 동작하고 feature flag off 상태의 production flow는 변경하지 않는다.
- 이미 IndexedDB 문서가 있으면 legacy row를 다시 덮어쓰지 않는다.
- 기존에 빈 spike 문서가 저장된 사용자는 IndexedDB 삭제 또는 migration/rehydration 정책이 필요하다.

## 검증 방법

- 기존 Supabase checklist item이 있는 trip에서 `/trips/checklist?id=<tripId>&localFirstChecklist=1` 진입
- IndexedDB `onvoy-local-first-spike.tripDocuments`에 해당 trip document update 생성 확인
- 기존 checklist item, check state, assignee가 화면에 표시되는지 확인
- 새 항목 추가/체크 후 새로고침 시 IndexedDB 문서에서 복원되는지 확인
- `?localFirstChecklist=0` 또는 flag off 시 기존 Supabase repository 화면이 유지되는지 확인
- `pnpm build`
- `pnpm build:mobile`

## 롤백 방법

- `localFirstChecklist` flag를 off로 유지한다.
- hydration 경로를 제거해도 기존 Supabase repository는 그대로 동작해야 한다.
- 잘못 생성된 local spike document는 IndexedDB `onvoy-local-first-spike` DB 삭제로 초기화한다.

## 완료 조건

- local-first mode 최초 진입 시 기존 Supabase checklist 데이터가 빈 화면이 아니라 local-first read model로 표시된다.
- hydration 이후 local write와 새로고침 복원이 동작한다.
- hydration 실패/rollback 기준이 명확하다.
