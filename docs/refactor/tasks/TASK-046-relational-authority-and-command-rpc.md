# TASK-046: Relational Authority and Atomic Command RPC

- 상태: 대기

## 목적

여행, 일정, 준비물, 템플릿의 최종 권위를 Supabase normalized row로 확정한다. 모든 원격 변경을 인증된 batch
command RPC 한 transaction에서 처리하고, revision, idempotency, RLS를 데이터베이스에서 보장한다.

## 범위

- 기존 관계형 schema와 누적 RLS/helper 전수 감사
- trip/template resource revision과 entity version 추가
- offline delete 복구를 위한 tombstone 또는 `deleted_at` 정책
- `applied_operations` idempotency ledger
- `apply_trip_commands`, `apply_template_commands` batch RPC
- Trip/Template summary, revision, canonical bundle read RPC
- `document_members` 기반 owner/editor/viewer authority 통합
- pgTAP 또는 SQL 기반 권한·원자성·중복 요청 테스트

제외:

- Web/Mobile local store
- Realtime Broadcast trigger
- 기존 Yjs/P2P/backup object 제거

## 선행 조건

- `ADR-015-offline-capable-server-authority.md`
- TASK-043/044에서 도입한 document membership 및 invitation RPC

## 변경 대상

- `supabase/migrations`
- `supabase/tests`
- `packages/types/src/database.types.ts`
- `packages/core/src/supabase`

## 구현 단계

1. `trips`, `plans`, `plan_urls`, `checklists`, `checklist_items`, assignee/user-check, template table의 실제 column, FK, index, RLS를 inventory로 고정한다.
2. `trip_sync_state`와 `template_sync_state`에 monotonic `revision`을 추가한다.
3. mutable entity에 version, server `updated_at`, 필요한 delete tombstone과 stable sort key를 추가한다.
4. `(actor_id, operation_id)` unique ledger와 command hash를 저장해 동일 retry는 같은 결과를 반환하고 다른 payload 재사용은 거부한다.
5. 최대 32개 command를 한 transaction에서 검증·적용하는 Trip/Template RPC를 구현한다.
6. client가 보낸 owner/user/role/server timestamp는 무시하고 `auth.uid()`와 membership helper로 결정한다.
7. 성공 응답은 새 resource revision과 변경 canonical row만 반환한다. `select=*`와 전체 document 반환을 피한다.
8. summary/revision/bundle read RPC를 구현하고 viewer/public share 범위를 명시한다.
9. owner/editor/viewer/revoked/다른 계정, duplicate, stale version, batch 중간 실패를 SQL 테스트로 검증한다.

## Command 계약

- Trip: create/update/delete, plan/URL CRUD, checklist/item/assignee/check CRUD
- Template: create/update/delete, item CRUD 또는 transactional replace
- 모든 command: `operation_id`, `resource_id`, `base_revision`, entity ID/version, typed payload
- batch 하나가 실패하면 전체 batch를 rollback한다.
- 같은 field version conflict는 typed conflict response로 반환한다.

## 데이터 호환성 고려사항

- 기존 normalized row를 authority로 재사용하되 V1 Yjs snapshot/update를 import하지 않는다.
- `documents`/`document_members`는 permission registry로 유지할 수 있지만 `documents.snapshot`을 authority로 읽지 않는다.
- destructive drop/reset은 TASK-055 전까지 수행하지 않는다.

## 검증 방법

- 동일 `operation_id`를 반복 전송해 row와 revision이 한 번만 변경되는지 확인한다.
- editor batch는 성공하고 viewer/revoked/비멤버 batch는 전체 rollback되는지 확인한다.
- 두 actor가 같은 entity version을 수정하면 하나만 성공하고 conflict가 구조화되어 반환되는지 확인한다.
- owner trip 생성과 owner membership/resource revision 생성이 원자적인지 확인한다.
- `supabase db reset`과 전체 SQL 테스트를 통과한다.

## 롤백 방법

- 신규 RPC 호출 전이므로 migration rollback 또는 신규 object disable만 수행한다.
- 기존 document-primary runtime과 table은 그대로 유지한다.

## 완료 조건

- 핵심 도메인의 server authority schema와 batch command RPC가 존재한다.
- 권한, 원자성, idempotency, revision conflict가 DB 테스트로 고정된다.
- client가 direct table write 없이 canonical row를 읽고 쓸 수 있는 API가 준비된다.
