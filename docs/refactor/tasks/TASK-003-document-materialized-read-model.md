# TASK-003: Document Materialized Read Model

## 목적

Yjs/Document 원본에서 기존 화면이 소비하기 쉬운 read model을 생성해 UI 전환 비용을 낮춘다.

## 범위

- Trip detail read model
- Checklist read model
- Plan timeline read model
- tombstone entity 숨김 처리
- document size와 read model 생성 시간 계측 지점

## 선행 조건

- `TASK-001-trip-document-model.md`
- `TASK-002-row-to-document-converter.md`
- `ADR-005` 단일 Trip document 결정

## 변경 대상

- `packages/core/src/local-first/materialize.ts`
- `packages/core/src/local-first/tombstone.ts`
- `packages/core/src/local-first/__tests__/materialize.test.ts`

## 구현 단계

1. `TripDocumentV1`에서 화면별 read model을 생성한다.
2. tombstone이 있는 entity를 기본 결과에서 제외한다.
3. checklist progress와 user check state를 계산한다.
4. plan timeline 정렬 결과를 만든다.
5. document size와 materialize duration 계측 hook을 추가한다.

## 데이터 호환성 고려사항

- 기존 Supabase 화면과 의미상 같은 checklist progress가 나와야 한다.
- 삭제된 entity는 compaction 전까지 document에는 남지만 UI에는 노출하지 않는다.
- plan photo와 asset은 Storage reference를 유지한다.

## 검증 방법

- fixture document → read model unit test
- tombstone 적용 테스트
- legacy row fixture에서 변환한 document와 기존 기대 결과 비교

## 롤백 방법

- materializer와 테스트만 제거한다.
- UI 연결 전이면 서비스 영향은 없다.

## 완료 조건

- checklist, plan, trip summary read model이 생성된다.
- tombstone 숨김 정책이 테스트된다.
- document 크기 계측 값이 후속 ADR-005 검토에 사용할 수 있다.
