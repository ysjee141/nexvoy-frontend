# TASK-013: Invitation 및 Permission Registry

## 목적

딥 링크 초대와 초대 코드 fallback을 Supabase authority 기반으로 구현하고, document backup/P2P 접근 권한을 registry로 검증한다.

## 범위

- `document_members`
- `document_invitation_links`
- `document_share_tokens`
- invite create/accept/revoke RPC
- owner/editor/viewer role 반영
- signaling room join 검증 정책

## 선행 조건

- `TASK-006-backup-schema-and-rls.md`
- `TASK-010-cloudflare-ice-config.md`
- `ADR-008` 권장안 결정

## 변경 대상

- `supabase/migrations/*.sql`
- `supabase/functions/*` 또는 RPC SQL
- `packages/core/src/local-first/permissions.ts`
- Web/Mobile 초대 수락 route

## 구현 단계

1. invitation registry schema와 RLS/RPC를 작성한다. ✅
2. owner/editor가 초대 링크를 생성/폐기할 수 있게 한다. ✅
3. 초대 수락 RPC에서 token 만료, 폐기, 사용 횟수, role을 검증한다. ✅
4. accepted member만 backup restore와 document key read가 가능하게 연결한다. ✅
5. P2P room join 시 Supabase JWT, membership, role, room secret을 검증하는 interface를 정의한다. ✅

## 구현 결과

- `supabase/migrations/20260706000001_document_invitation_permission_registry.sql`에 `document_invitation_links`, `document_share_tokens`, hash-only token/code/share token 저장, RLS, 초대/공유 RPC를 추가했다.
- registry table 직접 write는 닫고, 생성/수락/폐기/검증은 `SECURITY DEFINER` RPC 전용 경로로 제한했다.
- 초대 코드 정규화는 Web/Mobile/SQL 모두 영숫자 대문자 기준으로 맞췄다.
- `document_share_tokens` password는 `crypt(..., gen_salt('bf'))`로 저장하고, `verify_document_share_token`과 `get_document_share_token_plans`로 검증 후 본문을 조회한다.
- `packages/core/src/local-first/permissions.ts`와 `packages/core/src/sync/signalingPermissions.ts`에 role/status 기반 권한 helper와 signaling join policy skeleton을 추가했다.
- `packages/core/src/supabase/invitationRepository.ts`에 document invitation/share wrapper와 legacy fallback을 추가했다.
- Web `CollaboratorModal`, `/join`, `ShareModal`, `/share/detail`을 document registry 우선 + legacy fallback으로 연결했다.
- Mobile `/join` route, login `next` 복귀, trip detail 초대/공유 UI를 document registry wrapper로 연결했다.
- 기존 `trip_members` role/revoke 함수는 bridge RPC를 통해 `document_members`와 `document_keys.revoked_at`을 함께 동기화한다.

## 데이터 호환성 고려사항

- 기존 share token과 invitation token은 유효성을 유지한다.
- 링크 자체에 document content를 포함하지 않는다.
- viewer는 local UI에서 편집이 막히고, backup upload도 서버에서 거부되어야 한다.
- raw token/code/share token은 생성 직후 UI state 또는 입력값으로만 사용하고 DB/log/localStorage에는 저장하지 않는다.
- 초대 수락 후 신규 사용자의 active wrapped document key가 없으면 `requires_key_provisioning=true`를 반환하고 Web/Mobile UI는 문서 진입을 차단한다. 서버는 raw DEK/KEK를 알 수 없으므로 owner-side key provisioning은 `ADR-011`과 `TASK-015`로 분리한다.

## 검증 방법

- owner/editor/viewer별 invite 생성/수락 권한 테스트
- revoked link와 expired link 거부 테스트
- viewer write upload 차단 테스트
- 딥 링크와 초대 코드 fallback 수동 테스트
- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- reviewer 최종 PASS, qa-engineer 최종 PASS

## 롤백 방법

- 새 registry를 비활성화하고 기존 초대/공유 flow를 유지한다.
- 신규 invitation rows는 cleanup migration 또는 admin script로 정리한다.
- 코드 롤백은 신규 migration, core permission/signaling/invitation wrapper, Web/Mobile join/share/invite 변경분을 제거하고 legacy wrapper fallback 경로만 유지하면 된다.

## 완료 조건

- 초대 링크와 초대 코드 fallback으로 document invitation을 조회/수락할 수 있다. ✅
- 권한 회수 후 `document_members`와 `document_keys.revoked_at`이 동기화된다. ✅
- viewer write/upload/signaling write는 policy/RLS/RPC에서 차단된다. ✅
- active wrapped document key가 없는 신규 수락자는 안전하게 문서 진입이 차단되며, owner-side key provisioning은 `ADR-011`과 `TASK-015`로 분리한다. ✅
