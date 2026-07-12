# TASK-026: P2P Connection Lifecycle Hardening

## 목적

`TASK-021`~`TASK-025`는 이상적인 조건(포그라운드, 안정적인 네트워크, 앱 종료 없음)에서의 연결만
다룬다. 실사용 환경에서는 네트워크 전환, Mobile 앱 백그라운드/포그라운드 전환, 브라우저 탭 종료 등이
발생한다. 이 task는 P2P 연결의 생명주기를 실사용 조건에서 안전하게 만들고, `ADR-012`가 명시적으로
미뤄둔 rotating room secret 하드닝을 도입한다.

## 범위

- 연결 끊김 시 재연결 로직(지수 백오프, 최대 재시도 횟수)
- Mobile foreground/background 전환 시 연결 해제 및 재개 — `TASK-009`가 이미 조사한 background
  전환 조건(foreground/background 전환 시 connection lifecycle 기록)을 재사용
- 브라우저 탭 종료/새로고침 시 signaling channel·data channel·peer connection 정리(leak 방지)
- rotating room secret 발급/회전 인프라(`ADR-012`가 후속 hardening으로 명시적으로 미룬 부분) — 현재는
  `documentId`의 결정적 해시만 room topic으로 쓰고 있어 topic 자체는 예측 가능하다(접근 통제는
  Realtime Authorization RLS가 담당하므로 즉시 위험하지는 않지만, 방어 심층화 차원에서 필요)
- 재연결 횟수/실패율 관측 이벤트 추가

제외:

- TURN relay 사용률과 비용 모니터링 자체(이미 `ADR-010`에서 다루는 영역이며, 이 task는 재연결 관련
  이벤트만 그 지표에 추가한다)

## 선행 조건

- `TASK-021-web-signaling-channel-and-data-channel-handshake.md`
- `TASK-023-mobile-signaling-channel-wiring.md` (Mobile 생명주기까지 다루려면 선행 필요)
- `TASK-009-mobile-webrtc-native-feasibility.md` (foreground/background 조사 결과)
- `ADR-012-p2p-signaling-transport-supabase-realtime-broadcast.md` (rotating secret 후속 작업으로
  명시)
- `ADR-010-operating-cost-and-infrastructure.md`

## 변경 대상

- `apps/web/lib/local-first/webP2PConnection.ts`, `apps/mobile/lib/local-first/webP2PConnection.ts`
  — 재연결/정리 로직
- `packages/core/src/sync/signalingPermissions.ts` — rotating room secret 검증 로직 보강
  (`hasValidRoomSecretProof`가 실제 값에 근거하도록)
- 신규 rotating room secret 발급 RPC 또는 Supabase Edge Function
- `packages/core/src/sync/iceServers.ts` — 재연결/실패율 관측 이벤트 추가
- `docs/refactor/tasks/README.md`

## 구현 단계

1. Web: `beforeunload`/`visibilitychange` 이벤트에서 signaling channel leave와 peer connection
   close를 호출하도록 연결한다.
2. Mobile: `AppState` 전환(background 진입) 시 연결을 정리하고, foreground 복귀 시 필요하면
   재연결을 시도하는 정책을 정한다(즉시 재연결 vs 사용자 액션 대기).
3. 연결 끊김(`connectionState === 'failed'`/`disconnected`) 감지 시 지수 백오프로 재연결을 시도하고,
   최대 횟수 초과 시 `TASK-025`의 "사용 불가" 상태로 수렴시킨다.
4. rotating room secret을 발급하는 서버 측 로직을 추가하고(문서 소유자/멤버만 발급 가능),
   `signalingPermissions.ts`의 `hasValidRoomSecretProof`가 이 값을 실제로 검증하도록 연결한다.
5. 재연결 시도/성공/실패, room secret 회전 이벤트를 관측 이벤트로 남긴다(원문 노출 없이 카운트/사유
   코드만).

## 데이터 호환성 고려사항

- rotating room secret 도입이 기존 `signalingPermissions.ts`의 공개 계약(`SignalingJoinRequest`/
  `SignalingJoinDecision`)을 깨지 않아야 한다 — `hasValidRoomSecretProof`는 이미 boolean으로 존재하며,
  이 task는 그 값의 출처만 실제 검증 로직으로 교체한다.
- 재연결 로직이 중복 offer/데이터 채널을 만들지 않도록 기존 연결 정리 순서를 명확히 한다.

## 검증 방법

- 브라우저 탭을 강제로 닫거나 새로고침했을 때 signaling channel이 정리되는지(다른 세션에서 leave가
  관측되는지) 확인한다.
- Mobile 앱을 백그라운드로 전환했다가 복귀했을 때 연결이 안전하게 정리/재개되는지 확인한다.
- 네트워크를 강제로 끊었다가 복구했을 때 지수 백오프 재연결이 동작하는지 확인한다.
- rotating room secret 없이(또는 만료된 secret으로) join을 시도했을 때 거부되는지 확인한다.
- iOS/Android dev client build, `pnpm build`, `pnpm build:mobile` 성공

## 롤백 방법

- 재연결/생명주기 로직을 제거하면 `TASK-021`~`TASK-024` 수준(수동 연결/해제)으로 되돌아간다.
- rotating room secret 발급을 비활성화하면 `hasValidRoomSecretProof`가 `TASK-021`처럼 고정값으로
  동작하도록 폴백한다(Realtime Authorization RLS가 여전히 최종 방어선이므로 안전하게 되돌릴 수 있다).

## 완료 조건

- 실사용 환경(네트워크 변화, 백그라운드 전환, 탭 종료)에서 P2P 연결이 안전하게 재연결되거나 정리된다.
- room topic이 고정된 결정적 해시가 아니라 회전하는 secret에 기반한다.
- 재연결/실패율이 관측 가능하다.
