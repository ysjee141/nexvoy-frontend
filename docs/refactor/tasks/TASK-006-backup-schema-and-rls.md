# TASK-006: Supabase Backup Schema 및 RLS

## 목적

암호화된 CRDT snapshot/update를 저장하기 위한 Supabase backup schema와 최소 RLS 정책을 추가한다.

## 범위

- `documents`
- `document_updates`
- `document_devices`
- `legacy_row_map`
- 초기 RLS policy
- local Supabase reset 가능성 확인

## 선행 조건

- `docs/refactor/TECHNICAL-SPEC.md` 9장
- `ADR-001` 보안 결정
- `ADR-003` 암호화 backup 결정

## 변경 대상

- `supabase/migrations/*.sql`
- `packages/types` DB 타입 갱신이 필요한 경우 관련 파일
- RLS policy 테스트 SQL 또는 문서

## 구현 단계

1. backup table migration을 작성한다.
2. 모든 신규 테이블에 RLS를 활성화한다.
3. owner/editor/viewer 권한별 read/write policy를 최소 구현한다.
4. `legacy_row_map` unique constraint를 추가한다.
5. 로컬 Supabase reset으로 재현 가능성을 확인한다.

## 데이터 호환성 고려사항

- 기존 row table은 삭제하거나 primary 역할을 바꾸지 않는다.
- `documents.id`는 기존 `trips.id`와 같을 수 있어야 한다.
- `document_updates`는 client id + seq 중복 insert를 막아야 한다.

## 검증 방법

- `supabase db reset --local`
- owner/editor/viewer 권한별 insert/read 차단 확인
- migration rollback 필요 시 down path 또는 보상 migration 계획 작성

## 롤백 방법

- 신규 테이블만 제거하는 보상 migration을 작성한다.
- 기존 서비스 테이블을 건드리지 않아야 한다.

## 완료 조건

- backup/update row를 저장할 schema가 있다.
- RLS가 모든 신규 테이블에 적용된다.
- 기존 Supabase row 기반 기능에 영향이 없다.
