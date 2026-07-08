# TASK-018: Mobile Non-exportable Key Storage

## 목적

`TASK-016` MVP의 SecureStore private JWK 저장 방식을 Android Keystore/iOS Keychain 기반 non-exportable private key 모델로 강화한다.

Mobile private key가 JS 문자열/JWK로 장기 보관되지 않도록 하고, Supabase에는 계속 public material과 wrapped DEK만 저장한다.

## 범위

- Android Keystore/iOS Keychain non-exportable RSA-OAEP key provider 조사
- native provider 또는 custom native module 경계 설계
- core `RsaOaepWrappingProvider` contract와 호환되는 Mobile adapter 보강
- 기존 SecureStore JWK material에서 새 material로 migration/re-registration
- revoke/rotation UX와 실패 복구 정책
- device/runtime 검증

## 선행 조건

- `TASK-016-mobile-native-key-provisioning-and-background-sync.md`
- `TASK-017-mobile-background-provisioning-sync.md` (선택)
- `ADR-003-backup-encryption-key-management.md`
- `ADR-011-invitation-key-provisioning-strategy.md`
- `docs/develop-context/mobile-app-verification-lifecycle.md`

## 변경 대상

- `apps/mobile/lib/local-first/mobileCryptoProvider.ts`
- `apps/mobile/lib/local-first/mobileKeyMaterialStore.ts`
- `apps/mobile/lib/local-first/keyProvisioningService.ts`
- `apps/mobile/app.config.js`
- `apps/mobile/package.json`
- `packages/core/src/sync/encryption.ts` (필요 시 provider handle contract 보강)
- `packages/core/src/sync/keyProvisioning.ts` (필요 시 material status/reason 보강)
- `supabase/migrations/*.sql` (필요 시 material type/version metadata 보강)

## 구현 단계

1. Native key provider 후보를 조사한다.
   - Android Keystore RSA-OAEP SHA-256 support
   - iOS SecKey/Keychain RSA-OAEP SHA-256 support
   - Expo config plugin/autolinking/New Architecture 요구사항
   - RNQC와 병행 가능 여부

2. Provider contract를 결정한다.
   - private key는 non-exportable handle로 유지한다.
   - public key는 export 가능해야 하고 Supabase `user_key_materials.public_key_jwk` 또는 동등한 public material로 등록한다.
   - `wrapDocumentKey`는 recipient public key로 DEK를 wrap한다.
   - `unwrapDocumentKey`는 current device private handle로 wrapped DEK를 unwrap한다.

3. Material registry metadata를 보강한다.
   - 필요 시 `user_key_materials`에 `material_type`, `platform`, `hardware_backed`, `attestation_status` 같은 metadata 추가를 검토한다.
   - migration이 필요하면 RLS/RPC-only write 원칙을 유지한다.

4. Migration/re-registration UX를 만든다.
   - 기존 SecureStore JWK material은 revocation 후 새 material로 재등록한다.
   - active `document_keys`는 새 material 기준으로 다시 provisioning request를 생성한다.
   - 사용자는 "이 기기 데이터 준비가 다시 필요합니다" 수준의 generic copy만 본다.

5. Logout/withdrawal/revoke 정책을 정리한다.
   - logout 시 native private key 삭제 또는 보존 정책을 결정한다.
   - 삭제한다면 server material revoke와 device-scoped `document_keys.revoked_at` 정리를 함께 수행한다.

6. Native runtime 검증을 수행한다.
   - key generation/import/export public material
   - RSA-OAEP wrap/unwrap round-trip
   - app reinstall/logout/relogin behavior
   - Android preview APK, 실제 device, Logcat

## 데이터 호환성 고려사항

- 기존 SecureStore JWK material row는 v2 native active document key unwrap 성공 후 또는 explicit logout/revoke cleanup에서 revoked 상태로 전환한다.
- 기존 active document key는 새 material로 rewrap되기 전까지 current device에서 restore가 막힐 수 있으므로 retry UX가 필요하다.
- server는 raw private key나 raw DEK를 받지 않는다.

## 보안 원칙

- private key는 JS-accessible JWK/PEM/string으로 장기 저장하지 않는다.
- native logs, JS logs, analytics, push payload에 key handle, raw key, wrapped DEK, document content를 넣지 않는다.
- hardware-backed 여부를 과장하지 않는다. 실제 attestation이 없으면 "hardware_backed verified"로 표시하지 않는다.

## 검증 방법

- Supabase `user_key_materials`에 private material이 저장되지 않는지 확인한다.
- native private key가 export 불가능한지 provider API 수준에서 확인한다.
- 기존 SecureStore JWK device가 새 material로 안전하게 전환되는지 확인한다.
- logout/revoke 후 stale active key가 반환되지 않는지 확인한다.
- Android/iOS 실제 device에서 key generation/unwrap crash가 없는지 확인한다.

## 롤백 방법

- non-exportable provider를 feature flag로 비활성화하고 `TASK-016` SecureStore JWK provider로 되돌린다.
- 새 material rows는 revoked 처리한다.
- rollback 시에도 raw private key/document content는 서버에 저장하지 않는다.

## 완료 조건

- Mobile private key가 non-exportable native storage 경계에 있다.
- Mobile invited member restore와 owner/editor provisioning이 새 provider로 동작한다.
- 기존 SecureStore JWK material에서 안전한 migration/retry UX가 있다.
- native preview/device/Logcat 검증을 통과한다.
- reviewer와 qa-engineer 최종 verdict가 PASS다.

## 구현 결과

- `apps/mobile/modules/onvoy-native-crypto` Expo local module을 추가했다.
  - Android: Android Keystore RSA-OAEP private key를 local alias 내부에 보관하고 public JWK만 JS로 반환한다.
  - iOS: Security.framework/Keychain permanent RSA private key를 `ThisDeviceOnly` + non-extractable 속성으로 생성하고 public JWK만 JS로 반환한다.
- Mobile v2 material store는 `publicKeyJwk`, `platform`, `hardwareBacked`, `attestationStatus` metadata만 저장하며 `privateKeyJwk`가 섞이면 해당 v2 payload를 폐기한다.
- `ensureMobileDeviceKeyMaterial()`는 기본 경로에서 `native_rsa` material v2를 등록한다.
- `DOCUMENT_KEY_VERSION = 1`과 `MOBILE_NATIVE_MATERIAL_VERSION = 2`를 분리해 document key version과 material version 혼동을 막았다.
- `register_user_key_material()` RPC에 `material_type`, `platform`, `hardware_backed`, `attestation_status` metadata를 추가하고 public RSA-OAEP JWK whitelist를 강제했다.
- legacy SecureStore fallback은 `EXPO_PUBLIC_ONVOY_ENABLE_LEGACY_SECURESTORE_KEY_MATERIAL_FALLBACK=true`일 때만 사용한다.
- background provisioning은 native provider/key/session/unwrap 실패를 skip/retry로 남기며 request를 `failed`로 오염시키지 않는다.

## 검증 결과

- reviewer 최종 PASS
- qa-engineer 최종 PASS
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter nexvoy-app exec expo install --check` 성공
- `pnpm --filter nexvoy-app lint` 성공 (기존 warning 7건)
- `pnpm build:mobile` 성공
- `pnpm build` 성공
- `pnpm --filter nexvoy-app build:preview:android:local` 성공
- `docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task015_key_provisioning.sql` 성공
- `git diff --check` 성공

## 잔여 검증

- Android preview APK 실제 device/emulator 설치, 실행, Logcat 검증은 후속 수동 검증으로 남긴다.
- iOS physical device에서 Keychain RSA-OAEP key generation/unwrap runtime 검증은 residual이다.
- native unwrap 결과 raw DEK가 JS로 transient 반환되는 구조는 후속 hardening에서 AES-GCM `extractable: false` 또는 native AES-GCM 확장으로 재검토한다.
