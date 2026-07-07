# TASK-017: Mobile Background Provisioning Sync

## 목적

`TASK-016`에서 foreground/resume 중심으로 구현한 Mobile key provisioning 재시도 경로를 OS background task까지 확장한다.

앱이 foreground에 오래 머물지 않더라도 owner/editor Mobile 기기가 pending provisioning request를 best-effort로 확인하고, 현재 기기가 active RSA document key를 보유한 경우 안전하게 wrapped DEK 발급을 시도해야 한다.

## 범위

- Expo/RN background task module 선정
- Mobile provisioning background task registration/handler
- 네트워크/배터리 제약을 고려한 작은 batch 처리
- foreground trigger와 충돌하지 않는 in-flight lock/backoff
- content-free observability event
- Android preview APK와 실제 device/Logcat 검증

## 선행 조건

- `TASK-014-notification-and-observability.md`
- `TASK-015-owner-side-document-key-provisioning.md`
- `TASK-016-mobile-native-key-provisioning-and-background-sync.md`
- `docs/develop-context/mobile-app-verification-lifecycle.md`

## 변경 대상

- `apps/mobile/package.json`
- `apps/mobile/app.config.js`
- `apps/mobile/app.json`
- `apps/mobile/lib/local-first/keyProvisioningService.ts`
- `apps/mobile/lib/local-first/provisioningBackgroundTask.ts`
- `apps/mobile/lib/auth-context.tsx`
- `apps/mobile/lib/observability.ts`
- `docs/refactor/tasks/README.md`
- `walkthrough.md`

## 구현 단계

1. Background task module을 선정한다.
   - Expo SDK 54 기준 `expo-background-task`/`expo-task-manager` 호환성을 확인한다.
   - Expo Go는 검증 경로에서 제외하고 development/preview APK 기준으로 판단한다.

2. Background handler를 만든다.
   - 작은 limit으로 pending request를 조회한다.
   - current Mobile device가 active RSA document key를 보유한 document만 처리한다.
   - document DEK를 얻을 수 없는 경우 request를 failed로 오염시키지 않는다.

3. Foreground processor와 중복 실행을 막는다.
   - process-wide in-flight lock을 공유한다.
   - retry/backoff는 client-side debounce를 우선 적용한다.
   - background interruption은 retryable 상태로 남긴다.

4. Observability를 연결한다.
   - 이벤트는 `document_key_provisioning_pending/completed/failed` allowlist를 사용한다.
   - params는 `platform`, `document_type`, `entity_type`, `operation`, `status`, `reason_code`, `count`, `pending_count`만 사용한다.

5. Native runtime 검증을 수행한다.
   - `pnpm --filter nexvoy-app typecheck`
   - `pnpm build:mobile`
   - `pnpm --filter nexvoy-app exec expo install --check`
   - `pnpm --filter nexvoy-app build:preview:android:local`
   - 실제 Android device 설치/실행
   - Logcat에서 `AndroidRuntime`, `ReactNativeJS`, background task/native crypto crash 확인

## 데이터 호환성 고려사항

- 신규 migration 없이 `TASK-015/016`의 `document_key_provisioning_requests`, `user_key_materials`, device-scoped `document_keys` contract를 유지한다.
- background task는 서버 상태를 완료로 확정하지 않는다. `complete_document_key_provisioning()` RPC만 완료 상태를 만든다.
- network failure, app kill, battery restriction은 retryable 상태로 남겨야 한다.

## 보안 원칙

- background log, analytics, push payload에는 raw DEK/KEK/private JWK/public JWK/wrapped DEK/document content/token/device id를 넣지 않는다.
- owner/editor 권한과 request ownership 검증은 Supabase RPC가 최종 경계다.
- viewer/unrelated user의 background task는 pending request를 처리할 수 없어야 한다.

## 검증 방법

- foreground processor와 background handler가 동시에 실행되어도 request가 중복 완료되지 않는지 확인한다.
- offline/poor network에서 request가 failed로 오염되지 않고 retry 가능한지 확인한다.
- background task가 current device에 active RSA key가 없을 때 안전하게 skip하는지 확인한다.
- Android preview APK에서 background task registration crash가 없는지 확인한다.
- Logcat에 raw key/document payload가 출력되지 않는지 확인한다.

## 롤백 방법

- background task registration을 비활성화한다.
- foreground/resume processor는 `TASK-016` 상태로 유지한다.
- 추가 dependency/config plugin이 문제를 일으키면 제거하고 Mobile provisioning은 foreground-only로 되돌린다.

## 완료 조건

- background task가 best-effort로 pending provisioning을 재시도한다.
- foreground processor와 background task가 같은 request를 오염시키지 않는다.
- native preview APK와 실제 device/Logcat 검증을 통과한다.
- reviewer와 qa-engineer 최종 verdict가 PASS다.

## 구현 결과

### Background task runtime

- Expo SDK 54 호환 모듈로 `expo-background-task`와 `expo-task-manager`를 추가했다.
- `apps/mobile/index.js`에서 `expo-router/entry`보다 먼저 `apps/mobile/lib/local-first/provisioningBackgroundTask.ts`를 import해 `TaskManager.defineTask`가 global scope에서 평가되도록 했다.
- `apps/mobile/lib/local-first/provisioningBackgroundTask.ts`는 provisioning background task를 정의하고 authenticated session lifecycle에서 best-effort register/unregister한다.
- `apps/mobile/lib/backgroundTaskCoordinator.ts`를 추가해 background worker registry, process-wide exclusive runner, signOut/sessionless pause guard를 제공한다.

### Provisioning processor

- `runMobileBackgroundKeyProvisioning()`을 추가해 small batch(`limit: 5`)로 pending request를 처리한다.
- foreground와 background processor는 동일 worker lock을 공유한다.
- background path는 user-approved skip-only policy를 따른다. active RSA document key 없음, network failure, wrap/import failure, complete RPC failure, OS interruption은 request를 `failed`로 mark하지 않는다.
- signOut/sessionless 전환 시 pause guard를 먼저 켜고, worker는 begin/wrap/complete 전후로 pause 상태를 재확인한다.
- `list_pending_document_key_provisioning_requests()`는 10분 이상 stale 된 `processing` row를 다시 반환한다. background가 `begin` 후 interruption/skip으로 빠져도 request가 재시도 큐에서 영구 이탈하지 않는다.

### Native config

- `apps/mobile/app.config.js`에 `expo-background-task` plugin을 추가했다.
- iOS config에 `UIBackgroundModes: ["processing"]`와 `BGTaskSchedulerPermittedIdentifiers: ["com.expo.modules.backgroundtask.processing"]`를 반영했다.
- Android는 WorkManager 기반 실행을 사용하며 추가 broad permission은 넣지 않았다.

## 검증 결과

- `git diff --check`: PASS
- `pnpm --filter @nexvoy/core test`: PASS
- `pnpm --filter nexvoy-app typecheck`: PASS
- `pnpm --filter nexvoy-app lint`: PASS, 기존 warning 7건
- `pnpm --filter nexvoy-app exec expo install --check`: PASS
- `pnpm build`: PASS
- `pnpm build:mobile`: PASS
- `pnpm --filter nexvoy-app build:preview:android:local`: PASS
- reviewer 최종 verdict: PASS
- qa-engineer 최종 verdict: PASS

## 잔여 검증

- 현재 shell에는 `adb`가 없어 Android device install/run/Logcat 검증은 수행하지 못했다.
- iOS는 config smoke 범위로만 확인했다. physical device background execution 검증은 후속 QA에서 수행한다.
