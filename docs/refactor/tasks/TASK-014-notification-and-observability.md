# TASK-014: Notification Metadata 및 Observability

## 목적

Local-first 구조에서 로컬 알림과 협업 push metadata를 분리하고, sync/P2P/backup 비용과 품질을 관측할 수 있는 이벤트를 정의한다.

## 범위

- 시간 기반 로컬 알림 scheduler abstraction
- 협업 변경 `notification_events`
- batching/dedupe policy
- push token lifecycle
- local-first observability event 목록
- ADR-010 비용 dashboard 항목

## 선행 조건

- `TASK-008-backup-queue-and-restore.md`
- `TASK-012-guest-auth-promotion.md`
- `TASK-013-invitation-permission-registry.md`
- `ADR-009`, `ADR-010`

## 변경 대상

- `supabase/migrations/*.sql`
- `packages/core/src/sync/syncState.ts`
- `apps/mobile/lib/notifications/*`
- `apps/web/services` 또는 공용 analytics event boundary
- 비용/관측 문서

## 구현 단계

1. `notification_events` schema와 최소 RLS/RPC를 설계한다.
2. plan 변경 시 로컬 알림 예약/취소 interface를 만든다.
3. 협업 변경 summary를 Yjs update와 분리해 생성한다.
4. dedupe key와 batching 정책을 정의한다.
5. backup 실패, restore 완료, mismatch, P2P 연결/실패, TURN relay 사용량 이벤트를 수집한다.

## 데이터 호환성 고려사항

- push payload에 document content 전체를 넣지 않는다.
- 같은 document를 보고 있는 사용자는 push 대신 in-app toast를 우선한다.
- 로그아웃, 권한 해제, 회원 탈퇴 시 local notification과 push token을 정리한다.

## 검증 방법

- plan 시간 변경 시 로컬 알림 재등록 테스트
- offline 변경 후 online 복구 시 push 폭탄이 발생하지 않는지 확인
- observability event에 document payload가 남지 않는지 확인
- ADR-010 비용 지표에 backup/update/TURN/push 항목이 연결되는지 확인

## 롤백 방법

- 협업 push metadata 생성을 비활성화한다.
- 로컬 알림 scheduler는 기존 알림 flow로 fallback한다.
- 관측 이벤트는 no-op adapter로 교체한다.

## 완료 조건

- 서버가 Yjs blob을 해석하지 않아도 협업 알림을 보낼 수 있다.
- 로컬 알림이 오프라인에서도 동작한다.
- 비용과 품질을 판단할 최소 이벤트가 수집된다.
