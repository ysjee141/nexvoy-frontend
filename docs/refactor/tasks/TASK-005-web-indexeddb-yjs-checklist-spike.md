# TASK-005: Web IndexedDB + Yjs Checklist Spike

## 목적

체크리스트 도메인에서 Yjs local document와 IndexedDB persistence가 실제 Web 환경에서 동작하는지 검증한다.

## 범위

- Web 전용 local-first spike
- checklist item create/update/delete/toggle
- IndexedDB persistence
- 브라우저 새로고침 후 복원
- 동일 브라우저 다중 탭 동기화는 가능하면 BroadcastChannel로 검증

## 선행 조건

- `TASK-001-trip-document-model.md`
- `TASK-003-document-materialized-read-model.md`
- `ADR-001` Phase 0 기준

## 변경 대상

- `apps/web/lib/local-first/indexedDbStore.ts`
- `apps/web/lib/local-first/repositoryFactory.ts`
- `packages/core/src/local-first/tripDocument.ts`
- 실험용 route 또는 feature flag 영역

## 구현 단계

1. Web IndexedDB store를 작성한다.
2. Yjs document에 checklist update를 적용하는 helper를 만든다.
3. materialized read model을 통해 화면에 표시한다.
4. 새로고침 후 IndexedDB에서 복원되는지 검증한다.
5. 실패 시 기존 Supabase 화면으로 돌아갈 수 있게 feature flag로 감싼다.

## 데이터 호환성 고려사항

- spike document는 기존 row id를 사용할 수 있어야 한다.
- Supabase row에 write하지 않는 실험 모드라면 사용자 데이터와 분리한다.
- 기존 production 화면을 깨지 않도록 feature flag 기본값은 off로 둔다.

## 검증 방법

- Web 수동 테스트: 추가, 수정, 삭제, 체크, 새로고침 복원
- 다중 탭에서 update 전파 확인
- `pnpm build`

## 롤백 방법

- feature flag를 off로 유지한다.
- Web local-first spike 파일을 제거해도 기존 Supabase 화면이 동작해야 한다.

## 완료 조건

- Web에서 checklist local write가 네트워크 없이 성공한다.
- IndexedDB 복원이 가능하다.
- 체크/해제 동시 편집 검증을 위한 기반이 생긴다.
