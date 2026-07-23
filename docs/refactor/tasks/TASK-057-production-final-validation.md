# TASK-057: Production 최종 검증 및 통합 테스트 운영

- 상태: 문서화 완료, 후속 실행 작업 대기
- Issue: [#370](https://github.com/ysjee141/nexvoy-frontend/issues/370)
- 선행 작업: `TASK-046`~`TASK-056`

## 결론

TASK-057은 TASK-056의 코드 게이트 이후 필요한 검증 기준, 테스트 케이스, 실행 Runbook을 확정한다.
현재 상태는 **Production NO-GO**다. 실제 검증과 출시는 `TASK-058`~`TASK-063`에서 단계적으로 수행하며,
원격 migration, 실기기 통합 테스트, 7일 관측, DB와 Storage 복구, 출시 책임자 지정이 모두 끝나야
GO로 전환한다.

## 산출물

- [Production 최종 검증 마스터 계획](../reports/TASK-057-production-final-validation-plan.md)
- [Production 통합 테스트 케이스](../test-plans/TASK-057-production-integration-test-cases.md)
- [최종 검증·증적·출시 Runbook](../runbooks/TASK-057-production-validation-runbook.md)
- [TASK-056 Go/No-Go](../reports/TASK-056-production-go-no-go.md)
- [TASK-056 배포·복구 Runbook](../runbooks/TASK-056-production-rollout-and-recovery.md)

## 범위

- 로컬 자동화와 원격 안전 검증의 실행 경계 확정
- 여행, 일정, 준비물, 템플릿, 초대, 권한, asset 전체 제품 회귀
- Web/Web, Web/Mobile, Mobile/Mobile 및 동일 계정 새 기기 검증
- offline, 강제 종료, reconnect, Realtime 유실, 충돌, revoke 검증
- DEV migration ledger 정합화와 TASK-056 migration 적용
- 7일 운영 지표 관찰과 비용 기준 확인
- DB와 `place-photos` Storage의 분리 백업·복구 rehearsal
- Production preflight, canary, 단계적 확대, 중단과 롤백

## 제외 범위

- legacy object 물리 삭제
- WebRTC/P2P, Yjs, document key, encrypted backup 복구
- rich text CRDT와 custom sync gateway
- 실제 Production 배포의 자동 승인

## 실행 단계

1. `TASK-058`에서 P0 제품 통합 테스트 자동화를 보완한다.
2. `TASK-059`에서 DEV schema fingerprint, migration ledger, TASK-056 migration을 검증한다.
3. `TASK-060`에서 원격 안전 smoke와 전체 실기기 매트릭스를 실행한다.
4. `TASK-061`에서 7일 안정성·비용 지표를 수집한다.
5. `TASK-062`에서 DB+Storage 복구 rehearsal을 통과한다.
6. `TASK-063`에서 Production preflight와 내부·5%·25%·100% 출시를 수행한다.

## 완료 조건

- 마스터 계획, 통합 테스트 명세, Runbook이 서로 같은 Gate와 차단 항목을 사용한다.
- TASK-056의 남은 차단 항목이 `B-01`~`B-11`로 추적된다.
- 실제 실행 범위가 `TASK-058`~`TASK-063`으로 분리되고 선행 관계와 종료 조건이 명시된다.
- Production GO는 후속 작업 완료 전 선언하지 않는다.

## 롤백 원칙

TASK-055 이후 제품은 authority-only다. retired feature flag나 legacy document runtime으로 돌아가지 않는다.
문제가 발생하면 쓰기를 동결하고 직전 안정 authority-only client로 롤백한다. DB function은 비파괴적으로
복원하며 committed canonical row는 역방향 migration으로 임의 삭제하지 않는다.
