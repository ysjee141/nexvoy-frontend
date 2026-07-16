# TASK-047: Shared Offline Sync Core

- 상태: 대기

## 목적

Web과 Mobile이 공유할 domain command, Repository, local transaction, outbox, conflict, retry 계약을
`packages/core`에 구현한다. 플랫폼 저장소나 화면에 결합되지 않는 하나의 sync state machine을 만든다.

## 범위

- `TripCommand`/`TemplateCommand` discriminated union
- canonical row/bundle, resource/entity revision 타입
- server-authority Repository interface와 Supabase RPC adapter
- local cache/outbox platform port
- sync coordinator, batching, retry/backoff, ack reconciliation
- conflict 분류와 도메인별 기본 정책
- guest draft를 authenticated create command로 승격하는 공통 계약
- observability event와 민감정보 필터

제외:

- IndexedDB/SQLite 구현
- 화면 전환
- Realtime subscription

## 선행 조건

- `TASK-046-relational-authority-and-command-rpc.md`

## 변경 대상

- `packages/core/src/repositories`
- `packages/core/src/sync`
- `packages/core/src/supabase`
- `packages/core/src/observability`
- `packages/core/src/**/__tests__`
- `packages/core/package.json`

## 구현 단계

1. server RPC와 일치하는 command/result/conflict 타입을 정의한다.
2. `ServerAuthorityRepository`와 `TransactionalLocalStore` port를 정의한다.
3. local transaction이 entity projection 갱신과 outbox append를 함께 요구하도록 계약을 만든다.
4. outbox 상태를 `pending`, `sending`, `acked`, `retryable`, `conflict`, `rejected`로 구분한다.
5. 1~3초 debounce 또는 32개 command batch를 만드는 coordinator를 구현한다.
6. network/5xx는 backoff retry하고 auth/permission/schema 오류는 자동 재시도하지 않는다.
7. server ack의 canonical row와 revision으로 optimistic cache를 교정한다.
8. 독립 field patch, create UUID, delete tombstone, sort rank, user-check set semantics를 conflict policy로 고정한다.
9. guest namespace의 draft를 로그인 계정 command로 승격하되 operation ID와 entity ID를 유지한다.
10. command payload 본문을 로그에 남기지 않고 queue age/count/bytes/error code만 관측한다.

## 플랫폼별 고려사항

- Core는 IndexedDB, SQLite, DOM, Next.js, Expo/RN API를 import하지 않는다.
- 시간, UUID, network state, scheduler는 주입 가능한 port로 둔다.
- Web/Mobile이 같은 command serialization과 error classification을 사용해야 한다.

## 검증 방법

- crash 전후 outbox hydration, duplicate ack, out-of-order ack를 fake store로 검증한다.
- offline 100개 command가 batch 제한과 순서를 지키는지 확인한다.
- retryable/permanent/conflict error가 잘못 재시도되지 않는지 확인한다.
- server canonical row가 optimistic state를 결정적으로 교정하는지 확인한다.
- `pnpm --filter @nexvoy/core test`와 typecheck를 통과한다.

## 롤백 방법

- 신규 export와 adapter 사용을 중지한다. 기존 repository/runtime에는 영향이 없다.

## 완료 조건

- 두 플랫폼이 구현할 local store port와 sync coordinator가 안정된 타입으로 제공된다.
- domain command와 server RPC 계약이 compile-time 및 unit test로 일치한다.
- full Yjs update 없이 모든 핵심 mutation을 표현할 수 있다.
