# Walkthrough: TASK-016 Mobile Native Key Provisioning MVP

## Summary

`TASK-015`의 Web foreground key provisioning을 Mobile native runtime으로 확장했다. Mobile device는 RSA-OAEP public material을 등록하고, owner/editor Mobile 기기는 trip detail/collaborator/foreground resume 기회에 pending provisioning request를 처리한다. 서버는 raw DEK/KEK/private key를 알지 않고, public JWK와 wrapped DEK만 저장한다.

## Artifacts

- `docs/refactor/tasks/TASK-016-mobile-native-key-provisioning-and-background-sync.md`
- `docs/refactor/adrs/ADR-011-invitation-key-provisioning-strategy.md`
- `_workspace/03_reviewer_feedback.md`
- `_workspace/04_qa_report.md`

## Key Changes

- `react-native-quick-crypto` 기반 Mobile RSA-OAEP-256 provider를 추가했다.
- Mobile device id와 RSA key material은 `apps/mobile/lib/local-first` platform adapter에서 관리한다. private JWK는 SecureStore에만 저장하고 Supabase에는 public JWK만 등록한다.
- Mobile join flow는 초대 수락 후 material registration, device-specific provisioning request, status retry를 실제 RPC path로 수행한다.
- Mobile owner/editor는 trip detail 진입, collaborator sheet CTA, AppState active 전환 시 pending request를 foreground에서 처리한다.
- 현재 Mobile 기기가 document DEK를 unwrap할 수 없으면 자기 device provisioning request를 등록하고, 다른 request는 failed로 오염시키지 않고 skip한다.
- 로그아웃 시 local notification과 Mobile private key material을 best-effort로 삭제한다.
- OS background task, non-exportable keystore, key rotation은 후속 split으로 분리했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-app exec expo install --check` 성공
- `pnpm build:mobile` 성공
- `git diff --check` 성공
- reviewer/qa-engineer 검증 예정

## Rollback

문제 발생 시 Mobile provisioning processor와 RNQC plugin/dependency를 비활성화하고, Mobile은 `TASK-015`의 status/retry 안내만 유지한다. Web foreground provisioning path와 existing `document_keys` row는 유지한다.

## Notes

- raw DEK/KEK/private key/document content/CRDT blob/invitation token/share token은 DB/RPC/log/analytics/push에 포함하지 않는다.
- Expo Go는 custom native module을 지원하지 않으므로 RNQC runtime 검증은 dev client/preview APK 기준이다.
- 실제 Android preview APK 설치와 Logcat native crypto crash 확인은 아직 수행하지 않았다.
- 첫 Mobile owner device는 Web 또는 이미 준비된 owner/editor device가 해당 Mobile request를 처리해야 active key를 얻을 수 있다.
- 다음 split은 OS background task hardening과 non-exportable keystore 검토다.
