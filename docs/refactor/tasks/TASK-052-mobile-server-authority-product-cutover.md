# TASK-052: Mobile Server-Authority Product Cutover

- 상태: 구현 완료 (실기기 smoke 대기)

- Issue: [#360](https://github.com/ysjee141/nexvoy-frontend/issues/360)
- Pull Request: [#361](https://github.com/ysjee141/nexvoy-frontend/pull/361)

## 목적

Mobile의 여행, 일정, 준비물, 템플릿 제품 경로를 SQLite cache와 durable outbox 기반 server-authority
Repository로 전환한다. Web과 같은 canonical row와 conflict 정책을 사용한다.

## 범위

- 여행 목록/생성/수정/삭제
- 일정 전체 기능
- 준비물, assignee, 사용자별 check, template apply
- 템플릿 전체 기능
- collaborator 목록의 canonical membership read
- foreground/reconnect/background opportunity sync UX
- authority-only release rollback, integration test, 실기기 smoke

제외:

- invitation key UX 제거 (`TASK-053`)
- asset binary 최적화 (`TASK-054`)
- native WebRTC/crypto dependency 제거 (`TASK-055`)

## 선행 조건

- `TASK-051-mobile-sqlite-cache-outbox.md`

## 변경 대상

- `apps/mobile/app`
- `apps/mobile/components`
- `apps/mobile/lib/data`
- `apps/mobile/lib/local-first/documentPrimaryRepositories.ts`
- Mobile test/runbook

## 구현 단계

1. Mobile repository factory를 authority adapter로 전환한다.
2. 홈/상세는 SQLite cache를 먼저 렌더하고 server summary/revision을 background 갱신한다.
3. 모든 mutation을 SQLite transaction과 command outbox로 교체한다.
4. Realtime invalidation과 foreground/reconnect revision recovery를 화면 lifecycle에 연결한다.
5. background task는 제한된 flush 기회로만 사용하고 foreground 재개를 최종 fallback으로 둔다.
6. server ack 전 생성된 resource의 invitation/asset 등 server-dependent action을 명확히 제한한다.
7. conflict/permission/terminal error를 Web과 같은 상태 모델로 표현한다.
8. AsyncStorage Yjs/backup 자료가 없어도 제품 화면이 정상 동작하도록 한다.
9. Android/iOS development build에서 실제 앱 종료, airplane mode, 계정 전환을 검증한다.

## UX 원칙

- 네트워크가 느려도 local cache가 있으면 즉시 화면을 보여준다.
- 저장 대기와 조치가 필요한 오류를 구분한다.
- background sync 완료를 OS가 보장하는 것처럼 표시하지 않는다.
- reset된 V1 데이터에 대한 별도 이전 버전 메시지를 제공하지 않는다.

## 검증 방법

- Web에서 생성한 여행을 같은 계정의 새 Mobile 기기에서 복구한다.
- Mobile offline CRUD 후 Web collaborator가 reconnect 이후 canonical 결과를 보는지 확인한다.
- Mobile A/B 계정 전환에서 cache와 outbox가 격리되는지 확인한다.
- guest 작성 기능을 유지하는 경우 로그인 후 draft가 한 번만 계정 데이터로 승격되는지 확인한다.
- 제품 경로에서 key provisioning, backup update, signaling 호출이 없는지 확인한다.
- typecheck, lint, Expo export, Android/iOS development build smoke를 통과한다.

## 롤백 방법

- TASK-055 이후 기존 document-primary adapter와 feature flag는 제거됐다. 직전의 검증된
  authority-only Mobile binary로 롤백한다.
- SQLite DB는 schema version과 outbox 호환성을 확인한 뒤 유지한다. canonical row를 legacy
  runtime으로 되돌리지 않는다.

## 완료 조건

- Mobile 핵심 기능이 SQLite/cache/outbox/RPC 경로에서 동작한다.
- Web/Mobile이 동일 canonical row와 revision을 본다.
- 앱 종료, offline, reconnect, 계정 전환에서 데이터 유실·혼합이 없다.

## 구현 결과

- Web에 있던 제품 repository를 Core의 platform-independent factory로 추출하고 Mobile SQLite runtime을 연결했다.
- Mobile 여행, 일정, 준비물, 템플릿과 프로필 파생 조회를 account-scoped cache/outbox 경로로 전환했다.
- 목록은 local cache를 먼저 표시하고 foreground/reconnect에서 summary를 갱신한다. 상세는 private Realtime invalidation과 revision recovery를 구독한다.
- mutation은 SQLite optimistic transaction과 durable command outbox를 사용하고, 1초 debounce와 lifecycle trigger로 flush한다.
- 신규 resource의 server ack 전에는 초대와 이미지 업로드를 제한하며, sync badge로 offline/pending/synced/conflict/error를 구분한다.
- authority mode에서는 legacy key provisioning, encrypted backup, WebRTC/P2P runtime을 시작하지 않는다.
- 당시 롤백 플래그를 유지했으나 TASK-055에서 legacy runtime과 함께 제거했다. 현재 롤백은
  authority-only binary release 단위로 수행한다.
- DB migration이나 신규 RPC는 없으며 TASK-046~051 authority 계약을 재사용한다.

자동 unit/typecheck/lint/Web build/Expo export/Android native build를 수행했다. 실제 기기의 계정 전환, 비행기 모드, Web/Mobile 교차 동기화는
`docs/refactor/runbooks/TASK-052-mobile-authority-product-smoke.md` 절차로 최종 확인한다.
