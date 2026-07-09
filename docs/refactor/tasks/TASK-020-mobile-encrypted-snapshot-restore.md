# TASK-020: Mobile Encrypted Snapshot Restore

## 목적

`TASK-008`은 Web 기준으로 snapshot download → updates replay → read model 재생성 순서의 restore flow를 구현했다. 하지만 Mobile은 Yjs/lib0가 요구하는 `isomorphic-webcrypto`를 React Native 번들에서 사용할 수 없어 동일한 restore 파이프라인을 그대로 재사용하지 못한다(`apps/mobile/lib/local-first/documentBootstrapService.ts`의 `createInitialMobileSnapshotPayload` 주석 참고).

이 작업은 Mobile 전용 encrypted snapshot restore 경로를 정의하고, `TASK-019`에서 owner device가 새 active key를 확보한 뒤 restore를 재시도하는 흐름을 연결한다.

## 범위

- Mobile에서 사용 가능한 snapshot 다운로드/복호화/적용 경로 설계 (Yjs 의존 없이)
- active document key 미보유로 실패했던 restore를 key 확보 후 재시도하는 흐름
- restore 성공 시 device-scoped RSA key row가 없으면 bootstrap하는 연결 (`TASK-019`의 `ensureMobileOwnerDocumentKey`/`bootstrapMobileDeviceDocumentKey` 재사용)
- "복구 후 자동 준비" 등 restore 상태에 대한 first-device/recovery UX copy
- corruption/hash mismatch 등 실패 상태의 Mobile UX 처리

## 선행 조건

- `TASK-008-backup-queue-and-restore.md`
- `TASK-016-mobile-native-key-provisioning-and-background-sync.md`
- `TASK-017-mobile-background-provisioning-sync.md`
- `TASK-018-mobile-non-exportable-key-storage.md`
- `TASK-019-mobile-first-owner-key-bootstrap.md`

## 변경 대상

- `apps/mobile/lib/local-first/documentBootstrapService.ts`
- `apps/mobile/lib/local-first/keyProvisioningService.ts`
- `apps/mobile/app/trip/[id].tsx`
- `packages/core/src/sync/restore.ts` (Yjs 의존 부분을 Mobile에서 우회할 수 있는 경계 확인/분리)
- `packages/core/src/supabase/backupRepository.ts`
- `docs/refactor/tasks/README.md`
- `walkthrough.md`

## 구현 단계

1. `packages/core/src/sync/restore.ts`의 restore state machine 중 Yjs/lib0에 의존하지 않는 부분(snapshot download, 복호화, hash 검증)과 의존하는 부분(updates replay)을 구분한다.
2. Mobile에서 사용할 수 있는 restore 경로를 설계한다. 최소 범위는 snapshot 복호화까지이며, updates replay가 필요한 경우 Mobile 호환 방식을 별도로 검토한다.
3. active document key가 없어 실패했던 restore를 key 확보(=`ensureMobileOwnerDocumentKey`/provisioning 완료) 이후 재시도하는 트리거를 연결한다.
4. restore 성공 후 현재 device의 RSA key row가 없으면 `bootstrapMobileDeviceDocumentKey`를 호출해 device-scoped row를 생성한다.
5. UX를 정리한다.
   - "복구 후 자동 준비" 등 restore 진행/완료 상태에 대한 generic copy를 추가한다.
   - corruption/hash mismatch 등 실패 상태를 raw error 없이 안내한다.

## 데이터 호환성 고려사항

- restore 결과가 Web에서 생성된 snapshot과 의미상 동일해야 한다.
- Mobile이 생성한 minimal snapshot(`documentBootstrapService.ts`의 marker payload)과 향후 정식 Yjs 기반 snapshot이 공존할 수 있어야 한다.
- restore 실패가 기존 local 데이터를 훼손하면 안 된다.

## 보안 원칙

- restore된 평문 document/CRDT blob은 log/analytics/push에 노출하지 않는다.
- restore 실패 시 원인(hash mismatch, key 없음 등)을 generic reason code로만 다루고 raw error/provider detail을 노출하지 않는다.

## 검증 방법

- Mobile invited member가 active key 수신 후 encrypted snapshot restore를 재시도해 성공하는지 확인한다.
- restore 성공 후 owner/editor device가 pending provisioning request를 처리할 수 있는지 확인한다.
- hash mismatch/corruption 시 restore가 안전하게 실패하고 기존 local 데이터가 보존되는지 확인한다.
- offline/poor network에서 restore 재시도가 failed로 오염되지 않는지 확인한다.
- `pnpm build`, `pnpm build:mobile`, preview APK/device/Logcat 검증을 수행한다.

## 롤백 방법

- Mobile restore 재시도 트리거를 비활성화하고 기존 `owner_device_key_unavailable` pending 상태 UX로 되돌린다.
- 문제가 있는 snapshot/row는 별도 cleanup script로 정리한다.

## 완료 조건

- Mobile invited/owner device가 active key 수신 후 encrypted snapshot restore를 재시도할 수 있다.
- restore 성공 시 device-scoped RSA key row가 자동으로 bootstrap된다.
- restore 실패/진행 상태가 raw error 없이 generic copy로 노출된다.
- reviewer와 qa-engineer 최종 verdict가 PASS다.
