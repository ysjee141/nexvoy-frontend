# Walkthrough: TASK-010 Cloudflare ICE Config

## Summary

Cloudflare STUN/TURN을 local-first P2P optional fast path의 ICE provider 기준선으로 추가했다. STUN은 공용 기본값으로 제공하고, TURN credential은 클라이언트에 하드코딩하지 않고 Supabase Edge Function에서 짧은 TTL로 발급하도록 구성했다.

## Artifacts

- `docs/refactor/tasks/TASK-010-cloudflare-ice-config.md`
- `docs/refactor/adrs/ADR-004-p2p-signaling-strategy.md`
- `docs/refactor/adrs/ADR-010-operating-cost-and-infrastructure.md`
- GitHub Issue: `#277`

## Key Changes

- `packages/core/src/sync/iceServers.ts`에 Web/RN 공용 ICE config 타입, Cloudflare STUN 기본값, TTL clamp, platform filter, P2P 관측 이벤트 타입을 추가했다.
- `supabase/functions/ice-servers` Edge Function을 추가해 Cloudflare Realtime TURN credential을 server-side secret으로 발급한다.
- Edge Function은 `verify_jwt=true`와 내부 `auth.getUser()` 검증으로 실제 로그인 사용자 세션에만 TURN credential을 발급한다.
- Cloudflare TURN env 누락 또는 발급 실패 시 STUN-only fallback을 반환해 P2P 실패가 local write/Supabase backup sync를 막지 않게 했다.
- `apps/web/lib/local-first/iceServers.ts`와 `apps/mobile/lib/local-first/iceServers.ts`에 Edge Function 호출, TTL 메모리 캐시, 실패 fallback adapter를 추가했다.
- `apps/web/lib/local-first/webRtcProvider.ts`를 추가하고, 모바일 `webRtcProvider*.ts`는 공용 ICE 타입과 P2P 관측 이벤트 hook을 사용하도록 정렬했다.
- Web/RN provider는 연결 후 `getStats()`로 selected candidate pair를 확인해 relay candidate 선택 시 `p2p_relay_selected`를 남긴다.
- `apps/web/services/AnalyticsService.ts`에 P2P 관측 이벤트 helper를 추가했다.
- `docs/refactor/tasks/README.md`를 갱신해 다음 task를 `TASK-011: Dual-write and Mismatch Detector`로 조정했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-app lint` 성공 (기존 warning 6건)
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- Cloudflare Realtime TURN key + Supabase Edge Function secret 등록 후 authenticated Web 호출에서 `fallback: "none"` 및 TURN `iceServers` 응답 확인
- reviewer 최종 PASS
- qa-engineer 최종 PASS

## Rollback

문제 발생 시 `supabase/functions/ice-servers`, `apps/web/lib/local-first/iceServers.ts`, `apps/web/lib/local-first/webRtcProvider.ts`, `apps/mobile/lib/local-first/iceServers.ts`, `packages/core/src/sync/iceServers.ts`를 제거하고 Web/RN provider의 ICE 타입 연동을 이전 상태로 되돌리면 된다. Cloudflare 관련 secret을 제거해도 앱은 STUN-only fallback 또는 P2P unavailable 상태에서 local write/Supabase backup sync를 유지해야 한다.

## Notes

- Supabase Edge Function secret: `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_KEY_SECRET`, 선택 `ICE_CONFIG_TTL_SECONDS`.
- `ICE_CONFIG_ALLOW_UNAUTHENTICATED`는 기본 false로 두어 인증 없이 TURN credential을 발급하지 않는다.
- 관측 이벤트에는 document content, Yjs update/snapshot/CRDT payload, signaling room id, raw document id를 포함하지 않는다.
- 실제 TURN credential 발급은 확인했다. TURN relay 연결성, relay selected/bytes, Web/RN data channel 안정성은 후속 브라우저/실기기 P2P 검증 대상이다.
