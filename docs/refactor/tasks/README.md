# Local-First Refactor Tasks

이 디렉토리는 Local-first Data Engine 전환 작업의 phase별 실행 문서를 보관한다.

상위 문서:

- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/refactor/progress.md`
- `docs/refactor/adrs/ADR-001-local-first-data-engine.md`
- `docs/plans/PLAN-008-local-first-architecture-review.md`

## 문서 네이밍

작업 문서는 아래 형식을 사용한다.

```text
TASK-001-trip-document-model.md
TASK-002-row-to-document-converter.md
TASK-003-document-materialized-read-model.md
TASK-004-repository-abstraction.md
TASK-005-web-indexeddb-yjs-checklist-spike.md
TASK-008a-web-checklist-read-through-hydration.md
```

## 권장 템플릿

```markdown
# TASK-NNN: 제목

## 목적

## 범위

## 선행 조건

## 변경 대상

## 구현 단계

## 데이터 호환성 고려사항

## 검증 방법

## 롤백 방법

## 완료 조건
```

## 실행 원칙

- 각 task는 가능한 한 하나의 PR로 끝낼 수 있는 크기를 유지한다.
- UI는 Supabase, Yjs, WebRTC를 직접 호출하지 않고 Repository 또는 platform adapter를 통해 접근한다.
- `packages/core`에는 IndexedDB, SQLite, WebRTC, Next.js, Expo/RN API를 넣지 않는다.
- 기존 Supabase row table은 document-primary 전환 전까지 fallback으로 유지한다.
- WebRTC/P2P는 optional fast path이며, 기본 sync/restore는 Supabase backup pull/push다.
- Cloudflare STUN/TURN은 managed provider 기준선으로 사용한다.

## 진행 현황

| Task | 상태 | 결과 |
|------|------|------|
| `TASK-001-trip-document-model.md` | 완료 | PR [#255](https://github.com/ysjee141/nexvoy-frontend/pull/255) |
| `TASK-002-row-to-document-converter.md` | 완료 | PR [#257](https://github.com/ysjee141/nexvoy-frontend/pull/257) |
| `TASK-003-document-materialized-read-model.md` | 완료 | PR [#259](https://github.com/ysjee141/nexvoy-frontend/pull/259) |
| `TASK-004-repository-abstraction.md` | 완료 | PR [#261](https://github.com/ysjee141/nexvoy-frontend/pull/261) |
| `TASK-005-web-indexeddb-yjs-checklist-spike.md` | 완료 | PR [#263](https://github.com/ysjee141/nexvoy-frontend/pull/263) |
| `TASK-006-backup-schema-and-rls.md` | 완료 | 로컬 구현 및 검증 완료 |
| `TASK-007-document-key-model.md` | 완료 | 로컬 구현 및 검증 완료 |
| `TASK-008-backup-queue-and-restore.md` | 완료 | 로컬 구현 및 검증 완료 |
| `TASK-008a-web-checklist-read-through-hydration.md` | 완료 | 로컬 구현 및 검증 완료 |
| `TASK-009-mobile-webrtc-native-feasibility.md` | 완료 | 로컬 구현 및 검증 완료 |
| `TASK-010-cloudflare-ice-config.md` | 완료 | 로컬 구현 및 검증 완료 |
| `TASK-011-dual-write-and-mismatch-detector.md` | 완료 | 로컬 구현 및 검증 완료 |
| `TASK-012-guest-auth-promotion.md` | 완료 | 로컬 구현 및 검증 완료 |
| `TASK-013-invitation-permission-registry.md` | 완료 | 로컬 구현 및 검증 완료 |
| `TASK-014-notification-and-observability.md` | 완료 | 로컬 구현 및 검증 완료 |
| `TASK-015-owner-side-document-key-provisioning.md` | 완료 | 로컬 구현 및 검증 완료 |
| `TASK-016-mobile-native-key-provisioning-and-background-sync.md` | 완료 | Mobile Native Key Provisioning MVP 구현 및 검증 완료 |
| `TASK-017-mobile-background-provisioning-sync.md` | 완료 | Mobile background task 기반 provisioning sync 구현 및 검증 완료 |
| `TASK-018-mobile-non-exportable-key-storage.md` | 완료 | Mobile native non-exportable key storage hardening 구현 및 검증 완료 |
| `TASK-019-mobile-first-owner-key-bootstrap.md` | 완료 | 로컬 구현 및 검증 완료 (restore 재시도는 TASK-020으로 이관) |
| `TASK-020-mobile-encrypted-snapshot-restore.md` | 완료 | 로컬 구현 및 검증 완료 (reviewer APPROVE, qa-engineer PASS) |
| `TASK-021-web-signaling-channel-and-data-channel-handshake.md` | PR 리뷰 대기 | typecheck/test/build 통과, PR [#300](https://github.com/ysjee141/nexvoy-frontend/pull/300), 실브라우저 2세션 수동 검증은 후속 |
| `TASK-022-document-registry-bootstrap-for-regular-trips.md` | 완료 | 일반 Web trip의 documents/document_members lazy bootstrap 구현 및 검증 완료 |
| `TASK-023-mobile-signaling-channel-wiring.md` | 완료 | Mobile signaling channel, native data-channel handshake, P2P 조립 지점 구현 및 자동 검증 완료 |
| `TASK-024-p2p-data-channel-yjs-update-exchange.md` | 완료 | Web-to-Web data channel Yjs update 교환 구현 및 자동 검증 완료 |
| `TASK-025-p2p-connection-status-ui.md` | 완료 | Web 준비물 화면 P2P 연결 자동 시도 및 사용자 대상 연결 상태 UI 구현 |
| `TASK-026-p2p-connection-lifecycle-hardening.md` | 완료 | Web checklist P2P 재연결/backoff, 탭 종료 정리, Mobile lifecycle hook point 구현 |
| `TASK-027-mobile-yjs-runtime-adapter.md` | 완료 | Mobile Yjs runtime adapter, AsyncStorage persistence, P2P update apply 경로 구현 및 자동 검증 완료 |
| `TASK-028-rotating-room-secret-hardening.md` | 완료 | server-issued signaling topic, active topic RLS, Web/Mobile adapter 전환 구현, Issue [#312](https://github.com/ysjee141/nexvoy-frontend/issues/312) |
| `TASK-029-full-local-first-product-scope-adr.md` | 완료 | ADR-013으로 전체 제품 Local-first 범위, `TemplateDocumentV1` boundary, migration/rollback 정책 채택, Issue [#316](https://github.com/ysjee141/nexvoy-frontend/issues/316) |
| `TASK-030-document-primary-repository-layer.md` | 완료 | Trip/Plan/Checklist/Template/Member document-primary repository contract, mutation writer, TemplateDocumentV1 구현, Issue [#318](https://github.com/ysjee141/nexvoy-frontend/issues/318) |
| `TASK-031-web-full-document-primary-transition.md` | 완료 | Web checklist/plans/templates/collaborators document-primary 전환, PR #321 |
| `TASK-032-mobile-full-document-primary-transition.md` | 완료 | Mobile checklist/plans/templates/collaborators document-primary 전환, Issue #322 |
| `TASK-033-backup-sync-productization.md` | 계획됨 | 모든 도메인 mutation의 encrypted backup/update sync 제품화 |
| `TASK-034-p2p-all-domain-wiring.md` | 계획됨 | 모든 도메인 P2P update 전파와 late join/peer discovery 하드닝 |
| `TASK-035-full-integration-test-suite.md` | 계획됨 | Web/App 전체 기능 통합 테스트 및 실기기 smoke 검증 |
| `TASK-036-closed-beta-readiness.md` | 계획됨 | 완성 제품 기준 Closed Beta 출시 준비 |

현재 `Phase 0: 모델과 변환 기반`, `Phase 1: Repository 경계와 Web 스파이크`, `Phase 2: Backup, 암호화, Restore`, `Phase 2.5: Web Read-through 보완`은 완료되었다. `Phase 3`의 모바일 WebRTC native feasibility와 Cloudflare ICE config 발급 경로는 provider boundary, Edge Function, 검증 보고서로 정리했다. `Phase 4`의 dual-write 및 mismatch detector와 guest auth promotion은 Web-first 범위로 구현했다. `TASK-013`에서 초대/권한 registry, invite/share RPC, Web/Mobile join fallback을 구현했고, `TASK-014`에서 notification metadata, local notification scheduler, observability event boundary를 구현했다. `TASK-015`에서 owner/editor Web foreground document key provisioning과 pending/status UX를 구현했다. `TASK-016`은 Mobile Native Key Provisioning MVP를 구현하고 accepted scope 기준 검증했다. `TASK-017`은 Mobile background task 기반 provisioning retry path를 구현하고 Android-first 검증 범위에서 PASS를 받았다. `TASK-018`은 Android Keystore/iOS Keychain 기반 non-exportable key storage hardening을 구현하고 native preview build와 SQL smoke까지 검증했다. `TASK-019`는 Mobile-first owner bootstrap 후속 문서다. `TASK-020`은 `restore.ts`의 Yjs 비의존 부분(snapshot 복호화·hash 검증)을 `backupPayloadCodec.ts`/`mobileRestore.ts`로 분리해 Mobile 전용 encrypted snapshot restore 경로(`restoreMobileEncryptedSnapshot`)를 구현하고, `TASK-019`의 owner bootstrap 성공/provisioning completion 트리거에 재시도를 연결했다. updates replay(Web/Yjs 기반 최신 콘텐츠 반영)는 이번 범위에서 제외했다. `TASK-021`은 `ADR-004`가 유보했던 시그널링 전송 계층을 `ADR-012`(Supabase Realtime Broadcast)로 결정하고, Web에서 시그널링 채널과 데이터 채널을 실제로 배선해 P2P fast path의 최초 연결을 증명했다. `TASK-022`는 일반 Web 로그인 trip이 `documents`/`document_members`에 등록되지 않던 선결 문제를 lazy bootstrap으로 해소했다. `TASK-023`은 같은 signaling 프로토콜과 room topic 파생 규칙을 Mobile까지 확장하고 native data-channel handshake/조립 지점을 추가했다. `TASK-024`는 Web-to-Web 범위에서 data channel로 Yjs update를 청킹/전송/재조립하고 IndexedDB 문서에 적용하는 fast path를 구현했다. `TASK-027`은 Mobile Yjs runtime adapter와 `react-native-quick-crypto` 기반 Metro shim을 추가해 Mobile도 같은 Yjs update format을 apply할 수 있게 했다. `TASK-029`부터는 checklist pilot을 넘어 Web/App 전체 제품 기능을 document-primary로 전환하고, 그 이후 통합 테스트와 Closed Beta 준비를 진행한다.

`TASK-021`은 `ADR-004`가 유보했던 시그널링 전송 계층을 `ADR-012`(Supabase Realtime Broadcast)로
결정하고, Web에서 시그널링 채널과 데이터 채널을 실제로 연결해 P2P fast path의 최초 연결을 증명했다
(PR #300, 자동 검증 완료·실브라우저 수동 검증 후속). 수동 검증 중 일반 trip이 `documents`/
`document_members`에 전혀 등록되지 않는다는 선결 문제를 발견해 `TASK-022`로 분리했다. P2P를 완전한
기능으로 만들기 위한 나머지 작업 중 `TASK-025` 사용자 UI, `TASK-026` 생명주기 하드닝, `TASK-028`
rotating room secret 보안 하드닝을 완료했다.

## Phase별 작업 목록

### Phase 0: 모델과 변환 기반

- [x] `TASK-001-trip-document-model.md`: Trip 단위 `TripDocumentV1` 타입과 entity boundary 정의
- [x] `TASK-002-row-to-document-converter.md`: 기존 Supabase row bundle을 document로 변환
- [x] `TASK-003-document-materialized-read-model.md`: document에서 화면용 read model 생성

### Phase 1: Repository 경계와 Web 스파이크

- [x] `TASK-004-repository-abstraction.md`: Supabase query 앞 Repository interface 도입
- [x] `TASK-005-web-indexeddb-yjs-checklist-spike.md`: Web IndexedDB + Yjs checklist local-first 스파이크

### Phase 2: Backup, 암호화, Restore

- [x] `TASK-006-backup-schema-and-rls.md`: Supabase backup schema 및 RLS 추가
- [x] `TASK-007-document-key-model.md`: Server-wrapped key 기반 document 암호화 PoC
- [x] `TASK-008-backup-queue-and-restore.md`: backup queue와 snapshot/update restore flow 구현

### Phase 2.5: Web Read-through 보완

- [x] `TASK-008a-web-checklist-read-through-hydration.md`: Web checklist local-first 최초 진입 시 기존 Supabase row를 document로 hydrate

### Phase 3: P2P Optional Fast Path

- [x] `TASK-009-mobile-webrtc-native-feasibility.md`: Expo dev client/EAS Build 기반 모바일 WebRTC 검증
- [x] `TASK-010-cloudflare-ice-config.md`: Cloudflare STUN/TURN ICE config 발급 경로 구현
- [x] `TASK-021-web-signaling-channel-and-data-channel-handshake.md`: Web 시그널링 채널(Supabase Realtime Broadcast) + 데이터 채널 배선으로 P2P fast path 최초 연결 증명 (자동 검증 완료, 실브라우저 2세션 수동 검증은 후속)

### Phase 4: 이관 안정화

- [x] `TASK-011-dual-write-and-mismatch-detector.md`: dual-write와 mismatch detector 도입
- [x] `TASK-012-guest-auth-promotion.md`: guest local document를 Supabase Auth 계정으로 승격

### Phase 5: 협업/알림/관측

- [x] `TASK-013-invitation-permission-registry.md`: 초대/권한 registry와 invite RPC 구현
- [x] `TASK-014-notification-and-observability.md`: notification metadata, local notification, 비용 관측 이벤트 정리
- [x] `TASK-015-owner-side-document-key-provisioning.md`: 초대 수락 멤버의 wrapped document key 발급
- [x] `TASK-016-mobile-native-key-provisioning-and-background-sync.md`: Mobile native key provisioning MVP와 foreground/resume sync
- [x] `TASK-017-mobile-background-provisioning-sync.md`: Mobile background task 기반 provisioning sync
- [x] `TASK-018-mobile-non-exportable-key-storage.md`: Mobile non-exportable key storage hardening
- [x] `TASK-019-mobile-first-owner-key-bootstrap.md`: 첫 Mobile owner device key bootstrap
- [x] `TASK-020-mobile-encrypted-snapshot-restore.md`: Mobile encrypted snapshot restore와 restore 후 key bootstrap 연결

### Phase 6: P2P Fast Path 완성

- [x] `TASK-021-web-signaling-channel-and-data-channel-handshake.md`: Web 시그널링 채널(Supabase Realtime Broadcast) + 데이터 채널 배선으로 P2P fast path 최초 연결 증명 (PR #300, 실브라우저 2세션 수동 검증은 후속)
- [x] `TASK-022-document-registry-bootstrap-for-regular-trips.md`: 일반 trip이 documents/document_members에 자동 등록되도록 bootstrap
- [x] `TASK-023-mobile-signaling-channel-wiring.md`: TASK-021을 Mobile까지 확장(Web-Mobile, Mobile-Mobile 연결 조립 지점)
- [x] `TASK-024-p2p-data-channel-yjs-update-exchange.md`: Web-to-Web 데이터 채널로 실제 Yjs update 교환
- [x] `TASK-025-p2p-connection-status-ui.md`: 사용자 대상 연결 상태 UI/UX
- [x] `TASK-026-p2p-connection-lifecycle-hardening.md`: 재연결/생명주기 하드닝
- [x] `TASK-027-mobile-yjs-runtime-adapter.md`: Mobile Yjs runtime adapter로 Web/Mobile 공통 update format 적용
- [x] `TASK-028-rotating-room-secret-hardening.md`: signaling topic rotating room secret 하드닝

### Phase 7: Full Product Document-primary 전환

- [x] `TASK-029-full-local-first-product-scope-adr.md`: 전체 제품 Local-first 범위와 migration/rollback 정책 확정
- [x] `TASK-030-document-primary-repository-layer.md`: 모든 핵심 도메인의 공통 document-primary repository 계약 도입
- [x] `TASK-031-web-full-document-primary-transition.md`: Web 핵심 기능을 document-primary read/write로 전환
- [x] `TASK-032-mobile-full-document-primary-transition.md`: Mobile 핵심 기능을 document-primary read/write로 전환
- [ ] `TASK-033-backup-sync-productization.md`: encrypted backup/update sync를 모든 도메인 mutation에 연결
- [ ] `TASK-034-p2p-all-domain-wiring.md`: P2P update 전파를 모든 도메인으로 확장하고 late join을 하드닝
- [ ] `TASK-035-full-integration-test-suite.md`: 전체 제품 통합 테스트와 실기기 smoke 검증
- [ ] `TASK-036-closed-beta-readiness.md`: 완성 제품 기준 Closed Beta 출시 준비

## 권장 시작 순서

TASK-001~028까지 완료되어 Web checklist 도메인에서 local-first read/write 스파이크, Supabase backup schema/RLS, document key model, backup queue, snapshot/update restore flow, 기존 Supabase row 기반 read-through hydration, 모바일 WebRTC native runtime 조건, Cloudflare STUN/TURN ICE config 발급 경로, checklist dual-write/mismatch detector, guest auth promotion, 초대/권한 registry, notification/observability boundary, Web foreground owner-side key provisioning, Mobile native key provisioning MVP와 foreground/resume/background sync, native non-exportable key storage hardening, Mobile-first owner device key bootstrap, Mobile encrypted snapshot restore, Web/Mobile P2P signaling/data-channel wiring, Web-to-Web Yjs update exchange, P2P 연결 생명주기 하드닝, Mobile Yjs runtime adapter, signaling rotating room topic hardening까지 검증을 완료했다.

`TASK-021`은 Web-to-Web P2P 연결을 최초로 증명했고, `TASK-022`는 일반 계정 trip의 document registry 등록 갭을 해소했다. `TASK-023`은 Mobile 배선까지 확장했고, `TASK-024`는 Web-to-Web Yjs update 교환을 구현했다. `TASK-025`는 Web 준비물 화면에서 P2P 연결을 자동 시도하고 상태를 표시하도록 연결했다. `TASK-026`은 Web checklist P2P 재연결/backoff와 탭 종료 정리, Mobile lifecycle hook point를 추가했다. `TASK-027`은 Mobile도 같은 Yjs update format을 apply하도록 runtime adapter와 P2P apply 경로를 추가했다. `TASK-028`은 signaling topic을 server-issued active topic으로 전환하고 Realtime RLS를 강화했다.

다음 권장 순서는 partial checklist pilot을 확장하는 방식이 아니라 전체 제품 Local-first 완료를 목표로 한다.

1. `TASK-031`과 `TASK-032`: Web/App의 준비물, 일정, 템플릿, 동행자 초대/수락/거부를 document-primary로 전환한다.
2. `TASK-033`과 `TASK-034`: 모든 도메인 mutation을 encrypted backup sync와 P2P fast path에 연결한다.
3. `TASK-035`: 전체 기능이 구현된 뒤 Web/App 통합 테스트와 실기기 smoke를 수행한다.
4. `TASK-036`: 완성된 제품 기준으로 Closed Beta 출시 준비를 완료한다.
