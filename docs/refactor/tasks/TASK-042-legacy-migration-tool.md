# TASK-042: Legacy Migration Tool

## 목적

Closed Beta 기준선에서는 기존 데이터를 무시하지만, 향후 필요 시 기존 row 데이터를 명시적으로 document-primary로
전환할 수 있는 migration tool을 만든다.

## 범위

- legacy trip/template scan
- 사용자가 선택한 항목만 migration
- row bundle -> `TripDocumentV1`/`TemplateDocumentV1` 변환
- encrypted snapshot/key/member bootstrap
- migration 결과 검증
- 실패 시 rollback/export

제외:

- Closed Beta 필수 gate
- 자동 silent migration
- legacy row 실시간 mirror

## 선행 조건

- `TASK-040-document-primary-product-path-cutover.md`
- `TASK-041-backup-freshness-and-cost-control.md`

## 변경 대상

- admin/dev migration script 또는 protected route
- `packages/core/src/local-first/migrations.ts`
- Supabase service role script
- migration runbook

## 구현 단계

1. legacy row-only 데이터 후보를 식별한다.
2. dry-run 변환과 validation report를 만든다.
3. 사용자가 선택한 데이터만 document-primary snapshot/key/member로 bootstrap한다.
4. 변환 후 Web/Mobile restore smoke를 수행한다.
5. 실패 항목은 원본 row를 유지하고 report에 남긴다.

## 데이터 호환성 고려사항

- 원본 legacy row는 migration 성공 후에도 즉시 삭제하지 않는다.
- migration은 idempotent해야 한다.
- 이미 document-primary document가 있는 항목은 overwrite하지 않는다.

## 검증 방법

- dry-run report가 row 수, 변환 entity 수, 누락 필드를 보여준다.
- 성공 migration 후 fresh Web/Mobile session에서 backup restore가 가능하다.
- 실패 migration은 원본 row를 변경하지 않는다.

## 롤백 방법

- 생성된 document/updates/keys/members를 migration batch id 기준으로 삭제한다.
- legacy row 원본을 계속 유지한다.

## 완료 조건

- 기존 데이터를 수동 선택 방식으로 안전하게 document-primary로 전환할 수 있다.
