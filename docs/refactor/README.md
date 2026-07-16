# Data Architecture Refactor

## 기준 브랜치

데이터 아키텍처 refactor 작업은 기존 규칙을 유지해 항상 `refactoring/local-first-architecture`를 기준 브랜치로 사용한다.

- 새 refactor task 브랜치는 `refactoring/local-first-architecture`에서 분기한다.
- refactor task PR의 base branch도 `refactoring/local-first-architecture`로 지정한다.
- `develop`, `main`, 또는 이전 task feature branch를 refactor 작업의 base로 사용하지 않는다.
- 이전 task가 머지된 뒤 다음 task를 시작할 때는 먼저 `git checkout refactoring/local-first-architecture && git pull origin refactoring/local-first-architecture`를 실행한다.

이 규칙은 TASK-030~032가 feature branch stack에 머지되어 `refactoring/local-first-architecture` 반영 시 충돌이 발생했던 문제를 방지하기 위한 것이다.

## 관련 문서

- `docs/refactor/adrs/ADR-015-offline-capable-server-authority.md` - 2026-07-17 이후 채택된 데이터 권위 및 동기화 기준
- `docs/refactor/reports/LOCAL-FIRST-DATA-INTEGRITY-AUDIT.md` - Production 단계별 계정 데이터 보장, 권한, 암호화, 저장소, P2P, 백업/복구 감사
- `docs/refactor/reports/PRODUCT-DATA-TRANSPORT-COST-EVALUATION.md` - 기존 P2P/local-first 제약을 제거한 제품 기능 기반 통신량·운영비용 비교
- `docs/refactor/progress.md`
- `docs/refactor/tasks/README.md`
- `docs/refactor/tasks/TASK-044-targeted-document-invitation-authority.md`
- `docs/refactor/tasks/TASK-045-invitation-join-and-key-delivery-productization.md`
- `docs/refactor/tasks/TASK-046-relational-authority-and-command-rpc.md`
- `docs/refactor/tasks/TASK-047-shared-offline-sync-core.md`
- `docs/refactor/tasks/TASK-048-web-indexeddb-cache-outbox.md`
- `docs/refactor/tasks/TASK-049-realtime-invalidation-and-revision-recovery.md`
- `docs/refactor/tasks/TASK-050-web-server-authority-product-cutover.md`
- `docs/refactor/TECHNICAL-SPEC.md`
