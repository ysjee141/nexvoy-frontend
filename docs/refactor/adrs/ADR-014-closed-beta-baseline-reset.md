# ADR-014: Closed Beta Baseline Reset

- 상태: 채택됨
- 결정일: 2026-07-15
- 결정자: ysjee141
- 관련 문서:
  - `docs/refactor/adrs/ADR-013-full-local-first-product-scope.md`
  - `docs/refactor/TECHNICAL-SPEC.md`
  - `docs/refactor/progress.md`
  - `docs/refactor/tasks/TASK-038-closed-beta-baseline-reset-plan.md`

---

## 문제 정의

ADR-013은 기존 Supabase row 데이터를 document-primary 구조로 보존/전환하는 것을 전제로 했다. 그러나 TASK-037 검증 중
legacy row, document registry, encrypted snapshot, device key provisioning이 함께 얽히며 Closed Beta 이전 품질
기준을 흐리는 문제가 확인되었다.

기존 운영 데이터는 Closed Beta 기준에서 제품 가치가 낮고, 자동 마이그레이션을 전제로 하면 핵심 목표인 Local-first/P2P/
backup sync 안정화보다 전환기 호환성 문제가 더 커진다.

## 결정

Closed Beta 기준선을 **백지 상태의 document-primary 데이터**로 재설정한다.

- 기존 여행/일정/준비물/템플릿 row 데이터는 Closed Beta 제품 경로에서 무시한다.
- 기존 데이터에 대한 별도 사용 불가 메시지는 제공하지 않는다.
- 새로 생성되는 여행과 템플릿만 Local-first 제품 데이터로 간주한다.
- legacy row 자동 마이그레이션은 Closed Beta 전 필수 조건에서 제외하고, 별도 후속 도구 작업으로 분리한다.
- 모든 기능 범위는 여행, 일정, 준비물, 템플릿, 동행자/권한을 포함한다.

## 신규 데이터 기준선

새 여행 생성은 다음을 원자적 제품 기준으로 삼는다.

1. `TripDocumentV1` local document 생성
2. Web IndexedDB 또는 Mobile local storage에 즉시 저장
3. Supabase `documents` encrypted initial snapshot 생성
4. owner `document_members` accepted row 생성
5. current device용 `document_keys` row 생성

새 템플릿 생성도 동일하게 `TemplateDocumentV1` local document와 encrypted snapshot/key bootstrap을 기준으로 한다.

## Sync 원칙

- Local storage가 always-first source다. 사용자의 write는 네트워크와 무관하게 local document에 먼저 기록된다.
- 동시 접속 peer가 있으면 WebRTC P2P가 빠른 전파 경로다.
- peer가 없거나 실패하면 Supabase encrypted backup snapshot/update가 비동시 sync/restore 경로다.
- 다른 사용자가 나중에 같은 여행에 진입하면 Supabase backup을 기준으로 최신 document를 복구해야 한다.
- local document와 Supabase backup이 모두 존재하고 diverge하면 `updatedAt`/document clock 기반 freshness 비교 후 최신 쪽을 선택하거나 병합한다.

## 통신량/비용 원칙

- 기본 polling을 피하고 trigger/event 기반 freshness 확인을 우선한다.
- Supabase Realtime은 document metadata/freshness notification과 P2P signaling에 한정한다.
- document 본문은 Realtime payload로 보내지 않고 encrypted backup pull로만 가져온다.
- snapshot은 초기 생성 및 compaction 시점에만 쓰고, 일반 변경은 encrypted update queue로 batch upload한다.
- 앱 foreground, network reconnect, visibility change, explicit document enter 이벤트에서만 backup freshness를 확인한다.

## 기존 데이터 처리

Closed Beta 제품 경로에서는 legacy row read-through/hydrate를 제거한다. 기존 row 데이터는 숨겨진 migration source로만 남긴다.

후속 migration tool은 다음을 별도 task로 다룬다.

- 사용자가 명시적으로 선택한 legacy trip/template을 document-primary로 변환
- snapshot/key/member bootstrap
- 변환 결과 검증과 rollback/export

## 영향

이 결정은 ADR-013의 "기존 row 데이터는 손실 없이 migration 된다" 완료 조건을 Closed Beta gate에서 제거한다.
대신 Closed Beta gate는 신규 document-primary 데이터의 local write, P2P, encrypted backup, restore 품질을 기준으로 한다.

## 결과

장점:

- 전환기 compatibility 코드와 edge case를 줄인다.
- Closed Beta 검증 기준이 신규 document-primary flow로 선명해진다.
- Supabase 사용량을 backup/registry/freshness로 제한하기 쉽다.

단점:

- 기존 데이터는 Closed Beta 제품 경로에서 보이지 않는다.
- legacy migration은 별도 작업 전까지 제공되지 않는다.
- 데이터 기준선 reset을 문서와 운영 안내에 명확히 반영해야 한다.
