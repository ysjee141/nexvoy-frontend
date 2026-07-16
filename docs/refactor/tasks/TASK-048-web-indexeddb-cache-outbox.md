# TASK-048: Web IndexedDB Cache and Transactional Outbox

- 상태: 대기

## 목적

Web에서 계정별 canonical cache와 durable command outbox를 IndexedDB 한 transaction으로 저장한다. 네트워크가
없거나 프로세스가 종료돼도 optimistic mutation을 복구하고 server로 재전송할 수 있는 platform adapter를 만든다.

## 범위

- versioned IndexedDB schema
- account/resource-scoped entity cache, outbox, sync state
- atomic local mutation + outbox append
- Web sync worker와 online/visibility/detail-enter trigger
- batch RPC flush, ack reconciliation, retry scheduling
- account switch/logout isolation과 V1 local data reset
- adapter integration test와 crash recovery test

제외:

- 제품 화면 repository cutover
- Realtime subscription
- 기존 IndexedDB/Yjs store 삭제

## 선행 조건

- `TASK-047-shared-offline-sync-core.md`

## 변경 대상

- `apps/web/lib/data`
- `apps/web/lib/local-first`의 신규 authority adapter
- `apps/web/stores`
- `apps/web/e2e`
- Web test helper

## 구현 단계

1. account ID를 모든 cache/outbox/sync key에 포함한 새 DB version을 정의한다.
2. Trip/Template summary, bundle/entity, resource revision, outbox를 같은 DB에서 관리한다.
3. optimistic entity mutation과 command append를 하나의 read-write transaction으로 구현한다.
4. startup에서 `sending` command를 `pending`으로 회수하고 중복 전송은 `operation_id`로 안전하게 처리한다.
5. online, visibility, explicit refresh, detail enter에서 debounce된 flush/revision check를 실행한다.
6. server canonical response를 적용하고 acked command를 정리한다.
7. 계정 전환 시 활성 namespace와 subscription을 교체하고 다른 계정 row를 query하지 않는다.
8. guest namespace의 draft는 로그인 시 authenticated create command로 승격한다.
9. 승인된 reset 정책에 따라 기존 Yjs document/backupQueue DB를 hydrate하지 않는다.
10. 브라우저 종료 지점별 복구와 저장 quota/error를 자동 테스트한다.

## 데이터 고려사항

- 로그아웃은 계정 cache를 무조건 삭제하지 않는다. 다음 로그인의 offline 조회를 위해 namespace만 분리한다.
- revoke 또는 명시적 계정 데이터 삭제는 별도 purge API로 처리한다.
- browser storage eviction 가능성을 고려해 server authority에서 언제든 full bundle을 복구할 수 있어야 한다.

## 검증 방법

- local commit 직후 탭을 종료하고 재접속해 command가 한 번만 server에 적용되는지 확인한다.
- A/B 계정 전환 시 cache와 outbox가 교차 노출되지 않는지 확인한다.
- server ack 전 offline 전환과 5xx 후 backoff가 queue를 잃지 않는지 확인한다.
- IndexedDB transaction 실패 시 cache와 outbox가 함께 rollback되는지 확인한다.

## 롤백 방법

- 신규 adapter feature flag를 끄고 기존 document-primary Web runtime을 유지한다.
- 새 IndexedDB는 독립 version/name으로 두어 기존 DB를 손상시키지 않는다.

## 완료 조건

- Web local mutation과 outbox가 원자적이다.
- 재시작, offline, retry, 계정 전환에서 데이터가 유실·혼합되지 않는다.
- TASK-050에서 화면을 전환할 수 있는 repository adapter가 준비된다.
