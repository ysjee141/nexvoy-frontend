# TASK-011: Dual-write 및 Mismatch Detector

## 목적

전환 기간 동안 Supabase row와 Local-first document에 mutation을 동시에 반영하고, 불일치를 감지해 운영 데이터 손실 없이 document-primary 전환을 준비한다.

## 범위

- `DualWriteTripRepository`
- mutation별 Supabase row write + Yjs document update
- mismatch detector
- mismatch observability event
- legacy fallback 유지

## 선행 조건

- `TASK-004-repository-abstraction.md`
- `TASK-005-web-indexeddb-yjs-checklist-spike.md`
- `TASK-008-backup-queue-and-restore.md`

## 변경 대상

- `packages/core/src/repositories/*`
- `packages/core/src/sync/conflictPolicy.ts`
- `packages/core/src/local-first/materialize.ts`
- `apps/web/lib/local-first/repositoryFactory.ts`

## 구현 단계

1. dual-write repository를 feature flag 뒤에 추가한다.
2. checklist mutation부터 Supabase row write와 document update를 동시에 수행한다.
3. mutation 후 materialized read model과 legacy query 결과를 비교한다.
4. mismatch 발생 시 `local_first_dual_write_mismatch` 이벤트를 남긴다.
5. mismatch가 나도 legacy row 결과를 사용자에게 보여주는 fallback을 유지한다.

## 데이터 호환성 고려사항

- dual-write 중 document update 실패가 legacy write rollback을 강제할지 정책을 정한다.
- idempotent mutation과 retry를 고려한다.
- 사용자에게 중복 아이템이 보이지 않아야 한다.

## 검증 방법

- checklist create/update/delete/toggle dual-write 테스트
- 의도적 mismatch fixture로 detector 동작 확인
- feature flag off 시 기존 Supabase 동작 확인

## 롤백 방법

- dual-write feature flag를 off로 전환한다.
- legacy Supabase repository를 기본값으로 유지한다.

## 완료 조건

- checklist domain에서 dual-write가 동작한다.
- mismatch를 관측할 수 있다.
- rollback 기준이 명확하다.
