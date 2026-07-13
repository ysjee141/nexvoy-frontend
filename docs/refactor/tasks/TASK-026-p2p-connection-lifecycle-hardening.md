# TASK-026: P2P Connection Lifecycle Hardening

## 목적

`TASK-021`~`TASK-025`는 이상적인 조건(포그라운드, 안정적인 네트워크, 앱 종료 없음)에서의 연결만
다룬다. 실사용 환경에서는 네트워크 전환, Mobile 앱 백그라운드/포그라운드 전환, 브라우저 탭 종료 등이
발생한다. 이 task는 P2P 연결의 생명주기를 실사용 조건에서 안전하게 만든다.

`ADR-012`가 명시적으로 미뤄둔 rotating room secret hardening은 signaling topic, Realtime Authorization
RLS, 서버 발급 토큰, Web/Mobile topic derivation을 함께 바꾸는 별도 migration 성격이므로 `TASK-028`로
분리한다.

## 범위

- 연결 끊김 시 재연결 로직(지수 백오프, 최대 재시도 횟수)
- Mobile foreground/background 전환 시 연결 해제 및 재개 — `TASK-009`가 이미 조사한 background
  전환 조건(foreground/background 전환 시 connection lifecycle 기록)을 재사용
- 브라우저 탭 종료/새로고침 시 signaling channel, data channel, peer connection 정리(leak 방지)
- 재연결 횟수/실패율 관측 이벤트 추가

제외:

- TURN relay 사용률과 비용 모니터링 자체(이미 `ADR-010`에서 다루는 영역이며, 이 task는 재연결 관련
  이벤트만 그 지표에 추가한다)
- rotating room secret 발급/회전 인프라(`TASK-028`로 분리)

## 선행 조건

- `TASK-021-web-signaling-channel-and-data-channel-handshake.md`
- `TASK-023-mobile-signaling-channel-wiring.md` (Mobile 생명주기까지 다루려면 선행 필요)
- `TASK-009-mobile-webrtc-native-feasibility.md` (foreground/background 조사 결과)
- `ADR-012-p2p-signaling-transport-supabase-realtime-broadcast.md`
- `ADR-010-operating-cost-and-infrastructure.md`

## 변경 대상

- `apps/web/lib/local-first/webP2PChecklistConnection.ts` — checklist P2P 재연결/탭 생명주기 로직
- `apps/web/lib/local-first/webP2PConnection.ts`, `apps/mobile/lib/local-first/webP2PConnection.ts`
  — connection close idempotency 및 Mobile offer retry cleanup
- `apps/mobile/lib/local-first/p2pLifecycle.native.ts` — AppState lifecycle hook point
- `packages/core/src/sync/p2pLifecycle.ts` — 재연결 정책 helper
- `packages/core/src/sync/iceServers.ts` — 재연결/실패율 관측 이벤트 추가
- `docs/refactor/tasks/README.md`

## 구현 단계

1. Web: `pagehide`/`beforeunload` 이벤트에서 signaling channel leave와 peer connection close를 호출하도록
   연결한다.
2. Mobile: `AppState` 전환(background 진입) 시 연결을 정리하고, foreground 복귀 시 필요하면 재연결을
   시도하는 hook point를 제공한다.
3. 연결 끊김(`connectionState === 'failed'`/`disconnected`) 감지 시 지수 백오프로 재연결을 시도하고,
   최대 횟수 초과 시 `TASK-025`의 fallback 상태로 수렴시킨다.
4. 재연결 scheduled/attempted/exhausted 및 lifecycle cleanup 이벤트를 원문 노출 없이 남긴다.
5. rotating room secret migration은 `TASK-028` 설계 범위로 넘긴다.

## 데이터 호환성 고려사항

- 재연결 로직이 중복 offer/데이터 채널을 만들지 않도록 기존 연결 정리 순서를 명확히 한다.
- 이번 task는 signaling topic derivation과 RLS를 변경하지 않는다. 따라서 기존 연결 권한 모델과 데이터
  호환성은 유지된다.

## 검증 방법

- 브라우저 탭을 강제로 닫거나 새로고침했을 때 signaling channel이 정리되는지 확인한다.
- Mobile 앱을 백그라운드로 전환했다가 복귀했을 때 연결이 안전하게 정리/재개되는지 확인한다.
- 네트워크를 강제로 끊었다가 복구했을 때 지수 백오프 재연결이 동작하는지 확인한다.
- `pnpm --filter @nexvoy/core test`, `pnpm typecheck`, `pnpm build`, `pnpm build:mobile` 성공

## 롤백 방법

- 재연결/생명주기 로직을 제거하면 `TASK-021`~`TASK-024` 수준(수동 연결/해제)으로 되돌아간다.
- 이번 task는 signaling topic/RLS를 변경하지 않으므로 rollback 시 데이터 migration은 필요 없다.

## 완료 조건

- 실사용 환경(네트워크 변화, 백그라운드 전환, 탭 종료)에서 P2P 연결이 안전하게 재연결되거나 정리된다.
- 재연결/실패율이 관측 가능하다.

## 구현 결과

- Web 준비물 P2P 연결에 bounded exponential backoff 재연결을 추가했다.
- `pagehide`/`beforeunload`/React cleanup에서 signaling channel, data channel, peer connection, retry timer를
  정리한다.
- Web/Mobile connection close를 idempotent하게 만들고, Mobile offer retry cleanup 및 AppState lifecycle
  hook point를 추가했다.
- `p2p_reconnect_scheduled`, `p2p_reconnect_attempted`, `p2p_reconnect_exhausted`,
  `p2p_lifecycle_cleanup` 관측 이벤트를 추가했다.
