# Walkthrough: TASK-012 Guest Auth Promotion

## Summary

로그인 없이 만든 Web local-first guest document를 Supabase Auth 사용자에게 승격하는 흐름을 추가했다. guest/auth user namespace를 분리하고, 로그인 성공 후 owner를 auth user로 바꾼 뒤 encrypted snapshot과 document key를 업로드한다.

## Artifacts

- `docs/refactor/tasks/TASK-012-guest-auth-promotion.md`
- `docs/refactor/adrs/ADR-007-auth-identity-and-delayed-auth.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- GitHub Issue: `#281`

## Key Changes

- `packages/core/src/local-first/guestIdentity.ts`에 guest owner id, owner namespace, login-required guard helper를 추가했다.
- `packages/core/src/local-first/guestPromotion.ts`에 guest document owner/member/reference rewrite helper를 추가했다.
- `apps/web/lib/local-first/indexedDbStore.ts`는 `guest:*` / `user:*` namespace별 local document 격리를 지원한다.
- `apps/web/lib/local-first/ownerNamespace.ts`는 Web guest owner id와 auth user namespace를 관리한다.
- `apps/web/lib/local-first/guestPromotionService.ts`는 로그인 후 guest documents를 auth namespace로 승격하고 encrypted snapshot + `document_keys`를 업로드한다.
- Web local-first checklist repository와 dual-write document writer는 guest/auth owner context를 사용한다.
- 로그인, OAuth 후 Home 진입, auth state 변경에서 best-effort promotion을 재시도한다.
- 로그아웃/회원 탈퇴 시 guest namespace를 포함한 local-first documents를 삭제한다.
- 같은 `documentId`가 이미 remote/auth namespace에 있으면 덮어쓰지 않고 conflict marker와 안내를 남긴다.
- `docs/refactor/tasks/README.md`를 갱신해 다음 task를 `TASK-013: Invitation Permission Registry`로 조정했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공

## Rollback

문제 발생 시 guest promotion trigger를 제거하고 local-first feature flag를 legacy mode로 유지하면 된다. 코드 롤백은 core guest identity/promotion helper, Web namespace store/promotion service, auth cleanup hook 변경분을 제거하면 된다.

## Notes

- ADR-007 Option B 기준으로 Supabase anonymous auth는 사용하지 않는다.
- Guest document는 서버에 쓰지 않고 local only로 유지하다가 로그인 후 auth user owner로 승격한다.
- 승격 완료 조건은 encrypted snapshot upload, owner member upsert, `document_keys` upsert 성공이다.
- 로그아웃/탈퇴 시 guest namespace를 포함한 기기 내 local-first documents를 삭제한다.
- Promotion conflict나 error marker에는 document content, item name, email, CRDT blob을 남기지 않는다.
