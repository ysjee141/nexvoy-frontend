# TASK-015: Owner-side Document Key Provisioning

## 목적

초대 수락으로 `document_members.status = accepted`가 된 신규 사용자가 encrypted backup snapshot/update를 복구할 수 있도록, owner/editor client가 사용자별 wrapped document key를 안전하게 발급하는 흐름을 구현한다.

`TASK-013`은 permission registry와 invitation accept를 완료했지만, 서버가 raw DEK/KEK를 알 수 없는 구조이므로 초대 수락 직후 `requires_key_provisioning=true` 상태가 남을 수 있다. 이 task는 해당 pending 상태를 owner-side key wrapping과 retry UX로 해소한다.

## 범위

- member wrapping material/public key registry
- pending key provisioning request 상태
- owner/editor client-side DEK wrapping flow
- `document_keys` upsert contract
- accepted member restore retry
- key provisioning pending/failed/completed UX
- revoke/rotation과 `document_keys.revoked_at` 정합성

## 선행 조건

- `TASK-007-document-key-model.md`
- `TASK-008-backup-queue-and-restore.md`
- `TASK-012-guest-auth-promotion.md`
- `TASK-013-invitation-permission-registry.md`
- `ADR-003-backup-encryption-key-management.md`
- `ADR-011-invitation-key-provisioning-strategy.md`

## 변경 대상

- `supabase/migrations/*.sql`
- `packages/core/src/sync/*`
- `packages/core/src/supabase/invitationRepository.ts`
- `packages/core/src/supabase/backupRepository.ts`
- `apps/web/lib/local-first/*`
- `apps/web/app/join/JoinClient.tsx`
- `apps/web/components/trips/CollaboratorModal.tsx`
- `apps/mobile/app/join.tsx`
- `apps/mobile/app/trip/[id].tsx`
- notification/observability 문서 또는 후속 `TASK-014` 산출물

## 구현 단계

1. member wrapping material registry를 설계한다.
   - 후보 테이블: `document_member_key_materials` 또는 `user_key_materials`
   - 저장 값은 public wrapping key 또는 서버가 복호화할 수 없는 wrapping material reference만 허용한다.
   - raw DEK/KEK/private key는 DB, RPC response, log에 저장하지 않는다.

2. pending provisioning request를 정의한다.
   - 후보 테이블: `document_key_provisioning_requests`
   - 필드: `document_id`, `user_id`, `requested_by`, `status`, `requested_at`, `fulfilled_at`, `failed_at`, `error_code`
   - `accept_document_invitation`이 active key가 없을 때 request를 upsert한다.

3. owner/editor provisioning reader를 구현한다.
   - owner/editor가 열 수 있는 document의 pending request만 조회한다.
   - response에는 member 식별에 필요한 최소 metadata만 포함한다.
   - document content, raw token, raw key, encrypted snapshot/update blob은 포함하지 않는다.

4. owner-side wrapping adapter를 구현한다.
   - owner/editor client가 현재 document DEK를 보유한 경우에만 실행한다.
   - member wrapping material로 DEK를 wrapping한다.
   - `document_keys`에는 wrapped DEK만 upsert한다.
   - 성공 시 provisioning request를 completed로 전환한다.

5. accepted member restore retry flow를 연결한다.
   - join/restore 화면이 `requires_key_provisioning=true`이면 pending 안내와 retry CTA를 표시한다.
   - active `document_keys`가 생기면 restore를 재시도한다.
   - 실패 시 generic error code만 표시하고 raw key/crypto detail은 노출하지 않는다.

6. revoke/rotation 정합성을 보강한다.
   - member revoke 시 pending request를 cancelled/revoked 처리한다.
   - `document_keys.revoked_at` 설정은 `TASK-013` bridge RPC와 일관되게 유지한다.
   - key rotation이 도입되면 accepted owner/editor/viewer별 새 wrapped key 발급 정책을 정의한다.

7. Web/Mobile UX를 구현한다.
   - Web owner/editor: 동행자 관리 화면 또는 Home background task에서 pending key provisioning 처리.
   - Web invited member: join/restore 화면에서 "문서 키 준비 중" 안내와 재시도.
   - Mobile owner/editor: trip detail 진입 또는 background sync 시 pending provisioning 처리.
   - Mobile invited member: join route에서 pending 안내와 재시도.

8. 관측/알림을 연결한다.
   - `TASK-014`와 연계해 pending request 생성/완료/실패 이벤트를 metadata-only로 기록한다.
   - owner에게 key provisioning 요청 알림을 보낼 경우 document content와 raw key material을 포함하지 않는다.

## 데이터 호환성 고려사항

- 기존 `document_keys` schema는 유지한다.
- 이미 accepted 되었지만 active key가 없는 member는 migration 없이 pending request 생성 대상이 될 수 있어야 한다.
- 기존 guest promotion의 owner key upload 흐름과 충돌하지 않아야 한다.
- legacy `trip_members`와 document registry가 공존하는 동안 bridge RPC가 key revoke를 계속 보장해야 한다.

## 보안 원칙

- 서버는 raw DEK/KEK/private key를 저장하거나 반환하지 않는다.
- provisioning request에는 document content, invite token, share token, CRDT blob, wrapped DEK payload를 넣지 않는다.
- owner/editor 권한 검증은 Supabase registry/RLS/RPC에서 수행한다.
- viewer는 provisioning을 수행할 수 없다.
- revoked member의 pending request와 active key는 즉시 사용할 수 없어야 한다.

## 검증 방법

- 초대 수락 후 active key가 없으면 `requires_key_provisioning=true`와 pending request가 생성되는지 확인한다.
- owner/editor가 pending request를 조회하고 wrapped key를 발급할 수 있는지 확인한다.
- viewer 또는 unrelated user가 pending request를 조회/처리할 수 없는지 확인한다.
- wrapped key 발급 후 invited member가 encrypted snapshot을 restore할 수 있는지 확인한다.
- revoke 후 `document_keys.revoked_at`이 설정되고 restore/update upload/P2P write가 차단되는지 확인한다.
- raw DEK/KEK/private key/document content가 DB/log/RPC response/analytics/push payload에 남지 않는지 확인한다.
- Web/Mobile join route에서 pending -> completed retry UX가 동작하는지 확인한다.

## 롤백 방법

- pending provisioning processor를 비활성화한다.
- `accept_document_invitation`은 기존처럼 `requires_key_provisioning=true`를 반환하고 safe block UX를 유지한다.
- 신규 provisioning request rows는 cleanup migration 또는 admin script로 정리한다.
- 기존 `document_keys`와 encrypted backup rows는 유지한다.

## 완료 조건

- 초대받은 accepted member가 owner-side wrapped key 발급 후 document를 복구할 수 있다.
- 서버가 raw DEK/KEK를 알지 않는 원칙이 유지된다.
- pending/failed/completed provisioning 상태가 Web/Mobile에서 명확히 표시된다.
- 권한 회수 후 key access와 새 sync/update가 차단된다.
