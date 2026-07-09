# TASK-019: Mobile-first Owner Key Bootstrap

## 목적

`TASK-016` MVP는 Mobile owner/editor 기기가 이미 active RSA document key를 보유한 경우에만 다른 member의 provisioning request를 완료할 수 있다.

이 작업은 Web 또는 이미 준비된 다른 owner/editor device 없이도 첫 Mobile owner device가 문서 DEK를 안전하게 확보하고 device-scoped active key를 bootstrap할 수 있는 경로를 정의한다.

## 범위

- Mobile document creation/guest promotion/auth promotion 경로의 DEK lifecycle 분석
- Mobile owner device RSA key bootstrap
- legacy AES-KW owner key와 device RSA key의 전환/공존 정책
- owner/editor bootstrap과 provisioning processor 연결
- first-device UX와 pending-device state copy
- SQL/RPC contract 보강 필요성 검토

> **범위 제외**: encrypted snapshot restore 재시도와 관련 recovery UX는 `TASK-020-mobile-encrypted-snapshot-restore.md`로 이관했다. 모바일 앱은 아직 snapshot restore 파이프라인 자체가 없어(Web의 Yjs 기반 restore를 그대로 쓸 수 없음), 이 작업의 owner key bootstrap 범위와 분리해서 다룬다.

## 선행 조건

- `TASK-007-document-key-model.md`
- `TASK-008-backup-queue-and-restore.md`
- `TASK-012-guest-auth-promotion.md`
- `TASK-015-owner-side-document-key-provisioning.md`
- `TASK-016-mobile-native-key-provisioning-and-background-sync.md`
- `ADR-003-backup-encryption-key-management.md`
- `ADR-011-invitation-key-provisioning-strategy.md`

## 변경 대상

- `apps/mobile/lib/local-first/keyProvisioningService.ts`
- `apps/mobile/lib/local-first/mobileCryptoProvider.ts`
- `apps/mobile/app/trip/[id].tsx`
- Mobile document creation/promotion/restore 관련 파일
- `packages/core/src/supabase/backupRepository.ts`
- `packages/core/src/sync/encryption.ts`
- `supabase/migrations/*.sql` (필요 시 owner bootstrap RPC 보강)
- `docs/refactor/tasks/README.md`
- `walkthrough.md`

## 구현 단계

1. Mobile document DEK source를 확인한다.
   - Mobile에서 새 trip/document 생성 시 DEK가 어디서 만들어지는지 확인한다.
   - restore 시 active wrapped key를 unwrap한 DEK가 어디까지 전달되는지 확인한다.
   - guest/auth promotion 경로에서 Mobile DEK가 보존되는지 확인한다.

2. Owner device bootstrap helper를 설계한다.
   - current Mobile device material을 보장한다.
   - current document DEK를 current device public key로 RSA-OAEP wrap한다.
   - `upsert_owner_document_key` 또는 별도 RPC로 device-scoped `document_keys` row를 저장한다.

3. Legacy AES-KW fallback 정책을 결정한다.
   - Mobile이 legacy AES-KW owner key를 unwrap할지 여부를 명확히 한다.
   - 권장 기본값은 legacy AES-KW unwrap을 Mobile에서 새로 추가하지 않고, DEK를 실제로 보유한 creation/restore moment에서 RSA row를 bootstrap하는 것이다.

4. ~~Restore flow와 연결한다.~~ → `TASK-020-mobile-encrypted-snapshot-restore.md`로 이관.

5. Owner/editor processor와 연결한다.
   - bootstrap 완료 후 pending member request를 처리한다.
   - bootstrap 전에는 request를 failed로 오염시키지 않는다.

6. UX를 정리한다.
   - "이 기기 데이터 준비 중", "다른 기기에서 준비 필요" 같은 generic copy를 사용한다.
   - raw key/error/provider detail은 표시하지 않는다.
   - "복구 후 자동 준비" copy는 restore 흐름과 함께 `TASK-020`에서 다룬다.

## 데이터 호환성 고려사항

- legacy AES-KW owner row와 device RSA-OAEP row는 동시에 존재할 수 있다.
- device RSA row는 `user_key_materials` active material과 연결되어야 한다.
- revoked material 또는 revoked member의 device key는 active로 반환되지 않아야 한다.
- server는 raw DEK/KEK를 받지 않고 wrapped DEK만 저장한다.

## 보안 원칙

- Mobile owner bootstrap은 client가 이미 문서 DEK를 보유한 순간에만 수행한다.
- RPC는 caller가 document owner/editor/member인지 재검증해야 한다.
- Supabase/log/analytics/push에는 raw DEK, private key, document content, CRDT blob, token을 넣지 않는다.
- "first owner bootstrap"을 위해 서버에 복호화 가능한 key escrow를 추가하지 않는다.

## 검증 방법

- Mobile에서 새 document를 만든 owner device가 device-scoped RSA key row를 생성하는지 확인한다.
- Mobile owner/editor device가 bootstrap 완료 후 pending provisioning request를 처리할 수 있는지 확인한다.
- Web 없이 Mobile owner + Mobile invited member 조합에서 accepted member가 active wrapped key를 받는지 확인한다.
- revoked material/member가 active key lookup에서 제외되는지 확인한다.
- offline/poor network에서 bootstrap/provisioning request가 failed로 오염되지 않는지 확인한다.
- `pnpm build`, `pnpm build:mobile`, preview APK/device/Logcat 검증을 수행한다.

## 롤백 방법

- Mobile owner bootstrap helper 호출을 비활성화한다.
- Web foreground provisioning과 TASK-016 foreground processor를 유지한다.
- 신규 device RSA rows가 문제를 일으키면 해당 material/device rows를 revoke하고 기존 legacy/Web path로 복구한다.

## 완료 조건

- 첫 Mobile owner device가 Web 도움 없이 자기 device-scoped active RSA key를 bootstrap할 수 있다.
- Mobile owner/editor가 bootstrap 후 pending member key provisioning을 완료할 수 있다.
- raw DEK/KEK/private key/document content가 서버/log/analytics/push에 노출되지 않는다.
- reviewer와 qa-engineer 최종 verdict가 PASS다.

> encrypted snapshot restore 재시도는 `TASK-020-mobile-encrypted-snapshot-restore.md`의 완료 조건으로 이관했다.
