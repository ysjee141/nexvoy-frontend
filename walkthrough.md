# Walkthrough: TASK-009 Mobile WebRTC Native Feasibility

## Summary

Expo SDK 54 모바일 앱에서 native WebRTC를 optional fast path로 둘 수 있는지 검토했다. `react-native-webrtc`는 Expo Go에서 사용할 수 없고 EAS development client가 필요하므로, 이번 단계에서는 native dependency를 바로 고정하지 않고 provider boundary와 feasibility report를 추가했다.

## Artifacts

- `docs/refactor/tasks/TASK-009-mobile-webrtc-native-feasibility.md`
- `docs/refactor/reports/TASK-009-mobile-webrtc-native-feasibility.md`
- `docs/refactor/adrs/ADR-002-mobile-webrtc-runtime.md`
- `docs/refactor/adrs/ADR-004-p2p-optional-fast-path.md`

## Key Changes

- `apps/mobile/lib/local-first/webRtcProvider.types.ts`에 모바일 WebRTC provider, diagnostics, ICE server 타입과 SDK 54 후보 패키지를 정의했다.
- `apps/mobile/lib/local-first/webRtcProvider.native.ts`는 native runtime에서 `react-native-webrtc` 미설치 상태를 명확히 반환하고 Supabase backup fallback을 요구한다.
- `apps/mobile/lib/local-first/webRtcProvider.ts`는 Expo web/export 또는 non-native resolution에서 dev-client-required 상태를 반환한다.
- feasibility report에 `react-native-webrtc@124.0.6`, `@config-plugins/react-native-webrtc@13.0.0`, `expo-dev-client` 기반의 EAS 검증 절차와 운영 비용을 정리했다.
- `docs/refactor/tasks/README.md`를 갱신해 다음 task를 `TASK-010: Cloudflare ICE Config`로 조정했다.

## Verification

- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공

## Rollback

문제 발생 시 `apps/mobile/lib/local-first/webRtcProvider*.ts`와 `docs/refactor/reports/TASK-009-mobile-webrtc-native-feasibility.md`를 제거하면 된다. native dependency를 추가하지 않았으므로 Expo 설정이나 lockfile rollback은 필요 없다.

## Notes

- 실제 iOS/Android peer connection 생성은 native module 설치와 EAS dev client build가 필요해 이 환경에서는 수동 검증 대상으로 남겼다.
- WebRTC는 optional fast path이며 unavailable 상태에서도 local write와 Supabase backup/restore가 데이터 안전성의 기본 경로다.
