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

## 구현 결과

- `notification_events` schema, RLS, RPC를 추가하고 direct table access는 닫았다.
- 협업 알림 target은 클라이언트 입력을 신뢰하지 않고 accepted `document_members`에서 actor를 제외해 서버에서 재계산한다.
- dispatcher용 list/mark RPC는 service-role 전용 grant와 runtime role check를 둔다.
- `user_devices`에 provider/status/last_seen/revocation lifecycle 컬럼과 current-user cleanup RPC를 추가했다.
- `dispatch-notification-events` Edge Function을 추가하고, 기존 FCM 경로는 service-role/internal 호출만 허용하도록 제한했다.
- legacy content-bearing DB push trigger와 `join_trip_via_token` direct nickname push 경로를 제거했다.
- 서버 cron형 `check-pending-alarms`는 local notification primary 정책에 맞춰 disabled/content-free response로 축소했다.
- `@nexvoy/core`에 notification metadata sanitizer, batching/dedupe helper, local notification scheduler interface, observability event sanitizer를 추가했다.
- Mobile은 `expo-notifications` 기반 local scheduler를 추가하고 plan create/update/delete, trip delete, logout/withdrawal cleanup에 연결했다.
- Web notification은 no-op/unsupported 경계로 정리하고 GA4 local-first event는 core sanitizer를 통과하도록 제한했다.
- Mobile observability는 Firebase Analytics adapter를 추가하되, native config 파일이 없으면 no-op fallback으로 동작한다.

## 데이터 호환성 고려사항

- push payload에 document content 전체를 넣지 않는다.
- 같은 document를 보고 있는 사용자는 push 대신 in-app toast를 우선한다.
- 로그아웃, 권한 해제, 회원 탈퇴 시 local notification과 push token을 정리한다.

## 검증 방법

- plan 시간 변경 시 로컬 알림 재등록 테스트
- offline 변경 후 online 복구 시 push 폭탄이 발생하지 않는지 확인
- observability event에 document payload가 남지 않는지 확인
- ADR-010 비용 지표에 backup/update/TURN/push 항목이 연결되는지 확인

## 검증 결과

- reviewer 최종 `PASS`
- qa-engineer 최종 `PASS`
- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-app lint` 성공 (기존 warning 7건)
- `pnpm --filter nexvoy-app exec expo install --check` 성공
- `git diff --check` 성공

미수행/잔여 검증:

- 로컬에 `deno` CLI가 없어 Edge Function `deno check`는 실행하지 못했다.
- Supabase local reset/RPC runtime smoke는 정적 검증까지만 수행했다.
- EAS preview APK, 실제 Android device 설치/실행, Logcat, OS notification schedule/cancel runtime 검증은 별도 수동 검증이 필요하다.

## 롤백 방법

- 협업 push metadata 생성을 비활성화한다.
- 로컬 알림 scheduler는 기존 알림 flow로 fallback한다.
- 관측 이벤트는 no-op adapter로 교체한다.

## 완료 조건

- 서버가 Yjs blob을 해석하지 않아도 협업 알림을 보낼 수 있다.
- 로컬 알림이 오프라인에서도 동작한다.
- 비용과 품질을 판단할 최소 이벤트가 수집된다.
