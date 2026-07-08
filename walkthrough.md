# Walkthrough: TASK-018 Mobile Non-exportable Key Storage

## Summary

`TASK-016~017`의 Mobile key provisioning 기반을 Android Keystore/iOS Keychain 기반 non-exportable private key storage로 강화했다. Mobile v2 material은 native private key를 JS JWK로 장기 저장하지 않고, Supabase에는 public JWK와 coarse metadata만 등록한다.

## Artifacts

- `docs/refactor/tasks/TASK-018-mobile-non-exportable-key-storage.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/02c_backend_changes.md`
- `_workspace/03_reviewer_feedback.md`
- `_workspace/04_qa_report.md`

## Key Changes

- `apps/mobile/modules/onvoy-native-crypto` Expo local module을 추가했다.
- Android는 Android Keystore RSA-OAEP private key를 local alias 내부에 보관하고 public JWK만 JS로 반환한다.
- iOS는 Keychain permanent RSA private key를 `ThisDeviceOnly` + non-extractable 속성으로 생성하고 public JWK만 JS로 반환한다.
- `mobileNativeKeyProvider`가 native bridge를 감싸고, v2 native unwrap은 private JWK 없이 native module에서 수행한다.
- Mobile v2 material store는 `publicKeyJwk`, `platform`, `hardwareBacked`, `attestationStatus`만 저장한다.
- `user_key_materials.material_version=2`와 document key version `1`을 분리했다.
- `register_user_key_material()` RPC에 metadata와 strict public RSA-OAEP JWK whitelist를 추가했다.
- legacy SecureStore fallback은 explicit feature flag가 있을 때만 동작하고, v1 cleanup은 foreground v2 active unwrap 성공 또는 logout/revoke cleanup으로 제한한다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-app lint` 성공, 기존 warning 7건
- `pnpm --filter nexvoy-app exec expo install --check` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- `pnpm --filter nexvoy-app build:preview:android:local` 성공
- `docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task015_key_provisioning.sql` 성공
- `git diff --check` 성공
- reviewer 최종 PASS
- qa-engineer 최종 PASS

## Rollback

문제 발생 시 `onvoy-native-crypto` local module dependency와 v2 native provider 경로를 feature flag로 비활성화하고, legacy SecureStore fallback을 제한적으로 재활성화한다. 서버에는 raw private key/raw DEK를 저장하지 않으며, 새 `native_rsa` material rows는 revoked 처리한다.

## Notes

- raw DEK/KEK/private key/document content/CRDT blob/invitation token/share token은 DB/RPC/log/analytics/push에 포함하지 않는다.
- Native key alias/tag는 local-only이며 JS bridge/RPC/log/analytics에 반환하지 않는다.
- Android preview APK build는 성공했지만 실제 device/emulator install/run/Logcat 검증은 후속 수동 검증으로 남긴다.
- iOS physical device native key generation/unwrap 검증은 residual이다.
- native unwrap 결과 raw DEK가 JS로 transient 반환되는 구조는 후속 hardening에서 AES-GCM `extractable: false` 또는 native AES-GCM 확장으로 재검토한다.
- 다음 권장 작업은 `TASK-019` Mobile-first owner key bootstrap이다.
