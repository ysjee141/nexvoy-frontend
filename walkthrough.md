# Walkthrough: TASK-017 Mobile Background Provisioning Sync

## Summary

`TASK-016`의 Mobile foreground/resume provisioning path를 Expo OS background task까지 확장했다. owner/editor Mobile 기기는 authenticated session 상태에서 background task를 best-effort로 등록하고, 현재 device가 active RSA document key를 가진 request만 small batch로 처리한다.

## Artifacts

- `docs/refactor/tasks/TASK-017-mobile-background-provisioning-sync.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/02c_backend_changes.md`
- `_workspace/03_reviewer_feedback.md`
- `_workspace/04_qa_report.md`

## Key Changes

- `expo-background-task`와 `expo-task-manager`를 추가하고 global task definition을 `apps/mobile/index.js`에서 router entry보다 먼저 import한다.
- `provisioningBackgroundTask.ts`가 background task definition, register/unregister, dev-only trigger helper를 제공한다.
- `backgroundTaskCoordinator.ts`가 shared worker registry, exclusive runner, signOut/sessionless pause guard를 제공한다.
- `runMobileBackgroundKeyProvisioning()`은 small batch로 pending request를 처리하며 background에서는 모든 failure를 retryable skip으로 둔다.
- stale `processing` provisioning request가 재시도 큐에 다시 잡히도록 `list_pending_document_key_provisioning_requests()`를 보강했다.
- iOS background processing config와 Expo background task plugin을 app config에 반영했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-app lint` 성공, 기존 warning 7건
- `pnpm --filter nexvoy-app exec expo install --check` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- `pnpm --filter nexvoy-app build:preview:android:local` 성공
- `git diff --check` 성공
- reviewer 최종 PASS
- qa-engineer 최종 PASS

## Rollback

문제 발생 시 background task registration/import를 비활성화하고 `expo-background-task`/`expo-task-manager` 및 iOS background config를 제거한다. Foreground/resume provisioning processor는 `TASK-016` 상태로 유지한다. 이미 `processing` 상태인 request는 failed로 일괄 변경하지 않고 stale timeout 후 retry path에 맡긴다.

## Notes

- raw DEK/KEK/private key/document content/CRDT blob/invitation token/share token은 DB/RPC/log/analytics/push에 포함하지 않는다.
- Background task는 best-effort다. OS battery/network/force-quit 조건에 따라 실행이 지연되거나 생략될 수 있다.
- 현재 shell에는 `adb`가 없어 Android device install/run/Logcat 검증은 수행하지 못했다.
- iOS는 config smoke만 완료했다. physical device background execution은 후속 QA residual이다.
- 다음 권장 작업은 `TASK-018` Mobile non-exportable key storage hardening이다.
