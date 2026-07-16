# ADR-012: P2P Signaling 전송 계층으로 Supabase Realtime Broadcast 채택

- 상태: 대체됨 (`ADR-015-offline-capable-server-authority.md`)
- 결정일: 2026-07-12
- 결정자: ysjee141
- 관련 문서:
  - `docs/refactor/TECHNICAL-SPEC.md`
  - `docs/refactor/adrs/ADR-002-mobile-webrtc-runtime.md`
  - `docs/refactor/adrs/ADR-004-p2p-signaling-strategy.md`
  - `docs/refactor/adrs/ADR-010-operating-cost-and-infrastructure.md`
  - `docs/refactor/tasks/TASK-021-web-signaling-channel-and-data-channel-handshake.md`

---

## 문제 정의

`ADR-004`는 P2P를 optional fast path로 채택하고(Option D), signaling 전송 방식 자체는 "P2P provider를
활성화하는 phase에서만 구현한다"고 명시적으로 유보했다. `TASK-009`(모바일 WebRTC native feasibility)와
`TASK-010`(Cloudflare ICE config)으로 peer connection factory와 ICE server 발급 경로는 준비되었지만,
SDP offer/answer와 ICE candidate를 실제 두 peer 간에 주고받는 전송 계층은 아직 정해지지 않았다.

`TASK-021`에서 이 phase를 시작하므로, `ADR-004`가 유보했던 질문에 답해야 한다: 시그널링 메시지를
어떤 전송 계층으로 주고받을 것인가.

---

## 결정해야 할 질문

시그널링(SDP offer/answer, ICE candidate) 전송을 어떤 기술로 구현할 것인가?

---

## 선택지

### Option A: 자체 signaling WebSocket 서버 운영 (ADR-004 Option B 재확인)

장점:

- 프로토콜과 room 정책을 완전히 통제할 수 있다.

단점:

- 별도 서버 프로세스와 배포/운영 비용이 생긴다.
- 1인 개발 규모에서 상시 운영 부담이 크다.
- `ADR-004`에서 이미 배제된 방향과 동일하다.

### Option B: `y-webrtc` 공개 signaling 서버 사용

장점:

- 구현이 가장 빠르다.

단점:

- 접근 통제와 운영 신뢰성을 OnVoy가 통제할 수 없다.
- `document_members` 권한 registry와 연동할 방법이 없다.
- `ADR-004`에서 이미 배제된 방향과 동일하다.

### Option C: Supabase Postgres 테이블 기반 signaling (`document_signaling_messages` + `postgres_changes`)

장점:

- 기존 `useRealtimeSubscription` 패턴과 완전히 동일한 방식으로 구현할 수 있다.
- RLS를 테이블에 직접 적용할 수 있어 권한 모델이 익숙하다.

단점:

- SDP/ICE candidate가 (일시적이라도) 테이블에 영속화되어 별도 TTL/삭제 정책과 cleanup job이 필요하다.
- signaling 메시지는 연결 수립 후 즉시 폐기되어야 하는 ephemeral 데이터인데, row 기반 저장은 이 성격과
  맞지 않는다.
- write 빈도가 낮지 않아(offer/answer/여러 ICE candidate) 테이블 row 증가와 정리 비용이 발생한다.

### Option D: Supabase Realtime Broadcast (private channel + Realtime Authorization)

장점:

- 두 앱 모두 이미 `@supabase/supabase-js`를 사용 중이라 신규 인프라/서버 운영이 필요 없다.
- Broadcast payload는 서버에 영속화되지 않아(ephemeral) signaling metadata에 여행 데이터가 남을
  위험이 없고 별도 cleanup이 불필요하다.
- Supabase Realtime Authorization(private channel에 대한 `realtime.messages` RLS policy)으로
  `document_members` 기반 접근 통제를 서버 경계에서 강제할 수 있다.
- Supabase Auth JWT를 그대로 재사용해 별도 인증 체계가 필요 없다.
- `ADR-010`이 이미 "Supabase Realtime은 critical document room에 제한적으로 사용한다"는 비용 원칙을
  전제하고 있어, signaling처럼 짧고 낮은 볼륨의 채널 용도와 부합한다.

단점:

- Supabase Realtime 자체의 가용성/latency에 signaling이 종속된다(다만 P2P는 optional fast path이고
  실패 시 backup pull/push로 fallback하므로 영향은 제한적이다).
- Realtime Authorization 설정(및 RLS policy 작성)에 대한 검증이 필요하다.
- 순수 P2P(중개자 없는 discovery)와는 거리가 있다 — 다만 이는 `ADR-004` Option D에서 이미 감수한
  트레이드오프다.

---

## 결정

Option D를 채택한다. 시그널링 전송 계층은 Supabase Realtime Broadcast의 private channel을 사용하고,
접근 통제는 Realtime Authorization(`realtime.messages` 대상 RLS policy)으로 `document_members`
registry와 연동한다.

결정 사항:

- signaling channel topic은 매 연결마다 별도 자원을 프로비저닝하지 않고 문서 단위로 열리는 private
  broadcast channel을 사용한다.
- 접근 통제의 최종 경계는 Realtime Authorization RLS policy이며, `document_members.status = 'accepted'`
  여부를 서버에서 검증한다. `packages/core/src/sync/signalingPermissions.ts`의
  `validateSignalingJoinPolicy()`는 client-side fail-fast UX guard로만 사용하고 보안 경계로 간주하지
  않는다(`conventions.md` 4-3 원칙과 일치).
- signaling broadcast payload에는 SDP/ICE candidate, roomId, senderId 외의 필드(document content,
  CRDT payload)를 포함하지 않는다.
- room id는 `ADR-004`가 권고한 rotating secret 기반 파생(`hash(documentId + rotatingRoomSecret)`)의
  완전한 구현을 이번 phase에서 강제하지 않는다. Realtime Authorization RLS가 실제 접근 통제 경계이므로,
  1차 구현에서는 documentId의 결정적 해시로 room id를 파생하고, rotating secret 도입은 별도 hardening
  task로 미룬다. 이 결정으로 `signalingPermissions.ts`의 `hasValidRoomSecretProof` 계약 자체는 바뀌지
  않으며, 값의 출처만 추후 교체 가능하도록 설계한다.
- Supabase Realtime을 signaling 외의 일반 fallback sync 채널로 확장하지 않는다(`ADR-010`의 제한적
  사용 원칙 유지).

---

## 승인 기준

- 권한 없는 사용자가 Realtime Authorization을 통과하지 못해 private channel에 join할 수 없다.
- signaling broadcast payload에 document content나 CRDT payload가 포함되지 않는다.
- Web/Mobile 양쪽 provider factory가 동일한 시그널링 메시지 프로토콜을 공유할 수 있는 구조다
  (`packages/core`에는 Supabase client, WebRTC API를 넣지 않는다).
- P2P/signaling 실패 시 local write와 Supabase backup pull/push가 영향받지 않는다.

---

## 후속 작업

- Realtime Authorization RLS policy 초안 작성 및 PoC (`TASK-021`)
- rotating room secret 발급/회전 인프라 설계 (hardening, 후속 task)
- Mobile 시그널링 배선 (후속 task)
- Yjs update를 data channel로 실제 교환하는 설계는 별도 ADR/TASK로 분리 검토
- TURN relay 사용률과 함께 Realtime Broadcast 사용량을 `ADR-010` 비용 검토 지표에 추가
