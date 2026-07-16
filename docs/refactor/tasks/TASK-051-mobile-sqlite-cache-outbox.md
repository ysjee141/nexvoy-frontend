# TASK-051: Mobile SQLite Cache and Transactional Outbox

- 상태: 대기

## 목적

Mobile에서 account-scoped cache와 durable outbox를 SQLite transaction으로 저장한다. AsyncStorage 기반 document와
queue의 비원자성을 제거하고 Web과 동일한 command/revision 계약을 구현한다.

## 범위

- `expo-sqlite` 도입과 schema version 관리
- account/resource-scoped cache, outbox, sync state table
- atomic local mutation + outbox append
- foreground/network reconnect/background opportunity sync
- batch RPC flush와 canonical ack 적용
- TASK-049 계약을 사용하는 Mobile Realtime subscription/revision recovery adapter
- account switch/logout/revoke purge
- native lifecycle 및 실제 개발 빌드 검증

제외:

- Mobile 화면 repository cutover
- Realtime subscription
- AsyncStorage/Yjs/crypto 파일 제거

## 선행 조건

- `TASK-047-shared-offline-sync-core.md`
- `TASK-049-realtime-invalidation-and-revision-recovery.md`
- `TASK-050-web-server-authority-product-cutover.md`

## 변경 대상

- `apps/mobile/package.json`
- `apps/mobile/lib/data`
- `apps/mobile/lib/local-first`의 신규 authority adapter
- `apps/mobile/app`의 lifecycle 조립 지점
- Mobile integration test/runbook

## 구현 단계

1. `expo-sqlite`와 versioned migration runner를 추가한다.
2. account ID, resource ID, entity ID를 포함하는 cache/outbox/sync table과 index를 정의한다.
3. optimistic projection 갱신과 outbox insert를 한 SQLite transaction에서 처리한다.
4. 앱 시작과 foreground에서 interrupted `sending` row를 회수한다.
5. network reconnect, foreground, background execution opportunity에서 제한된 batch를 flush한다.
6. OS background 제한을 보장처럼 표현하지 않고 다음 foreground에서도 반드시 이어서 처리한다.
7. canonical ack와 revision을 transaction으로 반영하고 terminal error를 보존한다.
8. 계정 전환과 revoke에서 활성 query/cache/outbox가 격리·정리되는지 검증한다.
9. guest namespace의 draft는 로그인 시 authenticated create command로 승격한다.
10. active detail Realtime invalidation과 foreground/reconnect revision recovery를 연결한다.
11. Android/iOS development build와 Expo export를 검증한다.

## 데이터 고려사항

- 기존 AsyncStorage Yjs document/backupQueue를 새 DB로 자동 import하지 않는다.
- DB 파일 자체는 공유해도 모든 query는 account namespace를 강제한다.
- SecureStore에는 auth credential만 두고 product row나 command payload를 저장하지 않는다.

## 검증 방법

- transaction 중 앱 종료, 재실행, duplicate flush에서 command가 유실·중복 적용되지 않는지 확인한다.
- A/B 계정 로그인 전환과 revoke 후 local data 접근 차단을 검증한다.
- airplane mode edit 후 reconnect/foreground에서 server와 canonical state가 일치하는지 확인한다.
- Android/iOS 실제 development build에서 DB migration과 lifecycle을 smoke test한다.

## 롤백 방법

- 신규 Mobile authority adapter feature flag를 끈다.
- SQLite DB는 기존 AsyncStorage key와 별도로 유지한다.

## 완료 조건

- Mobile cache와 outbox가 SQLite transaction으로 원자적이다.
- OS 종료와 network 변화 후에도 queue가 재개된다.
- TASK-052에서 제품 화면을 전환할 수 있는 persistence/Realtime adapter가 준비된다.
