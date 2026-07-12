# TASK-021: Web Signaling Channel and Data Channel Handshake

## 목적

`TASK-009`(mobile WebRTC native feasibility)와 `TASK-010`(Cloudflare ICE config)에서 만든 부품 —
`createWebRtcProvider`/`createMobileWebRtcProvider`, `supabase/functions/ice-servers`,
`packages/core/src/sync/signalingPermissions.ts`, `packages/core/src/sync/iceServers.ts` — 는 모두
존재하지만 실제로 두 기기를 연결하는 배선이 없다. SDP offer/answer와 ICE candidate를 주고받는
시그널링 전송 계층이 코드베이스에 전혀 없고, `createWebRtcProvider`의 소비처도 없다.

이 작업은 Web에서 시그널링 채널과 데이터 채널을 실제로 배선해 P2P fast path가 두 브라우저 세션 간에
최초로 동작함을 증명한다. `rules.md`의 Web First 원칙에 따라 Web을 먼저 구현/검증하고, Mobile 배선과
Yjs update 실제 교환은 이 TASK 범위에서 제외해 후속 TASK로 이관한다.

## 범위

포함:

- Supabase Realtime Broadcast 기반 시그널링 채널 (`ADR-012` 결정에 따름)
- Realtime Authorization RLS policy: private channel join/broadcast를 `document_members` 기반으로 통제
- `validateSignalingJoinPolicy()`를 실제 join 흐름(channel subscribe 이전)에 연결하는 client fail-fast guard
- SDP offer/answer, ICE candidate를 주고받는 시그널링 메시지 타입과 직렬화 (`packages/core`)
- `apps/web/lib/local-first/webRtcProvider.ts`가 실제로 소비되는 최초의 코드 경로 (Web repository/adapter 계층에서 호출)
- `createDataChannel`/`ondatachannel` 연동
- 데이터 채널 open 후 최소 handshake(ping/pong) payload 왕복 확인과 관측 이벤트
- Web-to-Web(동일 문서, accepted 상태의 두 세션) 연결 시나리오 검증

제외 (후속 TASK로 이관):

- Mobile 시그널링 채널 배선 (Mobile `webRtcProvider.native.ts`는 그대로 유지, 소비처 연결은 후속 TASK)
- Web-Mobile 교차 연결 검증
- Yjs update를 데이터 채널로 실제 교환하는 것 (conflict policy, batching/backpressure, dual-write와의
  정합성 등은 별도 설계가 필요하며 "WebRTC는 optional fast path, 기본 sync는 Supabase backup
  pull/push" 원칙에 따라 이번 TASK에서는 연결 증명 이상으로 확장하지 않는다)
- rotating room secret 발급/회전 인프라 (`ADR-012`에서 명시적으로 후속 hardening으로 분리)

## 선행 조건

- `ADR-004` P2P optional fast path 결정
- `ADR-012` P2P signaling 전송 계층 결정 (Supabase Realtime Broadcast)
- `TASK-009-mobile-webrtc-native-feasibility.md`
- `TASK-010-cloudflare-ice-config.md`
- `TASK-013-invitation-permission-registry.md` (`document_members` 기반 권한 registry)
- Supabase 프로젝트에서 Realtime이 활성화되어 있고 Realtime Authorization(private channel RLS)을
  사용할 수 있는지 확인

## 변경 대상

- `supabase/migrations/*_signaling_realtime_authorization.sql` (신규) — `realtime.messages`에 대한
  Authorization RLS policy, `document_members` 기반 판단
- `packages/core/src/sync/signalingChannel.ts` (신규) — 시그널링 메시지 타입(`offer`/`answer`/
  `ice-candidate`), 직렬화/역직렬화, room id 파생 유틸 (플랫폼 API 미포함)
- `packages/core/src/sync/signalingPermissions.ts` — 필요 시 join 흐름 연동을 위한 타입 보강
  (기존 계약은 유지)
- `apps/web/lib/local-first/signalingChannel.ts` (신규) — Supabase Realtime Broadcast 기반 Web
  구현체, `validateSignalingJoinPolicy()` 호출 지점
- `apps/web/lib/local-first/webRtcProvider.ts` — data channel 생성(`createDataChannel`)과
  `ondatachannel` 수신, handshake payload 송수신 연동
- `apps/web/lib/local-first/` 내 provider/repository 조립 지점 (실제 소비처 신설)
- `packages/core/src/sync/iceServers.ts` — 필요 시 `p2p_signaling_joined`/`p2p_data_channel_open` 등
  관측 이벤트 이름 추가
- `docs/refactor/tasks/README.md`
- `walkthrough.md`

## 구현 단계

1. `ADR-012` 결정에 따라 Supabase Realtime private channel 설계와 `realtime.messages` Authorization
   RLS policy를 작성한다. `document_members.status = 'accepted'` 여부로 join/broadcast를 통제한다. ✅
2. `packages/core/src/sync/signalingChannel.ts`에 시그널링 메시지 타입(offer/answer/ice-candidate),
   room id 결정적 파생 함수(documentId 기반), 직렬화 유틸을 정의한다. Supabase client, WebRTC API는
   포함하지 않는다. ✅
3. `apps/web/lib/local-first/signalingChannel.ts`에서 Supabase Realtime Broadcast로 채널을 열기 전에
   `validateSignalingJoinPolicy()`를 호출해 로컬 membership snapshot 기준으로 fail-fast 검증한다.
   거부되면 채널을 구독하지 않고 reason을 노출한다. ✅
4. `apps/web/lib/local-first/webRtcProvider.ts`의 `createPeerConnection()` 결과에 `createDataChannel`
   (initiator) 또는 `ondatachannel`(answerer)을 연동한다. ✅
5. 시그널링 채널을 통해 SDP offer/answer, ICE candidate를 교환해 `RTCPeerConnection`이 `connected`
   상태에 도달하도록 배선한다. ✅ (`apps/web/lib/local-first/webP2PConnection.ts`)
6. 데이터 채널 open 시 최소 handshake payload(`{ type: 'ping', ts }` → `{ type: 'pong', ts }`)를
   왕복시키고, 성공/실패를 관측 이벤트로 남긴다. ✅
7. 같은 문서의 accepted 상태 두 브라우저 세션으로 실제 연결을 수동 검증한다. ⬜ 미착수 — 아래
   "구현 결과" 참고.

## 구현 결과

- `supabase/migrations/20260712000001_task021_signaling_realtime_authorization.sql`: `realtime.messages`
  Authorization RLS. accepted 멤버는 수신, accepted owner/editor만 송신 가능(viewer는 read-only).
  room topic은 기존 `public.document_registry_hash()`를 재사용해 `signaling:<sha256-hex(documentId)>`로
  파생.
- `packages/core/src/sync/signalingChannel.ts`(신규): offer/answer/ice-candidate 메시지 타입, 방어적
  파싱, `deriveSignalingRoomTopic()`. `BackupCryptoProvider`와 동일하게 `SubtleCrypto`를 주입받아
  플랫폼 API를 core에 넣지 않는다. `packages/core/src/index.ts`/`package.json` exports에 등록.
- `apps/web/lib/local-first/signalingChannel.ts`(신규): Supabase Realtime Broadcast private channel
  join. `validateSignalingJoinPolicy()`는 client-side fail-fast guard로만 쓰고, 실제 경계는 RLS.
- `apps/web/lib/local-first/webRtcProvider.ts`: `createHandshakeDataChannel()`/
  `wireHandshakeDataChannel()` 추가 — ping/pong 왕복과 `p2p_data_channel_open` 이벤트.
- `apps/web/lib/local-first/webP2PConnection.ts`(신규): `connectWebP2PPeer()` — signaling과
  webRtcProvider를 연결하는 최초의 실제 소비처. offer/answer/ICE 교환, 데이터 채널 배선, viewer는
  초기화자가 될 수 없도록 방어(client no-op + server RLS 이중 방어).
- `packages/core/src/sync/iceServers.ts`: `p2p_signaling_joined`/`p2p_data_channel_open` 이벤트 추가.

## 알려진 제약

- 항목 7(실기기/실브라우저 두 세션 간 실제 연결 확인)은 이번 세션에서 수행하지 못했다. 자동화된
  typecheck/test/build는 모두 통과했지만, 로컬 Supabase 스택 기동 + 두 브라우저 세션으로 실제
  `connected` 상태 도달과 ping/pong 왕복을 눈으로 확인하는 절차는 후속 작업이 필요하다.
- `connectWebP2PPeer()`를 호출하는 UI 진입점은 이번 TASK 범위에 포함되지 않았다(범위 문서 기준
  library 레벨 조립까지). 수동 검증 시 임시 호출 코드나 최소 테스트 페이지가 필요하다.

## 데이터 호환성 고려사항

- signaling broadcast payload에는 SDP/ICE candidate, roomId, senderId 외의 필드를 포함하지 않는다.
  document content, CRDT payload, 여행 데이터는 어떤 형태로도 signaling metadata에 남기지 않는다.
- 데이터 채널 handshake payload는 고정된 최소 스키마(`type`, `ts`)만 사용하며 임의의 document 데이터를
  담지 않는다.
- P2P 연결/시그널링이 실패해도 local write와 Supabase backup pull/push는 영향받지 않아야 한다
  (`ADR-004`/`ADR-012` fallback 원칙).
- room id는 이번 TASK에서 documentId의 결정적 해시로 파생한다(rotating secret은 후속). 접근 통제의
  실제 경계는 Realtime Authorization RLS이며, room id 자체의 비밀성에 의존하지 않는다.

## 보안 원칙

- `signalingPermissions.ts`의 `validateSignalingJoinPolicy()`는 client-side UX guard로만 사용하고
  최종 권한 검증으로 간주하지 않는다. 최종 검증은 Realtime Authorization RLS policy가 담당한다
  (`conventions.md` 4-3).
- viewer 권한은 signaling room read/join은 가능하되 write(offer 생성, data channel을 통한 propagation)
  는 차단되어야 한다 (`canWriteSignalingUpdates` 기준).
- TURN credential, room id 파생 로직 등은 로그에 원문으로 남기지 않는다.

## 검증 방법

- 같은 문서에 accepted 상태로 속한 두 브라우저 세션(예: 두 프로필 또는 시크릿 창)에서 시그널링 채널
  join과 SDP/ICE 교환이 성공하는지 확인한다.
- `RTCPeerConnection.connectionState`가 `connected`에 도달하고 `p2p_connected` 관측 이벤트가
  발생하는지 확인한다.
- 데이터 채널 open 후 ping/pong handshake가 왕복되는지 확인한다.
- accepted가 아닌 사용자(revoked/pending) 또는 비회원 계정이 Realtime private channel에 join을
  시도했을 때 Authorization RLS에 의해 거부되는지 확인한다.
- viewer 계정이 signaling room에 join(read)은 가능하지만 write(offer 생성)는 차단되는지 확인한다.
- 시그널링/P2P 연결을 강제로 실패시켰을 때 local write와 Supabase backup pull/push가 정상 동작하는지
  확인한다.
- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공 (Mobile은 이번 TASK에서 배선하지 않지만 빌드 무결성은 유지되어야 한다)

## 롤백 방법

- signaling channel 조립 지점을 비활성화하고 provider factory가 P2P를 사용하지 않도록 되돌린다
  (기존 `webRtcProvider` 자체는 유지, 소비처만 제거).
- 신규 Realtime Authorization RLS policy를 제거해도 기존 `document_members` 기반 REST/RPC 권한
  검증에는 영향이 없어야 한다.
- signaling 관련 코드를 제거해도 local write와 Supabase backup pull/push는 그대로 동작해야 한다.

## 완료 조건

- 같은 문서를 공유하는 두 Web 세션이 시그널링 채널을 통해 SDP/ICE를 교환하고
  `RTCPeerConnection`이 실제로 `connected` 상태에 도달한다.
- 데이터 채널이 열리고 최소 handshake payload가 왕복된다.
- 권한 없는 사용자가 Realtime Authorization을 통과하지 못한다.
- P2P/시그널링 실패가 local write와 Supabase backup pull/push에 영향을 주지 않는다.
- Mobile 배선과 Yjs update 실제 교환은 후속 TASK로 명시적으로 이관되어 있다.
- reviewer와 qa-engineer 최종 verdict가 PASS다.
