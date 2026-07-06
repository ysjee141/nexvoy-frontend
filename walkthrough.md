# Walkthrough: TASK-014 Notification Metadata 및 Observability

## Summary

Local-first 구조에 맞춰 시간 기반 알림, 협업 push metadata, 비용/품질 관측 event boundary를 분리했다. 서버는 Yjs blob이나 문서 내용을 해석하지 않고 metadata-only `notification_events`를 dispatch하며, 모바일 일정 알림은 `expo-notifications` 기반 로컬 scheduler가 담당한다.

## Artifacts

- `docs/refactor/tasks/TASK-014-notification-and-observability.md`
- `docs/refactor/adrs/ADR-009-notification-strategy.md`
- `docs/refactor/adrs/ADR-010-operating-cost-and-infrastructure.md`
- GitHub Issue: `#285`

## Key Changes

- `notification_events` table, RLS, RPC를 추가하고 direct table access는 닫았다.
- 협업 push target은 accepted `document_members`에서 서버가 재계산하며 actor는 제외한다.
- `dispatch-notification-events` Edge Function을 추가하고 service-role/internal 호출만 허용했다.
- 기존 FCM direct relay와 server alarm function은 content-free/internal-only 경계로 축소했다.
- legacy content-bearing DB push trigger와 `join_trip_via_token` nickname push를 제거했다.
- `@nexvoy/core`에 notification metadata sanitizer, batching/dedupe helper, local notification scheduler interface, observability event sanitizer를 추가했다.
- Mobile은 `expo-notifications` scheduler를 plan save/delete, trip delete, logout/withdrawal cleanup에 연결했다.
- Web notification은 no-op/unsupported 경계로 정리하고 GA4 local-first event는 core sanitizer를 통과하도록 제한했다.
- Mobile Firebase Analytics adapter는 설정 파일이 없으면 no-op fallback으로 동작한다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-app lint` 성공 (기존 warning 7건)
- `pnpm --filter nexvoy-app exec expo install --check` 성공
- `git diff --check` 성공
- reviewer 최종 PASS
- qa-engineer 최종 PASS

## Rollback

문제 발생 시 `notification_events` enqueue/dispatcher cron을 비활성화하고 Web/Mobile은 no-op scheduler로 fallback한다. Mobile local notification은 adapter 호출을 끄거나 `cancelAllLocalNotifications()`로 정리한다. 신규 migration rollback은 `notification_events` table/RPC, user_devices lifecycle 컬럼, hardening function replace를 되돌리는 cleanup migration으로 처리한다.

## Notes

- push title/body/log/analytics에는 document content, plan title/location/memo, checklist item name, raw token/key/email/nickname/raw ids를 넣지 않는다.
- push data에는 navigation용 `document_id`/`trip_id`/`plan_id`만 허용했다.
- 로컬에 `deno` CLI가 없어 Edge Function `deno check`는 수행하지 못했다.
- Supabase local reset/RPC runtime smoke는 정적 검증까지만 수행했다.
- `expo-notifications`와 React Native Firebase는 native dependency 영향이 있으므로 EAS preview APK, 실제 Android device 설치/실행, Logcat, OS notification schedule/cancel 검증은 별도 수동 검증이 필요하다.
- 다음 작업은 `TASK-015: Owner-side Document Key Provisioning`다.
