# Walkthrough: TASK-044 Targeted Document Invitation Authority

## Summary

TASK-044는 이메일, 홈 pending UI, 링크, 코드 초대를 `document_invitation_links`와
`document_members` authority로 통합했다. targeted 초대는 대상 이메일 계정만 수락할 수 있고,
메일 API는 인증된 서버 세션과 document editor 권한으로 invitation을 생성한다.

## Artifacts

- GitHub Issue [#348](https://github.com/ysjee141/nexvoy-frontend/issues/348)
- Pull Request [#349](https://github.com/ysjee141/nexvoy-frontend/pull/349)
- 브랜치: `feature/task-044-targeted-document-invitation-authority-348`
- `supabase/migrations/20260716000003_task044_targeted_document_invitations.sql`
- `packages/core/src/supabase/invitationRepository.ts`
- `apps/web/app/api/invite/route.ts`
- `apps/web/components/trips/InvitationBanner.tsx`
- `apps/web/components/trips/CollaboratorModal.tsx`

## Key Changes

- targeted invitation의 정규화 이메일, 유형, 여행 표시 metadata를 registry에 저장한다.
- 현재 계정의 pending 목록, 수락, 거절, document collaborator 목록 RPC를 추가했다.
- token/code 수락 시 JWT email과 target email 일치를 강제한다.
- 기존 generic invitation과 share token 경로는 유지한다.
- 메일 API가 임의 URL/code를 받지 않고 서버에서 생성한 `/join` URL만 발송한다.
- 메일 실패 시 생성한 invitation을 회수한다.
- 홈 배너와 협업자 모달의 legacy `trip_members` 의존을 제거했다.
- accepted registry member를 local `TripDocumentV1.members` snapshot에 반영한다.

## Verification

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter @nexvoy/core exec tsx src/supabase/__tests__/invitationRepository.test.ts` | PASS |
| `pnpm --filter @nexvoy/core test` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |
| `pnpm lint:mobile` | PASS |
| `pnpm build:mobile` | PASS, 기존 WebRTC export warning만 발생 |

## Deployment Note

- migration은 DEV `ivgkqzwosbjukonlpfdw`에 먼저 적용하고 다중 사용자 초대 검증을 수행한다.
- PROD `runbcaegpefqnljsswhv`에는 사용자 승인 후 별도로 적용한다.
- 참여 후 wrapped document key 자동 전달과 준비 화면은 TASK-045 범위다.

# Walkthrough: TASK-043 Document-Primary Trip Entry Fix

## Summary

TASK-043은 Closed Beta 테스트 중 확인된 Web trip entry 회귀를 수정했다. 홈 목록이 legacy row-only 여행을
직접 읽던 경로를 제거하고 document-primary repository 목록으로 전환했으며, 여행 상세 진입도 `trips` row가 아니라
`TripDocumentV1` read model을 우선 사용하도록 정리했다. 신규 Web 여행 생성 시 owner member snapshot을
문서에 포함해 협업/초대 UI가 owner 권한을 안정적으로 판정하도록 보강했다. 추가로 신규 document snapshot/key
bootstrap이 owner member 생성 전에 `get_my_active_document_key`를 호출해 `권한이 없습니다.`로 실패하던 순서를
수정했다. 후속 권한 감사에서는 원격 DB migration 누락과 client-side registry upsert가 함께 문제를 만들고 있음을
확인해, document authority 초기화를 `auth.uid()` 기반 원자 RPC로 단일화했다.

## Artifacts

- GitHub Issue [#346](https://github.com/ysjee141/nexvoy-frontend/issues/346)
- 브랜치: `feature/task-043-document-primary-trip-entry`
- `apps/web/app/HomeClient.tsx`
- `apps/web/app/trips/detail/TripLayoutClient.tsx`
- `apps/web/app/trips/detail/TripClient.tsx`
- `apps/web/lib/local-first/documentPrimaryRepositories.ts`
- `apps/web/lib/local-first/tripReadModelAdapters.ts`

## Key Changes

- Home trip list에서 `trips`/`trip_members`/`checklists` row 직접 조회를 제거하고 `repositories.trips.listTrips()`를 사용한다.
- `TripSummaryReadModel`/`TripDetailReadModel`을 기존 Web 카드/상세 row shape로 변환하는 adapter를 추가했다.
- Trip detail layout이 `repositories.trips.getTrip()` 결과를 기준으로 trip header와 member rows를 구성한다.
- TripClient role 조회가 document owner/member snapshot을 우선 사용하고 legacy role query는 fallback으로만 사용한다.
- Web 신규 trip document에 owner member snapshot을 추가해 owner read model이 비어 있지 않게 했다.
- Home/Global modal의 `NewTripModal` 생성 경로도 legacy `trips.insert().select()`에서 `createWebTripDocument()`로 전환했다.
- Web/Mobile 신규 document 생성 시 `documents` owner row와 `document_members` owner row를 먼저 확보한 뒤 active key RPC를 호출한다.
- `ensureDocumentBootstrapped()`가 trip/template type과 schema version을 입력받도록 확장했다.
- `hasSnapshot()`은 빈 `documents` bootstrap row가 아니라 실제 snapshot payload 존재 여부를 반환하도록 정정했다.
- 이메일 동행자 초대 경로가 legacy `trip_members.insert()`를 호출하지 않고 document invitation link RPC를 생성한 뒤 해당 링크/코드를 메일로 발송하도록 변경했다.
- 로컬 IndexedDB에는 여행이 있지만 Supabase `documents`/`document_members` registry가 비어 있는 중간 상태에서도, owner가 초대 생성 전에 원격 snapshot/key/read-model을 재부트스트랩하도록 보강했다.
- 신규 Web/Mobile document-primary trip 생성 및 초대 전 원격 부트스트랩에서 legacy `trips.upsert()` dual-write를 제거했다. 원격 기준은 `documents` encrypted snapshot과 `document_members` registry로 단일화한다.
- Web trip detail 진입 시 owner 세션은 key readiness/backup flush 전에 로컬 문서의 원격 registry/snapshot/key bootstrap을 먼저 시도한다.
- `bootstrap_owner_document()` RPC가 `documents`와 owner `document_members`를 한 transaction에서 생성하며 client 입력 owner id를 받지 않는다.
- snapshot 저장은 기존 `documents` row의 owner RLS UPDATE만 사용하고 document INSERT/upsert를 수행하지 않는다.
- Web guest promotion과 Mobile 초기 snapshot도 동일한 registry bootstrap 순서를 사용한다.
- document owner/member/editor 판정에서 legacy `trips`/`trip_members` fallback을 제거했다.
- `documents` 직접 INSERT와 `document_members` 직접 쓰기 정책을 제거해 document authority 변경은 검증 RPC로만 수행한다.
- 원격 Supabase에 누락되어 있던 TASK-037 member conflict index와 TASK-043 document authority migration을 적용했다.
- NewPlanModal이 장소 미선택 상태에서 조용히 return하지 않고 오류 메시지를 표시한다.
- NewPlanModal form에 `noValidate`를 적용하고 방문 날짜/시간/체류 시간 검증을 React 경로에서 명시 처리한다.
- 일정 저장 후 mutation 결과 document에서 저장된 plan을 즉시 materialize해 화면 state에 반영한다.
- RouteMapView의 일정 조회/수정/삭제/저장 경로도 Supabase row 직접 접근에서 document-primary repository로 전환했다.

## Verification

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter @nexvoy/core test` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm -C apps/web exec tsc --noEmit` | PASS |
| `pnpm build` | PASS |
| `pnpm build:mobile` | PASS, 기존 `react-native-webrtc`/`event-target-shim` export warning만 발생 |
| `supabase db lint --local --level error` | PASS |
| Local RLS/RPC SQL integration | PASS: owner bootstrap/update 허용, 타 사용자 bootstrap 및 직접 INSERT 차단 |

## Notes

- 이미 Supabase `documents`에 존재하는 과거 snapshot은 document-primary 데이터로 간주되어 목록에 표시될 수 있다.
  이번 수정은 legacy row-only 여행이 제품 목록에 섞이는 경로를 제거한 것이다.
- 오류 기간에 encrypted snapshot 없이 특정 브라우저 IndexedDB에만 저장된 여행은 새 로그인/기기에서 자동 복원할 수 없다.
  원본 브라우저의 local document가 남아 있다면 owner detail bootstrap으로 원격 복구할 수 있다.
- 원격 DB에서 `20260712` 이후 migration이 누락되어 있었고, TASK-021/025/028 signaling migration은 관리 스키마
  `realtime.messages`가 `supabase_realtime_admin` 소유라 일반 migration 계정으로 적용되지 않는다. 이 세 migration은
  완료 처리하지 않았으며 P2P private channel 권한 배포 방식을 별도 인프라 작업으로 해결해야 한다.

# Walkthrough: TASK-042 Legacy Migration Tool

## Summary

TASK-042는 Closed Beta 제품 경로에서 제외한 기존 Supabase row 데이터를, 향후 필요 시 사용자가 명시적으로 선택해
document-primary snapshot으로 전환할 수 있는 Web dev migration tool을 추가했다. 자동 migration/hydrate는
되살리지 않고, 로그인된 Web 세션의 현재 device key material로 encrypted snapshot, owner member, document key를
함께 bootstrap한다.

## Artifacts

- `docs/refactor/tasks/TASK-042-legacy-migration-tool.md`
- GitHub Issue [#343](https://github.com/ysjee141/nexvoy-frontend/issues/343)
- 브랜치: `feature/task-042-legacy-migration-tool`
- `packages/core/src/local-first/migrations.ts`
- `apps/web/lib/local-first/legacyMigrationService.ts`
- `apps/web/app/dev/legacy-migration/page.tsx`
- `docs/runbooks/legacy-document-migration.md`

## Key Changes

- `LegacyTemplateRowBundle`과 `convertLegacyTemplateRowsToDocument()`를 추가해 legacy template rows를
  `TemplateDocumentV1`로 변환한다.
- `/dev/legacy-migration`에서 current user 소유 row-only trip/template 후보를 scan한다.
- dry-run report가 변환 entity count와 validation message를 표시한다.
- migration 실행 시 local IndexedDB document update와 Supabase encrypted snapshot/member/key를 함께 생성한다.
- migration 직후 backup restore smoke를 수행해 current Web device key로 복구 가능한지 확인한다.

## Verification

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter @nexvoy/core test` | PASS |
| `pnpm -C packages/core typecheck` | PASS |
| `pnpm -C apps/web exec tsc --noEmit` | PASS |
| `pnpm build` | PASS |

## Follow-up

- Mobile에서 마이그레이션된 snapshot restore smoke는 실제 기기/시뮬레이터 계정으로 수동 확인한다.
- 이 도구는 public/default template migration을 다루지 않는다. 필요하면 별도 정책 결정 후 확장한다.

# Walkthrough: TASK-041 Backup Freshness and Cost Control

## Summary

TASK-041은 local-first 제품 경로가 local document를 우선 사용하되, Supabase backup metadata가 더 최신일 때만
encrypted payload를 pull/restore하도록 정리했다. repository read/document enter 성격의 호출에서
`documents.updated_at`과 최신 `document_updates.created_at`만 먼저 확인하고, remote가 local `updatedAt`보다
최신일 때에만 trip/template backup restore를 수행한다.

## Artifacts

- `docs/refactor/tasks/TASK-041-backup-freshness-and-cost-control.md`
- GitHub Issue [#341](https://github.com/ysjee141/nexvoy-frontend/issues/341)
- 브랜치: `feature/task-041-backup-freshness-cost-control`
- `packages/core/src/sync/backupTypes.ts`
- `packages/core/src/supabase/backupRepository.ts`
- `apps/web/lib/local-first/webDocumentStores.ts`
- `apps/mobile/lib/local-first/mobileDocumentStores.ts`
- `apps/web/lib/local-first/documentPrimaryRepositories.ts`
- `apps/mobile/lib/local-first/documentPrimaryRepositories.ts`

## Key Changes

- `DocumentFreshnessRecord`와 `getDocumentFreshness()`를 추가해 snapshot/update blob 없이 metadata만 조회한다.
- Web/Mobile document store에 `refreshDocument` hook을 추가했다.
- local document가 이미 있을 때도 remote metadata가 더 최신이면 backup restore를 수행한다.
- remote가 최신이 아니면 encrypted snapshot/update payload를 다운로드하지 않는다.
- Web/Mobile template mutation도 backup update queue에 enqueue되도록 연결했다.
- Realtime payload는 도입하지 않고, metadata query 기반으로 통신량을 제한했다.

## Verification

| 명령 | 결과 |
| --- | --- |
| `pnpm -C packages/core typecheck` | PASS |
| `pnpm -C apps/web exec tsc --noEmit` | PASS |
| `pnpm -C apps/mobile typecheck` | PASS |
| `pnpm --filter @nexvoy/core test` | PASS |
| `pnpm build` | PASS |
| `pnpm build:mobile` | PASS, 기존 `react-native-webrtc`/`event-target-shim` export warning만 발생 |

## Follow-up

- full conflict-free merge 정책은 이번 범위에서 제외했다. 현재는 remote metadata가 더 최신이면 restore/replay하고,
  local이 최신이면 pull을 skip한다.
- Realtime metadata notification은 이번 PR에서 추가하지 않았다. 비용 최소화를 위해 document enter/list read trigger를
  먼저 기준선으로 둔다.

# Walkthrough: TASK-040 Document-Primary Product Path Cutover

## Summary

TASK-040은 Web/Mobile document-primary repository의 제품 read path에서 legacy row hydrate/fallback을 제거했다.
이제 repository 목록은 local document id와 Supabase `documents` metadata id를 기준으로 구성하고, local document가
없을 때는 encrypted backup restore만 시도한다. 기존 row-only 여행/템플릿은 document repository 목록/상세로
자동 hydrate되지 않는다.

## Artifacts

- `docs/refactor/tasks/TASK-040-document-primary-product-path-cutover.md`
- GitHub Issue [#339](https://github.com/ysjee141/nexvoy-frontend/issues/339)
- 브랜치: `feature/task-040-document-primary-product-path-cutover`
- `packages/core/src/sync/restore.ts`
- `apps/web/lib/local-first/backupRestoreService.ts`
- `apps/web/lib/local-first/documentPrimaryRepositories.ts`
- `apps/web/lib/local-first/webDocumentStores.ts`
- `apps/mobile/lib/local-first/documentPrimaryRepositories.ts`
- `apps/mobile/lib/local-first/mobileDocumentStores.ts`

## Key Changes

- Web/Mobile document-primary repositories에서 `getLegacyTripRowBundle` 기반 trip hydrate를 제거했다.
- Web/Mobile template repository에서 `checklist_templates`/`checklist_template_items` 기반 hydrate/list를 제거했다.
- local document list에 Supabase `documents` metadata id를 병합해 다른 기기에서 생성된 신규 document-primary 문서를
  목록 후보로 볼 수 있게 했다.
- Web backup restore service에 `TemplateDocumentV1` restore를 추가했다.
- core `restore.ts`에 template Yjs backup replay helper를 추가했다.
- Mobile은 template snapshot을 복호화한 뒤 `TemplateDocumentV1`로 materialize하는 restore path를 추가했다.

## Verification

| 명령 | 결과 |
| --- | --- |
| `pnpm -C packages/core typecheck` | PASS |
| `pnpm -C apps/web exec tsc --noEmit` | PASS |
| `pnpm -C apps/mobile typecheck` | PASS |
| `pnpm --filter @nexvoy/core test` | PASS |
| `pnpm build` | PASS |
| `pnpm build:mobile` | PASS, 기존 `react-native-webrtc`/`event-target-shim` export warning만 발생 |

## Follow-up

- TASK-041에서 backup update enqueue/freshness 정책을 정리한다. 특히 template mutation update backup은 이번 범위에서
  생성 snapshot restore까지만 닫았고, 후속 freshness/update 정책에서 보강한다.
- TASK-039의 신규 trip `trips` read model upsert는 일부 화면 호환용으로 남아 있다. 완전한 row read model 의존
  제거는 별도 UI/layout 정리와 함께 다룬다.

# Walkthrough: TASK-039 New Document Bootstrap

## Summary

TASK-039는 신규 여행과 신규 템플릿 생성 경로를 document-primary bootstrap으로 전환했다. 생성 화면은 더 이상
legacy row insert를 primary write로 사용하지 않고, local document 저장과 encrypted initial snapshot,
owner `document_members`, current device `document_keys` bootstrap을 생성 완료 조건으로 사용한다.

현재 상세/목록 화면 중 일부가 아직 `trips` row read model에 의존하므로, 신규 여행 생성 시에는 같은 id로
최소 `trips` row를 비권위 read model로 upsert한다. 이 row는 TASK-040 product path cutover에서 제거할
호환 계층이며, 실제 생성 기준은 document snapshot/key다.

## Artifacts

- `docs/refactor/tasks/TASK-039-new-document-bootstrap.md`
- GitHub Issue [#337](https://github.com/ysjee141/nexvoy-frontend/issues/337)
- 브랜치: `feature/task-039-new-document-bootstrap`
- `apps/web/app/trips/new/page.tsx`
- `apps/mobile/app/trip/new.tsx`
- `apps/web/lib/local-first/documentPrimaryRepositories.ts`
- `apps/mobile/lib/local-first/documentPrimaryRepositories.ts`
- `apps/web/lib/local-first/keyProvisioningService.ts`
- `apps/mobile/lib/local-first/documentBootstrapService.ts`

## Key Changes

- Web 신규 여행 생성이 `createWebTripDocument()`를 통해 `TripDocumentV1` local document를 만들고,
  같은 Yjs initial update를 encrypted snapshot으로 bootstrap한다.
- Mobile 신규 여행 생성이 `createMobileTripDocument()`를 통해 동일한 document-primary contract를 사용한다.
- Web/Mobile 템플릿 생성 helper가 local 저장만 하던 상태에서 encrypted snapshot, owner member, current device key
  bootstrap까지 수행하도록 보강했다.
- Web owner key bootstrap을 trip 전용 document 입력에서 generic snapshot payload 입력도 받을 수 있게 확장했다.
- Mobile owner key bootstrap도 실제 snapshot payload를 받아 trip/template initial snapshot을 같은 경로로 암호화한다.
- 기존 화면 호환을 위해 신규 trip에 한해 `trips` row를 비권위 read model로 upsert한다.

## Verification

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter @nexvoy/core test` | PASS |
| `pnpm -C packages/core typecheck` | PASS |
| `pnpm -C apps/mobile typecheck` | PASS |
| `pnpm -C apps/web exec tsc --noEmit` | PASS |
| `pnpm build` | PASS |
| `pnpm build:mobile` | PASS, 기존 `react-native-webrtc`/`event-target-shim` export warning만 발생 |

## Follow-up

- TASK-040에서 여행/일정/준비물/템플릿 제품 경로의 legacy hydrate/fallback과 `trips` row read model 의존을 제거한다.
- TASK-041에서 신규 document backup freshness와 비용 최소화 trigger 정책을 정리한다.

# Walkthrough: TASK-037 Web Document-Primary Key Bootstrap and Photo Storage

## Summary

TASK-037은 Web document-primary 일정 생성 후 실제 backup sync가 `key_unavailable`로 실패하고,
place photo 저장 API가 `plans` row 부재로 `Plan not found` 404를 반환하던 통합 갭을 보완했다.
후속 재검토에서 P2P fallback, encrypted backup upload, fresh Web restore가 하나의 제품 flow로 닫히지
않았음이 확인되어 Web sync stabilization까지 범위를 확장했다. 이제 Web은 IndexedDB에 문서가 없을 때
Supabase encrypted backup restore를 legacy row hydrate보다 먼저 시도하고, key가 아직 없으면 stale row로
덮어쓰지 않고 key provisioning 대기 상태로 남긴다.

## Artifacts

- `docs/refactor/tasks/TASK-037-web-document-primary-key-bootstrap-and-photo-storage.md`
- GitHub Issue [#334](https://github.com/ysjee141/nexvoy-frontend/issues/334)
- 브랜치: `feature/task-037-web-document-primary-key-bootstrap-and-photo-storage-334`
- `apps/web/lib/local-first/keyProvisioningService.ts`
- `apps/web/lib/local-first/backupRestoreService.ts`
- `apps/web/lib/local-first/backupSyncService.ts`
- `apps/web/lib/local-first/documentPrimaryRepositories.ts`
- `apps/web/app/trips/detail/TripLayoutClient.tsx`
- `apps/web/components/trips/P2PConnectionStatusBadge.tsx`
- `apps/web/app/api/places/photo/store/route.ts`
- `apps/web/services/PlacePhotoService.ts`
- `apps/web/components/trips/NewPlanModal.tsx`
- `apps/web/app/trips/detail/TripClient.tsx`
- `supabase/migrations/20260715000001_task037_legacy_member_key_provisioning_list.sql`
- `supabase/migrations/20260715000002_task037_document_members_upsert_conflict_target.sql`

## Key Changes

- `ensureWebOwnerDocumentKey()`를 추가해 첫 owner mutation에서 encrypted snapshot과 현재 Web device용
  RSA-wrapped `document_keys` row를 보장한다.
- Web document-primary publisher가 backup enqueue 전에 registry와 owner key bootstrap을 순서대로 수행한다.
- trip 화면 진입 시 editor/viewer device가 key provisioning request를 자동 생성하고, owner는 열린 화면에서
  pending request를 주기적으로 처리한다.
- legacy `trip_members` 기반 accepted 멤버의 pending key request도 owner provisioning 목록에 보이도록 RPC를 보강했다.
- 현재 device의 active key row가 있지만 IndexedDB private key로 unwrap할 수 없는 경우 stale device key로 간주하고,
  해당 device key material을 revoke/recreate한 뒤 provisioning request를 다시 생성한다.
- `flushWebBackupQueue()`도 같은 stale key 복구 helper를 사용해 unwrap 실패가 unhandled rejection으로 터지지 않게 했다.
- Web document-primary hydrate가 IndexedDB miss 시 encrypted backup snapshot/update restore를 먼저 수행한다.
- backup이 존재하지만 현재 device key가 없거나 restore가 실패하면 legacy row hydrate로 stale data를 저장하지 않는다.
- `key_unavailable` queue는 `failed`로 고착하지 않고 retryable `pending` 상태로 유지한다.
- trip 화면 진입 후 key readiness/backup flush/read-through restore를 이어서 수행해 key provisioning 완료 후 복구가 화면에 반영되도록 했다.
- 상태 배지는 P2P fallback을 “백업 동기화 중”으로 오인시키지 않고, backup key 대기/동기화/실패/완료를 구분한다.
- `/api/places/photo/store`에 `documentPrimary` 요청 분기를 추가해 `plans` row가 없는 plan도 Storage upload를
  완료하고 URL을 반환한다.
- `NewPlanModal`의 document-primary 저장 경로가 photo store 요청에 `documentPrimary: true`를 전달한다.
- photo upload 성공 후 기존 callback이 document-primary plan `imageUrl` mutation을 수행하도록 의존성을 보정했다.

## Verification

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter nexvoy-web exec tsc --noEmit` | PASS |
| `pnpm --filter @nexvoy/core test` | PASS |
| `pnpm --filter nexvoy-app run typecheck` | PASS |
| `pnpm run typecheck` | PASS |
| `pnpm run build` | PASS |
| `pnpm run build:mobile` | PASS |

## Deployment Note

- 운영 Supabase에는 `supabase/migrations/20260715000001_task037_legacy_member_key_provisioning_list.sql` 적용이 필요하다.
  이 migration이 없으면 legacy `trip_members` 사용자들의 key provisioning request가 owner 처리 목록에 나타나지 않을 수 있다.
- `supabase/migrations/20260715000002_task037_document_members_upsert_conflict_target.sql`도 함께 적용해야
  `document_members` PostgREST upsert가 `on_conflict=document_id,user_id`로 동작한다.
- 완전히 새 기기가 기존 document key를 가진 어떤 owner/editor 기기와도 만나지 못하면 E2EE 모델상 즉시 복구할 수 없다.
  이 경우 UI는 backup key 대기 상태를 표시하고, key provisioning이 완료되는 즉시 restore/flush를 재시도한다.

## Follow-up

- `RouteMapView`에는 별도 legacy `plans` row 의존이 남아 있다. 지도 탭의 document-primary 완전 전환은 후속
  hardening으로 분리 가능하다.

# Walkthrough: Fix Document Key RPC Legacy Permission

## Summary

일정 생성 후 document-primary backup flush가 `get_my_active_document_key` RPC를 호출할 때 legacy trip이 아직 `document_members`에 bootstrap되지 않아 `권한이 없습니다.`가 발생하던 문제를 보강했다. 전환기 동안 legacy `trips`/`trip_members` 권한을 document permission helper가 인정하도록 migration을 추가하고, Web/Mobile document-primary mutation 경로에서 owner registry bootstrap을 backup enqueue 전에 시도한다.

## Artifacts

- GitHub Issue [#332](https://github.com/ysjee141/nexvoy-frontend/issues/332)
- PR [#333](https://github.com/ysjee141/nexvoy-frontend/pull/333)
- 브랜치: `fix/document-key-rpc-legacy-member-permission`
- `supabase/migrations/20260714000002_document_permission_legacy_trip_compat.sql`
- `apps/web/lib/local-first/documentPrimaryRepositories.ts`
- `apps/web/lib/local-first/backupSyncService.ts`
- `apps/mobile/lib/local-first/documentPrimaryRepositories.ts`
- `apps/mobile/lib/local-first/mobileBackupSyncService.ts`

## Key Changes

- `check_is_document_owner/member/editor`가 legacy `trips`/`trip_members`를 fallback으로 인정하도록 migration을 추가했다.
- Web/Mobile document-primary publisher가 owner mutation 후 backup enqueue 전에 `documents`/`document_members` bootstrap을 시도한다.
- Web/Mobile backup flush가 active auth session이 없으면 RPC를 호출하지 않고 pending queue를 유지하도록 guard를 추가했다.

## Verification

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter nexvoy-web exec tsc --noEmit` | PASS |
| `pnpm --filter nexvoy-app typecheck` | PASS |
| `pnpm --filter @nexvoy/core test` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |
| `pnpm build:mobile` | PASS |

# Walkthrough: TASK-036 Closed Beta Readiness

## Summary

TASK-036은 Local-first document-primary 제품을 Closed Beta로 공개하기 위한 운영 기준선을 문서화했다. 기능 코드는 변경하지 않았고, production readiness, secret inventory, deployment/rollback, tester 운영 runbook을 Expo/EAS와 Local-first sync/P2P/backup 구조에 맞춰 정리했다.

## Artifacts

- `docs/refactor/tasks/TASK-036-closed-beta-readiness.md`
- GitHub Issue [#330](https://github.com/ysjee141/nexvoy-frontend/issues/330)
- PR [#331](https://github.com/ysjee141/nexvoy-frontend/pull/331)
- 브랜치: `feature/task-036-closed-beta-readiness-330`
- `docs/production-readiness.md`
- `docs/runbooks/secret-inventory.md`
- `docs/runbooks/deployment-rollback.md`
- `docs/runbooks/closed-beta-runbook.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/implementation_plan.md`

## Key Changes

- `docs/production-readiness.md`: 기존 Capacitor/구버전 readiness를 Closed Beta go/no-go gate 중심으로 갱신했다.
- `docs/runbooks/secret-inventory.md`: Web, server/API, Mobile/EAS, Supabase Edge Function secret을 값 없이 inventory로 정리했다.
- `docs/runbooks/deployment-rollback.md`: Vercel, EAS, Supabase, Local-first kill switch rollback matrix를 추가했다.
- `docs/runbooks/closed-beta-runbook.md`: tester onboarding, daily smoke, feedback triage, privacy/data request, beta exit criteria를 정의했다.

## Verification

문서-only 변경이지만 release readiness 문서가 build/test 명령과 앱 설정을 참조하므로 아래 검증을 실행했다.

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter @nexvoy/core test` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |
| `pnpm build:mobile` | PASS |

## Follow-up

- 실제 Closed Beta 시작 전 Supabase 운영 migration list, RLS/RPC smoke, Android Internal Testing, iOS TestFlight, monitoring alert test 결과를 readiness 문서의 evidence로 남긴다.
- `/api/invite`, `/api/feedback`, `/api/places/photo/store` rate limiting은 별도 hardening task로 분리한다.

# Walkthrough: TASK-035 Full Integration Test Suite

## Summary

TASK-035는 Closed Beta 전 Local-first 제품 경로를 검증하기 위한 자동 테스트와 실기기 smoke runbook을 추가했다. 자동화는 deterministic한 Web document-primary 권한/reload와 observability payload safety에 집중했고, Web/Mobile/Mobile P2P 및 backup restore는 기기/network timing 의존성을 고려해 runbook 검증으로 고정했다.

## Artifacts

- `docs/refactor/tasks/TASK-035-full-integration-test-suite.md`
- GitHub Issue [#328](https://github.com/ysjee141/nexvoy-frontend/issues/328)
- PR [#329](https://github.com/ysjee141/nexvoy-frontend/pull/329)
- 브랜치: `feature/task-035-full-integration-test-suite-328`
- `apps/web/e2e/local-first-product.spec.ts`
- `apps/web/e2e/observability-safety.spec.ts`
- `docs/qa/local-first-integration-runbook.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/implementation_plan.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- `apps/web/e2e/fixtures/auth.ts`: owner/editor/viewer multi-user fixture와 사용자별 authenticated context factory 추가.
- `apps/web/e2e/helpers/supabase.ts`: 로컬 Supabase URL guard와 `*.onvoy.local` 테스트 유저 guard 추가.
- `apps/web/e2e/helpers/seed.ts`: local service role guard, accepted trip member seed, trip role lookup helper 추가.
- `apps/web/e2e/local-first-product.spec.ts`: document-primary mode에서 owner/editor/viewer 권한 UI와 checklist local document reload 검증.
- `apps/web/e2e/observability-safety.spec.ts`: Local-first 관측 이벤트가 raw document/identity/secret/key material을 거부하는지 검증.
- `docs/qa/local-first-integration-runbook.md`: Web/Web, Web/Mobile, Mobile/Mobile P2P, backup restore, offline reconnect smoke 절차 추가.

## Verification

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter @nexvoy/core test` | PASS |
| `pnpm --filter nexvoy-web exec tsc --noEmit` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |
| `pnpm build:mobile` | PASS |
| `pnpm --filter nexvoy-web test:e2e -- observability-safety.spec.ts` | PASS |
| `pnpm --filter nexvoy-web test:e2e -- local-first-product.spec.ts` | BLOCKED: `.env.test.local`이 remote Supabase host를 가리켜 local guard가 실행 중단 |

## Follow-up

- `local-first-product.spec.ts`는 로컬 Supabase(`localhost` 또는 `127.0.0.1`)로 `.env.test.local`을 맞춘 뒤 실행한다.
- Web/Mobile 및 Mobile/Mobile P2P, backup restore, offline reconnect는 `docs/qa/local-first-integration-runbook.md` 결과 표에 기록한다.

# Walkthrough: TASK-034 P2P All-domain Wiring

## Summary

TASK-034는 P2P fast path를 체크리스트 화면 전용 연결에서 Trip document 전체 lifecycle 연결로 승격했다. Web은 Trip detail 상위에서 한 번만 P2P connection을 유지하고, Mobile은 reconnect/backoff/timeout 처리를 보강했다.

## Artifacts

- `docs/refactor/tasks/TASK-034-p2p-all-domain-wiring.md`
- GitHub Issue [#326](https://github.com/ysjee141/nexvoy-frontend/issues/326)
- PR [#327](https://github.com/ysjee141/nexvoy-frontend/pull/327)
- 브랜치: `feature/task-034-p2p-all-domain-wiring-326`
- `apps/web/lib/local-first/webP2PDocumentConnection.ts`
- `_workspace/01_planner_analysis.md`
- `_workspace/implementation_plan.md`

## Key Changes

- Web P2P hook을 document-level `useWebP2PDocumentConnection()`으로 일반화했다.
- 기존 `useWebP2PChecklistConnection()`은 compatibility re-export로 유지했다.
- `TripLayoutClient`에서 일정/준비물/지도 탭 전체에 걸쳐 P2P connection을 유지한다.
- `ChecklistClient`는 자체 P2P 연결을 만들지 않고 상위 status를 표시한다.
- `TripClient`는 remote P2P update apply 후 IndexedDB broadcast로 일정 read model을 refresh한다.
- Mobile Trip screen에 reconnect backoff, handshake timeout, connection state failure handling을 추가했다.
- P2P fallback 문구를 backup sync 기준으로 정리했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm --filter nexvoy-web build` 성공
- `pnpm --filter nexvoy-app lint` 성공
- `pnpm build:mobile` 성공

## Notes

- 신규 Supabase migration/API Route는 없다.
- P2P payload는 기존 Yjs update protocol을 유지한다.
- late join에서 놓친 update는 TASK-033 encrypted backup sync fallback이 담당한다.
- `pnpm build:mobile` 중 `react-native-webrtc`의 `event-target-shim` exports fallback 경고가 출력됐지만 export는 성공했다.

---

# Walkthrough: TASK-033 Backup Sync Productization

## Summary

TASK-033은 Web/Mobile document-primary mutation 결과를 Supabase encrypted backup update 경로에 연결했다. P2P가 없거나 앱/브라우저가 종료되어도 owner/editor 변경분은 로컬 pending queue에 남고, 다음 foreground/startup에서 document key가 준비되면 암호화된 update로 업로드된다.

## Artifacts

- `docs/refactor/tasks/TASK-033-backup-sync-productization.md`
- GitHub Issue [#324](https://github.com/ysjee141/nexvoy-frontend/issues/324)
- PR [#325](https://github.com/ysjee141/nexvoy-frontend/pull/325)
- 브랜치: `feature/task-033-backup-sync-productization-324`
- `packages/core/src/sync/backupQueue.ts`
- `apps/web/lib/local-first/backupSyncService.ts`
- `apps/mobile/lib/local-first/mobileBackupSyncService.ts`
- `apps/mobile/lib/local-first/mobileBackupQueueStore.ts`
- `_workspace/01_planner_analysis.md`
- `_workspace/implementation_plan.md`

## Key Changes

- core에 pending backup update 암호화 helper와 safe failure reason mapping을 추가했다.
- Web IndexedDB에 `backupQueues` store를 추가하고 Trip mutation 후 pending update를 durable하게 저장한다.
- Mobile AsyncStorage backup queue를 추가하고 Trip mutation 후 pending update를 durable하게 저장한다.
- Web/Mobile document-primary publisher에서 owner/editor 변경만 backup enqueue 대상으로 연결했다.
- Web visibility 복귀, Mobile foreground/provisioning 경로에서 pending queue flush를 실행한다.
- 실패 관측은 `local_first_backup_failed`에 generic reason code와 pending count만 남긴다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-web build` 성공
- `pnpm typecheck` 성공
- `pnpm build:mobile` 성공

## Notes

- 신규 Supabase migration/API Route는 없다.
- 이번 slice는 durable encrypted update upload/retry 제품 경로에 집중했다. full snapshot compaction worker와 remote pull/replay UX는 후속 통합 검증에서 이어서 보강한다.
- `pnpm build:mobile` 중 `react-native-webrtc`의 `event-target-shim` exports fallback 경고가 출력됐지만 export는 성공했다.

---

# Walkthrough: TASK-032 Mobile Full Document-primary Transition

## Summary

TASK-032는 Mobile의 trip detail, 준비물, 일정, 템플릿, collaborator member snapshot을 document-primary repository 경로로 전환했다. Mobile AsyncStorage 기반 Trip/Template document store를 추가했고, owner/editor 화면에서는 `connectMobileP2PPeer()`를 screen lifecycle과 AppState foreground/background에 연결했다.

## Artifacts

- `docs/refactor/tasks/TASK-032-mobile-full-document-primary-transition.md`
- GitHub Issue [#322](https://github.com/ysjee141/nexvoy-frontend/issues/322)
- 브랜치: `feature/task-032-mobile-full-document-primary-transition-322`
- `apps/mobile/lib/local-first/mobileDocumentStores.ts`
- `apps/mobile/lib/local-first/documentPrimaryRepositories.ts`
- `apps/mobile/lib/local-first/documentPrimaryAdapters.ts`
- `_workspace/01_planner_analysis.md`
- `_workspace/implementation_plan.md`

## Key Changes

- Mobile AsyncStorage Yjs update 저장소를 `LocalDocumentStore` contract로 감싸 Trip/Template document repository에 주입했다.
- Trip legacy row bundle과 checklist template rows를 최초 진입 시 document로 hydrate하는 Mobile bridge를 추가했다.
- Mobile trip detail의 trip/plans/checklist/member read path와 일정/준비물 mutations를 document-primary repository로 전환했다.
- Mobile template list/create/edit/delete/share management를 Template document repository 경유로 전환했다.
- collaborator role 변경/revoke 후 Trip document member snapshot을 upsert/revoke하도록 연결했다.
- trip screen에서 Mobile P2P connection을 자동 시도하고, background cleanup/foreground reconnect 및 상태 표시를 추가했다.

## Verification

- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-app lint` 성공
- `pnpm build:mobile` 성공

## Notes

- 신규 Supabase migration/API Route는 없다.
- `pnpm build:mobile` 중 `react-native-webrtc`의 `event-target-shim` exports fallback 경고가 출력됐지만 export는 성공했다.
- Android preview APK 설치/Logcat smoke는 이번 세션에서 실행하지 못했다. TASK-035 full integration/mobile smoke에서 이어서 검증한다.

---

# Walkthrough: TASK-031 Web Full Document-primary Transition

## Summary

TASK-031은 Web의 일정, 준비물, 템플릿, 동행자/권한 UI를 document-primary repository 경로로 전환했다.
legacy Supabase row는 최초 hydrate/read-only fallback과 registry authority 작업에만 남겼다.

## Artifacts

- `docs/refactor/tasks/TASK-031-web-full-document-primary-transition.md`
- `apps/web/lib/local-first/webDocumentStores.ts`
- `apps/web/lib/local-first/documentPrimaryRepositories.ts`
- `apps/web/lib/local-first/documentPrimaryChecklistRepository.ts`
- `_workspace/01_planner_analysis.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- Web IndexedDB Yjs update 저장소를 `LocalDocumentStore` contract로 감싸 Trip/Template document repository에 주입했다.
- Trip legacy row bundle과 checklist template row/share/item을 최초 진입 시 document로 hydrate하는 bridge를 추가했다.
- 일정 목록/생성/수정/삭제/방문 상태/이미지 URL 복구를 Plan repository mutation으로 연결했다.
- 준비물 CRUD/toggle/template apply를 document-primary checklist repository 경유로 연결했다.
- 템플릿 목록/생성/수정/삭제/적용을 Template document repository로 전환했다.
- 동행자 registry 조회/role 변경/revoke 후 Trip document member snapshot을 upsert/revoke하도록 연결했다.
- mutation actor role을 호출부에서 주입해 viewer write 차단 정책이 유지되도록 했다.

## Verification

- `pnpm --filter nexvoy-web exec tsc --noEmit` 성공
- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공

## Notes

- 신규 Supabase migration/API Route는 없다.
- Mobile 화면 전환은 TASK-032 범위로 유지했다.
- Template share registry write는 기존 Supabase helper를 유지한다. document share snapshot productization은 후속 정리 대상이다.

---

# Walkthrough: TASK-030 Document-primary Repository Layer

## Summary

TASK-030은 Web/Mobile 화면 전환 전에 공유할 document-primary repository layer를 `@nexvoy/core`에 추가했다.
기존 legacy repository contract는 유지하면서, Trip/Plan/Checklist/Template/Member용 document-primary
contract와 순수 mutation writer를 병렬로 제공한다.

## Artifacts

- `docs/refactor/tasks/TASK-030-document-primary-repository-layer.md`
- `packages/core/src/local-first/templateDocument.ts`
- `packages/core/src/local-first/documentMutationWriter.ts`
- `packages/core/src/repositories/documentPrimaryRepository.ts`
- `packages/core/src/local-first/__tests__/templateDocument.test.ts`
- `packages/core/src/repositories/__tests__/documentPrimaryRepository.test.ts`
- `implementation_plan.md`
- `_workspace/01_planner_analysis.md`

## Key Changes

- `TemplateDocumentV1` boundary를 추가하고 Yjs update round-trip helper를 구현했다.
- `DocumentMutationResult`, `DocumentMutationPublisher`, `LocalDocumentStore` contract를 추가해 P2P publish와 backup enqueue 경계를 repository level로 고정했다.
- Trip document mutation writer를 추가했다: trip update/delete, plan create/update/delete/url, checklist/checklist item create/update/delete/toggle/template apply, member upsert/revoke.
- Template document mutation writer를 추가했다: template update/delete, item replace, share upsert/remove.
- `createDocumentPrimaryRepositoryBundle()`을 추가해 Web/Mobile adapter가 store/runtime만 주입하면 같은 repository contract를 사용할 수 있게 했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공

## SQL / Query Files

이번 TASK-030에서 새 Supabase migration/query 파일은 만들지 않았다. 실행해야 할 SQL 파일은 없다.

## Next

- `TASK-031-web-full-document-primary-transition.md`: Web 준비물/일정/템플릿/동행자 UI를 document-primary repository로 전환
- `TASK-032-mobile-full-document-primary-transition.md`: Mobile 동일 전환

---

# Walkthrough: TASK-029 Full Local-first Product Scope ADR

## Summary

TASK-029는 checklist pilot 이후의 작업 축을 전체 제품 document-primary 전환으로 확정했다. ADR-013에서
Web/Mobile의 준비물, 일정, 템플릿, 동행자 초대/수락/거부, 권한 변경, backup restore/sync, P2P fast path를
모두 Local-first 완료 범위로 정의했다.

## Artifacts

- `docs/refactor/tasks/TASK-029-full-local-first-product-scope-adr.md`
- `docs/refactor/adrs/ADR-013-full-local-first-product-scope.md`
- `docs/refactor/progress.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- `_workspace/01_planner_analysis.md`

## Key Decisions

- `TripDocumentV1`은 trip-scoped 데이터의 root document로 유지한다.
- 개인/공유/공개 템플릿은 trip collaborator 범위와 다르므로 별도 `TemplateDocumentV1` boundary로 분리한다.
- 템플릿 적용은 Template document snapshot을 읽어 `TripDocumentV1` checklist item mutation으로 복사한다.
- Supabase row table은 장기 dual-write 대상이 아니라 migration source와 read-only rollback fallback으로 축소한다.
- 통합테스트와 Closed Beta는 일부 기능이 아니라 전체 핵심 기능이 document-primary 제품 경로에 올라간 뒤 진행한다.

## Verification

- `git diff --check` 성공
- 문서 변경만 수행했고 코드/DB migration/API 변경은 없다.

## Next

- `TASK-030-document-primary-repository-layer.md`: checklist/plans/templates/members 공통 document-primary repository 계약 도입

---

# Walkthrough: TASK-028 Rotating Room Secret Hardening

## Summary

TASK-028은 P2P signaling room topic을 deterministic `sha256(documentId)`에서 server-issued opaque topic으로 전환했다. 클라이언트는 `issue_document_signaling_room_topic` RPC로 active topic을 받은 뒤 Supabase Realtime private channel에 join하며, Realtime Authorization RLS는 active server-issued topic만 허용한다.

## Artifacts

- `docs/refactor/tasks/TASK-028-rotating-room-secret-hardening.md`
- `implementation_plan.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/02c_backend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- `supabase/migrations/20260714000001_task028_rotating_signaling_room_topics.sql`(신규): `document_signaling_room_topics` table, topic issuing RPC, active topic permission helpers, Realtime Authorization policy 교체.
- `packages/core/src/sync/signalingChannel.ts`: rotating topic derivation helper와 topic format validator 추가. legacy deterministic helper는 rollback/test compatibility를 위해 유지.
- `apps/web/lib/local-first/signalingChannel.ts`: deterministic topic derivation 대신 server-issued topic fetch 후 Realtime channel join.
- `apps/mobile/lib/local-first/signalingChannel.ts`: Web과 동일하게 RPC-issued topic을 사용하도록 변경.
- `docs/refactor/tasks/README.md`, `TASK-028`: TASK-028 완료 상태와 구현 결과 반영.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm --filter nexvoy-app lint` 성공. 기존 Mobile 파일 warning 7건은 이번 변경과 무관하다.
- `pnpm build:mobile` 성공

## Rollback

이번 PR을 되돌리면 TASK-025/026의 deterministic topic policy와 client derivation으로 복귀한다. 신규 topic table은 document content와 독립적이므로, rollback 시 사용 중지만으로 충분하다.

## Notes

- topic 원문은 RPC 응답과 Realtime join에만 사용하고 observability/UI/log에는 남기지 않는다.
- 만료 2분 이내에는 새 topic을 발급하고 기존 unexpired topic은 자연 만료까지 유지해 old/new overlap window를 제공한다.
- P2P late join/peer discovery 개선은 별도 후속 작업이다.

---

# Walkthrough: TASK-026 P2P Connection Lifecycle Hardening

## Summary

TASK-026은 Web 준비물 P2P fast path의 실사용 생명주기를 보강했다. 연결 실패/끊김/timeout 시 bounded exponential backoff로 재연결을 시도하고, 최대 재시도 초과 시 기존 방식 동기화 상태로 수렴한다. 브라우저 탭 종료/새로고침 및 React cleanup에서는 signaling channel, data channel, peer connection, retry timer를 정리한다.

Rotating room secret hardening은 signaling topic derivation, Supabase Realtime Authorization RLS, server-issued secret, Web/Mobile adapter migration이 함께 필요한 별도 migration이므로 TASK-028로 분리했다.

## Artifacts

- `docs/refactor/tasks/TASK-026-p2p-connection-lifecycle-hardening.md`
- `docs/refactor/tasks/TASK-028-rotating-room-secret-hardening.md`
- `implementation_plan.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- `packages/core/src/sync/p2pLifecycle.ts`(신규): platform-independent reconnect policy helper. max attempts, initial/max delay, multiplier normalization 및 delay 계산을 제공한다.
- `apps/web/lib/local-first/webP2PChecklistConnection.ts`: Web checklist P2P 연결에 reconnect/backoff, connection timeout 재시도, page lifecycle cleanup, reconnect observability event를 추가했다.
- `apps/web/lib/local-first/webP2PConnection.ts`: connection `close()`를 idempotent하게 만들어 중복 cleanup에서 부작용 없이 종료되도록 했다.
- `apps/mobile/lib/local-first/webP2PConnection.ts`: Mobile offer retry timer cleanup과 idempotent close를 보강하고, 연결 상태 조회 hook을 추가했다.
- `apps/mobile/lib/local-first/p2pLifecycle.native.ts`(신규): AppState background 진입 시 active P2P connection cleanup, foreground 복귀 시 reconnect callback을 호출할 수 있는 lifecycle binding을 추가했다.
- `packages/core/src/sync/iceServers.ts`, `packages/core/src/observability/events.ts`: `p2p_reconnect_scheduled`, `p2p_reconnect_attempted`, `p2p_reconnect_exhausted`, `p2p_lifecycle_cleanup` 이벤트를 추가했다.
- `docs/refactor/tasks/README.md`: TASK-026 완료 상태와 TASK-028 후속 작업을 반영했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm --filter nexvoy-app lint` 성공. 기존 Mobile 파일 warning 7건은 이번 변경과 무관하다.
- `pnpm build:mobile` 성공

## Rollback

`useWebP2PChecklistConnection()`의 reconnect/lifecycle handling을 TASK-025 수준으로 되돌리고, 신규 `p2pLifecycle` helper와 Mobile lifecycle hook point를 제거하면 된다. 이번 PR은 signaling topic/RLS를 변경하지 않으므로 데이터 migration rollback은 필요 없다.

## Notes

- Rotating room secret은 TASK-028로 분리했다. 현재 PR은 deterministic signaling topic + Realtime Authorization RLS 모델을 유지한다.
- Mobile lifecycle hook은 아직 화면 자동 연결에 직접 wiring하지 않았다. Mobile P2P adapter 사용 지점이 생길 때 close/reconnect callback을 연결하는 boundary다.
- 일정 add/delete P2P는 아직 범위 밖이다.

---

# Walkthrough: TASK-025 P2P Connection Status UI

## Summary

TASK-025는 Web 준비물 화면에서 P2P fast path를 자동으로 시도하고, 사용자에게 연결 상태를 기술 용어 없이 표시하도록 배선했다. `NEXT_PUBLIC_LOCAL_FIRST_CHECKLIST_SPIKE=1` 또는 `NEXT_PUBLIC_LOCAL_FIRST_CHECKLIST_DUAL_WRITE=1` 모드에서 accepted owner/editor 계정은 준비물 화면 진입 시 P2P 연결을 시도한다. 실패하거나 대상이 아니면 기존 방식으로 동기화 중이라는 generic 상태로 수렴한다.

## Artifacts

- `docs/refactor/tasks/TASK-025-p2p-connection-status-ui.md`
- `implementation_plan.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/01b_ux_design.md`
- `_workspace/02a_ui_components.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- `apps/web/components/trips/P2PConnectionStatusBadge.tsx`(신규): 연결 중/연결됨/fallback 상태를 compact badge로 표시. `role="status"`/`aria-live="polite"` 적용.
- `apps/web/lib/local-first/webP2PChecklistConnection.ts`(신규): 준비물 화면 전용 P2P connection hook. owner/editor accepted 사용자만 연결 대상이며 writable member id 정렬로 initiator를 결정한다.
- `apps/web/app/trips/checklist/ChecklistClient.tsx`: local-first checklist spike/dual-write 모드에서 P2P 연결을 자동 시도하고, IndexedDB document update subscription을 dual-write에도 적용한다.
- `packages/core/src/repositories/dualWriteChecklistRepository.ts`: dual-write `getChecklist()`를 local document 우선으로 변경하고, 실패 시 mismatch report 후 legacy read로 fallback한다. 이 변경으로 P2P로 받은 Yjs update가 준비물 화면 read path에 반영된다.
- `docs/refactor/tasks/README.md`: TASK-025 완료 상태와 다음 권장 순서를 TASK-026으로 갱신.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공. 최초 실행은 hook type narrowing 오류로 실패했고 타입 가드 수정 후 통과.
- `pnpm build:mobile` 성공
- `pnpm --filter nexvoy-app lint` 성공. 기존 warning 7건은 이번 변경과 무관한 기존 Mobile 파일 경고.

## Rollback

준비물 화면의 `useWebP2PChecklistConnection()` 호출과 `P2PConnectionStatusBadge` 렌더링을 제거하면 UI/자동 연결 시도는 사라진다. P2P core/data-channel 구현과 Mobile TASK-027 adapter는 영향받지 않는다. dual-write read path 변경을 되돌리면 dual-write 화면은 다시 legacy read 기준으로 돌아가며, P2P remote update 실시간 화면 반영은 제한된다.

## Notes

- 같은 Supabase userId로 두 브라우저를 열면 현재 signaling 구현이 동일 `senderId` 메시지를 무시하므로 Web-to-Web P2P 연결 검증이 어렵다. 실검증은 서로 다른 accepted owner/editor 계정 2개로 수행해야 한다.
- viewer는 signaling answer를 보낼 수 없으므로 이번 자동 연결 대상에서 제외했다.
- reconnect/background/tab-close hardening은 TASK-026 범위다.
- 일정 add/delete P2P는 아직 범위 밖이다.

---

# Walkthrough: TASK-027 Mobile Yjs Runtime Adapter

## Summary

TASK-024에서 Web-to-Web으로만 교환하던 Yjs update fast path를 Mobile platform boundary까지 확장했다. Mobile은 별도 JSON/patch format을 만들지 않고 `@nexvoy/core/local-first/yjsTripDocument`의 canonical Yjs update helper를 `apps/mobile/lib/local-first/mobileYjsTripDocument.ts` 안에서만 감싼다. RN/Expo 의존성은 Mobile adapter에만 두고, `packages/core`에는 platform API를 추가하지 않았다.

## Artifacts

- `docs/refactor/tasks/TASK-027-mobile-yjs-runtime-adapter.md`
- `implementation_plan.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/02b_frontend_changes.md`

## Key Changes

- `apps/mobile/lib/local-first/mobileYjsTripDocument.ts`(신규): Mobile Yjs runtime adapter. Web helper와 같은 create/read/write/apply/encode 계약을 제공하고 encoded Yjs update를 AsyncStorage에 저장/로드한다.
- `apps/mobile/lib/local-first/p2pUpdateBridge.ts`(신규): document별 active sender registry와 remote update apply bridge. P2P 실패는 optional fast path 특성대로 backup/restore fallback을 깨지 않는다.
- `apps/mobile/lib/local-first/webRtcProvider.native.ts`: 기존 ping/pong handshake 위에 TASK-024 `yjs-update`/`yjs-update-chunk` protocol parse/send를 추가했다.
- `apps/mobile/lib/local-first/webP2PConnection.ts`: `P2PUpdateReassembler`로 data channel update를 재조립한 뒤 Mobile Yjs store에 apply한다. sender unregister와 reassembler cleanup을 error/close 경로에 모두 배치했다.
- `apps/mobile/lib/local-first/documentBootstrapService.ts`: Mobile owner bootstrap snapshot plaintext를 JSON marker에서 Yjs encoded update로 변경하고, bootstrap 직후 local Yjs store에도 저장한다.
- `apps/mobile/lib/local-first/mobileSnapshotRestoreService.ts`: decrypt/hash 검증을 통과한 opaque snapshot plaintext를 Mobile Yjs store에 apply한다. raw error는 기존 generic restore failure 경로로만 매핑된다.
- `apps/mobile/package.json`: Metro dependency graph가 transitive workspace dependency에 기대지 않도록 `yjs`를 Mobile app dependency로 명시했다.
- `apps/mobile/metro.config.js`, `apps/mobile/lib/local-first/yjsWebcryptoShim.js`: `lib0`의 RN webcrypto import(`isomorphic-webcrypto/src/react-native`)를 기존 `react-native-quick-crypto` 기반 shim으로 해석해 native build dependency를 추가하지 않고 Metro export를 통과시켰다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공. 최초 실행은 `lib0`가 `isomorphic-webcrypto/src/react-native`를 찾지 못해 실패했고, Metro exact alias + quick-crypto shim 추가 후 Web/iOS/Android export가 모두 통과했다.

## Rollback

`connectMobileP2PPeer()`의 update wiring과 `p2pUpdateBridge.ts` registration을 제거하면 Mobile은 TASK-023 수준의 signaling/data-channel handshake로 되돌아간다. `mobileYjsTripDocument.ts` persistence는 앱 내부 AsyncStorage key만 사용하므로 서버 데이터 정리는 필요 없다. Web-to-Web TASK-024 경로는 영향받지 않는다.

## Notes

- 실제 Web-Mobile/Mobile-Mobile data-channel 교환과 Android dev client Logcat 검증은 실기기/에뮬레이터가 필요하다. 이번 세션의 자동 검증은 Metro export build와 TypeScript/build 검증으로 수행했다.
- Mobile checklist 화면의 기존 Supabase row write path를 document-primary Yjs writer로 전환하는 작업은 이번 범위가 아니다. 이번 task는 runtime adapter, restore, P2P apply/publish boundary를 마련한다.

---

# Walkthrough: TASK-020 Mobile Encrypted Snapshot Restore

## Summary

`TASK-008`은 Web 기준 snapshot download → 복호화 → hash 검증 → Yjs updates replay 순서의 restore를 구현했지만, 이 restore 파이프라인 전체가 Yjs/lib0(`isomorphic-webcrypto` 의존)에 묶여 있어 React Native 번들에서 재사용할 수 없었다. TASK-020은 Yjs에 의존하지 않는 부분(snapshot 복호화, hash 검증)만 분리한 Mobile 전용 restore 경로를 구현하고, `TASK-019`의 owner bootstrap/provisioning 완료 흐름에 자동 재시도를 연결했다. updates replay(Web/Yjs 기반 최신 콘텐츠 반영)는 이번 범위에서 제외했다.

## Artifacts

- `docs/refactor/tasks/TASK-020-mobile-encrypted-snapshot-restore.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/01b_ux_design.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/02c_backend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_report.md`

## Key Changes

- `packages/core/src/sync/backupPayloadCodec.ts`(신규): `restore.ts`와 `documentBootstrapService.ts`가 중복 구현하던 base64/JSON envelope 직렬화 로직을 SSOT로 승격. Yjs/lib0 import 없음.
- `packages/core/src/sync/mobileRestore.ts`(신규): Yjs 비의존 `decryptRestoreSnapshot` — snapshot 복호화 + hash 검증만 수행하고 `document_updates`는 다루지 않는다. 복호화된 평문을 JSON.parse 시도해 `mobile_marker`(TASK-019 bootstrap이 만든 marker payload) vs `opaque`(Web/Yjs 인코딩) snapshot을 판별한다.
- `packages/core/src/sync/restore.ts`: 신규 codec 모듈을 재사용하도록 리팩터링(public API/동작 불변, `restore.test.ts` 그대로 통과).
- `apps/mobile/lib/local-first/mobileSnapshotRestoreService.ts`(신규): `restoreMobileEncryptedSnapshot()` — snapshot 존재 확인 → 이 device의 DEK 확보 → 복호화/hash 검증 → 성공 시 device-scoped RSA row가 없으면 `bootstrapMobileDeviceDocumentKey`(TASK-019) 호출. 모든 실패는 raw error 없이 generic reason code(`hash_mismatch`/`decrypt_failed`/`unknown`/`no_snapshot`/`key_unavailable`)로만 반환.
- `apps/mobile/lib/local-first/keyProvisioningService.ts`: `runMobileKeyProvisioning`에 restore 재시도 트리거 2곳 연결(owner bootstrap 직후, 다른 멤버 요청을 이번 실행에서 completed 처리한 직후). 두 트리거가 steady-state에서 중복 발화하던 문제(리뷰 M1)를 트리거 2 조건을 `result.completed > 0`으로 좁혀 해결 — 실행당 최대 1회만 restore 시도.
- `apps/mobile/app/trip/[id].tsx`: `mobileRestoreStatus` state(기존 `keyProvisioningMessage`와 완전히 분리)와 `CollaboratorSheet`의 신규 "이 기기 데이터 상태" 블록(owner+editor 모두, `canEditContent` 기준 노출) — 진행/성공(mobile_marker)/부분 성공(opaque, 콘텐츠 미반영)/실패 4가지 tone을 raw error 없이 generic copy로 표시.

## Verification

- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm --filter @nexvoy/core test`(`restore.test.ts` 포함 회귀) 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-app lint` 성공, 신규 코드에 대한 경고 없음(기존 warning 6건은 무관한 기존 라인)
- `pnpm build` 성공 (Web)
- `pnpm build:mobile` 성공 (Web/iOS/Android 3개 플랫폼 번들, Hermes bytecode에 신규 모듈 심볼/카피 포함 확인)
- `backupPayloadCodec.ts`/`mobileRestore.ts`에 Yjs/lib0 import 없음(소스/번들 양쪽 grep 확인)
- reviewer 최종 APPROVE (1회 REQUEST_CHANGES → M1 수정 후 재리뷰 APPROVE)
- qa-engineer 최종 PASS

## Rollback

Mobile restore 재시도 트리거(`keyProvisioningService.ts`의 두 지점)를 비활성화하고 기존 `owner_device_key_unavailable` pending UX로 되돌린다. `restoreMobileEncryptedSnapshot`은 읽기 전용(복호화+검증)이며 `document_key_provisioning_requests`나 서버 상태를 갱신하지 않으므로, 트리거만 끄면 부작용 없이 이전 동작으로 복귀한다.

## Notes

- raw DEK/KEK/private key/document content/CRDT blob은 로그/analytics/push/UI에 노출하지 않는다. restore 실패는 generic reason code로만 UX에 전달된다.
- `document_updates` replay(Web에서 편집된 최신 콘텐츠를 Mobile에 반영)는 이번 범위 밖이다 — opaque(Web/Yjs) snapshot은 decrypt+hash 검증까지만 성공하고 콘텐츠는 반영되지 않으며, UX는 이를 "복구 완료"와 구분되는 별도 카피("여정 데이터 확인이 끝났어요. 최신 내용은 곧 이 기기에도 반영돼요.")로 안내한다.
- Web First 원칙과의 긴장 관계는 TASK-019와 동일한 근거(Yjs/webcrypto의 RN 미지원)로 정당화된다고 reviewer가 판단했으나, `docs/adrs/`에 이 예외를 명시하는 ADR 추가는 비블로킹 권고 사항으로 남겼다.
- 실기기/에뮬레이터/Preview APK 기반 검증(editor 기기 restore 실측, hash mismatch UX, offline 재시도 무오염, progress 깜빡임 육안 확인)은 이번 세션 환경 제약으로 수행하지 못했다 — 후속 수동 검증 필요.
- 다음 권장 작업은 별도로 지정될 예정이다(예: Web/Yjs 기반 updates replay를 Mobile에 지원하는 후속 task).

---

# Walkthrough: WebRTC 동작 확인 조사 (2026-07-12)

## Summary

"지금 WebRTC가 실제로 잘 동작하는지 눈으로 보고 싶다"는 요청에서 시작한 조사. 코드베이스 확인 결과, 두 기기가 실제 P2P 연결을 맺어 데이터를 주고받는 흐름은 아직 배선되어 있지 않다. ADR-002에서 결정한 "optional fast path"의 하부 부품(ICE 설정 발급, 피어 커넥션 팩토리, 시그널링 권한 검증)만 존재하고, 실제 시그널링 채널/데이터 채널/소비처(consumer)는 없다. 사용자가 나중에 검증 방식을 선택해 진행할 수 있도록 현황과 옵션을 정리한다.

## Findings — 구현됨 (스캐폴딩만 존재)

| 파일 | 역할 |
|------|------|
| `supabase/functions/ice-servers/index.ts` | Cloudflare TURN/STUN 자격증명 발급 Edge Function. 인증된 사용자에게 ICE 서버 정보 반환. TURN 키 없거나 Cloudflare 요청 실패 시 STUN-only로 폴백 |
| `apps/web/lib/local-first/webRtcProvider.ts` | 웹용 `RTCPeerConnection` 생성 팩토리. `connectionstatechange` 관찰, direct/relay 판별, 관측 이벤트(`p2p_connected` 등) 발행 |
| `apps/mobile/lib/local-first/webRtcProvider.native.ts` | 모바일용 동일 역할 (react-native-webrtc 기반, ADR-002 Option B 채택) |
| `packages/core/src/sync/signalingPermissions.ts` | 시그널링 룸 join 가능 여부 판단하는 순수 권한 로직 (문서 멤버십/역할/룸 시크릿 검증) |
| `packages/core/src/sync/iceServers.ts` | ICE 서버 설정 타입/유틸 (TTL 클램핑, 포트 53 필터링, TURN 존재 여부 판별 등) |

## Findings — 빠짐 (아직 없음)

- **실제 시그널링 채널**: SDP offer/answer를 두 기기 간 주고받는 WebSocket/Supabase Realtime 로직 없음
- **데이터 채널**: `createDataChannel` / `ondatachannel` 사용 코드가 코드베이스 전체에 전혀 없음
- **Provider의 소비처(consumer)**: `createWebRtcProvider` / `createMobileWebRtcProvider`를 실제로 호출하는 곳이 코드베이스 어디에도 없음 (정의만 있고 미사용)
- **UI 트리거**: P2P 연결을 시작하는 화면/버튼/서비스 로직 없음

관련 TASK 문서: `docs/refactor/tasks/TASK-009-mobile-webrtc-native-feasibility.md`, `docs/refactor/tasks/TASK-010-cloudflare-ice-config.md`. 최근 완료분은 TASK-020이며, 시그널링/데이터채널을 다루는 TASK는 아직 없음.

## Options considered (검증 방식 — 사용자 선택 대기 중)

1. **ICE 서버 발급만 테스트** — `supabase/functions/ice-servers`를 로컬(`supabase functions serve`) 또는 배포본에 curl로 요청해 Cloudflare TURN 자격증명이 실제 발급되는지 확인. 연결 자체는 확인 불가하지만 가장 빠름.
2. **단발성 수동 P2P 테스트 스크립트 작성** — 브라우저 두 탭(또는 web+mobile)에서 `createWebRtcProvider`를 직접 호출하고 SDP offer/answer를 콘솔에서 수동 교환하는 임시 테스트 코드를 작성해 실제 `connected` 상태까지 확인.
3. **실제 시그널링+데이터채널 기능부터 구현** — `onvoy-develop` 파이프라인으로 시그널링 채널과 데이터 채널을 포함한 실제 P2P 동기화 기능을 새 TASK로 설계/구현.
4. **현재 유닛 테스트만 실행** — `iceServers.test.ts`, `signalingPermissions.test.ts` 등 기존 로직 테스트만 돌려서 회귀 여부만 확인 (실제 동작 확인은 아님).

## Notes

- 사용자가 나중에 위 옵션 중 하나를 선택해 진행할 예정. 재개 시 이 섹션을 참고해 옵션을 다시 확인할 것.
- 관련 ADR: ADR-002 (모바일 WebRTC는 Option B — EAS Build + react-native-webrtc, optional fast path).

---

# Walkthrough: TASK-021 Web Signaling Channel and Data Channel Handshake

## Summary

위 조사에서 이어진 작업. `TASK-009`/`TASK-010`이 만든 WebRTC 부품(peer connection factory, ICE config
발급, signaling 권한 로직)은 있었지만 실제로 두 기기를 연결하는 배선이 전혀 없었다. `ADR-012`로
시그널링 전송 계층을 Supabase Realtime Broadcast(private channel + Realtime Authorization)로 결정하고,
`TASK-021`에서 Web-to-Web 연결을 실제로 배선했다. Mobile 배선과 Yjs update 실제 교환은 범위 밖이며,
데이터 채널은 연결 증명(ping/pong handshake)까지만 다룬다. 토큰 사용량을 고려해 서브에이전트 없이
메인 세션에서 직접 구현했고, 각 파일 단위로 커밋을 쪼개 중간에 세션이 끊겨도 재개 가능하도록 했다.

## Artifacts

- `docs/refactor/adrs/ADR-012-p2p-signaling-transport-supabase-realtime-broadcast.md`
- `docs/refactor/tasks/TASK-021-web-signaling-channel-and-data-channel-handshake.md`
- GitHub Issue [#299](https://github.com/ysjee141/nexvoy-frontend/issues/299)
- 브랜치: `feature/task-021-web-signaling-channel-and-data-channel-handshake-299`

## Key Changes

- `supabase/migrations/20260712000001_task021_signaling_realtime_authorization.sql`(신규):
  `realtime.messages` Authorization RLS. accepted 멤버는 수신 가능, accepted owner/editor만 송신
  가능(viewer는 read-only). 기존 `public.document_registry_hash()`를 재사용해 room topic을
  `signaling:<sha256-hex(documentId)>`로 파생 — 별도 해시 함수를 새로 만들지 않았다.
- `packages/core/src/sync/signalingChannel.ts`(신규): offer/answer/ice-candidate 메시지 타입, 방어적
  파싱, `deriveSignalingRoomTopic()`. `encryption.ts`의 `BackupCryptoProvider`와 동일한 패턴으로
  `SubtleCrypto`를 주입받아 core 패키지에 플랫폼 API를 넣지 않는다. `index.ts`/`package.json`
  exports·test 스크립트에 등록.
- `apps/web/lib/local-first/signalingChannel.ts`(신규): Supabase Realtime Broadcast private channel에
  join. `validateSignalingJoinPolicy()`는 client-side fail-fast guard로만 쓰고(`decision.allowed`가
  false면 채널 구독 자체를 하지 않음), 실제 접근 통제 경계는 Realtime Authorization RLS.
- `apps/web/lib/local-first/webRtcProvider.ts`: `createHandshakeDataChannel()`/
  `wireHandshakeDataChannel()` 추가 — `{type, ts}` 고정 스키마의 ping/pong 왕복과
  `p2p_data_channel_open` 관측 이벤트.
- `apps/web/lib/local-first/webP2PConnection.ts`(신규): `connectWebP2PPeer()` — signaling channel과
  webRtcProvider를 잇는 최초의 실제 소비처. SDP offer/answer·ICE candidate 교환, initiator/answerer에
  따른 데이터 채널 배선, signaling 거부 시 `WebP2PSignalingDeniedError`로 명시적 실패, viewer는
  `isInitiator`가 잘못 전달돼도 offer를 보낼 수 없도록 이중 방어(client no-op + server RLS).
- `packages/core/src/sync/iceServers.ts`: `P2PObservabilityEventName`에 `p2p_signaling_joined`/
  `p2p_data_channel_open` 추가.

## Verification

- `pnpm --filter @nexvoy/core test` 성공 (signalingChannel.test.ts 신규 포함)
- `pnpm --filter @nexvoy/core typecheck`, `@nexvoy/types`, `@nexvoy/design-tokens` typecheck 성공
- `pnpm --filter nexvoy-app typecheck` 성공, `pnpm --filter nexvoy-app lint` 성공(기존 warning 7건은
  이번 변경과 무관한 기존 라인)
- `pnpm build` 성공 (Web, Next.js TypeScript 체크 포함)
- `pnpm build:mobile` 성공 (Web/iOS/Android 3개 플랫폼 번들)
- 커밋을 7개 단위(문서, RLS migration, core 모듈, Web 어댑터, data channel 배선, provider 조립,
  빌드 검증)로 쪼개 진행 — 각 커밋 시점에 typecheck/test 통과를 확인해 중간에 세션이 끊겨도 안전하게
  재개 가능한 상태를 유지했다.

## Rollback

- signaling channel 조립 지점(`webP2PConnection.ts`)을 호출하는 곳이 없으므로 파일을 되돌리거나
  제거해도 기존 기능에 영향이 없다.
- `20260712000001_task021_signaling_realtime_authorization.sql`을 되돌려도(RLS policy 제거) 기존
  `document_members` 기반 REST/RPC 권한 검증에는 영향이 없다.
- 신규 코드는 모두 미사용 상태(진입점 없음)이므로 롤백 시 별도 데이터 정리가 필요 없다.

## Notes

- **실기기/실브라우저 검증 미수행**: 같은 문서의 accepted 상태 두 브라우저 세션으로 실제
  `RTCPeerConnection.connectionState === 'connected'` 도달과 ping/pong 왕복을 눈으로 확인하는 절차
  (TASK-021 검증 방법의 항목 7)는 이번 세션에서 수행하지 못했다. 로컬 Supabase 스택 기동(Realtime
  Authorization 포함)과 두 세션 수동 테스트가 필요하며, 자동화된 typecheck/test/build만으로는 실제
  네트워크 연결 성공을 보장하지 않는다.
- `connectWebP2PPeer()`를 호출하는 UI 진입점은 이번 TASK 범위에 없다. 수동 검증 시 임시 트리거
  코드나 최소 테스트 페이지가 필요하다.
- signaling broadcast payload와 데이터 채널 handshake payload에는 document content나 CRDT 데이터를
  담지 않는다(고정 스키마만 사용).
- Yjs update를 데이터 채널로 실제 교환하는 것과 Mobile 시그널링 배선은 명시적으로 범위 밖이며 후속
  TASK로 이관되어 있다.

---

# Walkthrough: TASK-022 Document Registry Bootstrap for Regular Trips

## Summary

TASK-021 수동 검증 준비 중 일반 로그인 사용자가 만든 trip이 `public.documents`와
`public.document_members`에 등록되지 않는 선결 문제를 확인했다. 초대 링크와 P2P signaling은
`document_id`가 `documents(id)`를 참조하므로, 일반 Web 계정 trip도 checklist read/write 진입 시 lazy하게
document registry를 보장하도록 TASK-022를 구현했다.

## Artifacts

- `docs/refactor/tasks/TASK-022-document-registry-bootstrap-for-regular-trips.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/01b_ux_design.md`
- `_workspace/02a_ui_components.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/02c_backend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- `packages/core/src/local-first/documentRegistryBootstrap.ts`(신규): owner 접근만 registry bootstrap을 허용하는 순수 판별 함수 추가.
- `packages/core/src/local-first/__tests__/documentRegistryBootstrap.test.ts`(신규): owner, non-owner, guest 판별 테스트 추가.
- `packages/core/src/supabase/backupRepository.ts`: `ensureDocumentBootstrapped()` 추가. `documents`는 `ignoreDuplicates: true`로 insert-only 보장 후 기존 `upsertOwnerMember()`를 재사용한다.
- `apps/web/lib/local-first/checklistDocumentWriter.ts`: checklist read/write 양쪽에서 owner 접근 시 document registry bootstrap을 시도한다. 실패는 catch로 격리해 기존 legacy row 기반 checklist 동작을 깨지 않는다.
- `docs/refactor/tasks/README.md`: TASK-022 상태를 완료로 갱신하고 다음 권장 순서를 TASK-023부터로 조정했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공. 최초 sandbox 실행은 `tsx` IPC pipe 권한 문제로 실패했고, 승인된 환경에서 동일 명령을 재실행해 통과 확인.
- `pnpm typecheck` 성공.
- `pnpm build` 성공. 최초 sandbox 실행은 `apps/web/.next` 쓰기 권한 문제로 실패했고, 승인된 환경에서 동일 명령을 재실행해 통과 확인.
- `pnpm build:mobile` 성공.
- 자체 코드 리뷰 결과 APPROVE, QA 결과 PASS.

## Rollback

`checklistDocumentWriter.ts`의 bootstrap 호출과 `SupabaseBackupRepository.ensureDocumentBootstrapped()`를 되돌리면 기존 checklist dual-write/legacy 흐름으로 복귀한다. DB schema 변경은 없으므로 migration rollback은 필요 없다.

## Notes

- 이번 작업은 Web local-first adapter 배선이다. Mobile은 TASK-019 owner bootstrap 경로를 유지한다.
- 실제 Supabase row 생성 E2E 수동 확인은 dual-write 모드와 로컬/개발 Supabase 인스턴스가 필요하다. 이번 세션에서는 코드 레벨 통합 정합성과 빌드 검증까지 완료했다.
- 다음 권장 작업은 TASK-023 Mobile signaling channel wiring이다.

---

# Walkthrough: TASK-023 Mobile Signaling Channel Wiring

## Summary

TASK-021에서 Web-to-Web으로만 증명했던 Supabase Realtime signaling channel과 WebRTC data-channel handshake를 Mobile까지 확장했다. Mobile은 Web과 같은 `@nexvoy/core/sync/signalingChannel` 메시지 타입과 `signaling:<sha256(documentId)>` room topic 규칙을 재사용한다. Yjs update 실제 교환, 사용자 UI, background/reconnect lifecycle은 후속 TASK-024~026 범위로 유지한다.

## Artifacts

- `docs/refactor/tasks/TASK-023-mobile-signaling-channel-wiring.md`
- GitHub Issue [#303](https://github.com/ysjee141/nexvoy-frontend/issues/303)
- 브랜치: `feature/task-023-mobile-signaling-channel-wiring-303`
- `_workspace/01_planner_analysis.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- `apps/mobile/lib/local-first/signalingChannel.ts`(신규): RN Supabase client로 private Realtime Broadcast channel에 join. `validateSignalingJoinPolicy()`는 Web과 동일하게 client-side fail-fast guard로만 사용하고, 접근 경계는 TASK-021 Realtime Authorization RLS에 둔다.
- `mobileSignalingDigestProvider`: `react-native-quick-crypto`의 `subtle.digest()`를 `SignalingRoomDigestProvider` 형태로 감싸 core의 `deriveSignalingRoomTopic()`을 그대로 재사용한다.
- `apps/mobile/lib/local-first/webRtcProvider.native.ts`: `createMobileHandshakeDataChannel()` / `wireMobileHandshakeDataChannel()` 추가. `{type, ts}` 고정 스키마의 ping/pong만 전송하며 document content나 CRDT update는 보내지 않는다.
- `apps/mobile/lib/local-first/webP2PConnection.ts`(신규): `connectMobileP2PPeer()`로 ICE config, mobile WebRTC provider, mobile signaling channel을 조립해 offer/answer/ICE candidate를 교환한다. signaling join 이후 peer connection 생성 실패 시 channel/provider cleanup을 수행한다.
- `packages/core/src/sync/__tests__/signalingChannel.test.ts`: RN-shaped digest provider도 Web/server와 같은 room topic을 산출하는지 검증을 추가했다.
- `docs/refactor/tasks/README.md`: TASK-023 상태를 완료로 갱신하고 다음 권장 순서를 TASK-024부터로 조정했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-app lint` 성공(기존 warning 7건 유지, 신규 warning 없음)
- `pnpm --filter nexvoy-app build` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공

## Rollback

신규 조립 지점(`webP2PConnection.ts`)은 아직 UI에서 호출하지 않으므로 파일 제거 또는 import 차단만으로 기존 기능 영향 없이 비활성화할 수 있다. DB schema 변경은 없고, TASK-021의 signaling RLS도 변경하지 않았다.

## Notes

- 실제 Web-Mobile, Mobile-Mobile 연결 수동 검증은 dev client와 두 세션/두 기기 환경이 필요해 이번 세션에서는 수행하지 못했다. 자동 검증은 room topic 계약, 타입/빌드 정합성, payload 제한을 확인하는 수준이다.
- Mobile background 전환 시 연결 유지/정리와 reconnect 정책은 TASK-026 범위로 유지한다.

---

# Walkthrough: TASK-024 P2P Data Channel Yjs Update Exchange

## Summary

TASK-021/023에서 데이터 채널 open과 ping/pong만 증명했던 P2P fast path를 Web-to-Web Yjs update 교환까지 확장했다. Local checklist mutation 후 encoded Yjs update를 active WebRTC data channel로 publish하고, remote peer는 chunked update를 재조립해 IndexedDB local document update에 적용한다. Mobile은 TASK-020의 Yjs/lib0 RN 번들 제약 때문에 이번 task에서 update payload 적용 범위에서 제외했다.

## Artifacts

- `docs/refactor/tasks/TASK-024-p2p-data-channel-yjs-update-exchange.md`
- GitHub Issue [#305](https://github.com/ysjee141/nexvoy-frontend/issues/305)
- 브랜치: `feature/task-024-p2p-data-channel-yjs-update-exchange-305`
- `implementation_plan.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- `packages/core/src/sync/p2pUpdateProtocol.ts`(신규): platform API 없는 Yjs update data-channel protocol. 단일 update와 chunked update, base64 payload, `P2PUpdateReassembler`를 제공한다.
- `packages/core/src/sync/__tests__/p2pUpdateProtocol.test.ts`(신규): single update, out-of-order chunk reassembly, invalid/tampered payload rejection 검증.
- `apps/web/lib/local-first/webRtcProvider.ts`: 기존 ping/pong data channel에 update protocol message parsing과 `sendP2PUpdateOverDataChannel()` 추가.
- `apps/web/lib/local-first/webP2PConnection.ts`: data channel attach 시 active update sender 등록, remote update reassembly/apply, connect 실패 cleanup, `sendUpdate()` 노출.
- `apps/web/lib/local-first/p2pUpdateBridge.ts`(신규): active sender registry, local update publish, remote update IndexedDB apply.
- `apps/web/lib/local-first/checklistDocumentWriter.ts`, `localFirstChecklistRepository.ts`: local mutation 저장 후 encoded Yjs update를 active P2P sender로 publish.
- `docs/refactor/tasks/README.md`: TASK-024 완료 및 다음 권장 순서를 TASK-025부터로 갱신.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm typecheck` 성공
- `pnpm --filter nexvoy-web build` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- `pnpm --filter nexvoy-app lint` 성공(기존 warning 7건 유지)

## Rollback

`p2pUpdateBridge` publish/apply wiring과 `webP2PConnection.ts`의 update callback/sender registration을 제거하면 TASK-021/023 수준의 signaling + ping/pong handshake로 되돌아간다. DB schema 변경은 없으며 기존 Supabase backup pull/push 경로에는 영향이 없다.

## Notes

- 실제 두 Web 세션에서 checklist update가 data channel로 반영되는 수동 검증은 accepted member 2세션과 dev harness/후속 UI가 필요해 이번 세션에서는 자동 검증까지만 수행했다.
- remote P2P update 적용은 IndexedDB 저장만 수행하고 Supabase backup upload를 직접 호출하지 않는다. 연결이 없거나 data channel send가 실패하면 기존 backup sync가 fallback이다.
- P2P update payload는 document content를 포함하므로 logs/analytics에는 원문을 남기지 않는다. 관측은 기존 연결/ICE 이벤트 수준으로 제한했다.
