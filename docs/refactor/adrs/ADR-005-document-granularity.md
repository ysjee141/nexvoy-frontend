# ADR-005: CRDT Document Granularity 및 Subdocument 분리 기준

- 상태: 채택됨
- 결정일: 2026-06-29
- 결정자: ysjee141
- 관련 문서:
  - `docs/refactor/TECHNICAL-SPEC.md`
  - `docs/refactor/adrs/ADR-001-local-first-data-engine.md`

---

## 문제 정의

Local-first 전환의 기본 저장 단위는 Trip document로 제안되어 있다. Trip 단위 문서는 여행 하나에 필요한 일정, 준비물, 멤버, 공유, asset reference를 한 번에 복구하고 동기화하기 쉽다.

하지만 여행 기간이 길거나 계획/체크리스트가 많아지면 단일 Yjs document가 커질 수 있다. document가 커지면 초기 로딩, 백업 snapshot, update merge, 모바일 메모리 사용량에 문제가 생길 수 있다.

따라서 Trip document를 언제 subdocument로 나눌지 기준이 필요하다.

---

## 결정해야 할 질문

Trip document가 너무 커질 경우 subdocument를 어떤 기준으로 분리할 것인가?

---

## 선택지

### Option A: Trip 하나 = Yjs document 하나

장점:

- 구현이 가장 단순하다.
- 복구와 백업 단위가 명확하다.
- 일정/체크리스트 간 참조가 쉽다.

단점:

- 큰 여행에서 document가 비대해질 수 있다.
- 일부 탭만 열어도 전체 document를 로드해야 한다.
- conflict/update log compaction 비용이 커질 수 있다.

### Option B: Trip root + 도메인별 subdocument

구조:

- `trip-root`
- `trip-plans`
- `trip-checklist`
- `trip-members`
- `trip-assets`

장점:

- 탭별 lazy loading이 가능하다.
- 체크리스트와 일정 sync를 독립적으로 최적화할 수 있다.
- 백업 snapshot 크기를 나눌 수 있다.

단점:

- 문서 간 transaction 경계가 복잡해진다.
- restore 순서와 schema migration이 어려워진다.
- 권한/멤버 변경 전파를 여러 문서에 반영해야 한다.

### Option C: Trip root + entity collection sharding

구조:

- `trip-root`
- `plans-by-date`
- `checklist-category-*`
- `assets-*`

장점:

- 매우 큰 데이터셋에 유리하다.
- 특정 날짜/카테고리만 sync할 수 있다.

단점:

- 현재 제품 규모에는 과도하다.
- 구현 복잡도가 매우 높다.
- migration과 compaction이 어렵다.

---

## 결정

Option A를 채택한다. 초기 local-first 모델은 Trip 하나를 하나의 Yjs document로 저장한다.

단, document model에는 향후 subdocument로 분리 가능한 경계를 명확히 둔다.

분리 후보:

- `plans`
- `checklist`
- `members`
- `assets`

다음 조건 중 하나를 만족하면 후속 ADR로 Option B 전환을 검토한다.

- snapshot 크기가 1MB를 지속적으로 초과
- update log compaction 시간이 모바일에서 UX에 영향을 줌
- 체크리스트/일정 중 하나만 열 때 전체 document load가 병목이 됨
- 여행 하나의 plan 수가 300개 이상
- checklist item 수가 500개 이상

---

## Document Boundary 원칙

- URL과 공유 링크의 기준은 항상 Trip root document다.
- owner/editor/viewer 권한은 Trip root에서 파생한다.
- subdocument는 root document의 membership snapshot을 따른다.
- subdocument id는 `tripId:domain` 형식을 사용한다.
- cross-document reference는 기존 row id를 유지한다.

---

## 승인 기준

- 초기 단일 document 모델에서 checklist 스파이크가 동작한다.
- document 크기 측정 지표가 수집된다.
- subdocument 전환 시 기존 entity id가 유지된다.
- root/subdocument restore 순서가 정의된다.

---

## 후속 작업

- document size instrumentation 추가
- snapshot/update compaction 비용 측정
- subdocument migration protocol 초안 작성
- Trip root와 subdocument 권한 전파 규칙 정의
