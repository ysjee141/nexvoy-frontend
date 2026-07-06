# TASK-016: Mobile Native Key Provisioning and Background Sync

## 목적

`TASK-015`에서 Web foreground 범위로 구현한 owner-side document key provisioning을 Mobile native runtime까지 확장한다.

초대받은 사용자가 Mobile에서도 device-level wrapping material을 등록하고, owner/editor Mobile 기기가 pending provisioning request를 실제로 처리할 수 있어야 한다. 또한 앱 foreground 진입, trip detail 진입, background sync 기회에서 pending request를 안전하게 재시도한다.

## 범위

- Mobile RSA-OAEP-256 wrapping provider
- Mobile device key material 생성/보관/등록
- Mobile invited member status/retry UX의 실제 key material 연결
- Mobile owner/editor pending provisioning processor
- foreground/background sync trigger
- native runtime 검증(EAS local build, 실제 device, Logcat)
- content-free observability/notification event 연결

## 선행 조건

- `TASK-007-document-key-model.md`
- `TASK-008-backup-queue-and-restore.md`
- `TASK-013-invitation-permission-registry.md`
- `TASK-014-notification-and-observability.md`
- `TASK-015-owner-side-document-key-provisioning.md`
- `ADR-003-backup-encryption-key-management.md`
- `ADR-011-invitation-key-provisioning-strategy.md`
- `docs/develop-context/mobile-app-verification-lifecycle.md`

## 변경 대상

- `apps/mobile/lib/local-first/*`
- `apps/mobile/lib/crypto/*` 또는 platform adapter 경계
- `apps/mobile/app/join.tsx`
- `apps/mobile/app/trip/[id].tsx`
- `apps/mobile/lib/observability.ts`
- `apps/mobile/app.config.js`
- `apps/mobile/package.json`
- `packages/core/src/sync/*` (필요 시 provider contract 보강)
- `packages/core/src/supabase/invitationRepository.ts` (필요 시 mobile caller contract 보강)
- `supabase/migrations/*.sql` (필요 시 background/status 보강)

## 구현 단계

1. Mobile crypto provider를 선정한다.
   - `RSA-OAEP-256` wrap/unwrap을 지원해야 한다.
   - private key export/storage 정책을 명확히 한다.
   - Expo Go가 아닌 dev client/preview build 기준으로 검증한다.

2. Mobile device key material lifecycle을 구현한다.
   - device id는 안정적으로 보관한다.
   - private key는 OS secure storage 또는 native keystore 경계에 둔다.
   - Supabase에는 public JWK 또는 서버가 복호화할 수 없는 public material만 등록한다.
   - logout/withdrawal 시 local material 정리 또는 revoke 정책을 정의한다.

3. Mobile invited member join/restore flow를 연결한다.
   - join 전후 `registerUserKeyMaterial`을 호출한다.
   - `requestDocumentKeyProvisioning`과 status retry를 실제 device material 기준으로 수행한다.
   - active `document_keys`가 생기면 restore를 재시도한다.

4. Mobile owner/editor foreground processor를 구현한다.
   - trip detail 또는 collaborator sheet 진입 시 pending request를 조회한다.
   - 현재 Mobile 기기가 document DEK를 보유하거나 unwrap할 수 있을 때만 처리한다.
   - 처리 불가 시 request를 failed로 오염시키지 않고 pending/안내 상태로 둔다.
   - wrapped DEK만 `completeDocumentKeyProvisioning`에 전달한다.

5. Background sync trigger를 설계한다.
   - 앱 foreground/resume 시 lightweight processor를 실행한다.
   - OS background task는 배터리/네트워크 제약을 고려해 best-effort로 둔다.
   - 중복 실행, stale processing timeout, retry backoff와 충돌하지 않게 한다.

6. Observability/notification을 연결한다.
   - `document_key_provisioning_pending/completed/failed` 계열 이벤트는 content-free sanitizer를 통과한다.
   - push/log/analytics에 raw DEK/KEK/private key/document content/CRDT blob/token을 넣지 않는다.
   - reason code는 allowlist 값만 사용한다.

7. Native runtime 검증을 수행한다.
   - `pnpm --filter nexvoy-app typecheck`
   - `pnpm build:mobile`
   - `pnpm --filter nexvoy-app exec expo install --check`
   - `pnpm --filter nexvoy-app build:preview:android:local`
   - 실제 Android device 설치/실행
   - Logcat crash/crypto provider/native module 오류 확인

## 데이터 호환성 고려사항

- `TASK-015`의 `user_key_materials`, `document_key_provisioning_requests`, device-scoped `document_keys` contract를 유지한다.
- Web에서 등록한 device material과 Mobile에서 등록한 device material은 서로 다른 device row로 취급한다.
- 기존 Web-only pending request는 Mobile material 등록 후 재요청 또는 status refresh로 device-specific request를 생성할 수 있어야 한다.
- legacy AES-KW owner key와 Web/Mobile RSA-OAEP device key가 동시에 존재해도 restore/provisioning 경로가 혼동되지 않아야 한다.

## 보안 원칙

- 서버는 raw DEK/KEK/private key를 저장하거나 반환하지 않는다.
- Mobile private key는 Supabase, analytics, push, log에 절대 전달하지 않는다.
- owner/editor 권한 검증은 Supabase RPC가 최종 경계다.
- viewer/unrelated user는 pending provisioning request를 처리할 수 없다.
- revoked member의 active key와 pending/processing request는 사용할 수 없어야 한다.
- background task 실패는 사용자 흐름을 차단하지 않되, sensitive detail 없이 safe error code만 남긴다.

## 검증 방법

- Mobile invited member가 public material을 등록하고 pending request를 생성하는지 확인한다.
- Web owner/editor가 Mobile member의 request를 처리한 뒤 Mobile restore가 가능한지 확인한다.
- Mobile owner/editor가 pending request를 처리해 invited member restore가 가능한지 확인한다.
- Mobile private key가 DB/RPC/log/analytics/push payload에 노출되지 않는지 확인한다.
- app foreground/resume과 trip detail 진입에서 중복 없이 pending processor가 동작하는지 확인한다.
- offline/poor network에서 request가 failed로 오염되지 않고 retry 가능한 상태로 남는지 확인한다.
- revoke 후 Mobile restore/update/P2P write가 차단되는지 확인한다.
- EAS preview APK를 실제 device에 설치하고 Logcat에서 native crypto crash가 없는지 확인한다.

## 롤백 방법

- Mobile native provisioning processor와 background task registration을 비활성화한다.
- Mobile은 `TASK-015`의 status/retry 안내만 유지한다.
- `user_key_materials`에 등록된 Mobile material은 revoke RPC 또는 cleanup migration으로 비활성화한다.
- Web foreground provisioning 경로와 existing `document_keys` rows는 유지한다.

## 완료 조건

- Mobile invited member가 device material을 등록하고 active wrapped key를 받은 뒤 encrypted snapshot을 복구할 수 있다.
- Mobile owner/editor가 raw DEK/KEK를 서버에 노출하지 않고 pending member용 wrapped key를 발급할 수 있다.
- foreground/background trigger가 중복/오염 없이 best-effort provisioning을 수행한다.
- Mobile native build와 실제 device runtime 검증을 통과한다.
- reviewer와 qa-engineer 최종 verdict가 PASS다.
