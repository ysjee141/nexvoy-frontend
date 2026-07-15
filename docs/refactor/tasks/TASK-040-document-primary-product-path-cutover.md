# TASK-040: Document-Primary Product Path Cutover

- 상태: 완료
- GitHub Issue: #339

## 목적

여행, 일정, 준비물, 템플릿 화면이 기존 row hydrate/fallback에 의존하지 않고 document-primary repository를
제품 경로로 사용하도록 정리한다.

## 범위

- Web 여행 목록/상세/일정/준비물 document-primary read path 정리
- Mobile 여행 목록/상세/일정/준비물 document-primary read path 정리
- Web/Mobile 템플릿 list/detail/apply document-primary 정리
- legacy row 자동 hydrate 제거
- 기존 데이터 미노출 처리

제외:

- 기존 데이터 마이그레이션 UI
- 검색/index 전용 read model 최적화
- Realtime freshness policy

## 선행 조건

- `TASK-039-new-document-bootstrap.md`

## 변경 대상

- `apps/web/app/trips/*`
- `apps/web/app/templates/*`
- `apps/mobile/app/*`
- `apps/web/lib/local-first/documentPrimaryRepositories.ts`
- `apps/mobile/lib/local-first/documentPrimaryRepositories.ts`
- repository factory / feature flag

## 구현 단계

1. 목록은 document registry/backup metadata 또는 local document list 기준으로 재정의한다. ✅
2. 상세/일정/준비물은 local document 없을 때 backup restore만 시도한다. ✅
3. legacy row hydrate fallback을 제품 경로에서 제거한다. ✅
4. 템플릿도 `TemplateDocumentV1` 기준으로 전환한다. ✅
5. 기존 row 데이터가 화면에 나타나지 않는지 확인한다. ✅

## 데이터 호환성 고려사항

- 기존 row 데이터는 삭제하지 않지만 화면에서 자동 노출하지 않는다.
- 기존 데이터 migration은 TASK-042에서 사용자가 명시적으로 실행하는 도구로 분리한다.
- read model/index table이 필요하면 document에서 파생된 비권위 데이터로 제한한다.

## 검증 방법

- 신규 여행/일정/준비물/템플릿이 Web/Mobile 양쪽에서 document repository로 보인다.
- 기존 row-only 여행/템플릿은 제품 목록에 나타나지 않는다.
- legacy row hydrate 호출이 제품 진입 경로에서 제거된다.

## 롤백 방법

- document-primary feature flag를 끄고 legacy 화면으로 복귀한다.

## 완료 조건

- Closed Beta 제품 화면은 신규 document-primary 데이터만 대상으로 한다.
