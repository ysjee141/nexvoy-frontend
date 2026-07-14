# TASK-037: Web Document-Primary Key Bootstrap and Photo Storage

## 목적

Web document-primary 전환 후 실제 백업 동기화가 실패하는 문제를 해결한다. 일반 Web 여행을 처음
document-primary로 수정할 때 owner device document key를 보장하고, document-primary plan 사진 저장 흐름을
Supabase row 의존 없이 동작하게 만든다.

후속 검증에서 P2P fallback, encrypted backup upload, fresh Web restore가 하나의 제품 흐름으로 닫히지
않았음이 확인되어 TASK-037 범위를 Web sync stabilization까지 확장한다. P2P는 optional fast path이며,
P2P 실패 시에도 Supabase encrypted backup pull/push가 실제 fallback으로 동작해야 한다.

## 범위

- Web owner/editor mutation 전 document key bootstrap 보장
- `backupQueue`의 `key_unavailable` 실패 해소
- `/api/places/photo/store`의 document-primary plan 호환성 보완
- 사진 저장 완료 후 document-primary plan `imageUrl` 반영
- 백업 동기화 상태가 실패를 진행 중으로 오해시키지 않도록 상태/관측 지점 점검
- Web document load 시 encrypted backup snapshot/update restore를 legacy row hydrate보다 우선 적용
- `key_unavailable` queue를 실패로 고착하지 않고 key provisioning 이후 재시도 가능한 pending 상태로 유지
- P2P fallback, backup key 대기, backup 실패/성공을 구분해 표시
- Mobile은 직접 구현 우선 대상은 아니지만, shared document model/backup restore 영향 검증과 typecheck/build를
  포함한다. 동일한 `key_unavailable` 재현이 확인되면 TASK-037 범위 안에서 최소 보완한다.

제외:

- Mobile native key bootstrap 재설계
- Storage bucket 구조 변경
- 기존 `plans` row 테이블 제거
- P2P transport 재구현

## 선행 조건

- `TASK-031-web-full-document-primary-transition.md`
- `TASK-033-backup-sync-productization.md`
- `TASK-036-closed-beta-readiness.md`
- PR #333 document permission legacy trip compatibility hotfix

## 변경 대상

- `apps/web/lib/local-first/documentPrimaryRepositories.ts`
- `apps/web/lib/local-first/keyProvisioningService.ts`
- `apps/web/lib/local-first/backupSyncService.ts`
- `apps/web/app/api/places/photo/store/route.ts`
- `apps/web/components/trips/NewPlanModal.tsx`
- `apps/web/app/trips/detail/TripClient.tsx`
- Mobile 영향 검증 대상:
  - `apps/mobile/lib/local-first/documentPrimaryRepositories.ts`
  - `apps/mobile/lib/local-first/mobileBackupSyncService.ts`
  - `apps/mobile/lib/local-first/documentBootstrapService.ts`
- 필요 시 `packages/core/src/repositories/documentPrimaryRepository.ts`
- 필요 시 `supabase/migrations/*.sql`
- 관련 단위/통합 테스트

## 구현 단계

1. Web document-primary mutation 전에 owner device key가 없으면 안전하게 bootstrap한다. ✅
2. 기존 snapshot/key 존재 조합별 동작을 정리하고 divergent DEK 생성을 차단한다. ✅
3. `backupQueue`가 `key_unavailable` 후 key 생성 시 재시도될 수 있게 한다. ✅
4. document-primary plan 사진 저장 경로를 정의한다. ✅
5. `/api/places/photo/store`가 document-primary plan을 검증하거나, client가 document-primary 전용 저장 경로를 사용하도록 분기한다. ✅
6. 사진 저장 결과를 document-primary plan `imageUrl` mutation으로 반영한다. ✅
7. 상태 UI/analytics에서 backup failure가 “동기화 중”으로만 보이지 않는지 점검한다. ✅

## 구현 결과

| 항목 | 결과 |
| --- | --- |
| Issue | [#334](https://github.com/ysjee141/nexvoy-frontend/issues/334) |
| Web owner key bootstrap | `ensureWebOwnerDocumentKey()`가 current `TripDocumentV1` snapshot을 암호화하고 현재 Web device RSA key로 DEK를 wrapping |
| Member key provisioning | editor/viewer device가 trip 진입 시 key provisioning request를 자동 생성하고 owner가 주기적으로 pending request를 처리 |
| Legacy member compatibility | `list_pending_document_key_provisioning_requests()`가 legacy `trip_members` accepted member도 반환하도록 migration 추가 |
| Backup queue | owner/member key provisioning 후 기존 pending update를 같은 flush 경로에서 재시도 |
| Web backup restore | IndexedDB에 문서가 없으면 encrypted backup restore를 먼저 시도하고, backup이 없을 때만 legacy row hydrate |
| Retryable key wait | `key_unavailable`은 `failed`가 아니라 retryable `pending` queue 상태로 유지 |
| Sync status UI | P2P fallback과 backup key 대기/동기화/실패/완료를 분리해 표시 |
| Photo storage | `documentPrimary` 요청은 `plans` row 조회/업데이트를 생략하고 trip-level owner/editor 권한으로 Storage 업로드 |
| Mobile impact | shared contract 변경 없이 Mobile typecheck/build 검증 통과 |

## 데이터 호환성 고려사항

- 기존 legacy row 여행의 `trips.id`는 document id로 계속 사용한다.
- 기존 `plans` row가 없는 document-primary plan도 사진 저장이 가능해야 한다.
- `document_keys`는 current user/device/material에 scoped된 row를 사용한다.
- plain DEK는 클라이언트 메모리 밖으로 노출하지 않는다.

## 검증 방법

- Web owner가 기존 여행에서 새 일정을 생성하면 `get_my_active_document_key`가 device key를 반환한다.
- IndexedDB `backupQueue`가 `key_unavailable`로 고착되지 않고 `lastUploadedSeq`를 갱신한다.
- IndexedDB가 비어 있는 Web 세션은 active document key가 있으면 Supabase encrypted backup에서 snapshot/update를 복구한다.
- active document key가 아직 없으면 stale legacy row로 덮어쓰지 않고 key provisioning 대기 상태를 표시한다.
- 새 document-primary plan의 place photo 저장 API가 404를 반환하지 않는다.
- `pnpm --filter nexvoy-web exec tsc --noEmit`
- `pnpm --filter @nexvoy/core test`
- `pnpm --filter nexvoy-app typecheck`
- `pnpm typecheck`
- `pnpm build`
- `pnpm build:mobile`
- 운영/스테이징 Supabase에 TASK-037 migration 적용 후 owner/editor 2세션에서 editor backup queue가 `synced`로 전환되는지 확인한다.

## 롤백 방법

- document-primary feature flag를 비활성화해 legacy row primary 흐름으로 되돌린다.
- 신규 migration이 있다면 down/compensating SQL을 적용한다.
- Storage 업로드는 best-effort로 유지하고 document mutation 실패 시 image placeholder로 fallback한다.

## 완료 조건

- Web document-primary 일정 생성 후 encrypted backup update가 Supabase에 업로드된다.
- Web document-primary 여행은 fresh Web session에서 Supabase encrypted backup을 우선 복구한다.
- key provisioning 대기 상태는 사용자에게 “동기화 중”으로 오인되지 않는다.
- 신규 일정의 place photo가 document-primary plan에 반영된다.
- 관련 테스트와 빌드가 통과한다.
