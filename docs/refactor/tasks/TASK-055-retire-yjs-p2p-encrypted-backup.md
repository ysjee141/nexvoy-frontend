# TASK-055: Retire Yjs, P2P, and Encrypted Backup Runtime

- 상태: 대기

## 목적

server-authority 제품 경로가 검증된 뒤 사용되지 않는 Yjs, WebRTC/P2P, signaling, app-layer encryption,
document update backup, key provisioning runtime을 제거한다. 중복 네트워크와 운영 책임을 끝낸다.

## 범위

- Web/Mobile/Core legacy runtime 및 export 제거
- Yjs, react-native-webrtc, ICE/signaling, native crypto dependency 정리
- backup queue/restore/key provisioning/background task 제거
- legacy sync status, dev migration UI, feature flag 제거
- Supabase legacy RPC/policy/table/column disable 및 단계적 cleanup
- V1 local/remote document/backup reset
- Technical Spec, architecture context, runbook 최종 갱신

제외:

- `document_members`와 targeted invitation registry 제거
- normalized authority row 삭제
- Supabase managed DB backup 제거

## 선행 조건

- `TASK-049-realtime-invalidation-and-revision-recovery.md`
- `TASK-050-web-server-authority-product-cutover.md`
- `TASK-052-mobile-server-authority-product-cutover.md`
- `TASK-053-membership-invitation-without-document-keys.md`
- `TASK-054-direct-asset-storage-and-delivery.md`

## 변경 대상

- `packages/core/src/local-first`
- `packages/core/src/sync`
- `apps/web/lib/local-first`
- `apps/mobile/lib/local-first`
- Web/Mobile package/config/native module
- `supabase/migrations`, function, RLS
- `docs/refactor`, `docs/develop-context`

## 구현 단계

1. telemetry와 code search로 신규 제품 경로가 legacy runtime을 호출하지 않는지 확인한다.
2. legacy feature flag를 기본 off로 배포하고 DEV에서 한 release window 동안 관측한다.
3. Web Yjs/P2P/backup/key service와 UI 상태를 제거한다.
4. Mobile WebRTC/Yjs/crypto/background provisioning code, config plugin, native dependency를 제거한다.
5. Core의 document mutation, Yjs codec, P2P, encryption, backup export와 테스트를 제거한다.
6. `document_updates`, `document_keys`, key request/material, signaling topic 관련 RPC/RLS를 먼저 revoke한다.
7. `documents`는 permission registry로 필요한 최소 metadata만 유지하고 snapshot/encryption column과 V1 payload를 정리한다.
8. DEV remote V1 backup과 Web/Mobile V1 local DB를 reset한다.
9. Production cleanup은 export, minimum supported app version, rollback 승인 후 별도 migration 단계로 실행한다.
10. package lock, Expo native project/config, docs에서 잔여 참조를 제거한다.

## 데이터 및 호환성 고려사항

- 기존 V1 document/backup을 normalized authority로 자동 변환하지 않는다.
- 이미 설치된 구 Mobile client가 제거된 RPC를 호출할 수 있으므로 minimum version gate 또는 유예 기간을 둔다.
- destructive migration 전 DB export와 적용 대상 DEV/PROD project를 명시적으로 확인한다.
- `document_members`와 invitation token/code는 새 authority에서도 사용하므로 삭제하지 않는다.

## 검증 방법

- `rg`로 Yjs/WebRTC/signaling/document key/backup queue active import가 없는지 확인한다.
- Web/Mobile network log에 signaling, key, `document_updates` 요청이 없는지 확인한다.
- package install, core tests, typecheck, Web build, Expo export, native development build를 통과한다.
- migration dry run과 DEV reset 후 새 계정/여행/초대/동기화가 정상인지 확인한다.

## 롤백 방법

- 코드 제거 전 release tag와 feature flag rollback을 준비한다.
- DB object drop 전 revoke-only 단계를 거치며, rollback 기간에는 table을 유지한다.
- destructive cleanup 이후에는 DB export/managed backup과 이전 release tag를 사용한다.

## 완료 조건

- 제품과 build dependency에서 Yjs/P2P/app E2EE/custom backup runtime이 제거된다.
- V1 document/backup 데이터가 새 제품 경로에 영향을 주지 않는다.
- Supabase managed row authority, Realtime invalidation, Storage만 원격 데이터 계층으로 남는다.
