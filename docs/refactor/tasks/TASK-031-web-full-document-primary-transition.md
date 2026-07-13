# TASK-031: Web Full Document-primary Transition

## 목적

Web 제품 화면의 핵심 기능을 legacy Supabase row primary에서 Local-first document-primary repository로 전환한다.
Closed Beta에서 Web이 완성 제품 경로로 동작하기 위한 단계다.

## 범위

- Web 준비물 document-primary 승격
  - dual-write 의존 축소
  - template apply document mutation 연결
- Web 일정 document-primary 전환
  - 일정 추가/수정/삭제
  - 방문 여부
  - plan URLs
  - 장소 사진 reference
  - 알림 metadata
- Web 템플릿 전환
  - ADR-013 결정에 따른 Template document 또는 repository 적용
  - 템플릿 생성/수정/삭제/적용
- Web 동행자/권한 UI 정리
  - 초대 생성
  - 수락/거부 후 member snapshot 반영
  - role 변경/revoke 반영
- Web local store subscription 정리

제외:

- Mobile 화면 전환
- full integration test 작성
- Closed Beta 운영 작업

## 선행 조건

- `TASK-029-full-local-first-product-scope-adr.md`
- `TASK-030-document-primary-repository-layer.md`

## 변경 대상

- `apps/web/app/trips/detail/`
- `apps/web/app/trips/checklist/`
- `apps/web/app/templates/`
- `apps/web/app/join/`
- `apps/web/lib/local-first/`
- `packages/core/src/repositories/`

## 구현 단계

1. Web repository factory의 document-primary mode를 추가한다.
2. 준비물 화면에서 dual-write를 제거하거나 fallback 뒤로 내린다.
3. 일정 화면 CRUD를 PlanRepository로 전환한다.
4. 템플릿 화면을 TemplateRepository로 전환한다.
5. 동행자 UI를 MemberRepository/permission registry와 연결한다.
6. document update subscription으로 준비물/일정/멤버 read model을 갱신한다.
7. legacy row fallback은 read-only migration fallback으로 제한한다.

## 데이터 호환성 고려사항

- 기존 trip 진입 시 legacy row bundle을 document로 hydrate해야 한다.
- row id 기반 URL/route가 유지되어야 한다.
- 기존 공유 링크/초대 링크가 document registry로 bootstrap되어야 한다.

## 검증 방법

- Web에서 준비물/일정/템플릿/동행자 기능이 legacy row write 없이 동작하는지 확인한다.
- 기존 row 데이터로 만든 여행이 최초 진입 시 document로 정상 hydrate되는지 확인한다.
- Web-to-Web P2P가 준비물뿐 아니라 일정/멤버 변경에도 적용 가능한지 smoke 확인한다.
- `pnpm typecheck`, `pnpm build`, core tests 통과.

## 롤백 방법

- feature flag로 Web repository mode를 legacy/dual-write로 되돌린다.

## 완료 조건

- Web 핵심 기능이 document-primary repository를 통해 동작한다.
- Web에서 legacy row write 없이 기존 제품 기능을 사용할 수 있다.
- Web Closed Beta 후보 경로가 document-primary로 고정된다.
