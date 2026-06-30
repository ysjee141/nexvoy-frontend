# TASK-009 Mobile WebRTC Native Feasibility

## Conclusion

Expo SDK 54 모바일 앱에서 native WebRTC는 가능성이 있지만 Expo Go에서는 사용할 수 없다. 제품 적용 전 `react-native-webrtc`를 포함한 EAS development client를 iOS/Android 실기기에서 빌드해 peer connection lifecycle을 검증해야 한다.

이번 task에서는 Android EAS development build prebuild까지 검증할 수 있도록 native dependency와 EAS project 설정을 추가했다. 모바일 provider는 `react-native-webrtc`의 `RTCPeerConnection` 생성까지 연결하되, WebRTC는 여전히 optional fast path이며 Supabase backup sync fallback을 유지한다.

## Candidate

- Primary: `react-native-webrtc`
- Expo config plugin: `@config-plugins/react-native-webrtc`
- SDK 54 기준 후보 버전:
  - `react-native-webrtc@124.0.6`
  - `@config-plugins/react-native-webrtc@13.0.0`
  - `expo-dev-client`

## Expo/EAS Impact

- Expo Go: 미지원. native module을 포함한 custom dev client가 필요하다.
- EAS/dev client: 필요. `app.json` plugins에 `@config-plugins/react-native-webrtc` 추가 후 native rebuild가 필요하다.
- Android: plugin이 minimum SDK 24를 요구할 수 있어 기존 native dependency와 충돌 여부 확인이 필요하다.
- iOS: plugin이 WebRTC 빌드 요구사항에 맞게 Bitcode 관련 설정을 조정한다.
- EAS Update: JS-only 변경은 가능하지만 native module/config 변경은 새 dev client/build가 필요하다.

## Current Implementation

- `apps/mobile/lib/local-first/webRtcProvider.types.ts`
  - 후보 provider, diagnostic, ICE server, availability 타입을 정의한다.
- `apps/mobile/lib/local-first/webRtcProvider.native.ts`
  - native runtime에서 `react-native-webrtc`의 `RTCPeerConnection`을 생성한다.
  - `close()` 호출 시 생성한 peer connection을 모두 닫는다.
- `apps/mobile/lib/local-first/webRtcProvider.ts`
  - Expo web/export 또는 non-native resolution에서 dev-client-required 상태를 반환한다.
- `apps/mobile/app.json`
  - EAS project id와 WebRTC config plugin을 연결한다.
  - 존재하지 않는 placeholder asset 참조를 제거해 prebuild asset hashing failure를 방지한다.
  - `react-native-webrtc` SDK 54 New Architecture 경고를 피하기 위해 mobile New Architecture를 비활성화한다.
- `apps/mobile/eas.json`
  - development client build profile을 추가한다.
- `apps/mobile/package.json`
  - SDK 54 기준 `react-native-webrtc@124.0.6`, `@config-plugins/react-native-webrtc@13.0.0`, `expo-dev-client`, `expo-font`, `react-dom`을 추가한다.
- `apps/mobile/index.js`, `index.js`, `apps/mobile/metro.config.js`
  - pnpm monorepo에서 Android Gradle release bundler가 Expo Router entry와 `@/` alias를 안정적으로 해석하도록 로컬 entry와 resolver를 추가한다.

## Lifecycle Notes

- Foreground/background 전환은 native dependency 설치 후 실기기에서 검증해야 한다.
- 현재 provider는 `AppState.currentState`를 diagnostic에 포함해 추후 연결 해제/복구 로그의 기준점을 제공한다.
- WebRTC는 optional fast path이므로 unavailable 상태에서도 local write와 Supabase backup queue는 계속 동작해야 한다.

## Manual Verification Plan

1. repo root에서 `pnpm install`을 먼저 실행해 workspace dependency를 설치한다.
2. `cd apps/mobile`
3. `pnpm exec eas build --profile development --platform ios`
4. `pnpm exec eas build --profile development --platform android`
5. 실기기에서 peer connection/data channel 생성 확인
6. foreground/background 전환 후 연결 close/reconnect 로그 확인
7. WebRTC disabled/unavailable 상태에서 Supabase backup restore flow가 유지되는지 확인

## EAS Android Build Notes

- Initial build: `c10e9239-8154-43cf-879b-4235681a8a1c`
- Failure phase: `PREBUILD`
- Direct cause: `ENOENT: no such file or directory, open './assets/adaptive-icon.png'`
- Resolution: remove missing `icon`, `splash.image`, and `android.adaptiveIcon.foregroundImage` references from `app.json`.
- Remaining `expo-doctor` findings are not currently build-blocking in EAS:
  - monorepo Metro override warning
  - `react-native-webrtc` untested on New Architecture warning
  - pre-existing Expo SDK package version mismatch warnings

## EAS Android Preview Notes

- Local preview build command: `pnpm exec eas build --profile preview --platform android --local --clear-cache`
- Earlier failure phase: `:app:createBundleReleaseJsAndAssets`
- Direct causes:
  - Android Gradle release bundler resolved the project entry from the pnpm monorepo root instead of the mobile package entry.
  - Gradle Metro did not resolve the `@/` TypeScript path alias.
  - pnpm isolated dependency layout did not expose `metro-runtime` and `babel-preset-expo` to the Gradle bundling process.
- Resolution:
  - Add mobile `index.js` and root entry shim for Expo Router release bundling.
  - Add Metro alias resolver for `@/`.
  - Add explicit `metro-runtime` and `babel-preset-expo@54.0.11` dependencies for SDK 54 bundling.
- Verification: local preview Android build completed successfully and produced a release APK.

## Decision

`react-native-webrtc`를 1차 후보로 유지한다. native build는 Expo Go가 아니라 EAS development client를 기준으로 검증한다. 다음 단계인 `TASK-010`에서 Cloudflare STUN/TURN config 발급 경로를 만든 뒤, ICE config와 함께 data channel 연결 안정성을 검증한다.
