# TASK-029: Full Local-first Product Scope ADR

## 목적

`TASK-001`~`TASK-028`은 Local-first 기반과 Web 준비물 중심 P2P fast path를 만들었다. 다음 단계는 일부
도메인 실험이 아니라 OnVoy 전체 제품을 Web/Mobile 모두 Local-first document-primary로 전환하는 것이다.
이 task는 구현 전에 전체 scope, document boundary, legacy row migration 전략, rollout/rollback 정책을
ADR로 확정한다.

## 범위

- Local-first 전체 제품 범위 확정
  - 준비물
  - 일정
  - 템플릿
  - 동행자 초대/수락/거부
  - 권한/멤버 역할 변경
  - Web/Mobile cross-device sync/restore
- document boundary 결정
  - `TripDocumentV1` 단일 document 유지 여부
  - `TemplateDocumentV1` 또는 subdocument 분리 여부
  - member/permission snapshot과 Supabase registry의 책임 분리
- legacy Supabase row migration 전략
  - 최초 진입 시 lazy migration
  - server/client migration job
  - read-only fallback 유지 기간
  - row table write 중단 시점
- Web/Mobile 전환 순서
- 통합테스트와 Closed Beta 진입 기준 정의

제외:

- 실제 repository 구현
- 화면 전환 코드
- DB migration 실행 코드

## 선행 조건

- `docs/refactor/progress.md`
- `TASK-001`~`TASK-028`
- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/refactor/adrs/ADR-001-local-first-data-engine.md`

## 변경 대상

- 신규 ADR: `docs/refactor/adrs/ADR-013-full-local-first-product-scope.md`
- `docs/refactor/tasks/README.md`
- 필요 시 `docs/refactor/TECHNICAL-SPEC.md` 보정

## 구현 단계

1. 현재 제품 기능을 Web/Mobile 기준으로 목록화한다.
2. 각 기능을 어느 document boundary에 둘지 결정한다.
3. legacy row를 migration source/fallback으로 축소하는 정책을 정한다.
4. document-primary 전환 완료 기준과 rollback 기준을 정의한다.
5. TASK-030~036의 dependency를 ADR에 반영한다.

## 데이터 호환성 고려사항

- 기존 row 데이터는 손실 없이 document로 변환되어야 한다.
- rollback 가능성을 위해 일정 기간 legacy row read fallback을 유지할 수 있다.
- document boundary 결정은 template 공개 범위와 trip collaborator 범위 차이를 반영해야 한다.

## 검증 방법

- ADR이 준비물/일정/템플릿/동행자 기능을 모두 포함하는지 확인한다.
- `progress.md`의 목표와 ADR 결정이 충돌하지 않는지 확인한다.
- TASK-030~036이 ADR decision을 근거로 구현 가능한 크기로 분해됐는지 확인한다.

## 롤백 방법

- 문서 task이므로 ADR/TASK 문서 변경을 되돌리면 된다.

## 완료 조건

- 전체 Local-first 제품 전환 scope가 ADR로 확정된다.
- document boundary와 legacy migration 전략이 명확하다.
- TASK-030~036이 해당 ADR 기준으로 실행 가능한 상태가 된다.
