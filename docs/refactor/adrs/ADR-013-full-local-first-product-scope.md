# ADR-013: Full Local-first Product Scope

- 상태: 부분 대체됨 (제품 범위는 유지, document-primary 방식은 `ADR-015`로 대체)
- 결정일: 2026-07-14
- 결정자: ysjee141
- 관련 문서:
  - `docs/refactor/TECHNICAL-SPEC.md`
  - `docs/refactor/progress.md`
  - `docs/refactor/adrs/ADR-001-local-first-data-engine.md`
  - `docs/refactor/adrs/ADR-005-document-granularity.md`
  - `docs/refactor/adrs/ADR-008-invitation-and-permission-registry.md`
  - `docs/refactor/adrs/ADR-011-invitation-key-provisioning-strategy.md`
  - `docs/refactor/tasks/TASK-029-full-local-first-product-scope-adr.md`
  - `docs/refactor/adrs/ADR-014-closed-beta-baseline-reset.md`

---

> 2026-07-15 업데이트: ADR-013의 "기존 row 데이터는 손실 없이 migration 된다" 완료 조건은 Closed Beta gate에서
> 제외한다. Closed Beta는 ADR-014에 따라 신규 document-primary 데이터만 제품 경로로 사용하고, 기존 데이터 migration은
> 별도 후속 tool 작업으로 분리한다.

## 문제 정의

TASK-001~028은 Local-first foundation, encrypted backup/key provisioning, Web/Mobile P2P signaling, Web
checklist 중심 Yjs update exchange를 구현했다. 하지만 제품 관점에서는 아직 checklist pilot 단계다.

다음 단계에서 바로 통합테스트나 Closed Beta를 진행하면 준비물 외 일정, 템플릿, 동행자 초대/수락/거부,
권한 변경, Web/Mobile cross-device restore/sync가 서로 다른 데이터 경로를 타게 된다. 이는 사용자에게
"일부 기능만 빠른 동기화/오프라인 지원"처럼 보이고, Closed Beta에서 검증하려는 완성 제품 기준과 맞지
않는다.

따라서 TASK-030 이후 구현 전에 전체 제품 scope, document boundary, legacy row migration 전략,
rollout/rollback 기준을 확정한다.

---

## 결정해야 할 질문

1. 어떤 기능을 Local-first 제품 완료 범위로 볼 것인가?
2. 템플릿은 `TripDocumentV1` 내부에 둘 것인가, 별도 document로 둘 것인가?
3. Supabase row table은 전환 기간에 어떤 역할만 맡길 것인가?
4. 언제 통합테스트와 Closed Beta로 넘어갈 수 있는가?

---

## 선택지

### Option A: Checklist 중심 pilot을 유지하고 나머지는 legacy row로 둔다

장점:

- 단기 구현량이 가장 작다.
- 이미 검증한 Web checklist P2P 경로를 빠르게 확장해 보일 수 있다.

단점:

- 일정, 템플릿, 초대/권한이 legacy row 중심으로 남아 제품 전체가 local-first가 아니다.
- Web/Mobile 간 데이터 경로가 달라져 통합테스트 기준이 모호하다.
- Closed Beta에서 핵심 기능별 품질 편차가 노출된다.

결론: 채택하지 않는다.

### Option B: 모든 기존 row 기능을 장기간 dual-write로 유지한다

장점:

- legacy 화면 rollback이 쉽다.
- row 기반 E2E와 운영 tooling을 오래 재사용할 수 있다.

단점:

- dual-write mismatch 탐지와 보정 범위가 준비물에서 일정/템플릿/권한까지 커진다.
- P2P/backup/Yjs update와 Supabase row mutation을 계속 맞춰야 하므로 구현 속도가 느려진다.
- "Local-first document가 primary"라는 목표가 지연된다.

결론: 전환 초기에 제한적으로만 사용하고 장기 전략으로 채택하지 않는다.

### Option C: Full product document-primary 전환

장점:

- Web/Mobile의 데이터 모델과 동기화 경로가 하나로 정리된다.
- P2P와 encrypted backup이 같은 Yjs update format을 공유한다.
- legacy row는 migration source/read fallback으로 축소되어 구현 복잡도가 줄어든다.
- 전체 기능 완료 후 통합테스트/Closed Beta라는 제품 목표와 일치한다.

단점:

- Plan/Template/Member repository와 Web/Mobile 화면 전환 작업량이 크다.
- migration/restore 실패가 고객 데이터 접근에 직접 영향을 줄 수 있다.
- template boundary와 permission registry 책임을 명확히 나누지 않으면 모델이 다시 복잡해진다.

결론: 채택한다.

---

## 결정

Option C를 채택한다. TASK-030 이후 작업은 checklist pilot 확대가 아니라 **전체 제품 document-primary 전환**으로
진행한다.

Local-first 완료 범위는 다음 기능 전체다.

- 준비물 CRUD/check/toggle/assignee/template apply
- 일정 CRUD/order/url/place/visited/memo/cost/alarm metadata
- 템플릿 list/detail/create/edit/delete/share/apply
- 동행자 초대 / 수락 / 거부
- owner/editor/viewer role 변경과 revoke
- Web/Mobile local persistence
- Web/Mobile encrypted backup restore/sync
- Web/Web, Web/Mobile, Mobile/Mobile P2P fast path
- offline write 후 비동시 기기 eventual sync

통합테스트와 Closed Beta는 위 범위가 제품 경로에 올라간 뒤 진행한다. 일부 기능만 Local-first인 상태에서는
Closed Beta를 시작하지 않는다.

---

## Document Boundary 결정

### Trip-scoped 데이터

`ADR-005`의 초기 결정을 유지한다. 여행 단위 데이터는 하나의 `TripDocumentV1`을 root document로 둔다.

`TripDocumentV1`에 포함되는 제품 범위:

- trip root metadata
- plans, plan order, plan urls
- checklists, checklist items, categories, assignees, user checks
- members snapshot
- shares/invitation links snapshot
- trip asset references
- tombstones

Trip document는 여행 화면의 primary source다. Web/Mobile 여행 상세, 일정, 준비물, 동행자 UI는 최종적으로
Trip document materialized read model과 repository contract만 사용한다.

### Template 데이터

템플릿은 `TripDocumentV1` 내부에 넣지 않고 별도 `TemplateDocumentV1` boundary로 둔다.

이유:

- 템플릿은 특정 trip에 종속되지 않는다.
- 개인 템플릿, 공유 템플릿, 공개 템플릿은 trip collaborator 범위와 다르다.
- template share 권한은 trip owner/editor/viewer 권한과 독립적이다.
- 공개 템플릿은 여러 trip에 적용될 수 있어 Trip document 내부 entity로 두면 중복과 권한 충돌이 생긴다.

`TemplateDocumentV1` 최소 범위:

- template root metadata
- template items/categories
- owner/shared/public visibility snapshot
- template share snapshot
- tombstones

템플릿을 여행 준비물에 적용할 때는 Template document를 읽고, 결과 아이템을 `TripDocumentV1.checklistItems`
mutation으로 복사한다. Trip document에는 적용 출처를 위한 `sourceTemplateName` 또는 후속 확장
`sourceTemplateId`만 보관하고, template 본문을 reference live-link로 유지하지 않는다.

### Permission/registry 데이터

권한의 최종 authority는 계속 Supabase registry다.

- `document_members`
- `document_invitation_links`
- `document_share_tokens`
- `document_keys`
- user/device key material registry

Trip/Template document 내부 member/share snapshot은 UI guard와 offline 표시용이다. backup upload,
restore read, P2P write propagation, invitation accept, role change, revoke는 Supabase registry/RLS/RPC가
최종 판단한다.

---

## Legacy Row Migration 결정

기존 Supabase row table은 document-primary 전환 이후 primary sync 경로가 아니다.

ADR-014 이후 Closed Beta 기준에서는 아래 전환 정책을 **자동 제품 경로로 적용하지 않는다**. 기존 row 데이터는
Closed Beta 화면에서 무시하며, 명시적 migration tool의 source로만 남긴다.

전환 정책:

1. 기존 row 데이터는 최초 진입 또는 migration job에서 document로 변환한다.
2. 변환된 document는 encrypted snapshot/update backup의 source가 된다.
3. 기능별 document-primary 전환이 끝나면 해당 기능의 신규 write는 document repository로만 간다.
4. legacy row는 필요한 기간 동안 read-only migration source와 rollback fallback으로 유지한다.
5. 장기 dual-write는 채택하지 않는다. dual-write는 이미 존재하는 checklist 검증 범위와 짧은 cutover 기간에만 허용한다.
6. row table을 실시간 mirror로 유지하지 않는다. post-cutover 변경을 row에 계속 맞추는 작업은 TASK-030 이후 기본 범위에서 제외한다.

이 결정은 구현 속도를 우선한다. legacy row를 계속 실시간 동기화 대상으로 유지하는 대신, document migration과
encrypted backup restore/sync를 제품 경로로 빠르게 완성한다.

---

## Rollout 및 Rollback 기준

### Rollout

rollout은 기능 단위로 진행하되, Closed Beta gate는 전체 기능 완료 후에만 연다.

1. TASK-030: document-primary repository layer와 shared mutation/update contract 확정
2. TASK-031: Web 핵심 기능 document-primary 전환
3. TASK-032: Mobile 핵심 기능 document-primary 전환
4. TASK-033: 모든 document-primary mutation을 encrypted backup sync에 연결
5. TASK-034: 모든 도메인 mutation을 P2P fast path에 연결
6. TASK-035: 전체 제품 통합 테스트
7. TASK-036: Closed Beta readiness

### Rollback

rollback은 단계별로 다르게 본다.

- cutover 전: feature flag로 legacy row 화면/repository fallback을 사용할 수 있다.
- cutover 중: document migration 실패 시 해당 trip/template은 legacy row read-through를 재시도한다.
- cutover 후: local document와 encrypted backup이 primary이므로 rollback은 row mirror가 아니라 backup restore와
  document repository fallback을 우선한다.
- post-cutover 변경을 legacy row에 자동 재수출하는 것은 기본 rollback 전략이 아니다. 필요하면 별도 emergency
  export script로 다룬다.

rollback 판단 기준:

- document migration이 기존 row 의미를 보존하지 못함
- encrypted backup restore가 반복적으로 실패함
- owner/editor/viewer 권한 검증이 registry와 충돌함
- Web/Mobile 중 한 플랫폼에서 document-primary write가 고객 데이터 접근을 막음

---

## 완료 기준

Full Local-first product 완료는 다음 조건을 모두 만족해야 한다.

- Web/Mobile에서 준비물, 일정, 템플릿, 동행자/권한 기능이 document repository를 통해 동작한다.
- 모든 local mutation은 local persistence에 먼저 기록된다.
- owner/editor mutation은 encrypted backup update queue에 들어간다.
- 동시 접속 peer는 P2P로 같은 Yjs update를 주고받는다.
- 비동시 기기는 Supabase backup pull/restore로 eventually sync 된다.
- viewer/revoked member는 UI edit, backup upload, P2P write propagation에서 차단된다.
- 신규 Closed Beta 데이터는 처음부터 Trip/Template document로 생성된다. 기존 row 데이터의 손실 없는 migration은
  Closed Beta gate가 아니라 후속 migration tool 완료 조건이다.
- 통합테스트는 legacy row assertion이 아니라 document-primary/P2P/backup restore 기준으로 통과한다.

---

## 후속 작업

- `TASK-030-document-primary-repository-layer.md`
- `TASK-031-web-full-document-primary-transition.md`
- `TASK-032-mobile-full-document-primary-transition.md`
- `TASK-033-backup-sync-productization.md`
- `TASK-034-p2p-all-domain-wiring.md`
- `TASK-035-full-integration-test-suite.md`
- `TASK-036-closed-beta-readiness.md`
