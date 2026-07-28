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
- `docs/refactor/tasks/TASK-051-mobile-sqlite-cache-outbox.md`
- `docs/refactor/runbooks/TASK-051-mobile-sqlite-authority-smoke.md`
- `docs/refactor/tasks/TASK-052-mobile-server-authority-product-cutover.md`
- `docs/refactor/tasks/TASK-058-production-p0-integration-automation.md`
- `docs/refactor/tasks/TASK-059-dev-migration-production-gate.md`
- `docs/refactor/reports/TASK-059-dev-migration-ledger-audit.md`
- `docs/refactor/runbooks/TASK-059-dev-migration-ledger.md`
- `docs/refactor/tasks/TASK-060-cross-platform-device-validation.md`
- `docs/refactor/tasks/TASK-061-dev-stability-cost-soak.md`
- `docs/refactor/tasks/TASK-062-disaster-recovery-rehearsal.md`
- `docs/refactor/tasks/TASK-063-production-preflight-and-rollout.md`
- `docs/refactor/tasks/TASK-064-ios-production-validation-and-rollout.md`
- `docs/refactor/reports/TASK-060-cross-platform-device-validation.md`
- `docs/refactor/runbooks/TASK-060-cross-platform-device-validation.md`
- `docs/refactor/runbooks/TASK-052-mobile-authority-product-smoke.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/refactor/runbooks/TASK-055-legacy-runtime-retirement.md`

## 현재 아키텍처

`TASK-055` 이후 제품 런타임은 Supabase normalized row authority, 계정별 Web IndexedDB/
Mobile SQLite cache, durable command outbox, Realtime revision invalidation만 사용한다. Yjs, WebRTC,
document key, encrypted backup, 별도 다운로드 여행 번들은 새 구현에서 사용하지 않는다.

Production P0 자동 Gate는 로컬 Supabase를 시작한 뒤 `pnpm test:production:p0`로 실행한다. 원격
DEV/Production에는 테스트 service role seed를 실행하지 않는다. TASK-059에서 DEV history repair와
TASK-058/059 forward migration을 적용했고 strict fingerprint는 12/12 version, 185/185 객체가
일치한다. 전용 임시 QA 네 계정의 authenticated remote-safe smoke도 PASS했으며 계정과 QA 데이터는
정리했다. 사용자 승인 후 Production에도 기존 history를 보존하는 target-only 방식으로
TASK-058/059를 적용했으며 fingerprint는 183/185다. 초기 Production 범위는 Web·Android다.
TASK-060의 Android 동일 계정·asset 수렴과 iOS release 실행은 Simulator PREPASS지만 Android 실제
기기 Gate가 남아 Android Production은 `NO-GO`다. TASK-061~063에서 관측·복구·Web/Android 출시를
진행하고 iOS 실기기와 App Store 출시는 TASK-064로 이관한다. 남은 ledger와 nullability 차이는
TASK-063에서 처리한다.
