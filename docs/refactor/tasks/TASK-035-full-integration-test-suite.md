# TASK-035: Full Integration Test Suite

## 목적

모든 핵심 기능이 Local-first document-primary로 구현된 이후, Closed Beta 진입 전 제품 전체 동작을 검증하는
통합 테스트 suite를 작성한다.

## 범위

- Web multi-user Playwright E2E
- document-primary repository integration
- Web/Web P2P
- Web/Mobile P2P smoke
- Mobile/Mobile P2P smoke
- backup restore cross-device
- invitation/permission/key provisioning
- offline write/reconnect
- observability payload safety

제외:

- 기능 구현 자체
- Closed Beta 운영/스토어 배포 작업

## 선행 조건

- `TASK-031-web-full-document-primary-transition.md`
- `TASK-032-mobile-full-document-primary-transition.md`
- `TASK-033-backup-sync-productization.md`
- `TASK-034-p2p-all-domain-wiring.md`

## 변경 대상

- `apps/web/e2e/`
- E2E helper/fixture
- Mobile preview APK test runbook
- CI workflow가 있다면 E2E job 설정
- docs QA runbook

## 구현 단계

1. owner/editor/viewer multi-user fixtures를 만든다. ✅
2. local Supabase reset/migration path를 고정한다. ✅
3. Web full product E2E를 작성한다. ✅
4. Web/Web P2P E2E를 작성한다. Runbook으로 고정
5. backup restore cross-device E2E를 작성한다. Runbook으로 고정
6. Mobile runtime smoke runbook 또는 자동화 가능한 범위를 작성한다. ✅
7. observability payload에 raw document/secret/key material이 없는지 검증한다. ✅

## 구현 결과

| 항목 | 결과 |
| --- | --- |
| Web multi-user fixture | owner/editor/viewer 계정과 사용자별 authenticated context 생성 |
| DB 안전장치 | 로컬 Supabase URL만 service role seed/cleanup 허용, 테스트 유저는 `*.onvoy.local`만 허용 |
| Web 자동 E2E | document-primary 모드에서 권한 UI와 checklist local document reload 검증 |
| Observability 자동 E2E | raw document id, trip id, email, secret, snapshot, key payload 거부 검증 |
| Mobile/P2P/backup | `docs/qa/local-first-integration-runbook.md`에 실기기 smoke 절차 기록 |

## 데이터 호환성 고려사항

- 테스트 유저는 `*.onvoy.local` 도메인만 사용한다.
- 운영 DB를 테스트에 사용하지 않는다.
- test cleanup은 document/backup/member/key rows를 안전하게 정리해야 한다.

## 검증 방법

- `pnpm test:e2e`
- `pnpm --filter @nexvoy/core test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm build:mobile`
- Android/iOS smoke runbook 결과 기록

## 롤백 방법

- 테스트 task이므로 테스트 파일과 CI job 변경을 되돌린다.

## 완료 조건

- Closed Beta 진입 전 필수 Local-first 제품 시나리오가 자동 또는 runbook으로 검증된다.
- Web/Mobile/P2P/backup/permission 경계의 회귀를 잡을 수 있다.
