# TASK-002: Row to Document 변환기

## 목적

기존 Supabase row 데이터를 `TripDocumentV1`로 변환하는 순수 변환기를 작성해 read-through와 migration bridge의 기반을 만든다.

## 범위

- Trip, Plan, Checklist, Member, Share row를 document node로 변환
- `legacy_row_map`에 넣을 수 있는 mapping payload 생성
- 변환 누락/불일치 감지를 위한 validation result 반환

## 선행 조건

- `TASK-001-trip-document-model.md`
- `docs/refactor/TECHNICAL-SPEC.md` 8장
- `ADR-001` 데이터 호환성 결정

## 변경 대상

- `packages/core/src/local-first/migrations.ts`
- `packages/core/src/local-first/materialize.ts`
- `packages/core/src/local-first/__tests__/migrations.test.ts`

## 구현 단계

1. legacy row bundle input 타입을 정의한다.
2. row bundle을 `TripDocumentV1`로 변환한다.
3. 기존 row id와 document path mapping을 함께 반환한다.
4. checklist check state와 assignment 의미가 보존되는지 테스트한다.
5. plan 정렬과 checklist item 정렬 기준을 명시한다.

## 데이터 호환성 고려사항

- 기존 `is_checked`는 legacy 호환 필드로만 다룬다.
- CRDT 기준 check state는 user check map에서 계산할 수 있어야 한다.
- 기존 URL과 공유 링크가 깨지지 않도록 id를 재생성하지 않는다.

## 검증 방법

- row fixture → document 변환 unit test
- checklist assignment/check state 보존 테스트
- 누락 필드가 validation warning으로 잡히는지 확인

## 롤백 방법

- 변환기 파일과 테스트만 되돌린다.
- repository 연결 전이면 런타임 영향은 없다.

## 완료 조건

- 대표 legacy fixture가 `TripDocumentV1`로 변환된다.
- mapping payload가 `legacy_row_map` 설계와 호환된다.
- 변환 결과에서 기존 entity id가 유지된다.
