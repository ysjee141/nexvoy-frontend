# Local-First Refactor Tasks

이 디렉토리는 Local-first Data Engine 전환 작업의 phase별 실행 문서를 보관한다.

상위 문서:

- `docs/refactor/TECHNICAL-SPEC.md`
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
| `TASK-017-mobile-background-provisioning-sync.md` | 대기 | Mobile background task 기반 provisioning sync |
| `TASK-018-mobile-non-exportable-key-storage.md` | 대기 | Mobile native non-exportable key storage hardening |
| `TASK-019-mobile-first-owner-key-bootstrap.md` | 대기 | Web 없는 첫 Mobile owner device key bootstrap |

현재 `Phase 0: 모델과 변환 기반`, `Phase 1: Repository 경계와 Web 스파이크`, `Phase 2: Backup, 암호화, Restore`, `Phase 2.5: Web Read-through 보완`은 완료되었다. `Phase 3`의 모바일 WebRTC native feasibility와 Cloudflare ICE config 발급 경로는 provider boundary, Edge Function, 검증 보고서로 정리했다. `Phase 4`의 dual-write 및 mismatch detector와 guest auth promotion은 Web-first 범위로 구현했다. `TASK-013`에서 초대/권한 registry, invite/share RPC, Web/Mobile join fallback을 구현했고, `TASK-014`에서 notification metadata, local notification scheduler, observability event boundary를 구현했다. `TASK-015`에서 owner/editor Web foreground document key provisioning과 pending/status UX를 구현했다. `TASK-016`은 Mobile Native Key Provisioning MVP를 구현하고 accepted scope 기준 검증했다. `TASK-017~019`는 TASK-016의 residual을 background sync, key storage hardening, Mobile-first owner bootstrap으로 분리한 후속 문서다.

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

### Phase 4: 이관 안정화

- [x] `TASK-011-dual-write-and-mismatch-detector.md`: dual-write와 mismatch detector 도입
- [x] `TASK-012-guest-auth-promotion.md`: guest local document를 Supabase Auth 계정으로 승격

### Phase 5: 협업/알림/관측

- [x] `TASK-013-invitation-permission-registry.md`: 초대/권한 registry와 invite RPC 구현
- [x] `TASK-014-notification-and-observability.md`: notification metadata, local notification, 비용 관측 이벤트 정리
- [x] `TASK-015-owner-side-document-key-provisioning.md`: 초대 수락 멤버의 wrapped document key 발급
- [x] `TASK-016-mobile-native-key-provisioning-and-background-sync.md`: Mobile native key provisioning MVP와 foreground/resume sync
- [ ] `TASK-017-mobile-background-provisioning-sync.md`: Mobile background task 기반 provisioning sync
- [ ] `TASK-018-mobile-non-exportable-key-storage.md`: Mobile non-exportable key storage hardening
- [ ] `TASK-019-mobile-first-owner-key-bootstrap.md`: 첫 Mobile owner device key bootstrap

## 권장 시작 순서

1. `TASK-017-mobile-background-provisioning-sync.md`
2. `TASK-018-mobile-non-exportable-key-storage.md`
3. `TASK-019-mobile-first-owner-key-bootstrap.md`

TASK-001~016까지 완료되어 Web checklist 도메인에서 local-first read/write 스파이크, Supabase backup schema/RLS, document key model, backup queue, snapshot/update restore flow, 기존 Supabase row 기반 read-through hydration, 모바일 WebRTC native runtime 조건, Cloudflare STUN/TURN ICE config 발급 경로, checklist dual-write/mismatch detector, guest auth promotion, 초대/권한 registry, notification/observability boundary, Web foreground owner-side key provisioning, Mobile native key provisioning MVP와 foreground/resume sync를 검증할 수 있는 상태가 되었다. 다음 단계는 background sync, native key storage hardening, Mobile-first owner bootstrap을 독립 PR로 검토한다.
