# TASK-056: Production Data Integrity and Cost Gate

- 상태: 대기

## 목적

새 server-authority 아키텍처가 Initial Production 기준의 데이터 정합성, 권한, offline, 협업, 통신량,
운영 복구 요구를 충족하는지 전체 제품에서 검증한다. Closed Beta가 아니라 Production 진입 기준으로 판정한다.

## 범위

- Web/Web, Web/Mobile, Mobile/Mobile 통합 시나리오
- 동일 계정 새 기기와 collaborator 정합성
- offline/retry/crash/conflict/revoke/RLS 테스트
- 여행, 일정, 준비물, 템플릿, invitation, asset 전체 E2E
- protocol bytes, RPC batch, Realtime, DB/Storage egress 관측
- DEV rollout, Production migration/rollback runbook
- legacy sync object 물리 삭제 go/no-go와 별도 destructive migration
- Initial/Growth/Scale trigger와 운영 dashboard

제외:

- Growth용 영구 delta change log
- custom sync gateway
- rich text CRDT

## 선행 조건

- `TASK-046`~`TASK-055` 완료

## 변경 대상

- `apps/web/e2e`
- Mobile smoke/integration harness
- `supabase/tests`
- observability dashboard/event
- `docs/refactor/runbooks`
- `walkthrough.md`

## 검증 방법

### 필수 시나리오

1. A 계정이 Web에서 여행을 만들고 같은 계정 새 Web/Mobile 기기가 동일 데이터를 본다.
2. A가 B를 초대하고 두 사용자가 각 플랫폼에서 동시에 다른 entity를 수정한다.
3. 한 사용자가 offline에서 수정·종료한 뒤 reconnect하면 outbox가 한 번만 적용된다.
4. 같은 entity/field 충돌이 정책대로 병합되거나 사용자에게 재선택을 요구한다.
5. Realtime event를 유실해도 foreground/reconnect revision check가 복구한다.
6. role 변경/revoke 직후 stale client의 read/write/Broadcast/asset 접근이 차단된다.
7. 계정 A/B 전환에서 local cache와 outbox가 혼합되지 않는다.
8. 여행·일정·준비물·템플릿 삭제와 tombstone 정리가 다른 기기에 반영된다.
9. asset upload/download/orphan cleanup이 권한과 CDN 정책을 지킨다.
10. DB backup/export에서 canonical row를 복구하는 rehearsal을 수행한다.

## Initial 품질 및 비용 기준

- online pending outbox p95 age: 30초 이하
- 일반 domain command payload: 대표 mutation 2KB 이하 목표
- Realtime invalidation payload: 1KB 이하 목표
- duplicate command로 인한 중복 row: 0
- 권한 우회/RLS 실패: 0
- committed data loss 및 계정 간 cache 노출: 0
- full bundle refresh와 image egress를 분리 측정
- 1,000 MAU/월 20,000 mutation 모델에서 Supabase Pro quota 내 운영 가능

## 구현 단계

1. 자동화 가능한 matrix를 Playwright, SQL, Core integration test로 구현한다.
2. Web/Mobile 실제 기기 및 네트워크 전환 runbook을 실행한다.
3. representative workload로 command, full refresh, Realtime, image bytes를 측정한다.
4. queue age, conflict rate, rejected command, revision gap, full refresh, egress dashboard를 만든다.
5. DEV migration/reset/rollback rehearsal을 수행한다.
6. Production 적용 migration, client release, feature flag, monitoring, rollback 순서를 runbook으로 고정한다.
7. Initial go/no-go 결과와 Growth trigger를 기록한다.
8. 최소 지원 버전과 legacy traffic 0 관찰 기간을 확인한 뒤, 물리 삭제 migration을
   DEV rehearsal과 별도 승인으로 Production에 적용한다.

## Growth 재평가 Trigger

- full bundle refresh egress 또는 latency가 월 목표를 반복 초과한다.
- Realtime/DB/connection/compute 사용률이 지속적으로 70%를 넘는다.
- offline sync 구현 유지 비용이 managed provider 비용보다 커진다.
- 여행당 collaborator 또는 mutation 빈도가 Initial 가정을 크게 넘는다.

## 롤백 방법

- authority feature flag를 이전 안정 release로 전환한다.
- destructive DB migration 전에는 revoke-only object를 복구한다.
- Production 데이터는 managed backup/off-site export와 migration rollback script로 복구한다.

## 완료 조건

- 전체 필수 시나리오가 Web/Mobile/다중 계정에서 통과한다.
- 데이터 손실, 권한 누출, 계정 cache 혼합이 없다.
- 통신량과 운영비가 Initial 목표 안에 있음을 실측한다.
- Production rollout 및 rollback 담당자가 실행 가능한 runbook이 완성된다.
- legacy object 물리 삭제 여부가 명시적으로 승인되고 실행/유예 결과가 기록된다.
