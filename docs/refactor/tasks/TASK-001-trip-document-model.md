# TASK-001: Trip Document Model 정의

## 목적

Local-first 전환의 공통 기준이 될 `TripDocumentV1` 타입과 entity id 보존 규칙을 `packages/core`에 정의한다.

## 범위

- `TripDocumentV1` 타입 초안
- Plan, Checklist, Member, Asset, Tombstone node 타입
- 기존 Supabase row id를 document 내부 id로 유지하는 규칙
- 단일 Trip = 단일 Yjs document 경계 명시

## 선행 조건

- `docs/refactor/TECHNICAL-SPEC.md` 7장, 8장 확인
- `ADR-001`, `ADR-005` 결정 확인

## 변경 대상

- `packages/core/src/local-first/documentModel.ts`
- `packages/core/src/local-first/tripDocument.ts`
- `packages/core/src/index.ts`

## 구현 단계

1. `TripDocumentV1`과 하위 node 타입을 작성한다.
2. legacy row id와 document path 매핑 규칙을 상수 또는 helper로 분리한다.
3. tombstone node 타입을 포함한다.
4. `packages/core` 외부로 export한다.
5. 타입만으로 샘플 Trip document fixture를 만들 수 있는지 확인한다.

## 데이터 호환성 고려사항

- `trips.id`는 document id로 유지한다.
- `plans.id`, `checklist_items.id`, `trip_members.id`는 entity id로 유지한다.
- Storage object path는 binary blob이 아니라 asset reference로만 저장한다.

## 검증 방법

- `pnpm --filter @nexvoy/core typecheck`
- 샘플 fixture가 `TripDocumentV1`을 만족하는지 타입 테스트로 확인

## 롤백 방법

- 추가한 타입 파일과 export만 되돌린다.
- 런타임 동작 변경이 없어 서비스 영향은 없다.

## 완료 조건

- `TripDocumentV1`이 TS 7장 구조와 일치한다.
- future subdocument 분리 후보(`plans`, `checklist`, `members`, `assets`)가 타입 경계로 드러난다.
- `any` 없이 typecheck가 통과한다.
