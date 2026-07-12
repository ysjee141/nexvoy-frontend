# TASK-023: Mobile Signaling Channel Wiring

## 목적

`TASK-021`은 Web-to-Web 연결만 증명했다. `apps/mobile/lib/local-first/webRtcProvider.native.ts`(TASK-009)는
여전히 소비처가 없어 Web-Mobile, Mobile-Mobile P2P 연결이 불가능하다. 이 task는 `TASK-021`의 시그널링
채널·데이터 채널 배선을 Mobile까지 확장한다.

## 범위

- `apps/mobile/lib/local-first/signalingChannel.ts`(신규): Supabase Realtime Broadcast private
  channel에 RN Supabase client로 join. `apps/web/lib/local-first/signalingChannel.ts`와 동일한
  프로토콜(`packages/core/src/sync/signalingChannel.ts`의 메시지 타입) 재사용.
- `packages/core`의 `deriveSignalingRoomTopic()`이 요구하는 `SubtleCrypto`-shaped digest provider를
  RN 환경에서 구현 — `isomorphic-webcrypto`는 RN 번들에서 쓸 수 없다는 `TASK-020` 결론을 그대로
  따르며, `expo-crypto`의 `digestStringAsync` 등 RN 호환 경로로 대체한다.
- `webRtcProvider.native.ts`에 `createHandshakeDataChannel`/`wireHandshakeDataChannel`에 대응하는
  RN 버전 배선(react-native-webrtc의 데이터 채널 API가 Web 표준과 100% 동일한지 확인 필요).
- `apps/mobile/lib/local-first/webP2PConnection.ts`(신규): Web의 `connectWebP2PPeer()`에 대응하는
  조립 지점.
- Web-Mobile, Mobile-Mobile 연결 시나리오 검증(foreground만; background 전환 시 연결 유지/정리는
  `TASK-026`으로 이관).

## 선행 조건

- `TASK-021-web-signaling-channel-and-data-channel-handshake.md`
- `TASK-009-mobile-webrtc-native-feasibility.md`
- `TASK-018-mobile-non-exportable-key-storage.md`, `TASK-020-mobile-encrypted-snapshot-restore.md`
  (RN에서 Web Crypto 계열 API를 쓸 수 없다는 것을 이미 확인한 선례)
- `ADR-012-p2p-signaling-transport-supabase-realtime-broadcast.md`

## 변경 대상

- `apps/mobile/lib/local-first/signalingChannel.ts`(신규)
- `apps/mobile/lib/local-first/webRtcProvider.native.ts`
- `apps/mobile/lib/local-first/webP2PConnection.ts`(신규)
- `packages/core/src/sync/signalingChannel.ts` (RN 호환성이 필요하면 인터페이스 조정, 로직 자체는
  플랫폼 무관 유지)
- `docs/refactor/tasks/README.md`

## 구현 단계

1. RN에서 SHA-256 digest를 제공하는 방법을 정한다(`expo-crypto`의 `digestStringAsync` 등). Web의
   `crypto.subtle.digest`와 동일한 hex 결과가 나오는지 cross-platform으로 검증한다(둘 다
   `public.document_registry_hash()`와 일치해야 room topic이 서로 맞는다).
2. `apps/mobile/lib/local-first/signalingChannel.ts`에서 RN Supabase client로 private broadcast
   channel에 join하고, `validateSignalingJoinPolicy()`를 client-side fail-fast guard로 호출한다(Web
   어댑터와 동일한 계약).
3. `webRtcProvider.native.ts`에 데이터 채널 handshake(ping/pong) 배선을 추가한다.
4. `webP2PConnection.ts`(Mobile)에서 시그널링과 provider를 연결해 offer/answer/ICE candidate를
   교환한다.
5. Web-Mobile, Mobile-Mobile 두 조합으로 실제 연결을 수동 검증한다(`TASK-022`로 documents row가 있는
   test trip 필요).

## 데이터 호환성 고려사항

- room topic 해시가 Web과 Mobile에서 동일해야 서로 연결될 수 있다 — 이 동등성이 이 task의 핵심 위험
  요소이며, 반드시 자동화된 cross-check(같은 documentId 입력에 대해 Web과 Mobile 구현이 같은 hex
  문자열을 내는지)를 둔다.
- 데이터 채널 handshake payload 스키마는 `TASK-021`과 동일하게 고정(`{type, ts}`)한다.

## 검증 방법

- Web 세션과 Mobile dev client 세션이 같은 documentId로 실제 연결되어 `connected` 상태에 도달하고
  ping/pong이 왕복되는지 확인한다.
- Mobile-Mobile(두 대의 디바이스/에뮬레이터) 연결도 동일하게 확인한다.
- iOS/Android dev client build 성공, `pnpm build:mobile` 성공
- room topic 해시 cross-platform 일치 테스트 통과

## 롤백 방법

- Mobile 쪽 조립 지점(`webP2PConnection.ts`)을 호출하는 곳이 없으므로 파일을 제거해도 기존 기능에
  영향이 없다.
- `webRtcProvider.native.ts`의 데이터 채널 배선을 되돌려도 기존 peer connection factory 자체는
  그대로 유지된다.

## 완료 조건

- Web-Mobile, Mobile-Mobile 두 조합 모두 실제 P2P 연결이 확인된다.
- Web과 Mobile이 동일 documentId에 대해 동일한 room topic 해시를 산출한다.
- Mobile 앱 background 전환 시 연결 처리(재연결/정리)는 명시적으로 `TASK-026`으로 이관되어 있다.
