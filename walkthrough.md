# Walkthrough: TASK-013 Invitation Permission Registry

## Summary

딥 링크 초대와 초대 코드 fallback을 Supabase document registry 기반으로 구현했다. `document_invitation_links`, `document_share_tokens`, `document_members`를 authority로 두고, Web/Mobile 초대 생성·수락·공유 화면은 document RPC를 우선 사용하며 legacy token은 fallback으로 유지한다.

## Artifacts

- `docs/refactor/tasks/TASK-013-invitation-permission-registry.md`
- `docs/refactor/adrs/ADR-008-invitation-and-permission-registry.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- GitHub Issue: `#283`

## Key Changes

- `supabase/migrations/20260706000001_document_invitation_permission_registry.sql`에 invitation/share registry, hash-only token/code 저장, RLS, RPC를 추가했다.
- registry table 직접 write는 닫고, 생성/수락/폐기/검증은 `SECURITY DEFINER` RPC 전용 경로로 제한했다.
- 초대 코드 정규화는 Web/Mobile/SQL 모두 영숫자 대문자 기준으로 통일했다.
- `document_share_tokens` password는 salted `crypt()` hash로 저장하고, 검증된 share token으로 plans/plan_urls를 조회하는 RPC를 추가했다.
- `packages/core/src/local-first/permissions.ts`, `packages/core/src/sync/signalingPermissions.ts`, `packages/core/src/supabase/invitationRepository.ts`를 추가했다.
- Web `CollaboratorModal`, `/join`, `ShareModal`, `/share/detail`을 document registry 우선 + legacy fallback으로 연결했다.
- Mobile `/join`, login `next` 복귀, trip detail 초대/공유 UI를 document registry wrapper로 연결했다.
- 기존 `trip_members` role/revoke 함수는 bridge RPC를 통해 `document_members`와 `document_keys.revoked_at`을 함께 동기화한다.
- `docs/refactor/tasks/README.md`를 갱신해 다음 task를 `TASK-014: Notification and Observability`로 조정했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- reviewer 최종 PASS
- qa-engineer 최종 PASS

## Rollback

문제 발생 시 신규 registry RPC 사용을 중단하고 기존 legacy invitation/share flow를 유지한다. 코드 롤백은 신규 migration, core permission/signaling/invitation wrapper, Web/Mobile join/share/invite 변경분을 제거하면 된다. 신규 registry rows는 cleanup migration 또는 admin script로 정리한다.

## Notes

- 사용자 정책 결정에 따라 초대 생성/폐기는 owner/editor 모두 허용한다.
- raw token/code/share token은 DB/log/localStorage에 저장하지 않고 생성 직후 UI state 또는 입력값으로만 사용한다.
- Legacy invitation/share token은 document wrapper miss 시 fallback으로 유지한다.
- 신규 수락자에게 active wrapped document key가 없으면 `requires_key_provisioning=true`를 반환하고 Web/Mobile UI가 문서 진입을 차단한다.
- 서버는 raw DEK/KEK를 알 수 없으므로 owner-side key provisioning 계약은 `docs/refactor/adrs/ADR-011-invitation-key-provisioning-strategy.md`와 `docs/refactor/tasks/TASK-015-owner-side-document-key-provisioning.md`로 분리했다.
