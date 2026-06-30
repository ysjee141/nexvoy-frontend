# TASK-009 Mobile WebRTC Native Feasibility

## Conclusion

Expo SDK 54 모바일 앱에서 native WebRTC는 가능성이 있지만 Expo Go에서는 사용할 수 없다. 제품 적용 전 `react-native-webrtc`를 포함한 EAS development client를 iOS/Android 실기기에서 빌드해 peer connection lifecycle을 검증해야 한다.

이번 task에서는 native dependency를 앱에 바로 추가하지 않고, 모바일 P2P fast path가 실패해도 Supabase backup sync fallback을 유지하는 provider boundary를 추가했다.

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
  - native runtime에서 아직 `react-native-webrtc`가 설치되지 않은 상태를 명시적으로 반환한다.
  - `createPeerConnection()` 호출 시 fallback reason을 포함해 실패한다.
- `apps/mobile/lib/local-first/webRtcProvider.ts`
  - Expo web/export 또는 non-native resolution에서 dev-client-required 상태를 반환한다.

## Lifecycle Notes

- Foreground/background 전환은 native dependency 설치 후 실기기에서 검증해야 한다.
- 현재 provider는 `AppState.currentState`를 diagnostic에 포함해 추후 연결 해제/복구 로그의 기준점을 제공한다.
- WebRTC는 optional fast path이므로 unavailable 상태에서도 local write와 Supabase backup queue는 계속 동작해야 한다.

## Manual Verification Plan

1. `npx expo install react-native-webrtc @config-plugins/react-native-webrtc expo-dev-client`
2. `apps/mobile/app.json` plugins에 `@config-plugins/react-native-webrtc` 추가
3. `eas build --profile development --platform ios`
4. `eas build --profile development --platform android`
5. 실기기에서 peer connection/data channel 생성 확인
6. foreground/background 전환 후 연결 close/reconnect 로그 확인
7. WebRTC disabled/unavailable 상태에서 Supabase backup restore flow가 유지되는지 확인

## Decision

`react-native-webrtc`를 1차 후보로 유지한다. 다만 이번 단계에서 프로젝트에 native dependency를 고정하지 않는다. 다음 단계인 `TASK-010`에서 Cloudflare STUN/TURN config 발급 경로를 만든 뒤, ICE config와 함께 dev client PoC를 실행하는 편이 검증 비용이 낮다.
