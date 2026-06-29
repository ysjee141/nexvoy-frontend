# TASK-009: Mobile WebRTC Native Feasibility

## 목적

Expo dev client/EAS Build 기반에서 `react-native-webrtc` 또는 대체 provider가 iOS/Android에서 동작 가능한지 검증한다.

## 범위

- native WebRTC dependency 후보 검토
- Expo dev client/EAS Build 설정 영향 확인
- foreground/background 전환 시 연결 해제/복구 동작
- WebRTC 실패 시 Supabase backup fallback 확인

## 선행 조건

- `ADR-002` Option B 결정
- `ADR-004` P2P optional fast path 결정
- `TASK-008-backup-queue-and-restore.md`

## 변경 대상

- `apps/mobile/lib/local-first/webRtcProvider.native.ts`
- `apps/mobile/app.config.*` 또는 EAS 설정이 필요한 경우
- `apps/mobile/package.json`
- 검증 결과 문서

## 구현 단계

1. `react-native-webrtc`와 대체 provider의 Expo/EAS 호환성을 확인한다.
2. dev client build에서 peer connection 생성만 먼저 검증한다.
3. foreground/background 전환 시 connection lifecycle을 기록한다.
4. 실패 시 backup queue가 계속 동작하는지 확인한다.
5. 제품 적용 전 필요한 native build 운영 비용을 정리한다.

## 데이터 호환성 고려사항

- WebRTC는 optional이므로 실패해도 local write와 backup sync는 유지되어야 한다.
- native module 도입이 Expo Go 개발 흐름에 미치는 영향을 문서화한다.

## 검증 방법

- iOS dev client build
- Android dev client build
- foreground/background 전환 수동 테스트
- WebRTC disabled 상태에서 backup restore 테스트

## 롤백 방법

- native WebRTC dependency와 설정을 제거한다.
- provider factory가 no-op P2P provider를 반환하도록 한다.

## 완료 조건

- iOS/Android에서 native WebRTC 가능 여부가 명확해진다.
- 불가할 경우 대체 provider 또는 P2P 후순위 전략이 문서화된다.
- WebRTC 실패가 데이터 손실로 이어지지 않는다.
