# Walkthrough: TASK-015 Owner-side Document Key Provisioning

## Summary

초대 수락 후 `requires_key_provisioning` 상태에 남는 멤버가 encrypted local-first document를 복구할 수 있도록 owner/editor Web client가 wrapped document key를 안전하게 발급하는 흐름을 구현했다. 서버는 raw DEK/KEK/private key를 알지 않고, device-level public material과 wrapped DEK만 저장한다.

## Artifacts

- `docs/refactor/tasks/TASK-015-owner-side-document-key-provisioning.md`
- `docs/refactor/adrs/ADR-011-invitation-key-provisioning-strategy.md`
- `_workspace/03_reviewer_feedback.md`
- `_workspace/04_qa_report.md`

## Key Changes

- `user_key_materials`와 `document_key_provisioning_requests`를 추가하고 RPC 중심 권한 경계를 구성했다.
- `document_keys`는 legacy AES-KW owner row와 device-scoped RSA-OAEP row를 병행 지원한다.
- `upsert_owner_document_key`는 AES-KW legacy 저장과 RSA-OAEP device 저장을 분기하고 active material을 재검증한다.
- Web device key material은 IndexedDB에 저장하고 Supabase에는 public JWK만 등록한다.
- Web guest promotion 초기 backup에서 owner device RSA-OAEP key row를 bootstrap해 foreground provisioning이 DEK를 얻을 수 있게 했다.
- Web CollaboratorModal은 pending request 조회, owner/editor foreground provisioning, revoke cleanup RPC를 연결했다.
- Web/Mobile join은 provisioning pending/status/retry UX를 제공한다.
- Mobile actual native crypto, owner/editor provisioning, background sync는 TASK-016으로 분리했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `git diff --check` 성공
- reviewer 최종 PASS
- qa-engineer 최종 PASS

## Rollback

문제 발생 시 Web foreground provisioning CTA를 비활성화하고 invited member는 pending 안내/retry 상태로 유지한다. 신규 provisioning queue/material registry는 cleanup migration으로 제거하고, `document_keys`는 legacy AES-KW owner row를 유지한다. 초대 수락 RPC는 `requires_key_provisioning` safe block UX를 반환하도록 되돌린다.

## Notes

- raw DEK/KEK/private key/document content/CRDT blob/invitation token/share token은 DB/RPC/log/analytics/push에 포함하지 않는다.
- Supabase SQL runtime smoke는 로컬 DB migration 적용 여부가 보장되지 않아 정적 검증과 테스트 파일 작성까지만 완료했다.
- Web 실제 브라우저 E2E와 Mobile 실제 device 검증은 수행하지 않았다.
- 다음 작업은 `TASK-016: Mobile Native Key Provisioning and Background Sync`다.
