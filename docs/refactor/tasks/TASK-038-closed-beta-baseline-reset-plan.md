# TASK-038: Closed Beta Baseline Reset Plan

## 목적

Closed Beta 기준선을 기존 데이터 보존/자동 마이그레이션에서 신규 document-primary 데이터 기준으로 재설정한다.
기존 데이터는 제품 경로에서 무시하고, 신규 여행/일정/준비물/템플릿이 local storage, P2P, encrypted backup으로
일관되게 동작하도록 후속 task를 분리한다.

## 범위

- ADR-014 작성 및 채택
- refactor 진행 문서와 task index 갱신
- 기존 데이터 자동 마이그레이션 전제 제거
- 후속 구현 task 분리
- Closed Beta gate를 신규 document-primary flow 기준으로 재정의

제외:

- 실제 legacy row 삭제
- 실제 기능 코드 변경
- migration tool 구현

## 선행 조건

- `TASK-037-web-document-primary-key-bootstrap-and-photo-storage.md`
- PR #335 merge

## 변경 대상

- `docs/refactor/adrs/ADR-014-closed-beta-baseline-reset.md`
- `docs/refactor/tasks/README.md`
- `docs/refactor/progress.md`
- `docs/refactor/tasks/TASK-039-new-document-bootstrap.md`
- `docs/refactor/tasks/TASK-040-document-primary-product-path-cutover.md`
- `docs/refactor/tasks/TASK-041-backup-freshness-and-cost-control.md`
- `docs/refactor/tasks/TASK-042-legacy-migration-tool.md`

## 구현 단계

1. ADR-014로 전략 변경을 기록한다.
2. TASK-039~042를 작은 구현 단위로 분리한다.
3. task index와 progress 문서의 완료 기준을 신규 baseline 기준으로 수정한다.
4. Closed Beta 전 필수 작업과 후속 migration 작업을 분리한다.

## 데이터 호환성 고려사항

- 기존 row 데이터는 삭제하지 않는다.
- 기존 row 데이터는 제품 화면에서 자동 hydrate하지 않는다.
- 기존 데이터 복구/전환은 TASK-042에서 명시적 migration tool로 다룬다.

## 검증 방법

- 문서상 Closed Beta gate가 신규 document-primary 데이터 기준인지 확인한다.
- 기존 데이터 자동 마이그레이션이 필수 조건에서 제거되었는지 확인한다.
- 후속 task가 여행/일정/준비물/템플릿 전체를 포함하는지 확인한다.

## 롤백 방법

- ADR-014를 폐기하고 ADR-013의 migration-first 전략으로 되돌린다.
- TASK-039~042를 보류하고 legacy hydrate/fallback 작업을 재개한다.

## 완료 조건

- 전략 변경이 ADR/task/progress 문서에 일관되게 반영된다.
- 후속 구현 task가 작업 가능한 크기로 분리된다.
