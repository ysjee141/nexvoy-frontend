# ADR-001: Local-First Data Engine 전환

- 상태: 채택됨
- 결정일: 2026-06-29
- 결정자: ysjee141
- 관련 문서:
  - `docs/refactor/TECHNICAL-SPEC.md`
  - `docs/plans/PLAN-008-local-first-architecture-review.md`
  - `docs/adrs/ADR-010-shared-packages.md`
  - `docs/develop-context/caching.md`
  - `docs/refactor/adrs/ADR-002-mobile-webrtc-runtime.md`
  - `docs/refactor/adrs/ADR-003-backup-encryption-key-management.md`
  - `docs/refactor/adrs/ADR-004-p2p-signaling-strategy.md`
  - `docs/refactor/adrs/ADR-005-document-granularity.md`
  - `docs/refactor/adrs/ADR-006-search-analytics-indexing.md`
  - `docs/refactor/adrs/ADR-007-auth-identity-and-delayed-auth.md`
  - `docs/refactor/adrs/ADR-008-invitation-and-permission-registry.md`
  - `docs/refactor/adrs/ADR-009-notification-strategy.md`
  - `docs/refactor/adrs/ADR-010-operating-cost-and-infrastructure.md`

---

## 문제 정의

현재 OnVoy는 Supabase를 원본 데이터베이스, 권한 모델, 협업 registry, 백업 저장소, 인증 provider로 사용한다. 이 구조는 구현이 단순하고 RLS로 보안 경계를 강하게 유지할 수 있지만, 다음 한계가 있다.

1. 네트워크가 불안정하면 여행 계획과 체크리스트 편집 경험이 약해진다.
2. 현재 오프라인 모드는 명시적 다운로드 기반 read-only cache이며, 진짜 local-first 편집 모델이 아니다.
3. 협업 편집은 Supabase row mutation 중심이라 충돌 병합이 제한적이다.
4. 웹/앱 모두 화면 곳곳에서 Supabase query 또는 `@nexvoy/core/supabase/queries`에 의존한다.
5. 장기적으로 “여행 중 네트워크가 불안정해도 함께 편집 가능한 준비물/일정”이라는 제품 방향과 맞지 않는다.

따라서 데이터 원본을 클라이언트 로컬 저장소와 CRDT 문서로 이동하고, Supabase는 인증/백업/권한 registry 역할로 축소하는 전환을 검토한다.

---

## 의사결정

OnVoy는 Local-first Data Engine 전환을 단계적으로 추진한다.

채택할 목표 구조:

- 원본 편집 상태: 로컬 저장소 + Yjs CRDT document
- 실시간 협업: WebRTC 기반 P2P sync
- 영구 백업/복구: Supabase document snapshot/update log
- 인증: Supabase Auth 유지
- 권한/초대 registry: Supabase 유지
- 첨부 파일: Supabase Storage 유지
- 전환 기간 fallback: 기존 Supabase row table 유지

즉시 전체 전환하지 않고, 체크리스트 도메인으로 스파이크를 먼저 수행한다.

세부 결정은 ADR-002부터 ADR-010까지의 하위 ADR에서 검토한다. 본 ADR은 전환 방향성을 정의하고, 하위 ADR은 모바일 런타임, 암호화, signaling, 문서 분리, index, 인증 UX, 초대/권한, 알림, 운영 비용을 각각 결정한다.

---

## 결정 배경

### 기존 ADR-010과의 관계

ADR-010은 `@nexvoy/core`에 Supabase query helper를 두고 웹/앱이 공유하는 전략을 채택했다. 이 결정은 현재 구조에서는 여전히 유효하다.

다만 Local-first 전환이 승인되면 ADR-010의 “Supabase query helper 공유”는 최종 목표가 아니라 legacy repository 구현체가 된다. 새 공유 경계는 다음처럼 바뀐다.

- 기존: `@nexvoy/core` = Supabase query helper + 플랫폼 독립 로직
- 변경 후: `@nexvoy/core` = Repository interface + domain logic + local-first document logic + legacy Supabase adapter

따라서 본 ADR은 ADR-010을 폐기하지 않고 상위 전환 전략으로 확장한다.

### 기존 캐싱 정책과의 관계

`docs/develop-context/caching.md`는 현재 오프라인 정책을 read-only downloaded trip bundle로 정의한다. Local-first 전환 이후에는 이 정책을 갱신해야 한다.

기존 cache는 “서버 데이터를 복사한 보조 저장소”다. 새 local-first store는 “편집 가능한 원본 저장소”다. 두 개념을 혼용하면 안 된다.

---

## 검토한 선택지

### Option A: Supabase 유지 + optimistic UI 강화

장점:

- 공수가 가장 작다.
- RLS와 기존 schema를 그대로 사용한다.
- 데이터 손실 위험이 낮다.

단점:

- 네트워크 단절 중 편집 문제를 해결하지 못한다.
- 협업 충돌 해결이 row update 수준에 머문다.
- local-first 제품 방향과 맞지 않는다.

결론: 단기 개선책으로는 가능하지만 목표 아키텍처로는 부족하다.

### Option B: Supabase Realtime 중심 협업 강화

장점:

- 기존 Supabase 구조를 유지하면서 실시간성을 높일 수 있다.
- 서버 권한 모델이 유지된다.

단점:

- 오프라인 편집과 나중 병합은 여전히 약하다.
- CRDT 수준의 충돌 병합이 없다.
- 네트워크와 Supabase availability에 계속 의존한다.

결론: 협업 표시 개선에는 유효하지만 local-first 전환은 아니다.

### Option C: Local-first + Supabase backup/auth

장점:

- 오프라인 편집이 기본 동작이 된다.
- P2P로 같은 여행 참여자 간 빠른 동기화가 가능하다.
- Supabase를 완전히 버리지 않아 인증, 백업, 복구, 초대를 유지할 수 있다.
- 기존 UI와 도메인 타입을 상당 부분 재사용할 수 있다.

단점:

- 데이터 계층 재설계 공수가 매우 크다.
- RLS 기반 권한을 CRDT 문서 내부 변경에 직접 적용할 수 없다.
- 모바일 WebRTC 빌드/런타임 제약이 크다.
- 백업 암호화와 복구 키 관리가 어려울 수 있다.

결론: 채택하되, 스파이크와 단계적 이관을 전제로 한다.

### Option D: 완전 재구축

장점:

- 새 아키텍처에 맞춰 처음부터 단순하게 설계할 수 있다.

단점:

- 현재 웹/앱 UI, 인증, 타입, Supabase 마이그레이션, E2E 기반을 버리게 된다.
- 기능 재현 비용이 과도하다.
- 데이터 마이그레이션 위험은 여전히 남는다.

결론: 채택하지 않는다.

---

## 결정

Option C(Local-first + Supabase backup/auth)를 명시적으로 채택한다.

단, 즉시 전면 전환하지 않는다. 다음 순서를 따른다.

1. 체크리스트 도메인 스파이크
2. Repository abstraction 도입
3. 기존 row → Trip document 변환기 작성
4. Supabase backup schema 추가
5. read-through 모드 검증
6. dual-write 모드 검증
7. document-primary 모드로 전환
8. legacy row 의존 축소

---

## 데이터 호환성 결정

기존 Supabase 데이터와의 호환성을 유지한다.

필수 결정:

- 기존 `trips.id`를 document id로 유지한다.
- 기존 `plans.id`, `checklist_items.id`, `trip_members.id`를 document 내부 entity id로 유지한다.
- 기존 share token과 invitation token은 Supabase registry에서 계속 유효하게 한다.
- Supabase Storage object path는 document 내부 asset reference로 보존한다.
- 기존 row table은 초기 전환 기간 authoritative fallback으로 유지한다.
- CRDT 삭제는 hard delete가 아니라 tombstone으로 전파한다.

이 결정은 다음을 보장한다.

- 기존 URL과 공유 링크가 깨지지 않는다.
- 기존 사용자 데이터 이관이 가능하다.
- 문제 발생 시 Supabase row 기반 화면으로 rollback할 수 있다.

---

## 보안 결정

Supabase Auth는 유지한다.

Supabase RLS는 다음 테이블에 계속 적용한다.

- `documents`
- `document_updates`
- `document_members`
- `document_devices`
- `legacy_row_map`
- 기존 `profiles`
- 기존 초대/공유 registry
- Storage buckets

서버 검증이 필요한 작업:

- backup update upload
- snapshot upload
- member role 변경
- invitation 생성/수락
- share link 생성/폐기
- hard delete

클라이언트 권한 snapshot은 UX guard이며 최종 보안 경계가 아니다.

---

## 기대 효과

- 네트워크 단절 중에도 여행/준비물 편집 가능
- 동행자 간 체크리스트 동시 편집 충돌 감소
- 서버 지연과 네트워크 왕복에 덜 민감한 UX
- Supabase 장애 시에도 로컬 데이터 접근 가능
- 기존 Supabase Auth/Storage/초대 기반을 유지하면서 단계적 전환 가능

---

## 위험 요소

### 모바일 WebRTC 위험

Expo Go에서는 WebRTC 지원이 제한될 수 있다. `react-native-webrtc` 사용 시 dev client 또는 EAS Build 전환이 필요할 수 있다.

완화:

- 첫 스파이크에서 모바일 WebRTC 빌드 가능성을 별도로 검증한다.
- P2P 실패 시 Supabase backup pull/push를 fallback으로 둔다.

### 권한 모델 위험

CRDT update는 클라이언트에서 만들어지므로 기존 RLS가 내부 변경 단위까지 검증하지 못한다.

완화:

- backup upload 시 document membership을 Supabase에서 검증한다.
- owner/editor/viewer 권한 registry를 서버에 둔다.
- 초대와 role 변경은 RPC 또는 API route를 통해 처리한다.

### 데이터 손실 위험

row → document 변환, dual-write, tombstone 처리 중 누락이 발생할 수 있다.

완화:

- legacy row table을 fallback으로 유지한다.
- round-trip 변환 테스트를 필수화한다.
- mismatch detector를 dual-write 단계에 포함한다.

### 복잡도 위험

Yjs, P2P, local persistence, Supabase backup이 함께 들어오면 시스템 복잡도가 크게 증가한다.

완화:

- 체크리스트 하나로 스파이크를 제한한다.
- repository interface를 먼저 도입해 UI 변경 범위를 제한한다.
- 도메인별 단계 이관을 강제한다.

---

## 마이그레이션 정책

전환 단계:

1. Supabase-primary
2. Read-through document
3. Dual-write
4. Document-primary
5. Legacy reduction

각 단계는 rollback 가능해야 한다.

Rollback 기준:

- document restore 실패율 증가
- dual-write mismatch 발생
- 모바일 build/runtime 이슈
- 백업 upload 실패
- 권한 registry 불일치

Rollback 방법:

- repository factory에서 Supabase repository로 전환
- local-first feature flag 비활성화
- document backup은 보존하되 UI에서는 사용하지 않음

---

## 후속 과제

- `docs/refactor/tasks`에 phase별 작업 문서 작성
- 체크리스트 스파이크 범위 확정
- Web IndexedDB + Yjs persistence PoC
- Expo RN WebRTC 가능성 검증
- guest document 승격 및 지연 인증 PoC
- 초대 링크/코드 및 permission registry PoC
- 로컬 알림/협업 푸시 metadata PoC
- Supabase backup schema migration 초안 작성
- row/document 변환기 테스트 작성
- dual-write mismatch detector 설계

---

## 승인 조건

본 ADR이 승인되더라도 즉시 전면 전환하지 않는다. 다음 조건을 만족해야 Phase 1 구현으로 넘어간다.

- 체크리스트 스파이크 성공
- 모바일 WebRTC 또는 fallback sync 전략 검증
- 지연 인증/초대/권한/알림 관련 하위 ADR 임시 결정
- 기존 Supabase row와의 round-trip 변환 테스트 통과
- 백업/복구 데이터 손실 테스트 통과
- rollback 경로 확인
