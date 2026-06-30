# Walkthrough: TASK-009 Mobile WebRTC Native Feasibility

## Summary

Expo SDK 54 모바일 앱에서 native WebRTC를 optional fast path로 둘 수 있는지 검토했다. `react-native-webrtc`는 Expo Go에서 사용할 수 없고 EAS development client가 필요하므로, SDK 54 호환 native dependency와 EAS 설정을 추가하고 provider boundary에서 peer connection 생성까지 연결했다.

## Artifacts

- `docs/refactor/tasks/TASK-009-mobile-webrtc-native-feasibility.md`
- `docs/refactor/reports/TASK-009-mobile-webrtc-native-feasibility.md`
- `docs/refactor/adrs/ADR-002-mobile-webrtc-runtime.md`
- `docs/refactor/adrs/ADR-004-p2p-optional-fast-path.md`

## Key Changes

- `apps/mobile/lib/local-first/webRtcProvider.types.ts`에 모바일 WebRTC provider, diagnostics, ICE server 타입과 SDK 54 후보 패키지를 정의했다.
- `apps/mobile/lib/local-first/webRtcProvider.native.ts`는 native runtime에서 `react-native-webrtc`의 `RTCPeerConnection`을 생성하고 `close()`에서 생성된 연결을 정리한다.
- `apps/mobile/lib/local-first/webRtcProvider.ts`는 Expo web/export 또는 non-native resolution에서 dev-client-required 상태를 반환한다.
- `apps/mobile/app.json`, `apps/mobile/eas.json`, `apps/mobile/package.json`에 EAS dev client와 SDK 54 WebRTC dependency를 반영했다.
- EAS Android prebuild 실패 원인이 누락 asset 참조(`./assets/adaptive-icon.png`)였음을 기록하고, 존재하지 않는 placeholder asset 참조를 제거했다.
- feasibility report에 `react-native-webrtc@124.0.6`, `@config-plugins/react-native-webrtc@13.0.0`, `expo-dev-client` 기반의 EAS 검증 절차와 운영 비용을 정리했다.
- `docs/refactor/tasks/README.md`를 갱신해 다음 task를 `TASK-010: Cloudflare ICE Config`로 조정했다.

## Verification

- `pnpm --filter nexvoy-app typecheck` 성공
- `git diff --check` 성공
- `pnpm dlx expo-doctor` 실행: 15/18 checks passed, 남은 3개는 monorepo Metro override, `react-native-webrtc` New Architecture warning, 기존 SDK package mismatch warning
- `pnpm build` 성공
- `pnpm build:mobile` 성공

## Rollback

문제 발생 시 `apps/mobile/lib/local-first/webRtcProvider*.ts`, `docs/refactor/reports/TASK-009-mobile-webrtc-native-feasibility.md`, `apps/mobile/eas.json`을 제거하고 `apps/mobile/app.json`, `apps/mobile/package.json`, `pnpm-lock.yaml`의 WebRTC/EAS dependency 변경을 되돌리면 된다.

## Notes

- Android EAS build `c10e9239-8154-43cf-879b-4235681a8a1c`는 prebuild에서 실패했으며, 직접 원인은 WebRTC가 아니라 존재하지 않는 asset 파일 참조였다.
- 실제 iOS/Android peer connection 동작은 EAS dev client 실기기 설치 후 수동 검증 대상으로 남겼다.
- WebRTC는 optional fast path이며 unavailable 상태에서도 local write와 Supabase backup/restore가 데이터 안전성의 기본 경로다.
