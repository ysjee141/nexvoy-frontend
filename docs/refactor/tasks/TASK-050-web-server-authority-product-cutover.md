# TASK-050: Web Server-Authority Product Cutover

- 상태: 구현 완료 (로컬 Supabase 통합 E2E 실행 대기)
- Issue: [#354](https://github.com/ysjee141/nexvoy-frontend/issues/354)
- Pull Request: [#355](https://github.com/ysjee141/nexvoy-frontend/pull/355)

## 목적

Web의 여행, 일정, 준비물, 템플릿 제품 경로를 server-authority Repository로 전환한다. 화면은 IndexedDB cache를
즉시 표시하고 모든 mutation을 transactional outbox에 기록하며, Yjs/P2P/encrypted backup에 의존하지 않는다.

## 범위

- 여행 목록/생성/수정/삭제
- 일정 CRUD, URL, 정렬, 방문, 메모, 비용, 알림 metadata
- 준비물 CRUD, assignee, 사용자별 check, template apply
- 템플릿 list/detail/create/edit/delete/share/apply
- collaborator 목록의 canonical membership read
- offline/pending/synced/conflict/error 상태 UX
- Web repository factory feature flag와 E2E

제외:

- invitation join/key UX 제거 (`TASK-053`)
- asset binary 최적화 (`TASK-054`)
- legacy runtime 파일 삭제 (`TASK-055`)

## 선행 조건

- `TASK-048-web-indexeddb-cache-outbox.md`
- `TASK-049-realtime-invalidation-and-revision-recovery.md`

## 변경 대상

- `apps/web/app`
- `apps/web/components`
- `apps/web/stores`
- `apps/web/lib/data`
- `apps/web/lib/local-first/repositoryFactory.ts`
- `apps/web/e2e`

## 구현 단계

1. repository factory가 feature flag에 따라 신규 authority adapter를 주입하도록 한다.
2. 홈은 account-scoped local summary를 즉시 표시하고 background에서 server revision/summary를 갱신한다.
3. 여행 생성은 client UUID로 local trip과 create command를 원자적으로 만들며 server ack 전 invitation을 제한한다.
4. 일정/준비물/템플릿 화면의 direct Supabase/Yjs 호출을 Repository command로 교체한다.
5. mutation은 optimistic state를 즉시 표시하고 canonical ack로 교정한다.
6. active detail은 Realtime invalidation을 받아 changed entity 또는 full bundle을 refresh한다.
7. conflict는 silent overwrite하지 않고 domain별 자동 병합 또는 사용자 재선택 상태로 분리한다.
8. 기존 V1 document가 없는 경우에도 `Trip document was not found` 같은 오류가 발생하지 않도록 제거한다.
9. P2P/backup 중심 상태 문구를 offline, 저장 대기, 동기화 완료, 조치 필요 상태로 교체한다.

## UX 원칙

- local cache가 있으면 loading 화면보다 데이터를 먼저 보여준다.
- offline edit는 허용하되 서버에 반영되지 않은 상태를 숨기지 않는다.
- 일반적인 sync는 조용히 처리하고 terminal conflict/permission 오류만 명시한다.
- reset된 V1 데이터에 대한 별도 이전 버전 메시지를 제공하지 않는다.

## 검증 방법

- offline에서 각 도메인 CRUD 후 새로고침/reconnect해 server와 일치하는지 확인한다.
- 다른 Web 계정이 collaborator로 같은 여행을 열어 Realtime 변경을 받는지 확인한다.
- 계정 전환 후 이전 계정 여행이 노출되지 않는지 확인한다.
- guest 작성 기능을 유지하는 경우 로그인 후 draft가 한 번만 계정 데이터로 승격되는지 확인한다.
- 제품 경로 network log에 `document_updates`, key RPC, signaling 호출이 없는지 확인한다.
- Playwright, Web build, shared typecheck를 통과한다.

## 롤백 방법

- Web authority feature flag를 끄고 기존 document-primary repository를 사용한다.
- 신규 server row와 local cache는 유지해 재전환 시 재사용한다.

## 완료 조건

- Web 핵심 기능이 신규 Repository/cache/outbox/RPC 경로에서 동작한다.
- Web 제품 mutation이 full Yjs update를 생성하거나 P2P/backup에 publish하지 않는다.
- offline, cross-account collaboration, refresh가 데이터 유실 없이 검증된다.

## 구현 결과

- 여행, 일정, 준비물, 템플릿 및 프로필 파생 조회를 server-authority repository로 전환했다.
- `onvoy-server-authority` IndexedDB가 canonical bundle과 optimistic projection을 분리하고 mutation과 outbox를 한 transaction에 저장한다.
- 1초 debounce, 재시도 시각 예약, foreground/online flush, Realtime revision invalidation을 제품 runtime에 연결했다.
- 여행 상세에 오프라인 저장, 저장 대기, 동기화 완료, 충돌, 저장 오류 상태를 표시한다.
- 기본값은 신규 경로이며 `NEXT_PUBLIC_WEB_SERVER_AUTHORITY=0` 또는 `?serverAuthority=0`으로 기존 document-primary 경로를 사용할 수 있다.
- 신규 migration은 없으며 TASK-046/049의 RPC와 Realtime 계약을 사용한다.

## 검증 결과

- `pnpm --filter nexvoy-web test:authority`
- `pnpm --filter @nexvoy/core test`
- `pnpm typecheck`
- `pnpm build:packages`
- `pnpm build`
- `pnpm build:mobile`
- `pnpm --filter nexvoy-web exec playwright test --list`

위 검증은 통과했다. `server-authority-product.spec.ts`는 offline outbox, reconnect flush, editor Realtime 수신,
legacy key/backup/signaling 호출 부재를 검증한다. 실제 실행은 `.env.test.local`이 원격 DEV를 가리켜 destructive cleanup
안전장치가 중단했으며, 로컬 Supabase 환경에서 후속 실행해야 한다.
