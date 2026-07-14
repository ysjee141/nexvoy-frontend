# TASK-039: New Document Bootstrap

## 목적

신규 여행과 템플릿을 처음부터 document-primary 기준으로 생성한다. 생성 시점에 local document, encrypted initial
snapshot, owner membership, current device document key를 함께 준비해 `key_unavailable` 전환기 상태를 만들지 않는다.

## 범위

- Web 신규 여행 생성 document-primary 전환
- Mobile 신규 여행 생성 document-primary 전환
- Web/Mobile 신규 템플릿 생성 document-primary 전환
- initial encrypted snapshot upload
- owner `document_members` bootstrap
- current device `document_keys` bootstrap

제외:

- 기존 row 데이터 migration
- P2P lifecycle 변경
- snapshot compaction 정책 변경

## 선행 조건

- `TASK-038-closed-beta-baseline-reset-plan.md`

## 변경 대상

- `apps/web/app/trips/new`
- `apps/mobile/app` 신규 여행 생성 화면/서비스
- Web/Mobile template creation flow
- `packages/core/src/local-first`
- `apps/web/lib/local-first/*`
- `apps/mobile/lib/local-first/*`
- 필요 시 Supabase RPC/migration

## 구현 단계

1. 신규 `TripDocumentV1` 생성 helper를 owner/device bootstrap과 묶는다.
2. Web 신규 여행 생성이 legacy `trips` write를 primary로 사용하지 않도록 전환한다.
3. Mobile 신규 여행 생성도 같은 bootstrap contract를 사용한다.
4. 신규 `TemplateDocumentV1` 생성 경로를 동일한 기준으로 전환한다.
5. 생성 직후 local read, backup restore, 다른 기기 restore smoke를 검증한다.

## 데이터 호환성 고려사항

- 신규 document id는 기존 row id 호환을 고려하지 않아도 된다.
- legacy row는 생성하지 않거나, 필요하면 검색/index용 비권위 read model로만 생성한다.
- owner device key 생성 실패 시 여행/템플릿 생성 완료로 보지 않는다.

## 검증 방법

- 신규 여행 생성 후 local storage에 `TripDocumentV1`이 존재한다.
- Supabase `documents.snapshot`과 `document_keys`가 즉시 존재한다.
- 같은 계정의 새 Web session이 backup restore로 여행을 볼 수 있다.
- Web/Mobile 신규 템플릿 생성도 같은 기준을 만족한다.

## 롤백 방법

- 신규 생성 feature flag를 legacy create flow로 되돌린다.
- 생성 중 실패한 partial document/registry/key row를 cleanup script로 정리한다.

## 완료 조건

- 신규 여행/템플릿은 legacy migration 없이 document-primary로 시작한다.
- 생성 직후 backup restore가 가능한 상태다.
