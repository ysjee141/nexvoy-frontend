# ADR-004: P2P Signaling 및 Relay 전략

- 상태: 채택됨
- 결정일: 2026-06-29
- 결정자: ysjee141
- 관련 문서:
  - `docs/refactor/TECHNICAL-SPEC.md`
  - `docs/refactor/adrs/ADR-001-local-first-data-engine.md`
  - `docs/refactor/adrs/ADR-002-mobile-webrtc-runtime.md`

---

## 문제 정의

WebRTC P2P 동기화는 peer discovery와 연결 협상에 signaling이 필요하다. 또한 NAT, 방화벽, 모바일 네트워크 환경에 따라 직접 P2P 연결이 실패할 수 있다.

OnVoy는 여행 중 사용되는 서비스이므로 네트워크 품질이 다양하다. P2P signaling을 직접 운영할지, 외부 provider를 사용할지, 또는 Supabase를 relay/fallback으로 활용할지 결정해야 한다.

---

## 결정해야 할 질문

P2P signaling server를 직접 운영할 것인가, 외부 provider를 사용할 것인가?

---

## 선택지

### Option A: `y-webrtc` 기본 public signaling 사용

장점:

- PoC가 빠르다.
- 별도 서버 구축이 필요 없다.
- 웹 스파이크에 적합하다.

단점:

- 운영 안정성과 보안 통제권이 낮다.
- 서비스 수준을 보장하기 어렵다.
- 모바일 지원과 장기 운영에 부적합할 수 있다.

### Option B: 자체 signaling server 운영

장점:

- 접근 제어, 로깅, rate limit, room 정책을 직접 통제할 수 있다.
- OnVoy document id와 권한 registry를 연동할 수 있다.
- 운영 품질을 관리할 수 있다.

단점:

- 별도 인프라 운영이 필요하다.
- WebSocket server 운영 비용이 생긴다.
- 1인 개발 규모에서 부담이 크다.

### Option C: Supabase Realtime 또는 Edge Function을 signaling/fallback으로 활용

장점:

- 기존 Supabase 인프라와 Auth를 활용할 수 있다.
- document membership 검증과 통합하기 쉽다.
- P2P 실패 시 backup sync와 자연스럽게 연결된다.

단점:

- 순수 P2P와 거리가 있다.
- Supabase Realtime 비용/제약을 확인해야 한다.
- signaling latency와 payload 정책을 별도 검증해야 한다.

### Option D: P2P는 optional, 기본 sync는 Supabase backup pull/push

장점:

- 가장 안정적인 fallback을 중심에 둔다.
- 모바일/네트워크 edge case에 강하다.
- P2P 도입 실패 시에도 local-first 편집은 유지된다.

단점:

- 실시간 협업 품질은 낮아질 수 있다.
- “P2P-first” 목표와 다소 다르다.
- Supabase 의존이 더 오래 남는다.

---

## 결정

Option D를 채택한다. P2P는 optional fast path이며, 기본 sync 경로는 Supabase backup pull/push로 둔다.

결정 사항:

- Local-first write는 항상 로컬에서 성공해야 한다.
- 온라인 backup sync는 Supabase document snapshot/update log를 기본 경로로 사용한다.
- WebRTC P2P는 동시 접속 중인 peer 간 빠른 전파에만 사용한다.
- signaling server는 초기 필수 인프라가 아니라 P2P provider 활성화 시 필요한 보조 인프라다.
- 자체 signaling server 운영은 후속 검토로 미룬다.
- Supabase backup pull/push가 항상 데이터 복구의 기준 경로다.

---

## STUN/TURN 운영 정책

STUN/TURN은 P2P optional fast path를 보조하는 네트워크 인프라로만 사용한다. 데이터 정합성의 기준은 Supabase backup pull/push이며, TURN relay를 통과하지 못해도 local-first 편집과 백업 복구는 가능해야 한다.

역할 구분:

- 공개 STUN은 peer가 자신의 public endpoint 후보를 발견하기 위한 저비용 기본 경로다.
- TURN managed provider는 NAT, 방화벽, 모바일망 등으로 direct P2P가 실패할 때 encrypted WebRTC traffic을 relay하는 fallback 경로다.
- signaling은 peer discovery와 SDP/ICE candidate 교환만 담당하며, 여행 본문 데이터나 CRDT payload를 signaling metadata에 포함하지 않는다.

운영 원칙:

- 클라이언트에 TURN username/password를 하드코딩하지 않는다.
- ICE server config는 Supabase Edge Function 또는 동등한 server-side endpoint에서 짧은 TTL로 발급한다.
- STUN/TURN managed provider는 Cloudflare Realtime TURN을 기준으로 채택한다.
- STUN은 Cloudflare STUN을 기본값으로 사용하고, 연결성 검증 단계에서 Google public STUN을 보조 후보로 둘 수 있다.
- Metered/OpenRelay는 Cloudflare 적용 전후의 연결성 비교 또는 장애 대응 참고 후보로만 둔다.
- Twilio/Xirsys는 비용보다 지원, 계약, 기업용 신뢰성이 중요해지는 단계의 대체 후보로만 둔다.
- TURN 사용량, relay 연결 비율, P2P 실패율을 관측해 ADR-010의 비용 검토 입력으로 사용한다.

---

## Signaling Room 정책

room id는 document id만 노출하지 않는다.

권장:

- `roomId = hash(documentId + rotatingRoomSecret)`
- room secret은 Supabase registry에서 권한 있는 사용자에게만 제공
- role 변경 또는 share 폐기 시 secret rotation 검토

Option D 결정에 따라 signaling room 정책은 P2P provider를 활성화하는 phase에서만 구현한다. 그 전까지는 Supabase backup sync와 permission registry를 우선 완성한다.

---

## 승인 기준

- 권한 없는 사용자가 signaling room에 참여할 수 없다.
- P2P 연결 실패 시 데이터 손실 없이 backup sync로 전환된다.
- signaling metadata에 여행 내용이 포함되지 않는다.
- Web/RN 양쪽 provider factory가 같은 인터페이스를 따른다.

---

## 후속 작업

- Supabase backup pull/push fallback 구현
- Web y-webrtc PoC는 optional fast path 검증으로 수행
- Supabase Realtime signaling 가능성은 후속 검토
- Supabase Edge Function 기반 ICE server config 발급 방식 검토
- Cloudflare Realtime TURN 기반 Web/RN 연결성 PoC
- Metered/OpenRelay는 비교 검증이 필요할 때만 제한적으로 확인
- room id/secret rotation 설계
- P2P fallback E2E 시나리오 작성
