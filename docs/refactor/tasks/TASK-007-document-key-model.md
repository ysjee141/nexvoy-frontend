# TASK-007: Document Key Model 및 암호화 PoC

## 목적

Server-wrapped key 모델을 기준으로 document snapshot/update 암호화와 key lifecycle의 최소 구현 가능성을 검증한다.

## 범위

- 클라이언트 DEK 생성
- snapshot/update 암호화/복호화 helper
- `document_keys` schema 초안 또는 migration
- member별 wrapped DEK 읽기/폐기 정책
- payload logging 금지 규칙

## 선행 조건

- `TASK-006-backup-schema-and-rls.md`
- `ADR-003` Option B + Server-wrapped key 결정

## 변경 대상

- `packages/core/src/sync/backupTypes.ts`
- `packages/core/src/sync/encryption.ts`
- `supabase/migrations/*.sql`
- `docs/refactor/adrs/ADR-003-backup-encryption-key-management.md` 필요 시 보강

## 구현 단계

1. snapshot/update 암호화 helper interface를 정의한다.
2. Web Crypto 기반 PoC를 Web에서 검증한다.
3. RN에서 사용할 crypto provider 요구사항을 분리한다.
4. `document_keys` RLS와 revoke 정책을 검토한다.
5. key unwrap 실패 시 restore error code를 정의한다.

## 데이터 호환성 고려사항

- 서버는 document 본문을 복호화하지 않는다.
- index/notification metadata는 ADR-006/009 기준의 최소 평문만 허용한다.
- 새 기기 복구 UX가 불가능한 방식은 채택하지 않는다.

## 검증 방법

- 암호화 후 원문과 다른 byte가 저장되는지 확인
- 같은 key로 복호화 성공, 다른 key로 실패 테스트
- revoked member가 `document_keys`를 읽지 못하는지 RLS 확인

## 롤백 방법

- encryption feature flag를 off로 두고 plain test blob 저장으로 되돌린다.
- production backup 기본값을 켜기 전까지만 rollback을 허용한다.

## 완료 조건

- snapshot/update 암호화 PoC가 통과한다.
- key revoke와 새 기기 복구에서 남은 질문이 문서화된다.
- 서버 로그에 payload가 남지 않는 정책이 명확하다.
