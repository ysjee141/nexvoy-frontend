# ADR-002: 모바일 WebRTC 런타임 전략

- 상태: 채택됨 (native build 가능성 추가 검증 필요)
- 결정일: 2026-06-29
- 결정자: ysjee141
- 관련 문서:
  - `docs/refactor/TECHNICAL-SPEC.md`
  - `docs/refactor/adrs/ADR-001-local-first-data-engine.md`

---

## 문제 정의

Local-first 전환의 실시간 협업은 Yjs + WebRTC 기반 P2P 동기화를 목표로 한다. 웹은 `y-webrtc`를 비교적 직접 검토할 수 있지만, Expo React Native 앱은 WebRTC 지원 방식에 제약이 있다.

특히 Expo Go 환경에서는 native WebRTC 모듈 사용이 제한될 수 있으며, `react-native-webrtc`를 사용하려면 dev client 또는 EAS Build 기반의 native runtime 전환이 필요할 가능성이 높다.

---

## 결정해야 할 질문

모바일에서 WebRTC를 위해 Expo dev client/EAS Build 전환을 허용할 것인가?

---

## 선택지

### Option A: Expo Go 호환성 유지, 모바일 P2P 제외

장점:

- 개발 환경 변화가 작다.
- native module 관리 부담이 없다.
- 앱 빌드/디버깅 복잡도가 낮다.

단점:

- 모바일은 P2P 실시간 협업을 사용할 수 없다.
- 모바일 동기화는 Supabase backup/pull fallback에 의존한다.
- Local-first의 핵심 경험이 웹과 앱에서 다르게 동작한다.

### Option B: Expo dev client/EAS Build 전환 후 `react-native-webrtc` 사용

장점:

- 모바일에서도 P2P 협업 가능성이 생긴다.
- 웹/앱 모두 유사한 동기화 모델을 유지할 수 있다.
- 여행 중 기기간 직접 동기화 경험을 검증할 수 있다.

단점:

- native dependency 관리 부담이 커진다.
- Expo Go 기반 빠른 개발 루프가 약해진다.
- iOS/Android 권한, background, network edge case 검증이 필요하다.

### Option C: 모바일은 P2P 대신 Supabase relay/sync 우선

장점:

- 안정적인 fallback을 먼저 확보할 수 있다.
- WebRTC 도입을 늦출 수 있다.
- 백그라운드/재접속 시나리오가 단순해진다.

단점:

- 완전한 P2P 목표와 거리가 있다.
- Supabase availability 의존이 남는다.
- 실시간성은 WebRTC보다 낮을 수 있다.

---

## 결정

Option B를 채택한다. 모바일 앱은 Expo dev client/EAS Build 전환을 허용하고, `react-native-webrtc` 또는 동등한 native WebRTC provider 사용을 전제로 검증한다.

단, native build 가능 여부와 iOS/Android 런타임 안정성은 추가 검토가 필요하다. WebRTC는 제품의 optional fast path이며, 실패 시 Supabase backup/pull sync로 fallback한다.

결정 사항:

- Expo Go 호환성보다 native WebRTC 가능성을 우선한다.
- dev client/EAS Build 전환 비용을 수용한다.
- `react-native-webrtc` 도입 가능성을 1차 후보로 검증한다.
- background sync는 WebRTC가 아니라 Supabase backup queue 중심으로 설계한다.

---

## 승인 기준

- `react-native-webrtc` 또는 대체 provider가 iOS/Android 빌드에서 동작한다.
- 앱 foreground/background 전환 시 연결 해제와 복구가 안전하다.
- WebRTC 실패 시 local write와 Supabase backup이 정상 동작한다.
- Expo dev client/EAS Build 전환 비용을 수용할 수 있다.

---

## 후속 작업

- 모바일 WebRTC PoC task 작성
- iOS/Android 빌드 검증
- P2P 실패 fallback 시나리오 E2E 작성
- provider factory 설계
