# ADR-006: 검색, 통계, 분석용 Index 전략

- 상태: 채택됨
- 결정일: 2026-06-29
- 결정자: ysjee141
- 관련 문서:
  - `docs/refactor/TECHNICAL-SPEC.md`
  - `docs/refactor/adrs/ADR-001-local-first-data-engine.md`

---

## 문제 정의

현재 OnVoy는 Supabase PostgreSQL row를 기준으로 여행 목록, 통계, 방문 장소, 준비물 진행률 등을 조회한다. Local-first 전환 후 원본 데이터가 Yjs document snapshot/update blob으로 이동하면 PostgreSQL join/query 기반 조회를 그대로 사용할 수 없다.

특히 다음 기능은 document blob만으로는 효율적으로 처리하기 어렵다.

- 홈 여행 목록
- 프로필 여행 기록
- 방문한 곳
- 체크리스트 진행률
- 템플릿 목록/공유 상태
- 알림 대상 일정 조회
- 관리자/운영 분석

따라서 검색/통계/index 데이터를 어떻게 유지할지 결정해야 한다.

---

## 결정해야 할 질문

검색/통계를 document backup에서 재생성할 것인가, 별도 index table로 유지할 것인가?

---

## 선택지

### Option A: 클라이언트 materialized view만 사용

장점:

- 서버 index schema가 단순하다.
- local-first 철학에 가장 가깝다.
- 오프라인에서도 목록/통계를 계산할 수 있다.

단점:

- 서버 기반 검색/통계가 어렵다.
- 새 기기 첫 복구 전에는 목록 표시가 느릴 수 있다.
- 푸시 알림/서버 cron 대상 조회가 어렵다.

### Option B: Supabase에 서버 index table 유지

장점:

- 기존 목록/통계 조회 경험을 유지하기 쉽다.
- 푸시 알림, 운영 분석, 검색을 서버에서 처리할 수 있다.
- 점진적 전환에 유리하다.

단점:

- document와 index 간 불일치 가능성이 생긴다.
- index update pipeline이 필요하다.
- 암호화된 document와 충돌할 수 있다.

### Option C: Hybrid index

구조:

- 클라이언트: 전체 local materialized read model
- Supabase: 최소 metadata/index table

장점:

- 오프라인 UX와 서버 조회를 모두 지원한다.
- 서버에는 민감 본문 대신 필요한 최소 metadata만 둘 수 있다.
- 단계적 전환과 암호화 전략에 유리하다.

단점:

- 어떤 metadata를 서버에 둘지 정책이 필요하다.
- index 불일치 감지/복구가 필요하다.
- 구현 복잡도는 Option A보다 높다.

---

## 결정

Option C(Hybrid index)를 채택한다.

클라이언트는 document에서 read model을 생성해 UI를 렌더링한다. Supabase에는 목록, 권한, 복구, 알림에 필요한 최소 index만 저장한다.

추천 서버 index:

- `document_index`
  - `document_id`
  - `type`
  - `owner_id`
  - `destination`
  - `start_date`
  - `end_date`
  - `member_count`
  - `plan_count`
  - `checklist_total_count`
  - `checklist_done_count`
  - `updated_at`
  - `schema_version`
- `document_place_index`
  - `document_id`
  - `plan_id`
  - `place_name`
  - `address`
  - `google_place_id`
  - `location_lat`
  - `location_lng`
  - `visited_at`
- `document_alarm_index`
  - `document_id`
  - `plan_id`
  - `alarm_at`
  - `timezone`
  - `sent_at`

---

## Index 생성 방식

### Client-generated index

클라이언트가 document materialization 결과로 index payload를 만들어 Supabase에 업로드한다.

장점:

- 서버가 Yjs blob을 해석할 필요가 없다.
- 암호화된 document와 호환하기 쉽다.

단점:

- 악의적/버그 있는 client가 잘못된 index를 보낼 수 있다.
- 서버 검증이 제한적이다.

### Server-generated index

서버가 snapshot/update를 읽어 index를 생성한다.

장점:

- 서버에서 index 신뢰성을 확보하기 쉽다.
- analytics/cron과 연동하기 좋다.

단점:

- 서버에서 Yjs update를 해석해야 한다.
- E2EE와 충돌한다.
- Edge Function runtime 제약을 확인해야 한다.

### 권장

초기에는 client-generated index를 사용하고, integrity check를 추가한다. E2EE 정책이 확정되기 전까지 server-generated index를 전제로 설계하지 않는다.

---

## 불일치 복구

index는 원본이 아니다. 원본은 local CRDT document와 Supabase backup snapshot/update다.

불일치 감지:

- `snapshot_hash`
- `index_source_hash`
- `updated_at`
- `schema_version`

복구:

1. document restore
2. materialized read model 재생성
3. index payload 재업로드
4. 서버 index 갱신

---

## 승인 기준

- 홈 여행 목록을 index에서 빠르게 조회할 수 있다.
- 오프라인 상태에서는 local read model만으로 목록을 표시할 수 있다.
- index 불일치가 감지되면 재생성할 수 있다.
- 암호화 전략과 충돌하지 않는 metadata 범위가 정의되어 있다.

---

## 후속 작업

- `document_index` schema 초안 작성
- 클라이언트 materializer 출력 포맷 정의
- index payload validation 설계
- 기존 프로필 통계/방문 장소 화면 영향 분석
- 알림 cron이 사용할 index 범위 정의
