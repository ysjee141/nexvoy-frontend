# TASK-036: Closed Beta Readiness

## 목적

완성된 Local-first 제품을 실제 고객에게 Closed Beta로 공개하기 위한 운영, 보안, 배포, 법적, 모니터링
준비를 완료한다.

## 범위

- 운영 Supabase migration 적용/검증
- Vercel production/preview 환경 점검
- Android Play Internal Testing 준비
- iOS TestFlight 준비
- EAS build/submit 전략
- monitoring/alerting
- privacy/terms
- beta tester 운영 runbook
- P2P/backup kill switch
- incident rollback plan

제외:

- Local-first 기능 구현
- integration suite 구현

## 선행 조건

- `TASK-035-full-integration-test-suite.md`

## 변경 대상

- `docs/production-readiness.md`
- 신규 beta runbook 문서
- deployment docs
- env example/secret inventory
- monitoring docs
- 필요 시 API rate limiting 구현 task 분리

## 구현 단계

1. production readiness 문서를 Expo RN/EAS 기준으로 갱신한다. ✅
2. 운영 Supabase migration list와 RLS smoke 결과 기록 위치를 확정한다. ✅
3. Vercel env/preview/production 배포 checklist를 확정한다. ✅
4. Android internal testing build와 iOS TestFlight checklist를 작성한다. ✅
5. Sentry/GA/Discord/Supabase/Vercel alerting 점검표를 작성한다. ✅
6. 개인정보처리방침/이용약관/스토어 privacy label 준비 항목을 정리한다. ✅
7. Closed Beta tester 초대/피드백/incident 대응 runbook을 작성한다. ✅
8. P2P/backup/document-primary kill switch와 rollback 절차를 문서화한다. ✅

## 구현 결과

| 항목 | 결과 |
| --- | --- |
| Production readiness | `docs/production-readiness.md`를 Closed Beta go/no-go gate 기준으로 갱신 |
| Secret inventory | `docs/runbooks/secret-inventory.md`에 Web/Mobile/Supabase secret 위치와 rotation trigger 정리 |
| Rollback | `docs/runbooks/deployment-rollback.md`에 Vercel/EAS/Supabase/Local-first rollback matrix 작성 |
| Beta 운영 | `docs/runbooks/closed-beta-runbook.md`에 tester onboarding, daily smoke, feedback triage, incident/data request 절차 작성 |
| Issue | [#330](https://github.com/ysjee141/nexvoy-frontend/issues/330) |

## 데이터 호환성 고려사항

- 운영 migration 전 DB backup snapshot을 생성한다.
- migration rollback 가능성과 fallback mode를 문서화한다.
- beta tester 데이터 삭제/탈퇴 요청 대응 경로를 정리한다.

## 검증 방법

- full integration suite PASS 또는 미실행 사유 기록.
- Android internal test install/pass 결과 기록.
- iOS TestFlight smoke pass 결과 기록.
- production Supabase RLS/RPC smoke 결과 기록.
- monitoring alert test 결과 기록.
- privacy/terms URL 공개 확인.

## 롤백 방법

- Vercel 이전 deployment rollback.
- EAS update/channel rollback.
- P2P/backup/document-primary feature flag disable.
- 필요 시 Supabase migration rollback plan 실행.

## 완료 조건

- 완성 제품 기준 Closed Beta를 실제 고객에게 공개할 수 있다.
- 운영/보안/법적/모니터링/rollback 준비가 문서와 실행 결과로 확인된다.
