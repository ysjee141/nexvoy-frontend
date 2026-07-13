# TASK-028: Rotating Room Secret Hardening

GitHub Issue: [#312](https://github.com/ysjee141/nexvoy-frontend/issues/312)

## 목적

현재 P2P signaling room topic은 `documentId`의 결정적 해시에서 파생된다. Supabase Realtime
Authorization RLS가 accepted member 접근을 막고 있으므로 즉시 노출 위험은 제한적이지만, topic 자체는
예측 가능하다. 이 task는 `ADR-012`의 후속 hardening으로 남겨둔 rotating room secret을 도입해 signaling
topic을 예측 불가능하게 만든다.

## 범위

- document member만 받을 수 있는 server-issued room secret 발급 경로
- secret 만료/회전 정책과 old/new topic overlap window
- Web/Mobile signaling topic derivation 변경
- Supabase Realtime Authorization RLS가 active secret window를 검증하도록 보강
- secret 원문이 로그, analytics, UI, push payload에 남지 않도록 관측 이벤트 정리

제외:

- P2P 재연결/탭 종료/백그라운드 생명주기 처리(`TASK-026` 완료 범위)
- TURN relay 비용 모니터링(`ADR-010` 범위)

## 선행 조건

- `TASK-021-web-signaling-channel-and-data-channel-handshake.md`
- `TASK-023-mobile-signaling-channel-wiring.md`
- `TASK-026-p2p-connection-lifecycle-hardening.md`
- `ADR-012-p2p-signaling-transport-supabase-realtime-broadcast.md`

## 변경 대상

- `packages/core/src/sync/signalingChannel.ts` — secret 기반 topic derivation helper
- `packages/core/src/sync/signalingPermissions.ts` — `hasValidRoomSecretProof` 출처를 실제 검증 결과로 변경
- `apps/web/lib/local-first/signalingChannel.ts`
- `apps/mobile/lib/local-first/signalingChannel.ts`
- Supabase migration/RPC 또는 Edge Function — room secret 발급/회전/검증
- `docs/refactor/tasks/README.md`

## 구현 단계

1. secret 발급 모델을 정한다: 저장 위치, TTL, 회전 주기, old/new overlap window.
2. owner/editor/viewer accepted member만 secret을 받을 수 있는 서버 경계를 추가한다.
3. topic derivation을 `hash(documentId + activeSecret)` 형태로 바꾸되, migration 기간에는 old/new topic을
   함께 지원한다.
4. Realtime Authorization RLS가 active secret proof를 검증하도록 보강한다.
5. Web/Mobile signaling adapter가 secret fetch 실패 시 기존 backup sync로 안전하게 fallback하도록 한다.
6. secret 원문 없이 rotation/fetch/failure reason code만 관측 이벤트로 남긴다.

## 데이터 호환성 고려사항

- 기존 클라이언트가 deterministic topic을 사용하는 동안 새 클라이언트와 완전히 단절되지 않도록 overlap
  window 또는 feature flag가 필요하다.
- secret rotation은 document content, document key, backup snapshot과 독립적이어야 한다.
- RLS 변경은 accepted member 권한을 좁히는 방향이어야 하며 viewer는 계속 송신 제한을 유지해야 한다.

## 검증 방법

- active secret으로만 signaling channel join이 성공하는지 확인한다.
- 만료된 secret 또는 다른 document secret으로 join/send가 거부되는지 확인한다.
- old/new overlap window에서 기존 연결이 끊기지 않고 새 연결은 새 topic으로 붙는지 확인한다.
- Web-to-Web, Web-to-Mobile, Mobile-to-Mobile signaling smoke를 각각 수행한다.
- `pnpm --filter @nexvoy/core test`, `pnpm typecheck`, `pnpm build`, `pnpm build:mobile` 성공

## 롤백 방법

- feature flag로 secret-based topic derivation을 끄고 deterministic topic으로 되돌린다.
- secret 발급 RPC/Edge Function은 사용 중지하되, document/member 데이터는 삭제하지 않는다.

## 완료 조건

- signaling room topic이 고정된 결정적 해시가 아니라 회전하는 secret에 기반한다.
- secret 없는 join/send가 서버 경계에서 거부된다.
- rotation/fallback 상태가 원문 노출 없이 관측 가능하다.
