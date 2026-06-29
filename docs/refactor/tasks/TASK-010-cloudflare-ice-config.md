# TASK-010: Cloudflare ICE Config 발급

## 목적

Cloudflare STUN/TURN을 STUN/TURN managed provider 기준선으로 사용하고, 클라이언트가 짧은 TTL의 ICE server config를 서버에서 받아오도록 한다.

## 범위

- Cloudflare STUN 기본값
- Cloudflare Realtime TURN credential 발급 경로
- Supabase Edge Function 또는 server-side endpoint 설계
- Web/RN 공용 ICE config 타입
- TURN 사용량 관측 이벤트

## 선행 조건

- `ADR-004` STUN/TURN 운영 정책
- `ADR-010` Cloudflare STUN/TURN 기준선
- Cloudflare Realtime TURN 계정/credential 발급 방식 확인

## 변경 대상

- `packages/core/src/sync/iceServers.ts`
- `supabase/functions/ice-servers/*` 또는 동등한 server endpoint
- `apps/web/lib/local-first/webRtcProvider.ts`
- `apps/mobile/lib/local-first/webRtcProvider.native.ts`

## 구현 단계

1. 공용 `IceServerConfig` 타입을 정의한다.
2. Cloudflare STUN을 기본 ICE server로 넣는다.
3. TURN credential은 클라이언트에 하드코딩하지 않고 server endpoint에서 발급한다.
4. TTL 만료와 재발급 정책을 정의한다.
5. relay 사용 여부와 P2P 실패율을 관측 이벤트로 남긴다.

## 데이터 호환성 고려사항

- ICE config에는 document content나 CRDT payload를 포함하지 않는다.
- signaling room id는 document id를 그대로 노출하지 않는 별도 정책을 따른다.

## 검증 방법

- Web에서 ICE config fetch 성공
- RN에서 ICE config fetch 성공
- TURN credential이 repository에 하드코딩되지 않았는지 확인
- P2P disabled 상태에서도 backup sync가 동작하는지 확인

## 롤백 방법

- provider factory에서 P2P를 비활성화하고 backup sync만 사용한다.
- Cloudflare credential 관련 env만 제거해도 앱이 local/backup mode로 동작해야 한다.

## 완료 조건

- Cloudflare STUN/TURN 기준선이 코드에 반영된다.
- credential TTL과 재발급 정책이 문서화된다.
- TURN 사용량 관측 지표가 ADR-010 비용 검토에 연결된다.
