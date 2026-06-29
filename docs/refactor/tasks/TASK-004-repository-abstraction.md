# TASK-004: Repository Abstraction 도입

## 목적

화면이 Supabase query를 직접 호출하지 않도록 도메인 Repository 인터페이스를 도입하고, 첫 구현체는 기존 Supabase query를 감싸 동작 동일성을 유지한다.

## 범위

- `TripRepository`, `ChecklistRepository` 인터페이스
- `SupabaseTripRepository`, `SupabaseChecklistRepository`
- Web checklist 화면의 최소 연결
- Mobile trip detail 화면 연결 가능성 조사

## 선행 조건

- `docs/refactor/TECHNICAL-SPEC.md` 6장
- 기존 `packages/core/src/supabase/queries.ts` 동작 확인

## 변경 대상

- `packages/core/src/repositories/types.ts`
- `packages/core/src/supabase/legacyRepository.ts`
- `apps/web/app/trips/checklist/ChecklistClient.tsx`
- `apps/mobile/app/trip/[id].tsx`

## 구현 단계

1. repository interface를 `packages/core`에 정의한다.
2. 기존 Supabase query helper를 감싸는 legacy repository를 작성한다.
3. Web checklist 화면에서 repository factory를 통해 기존 동작을 호출한다.
4. Mobile 적용 범위는 별도 PR로 분리할 수 있도록 TODO와 adapter 경계를 남긴다.
5. 기존 query helper는 제거하지 않는다.

## 데이터 호환성 고려사항

- 이 단계에서는 원본 DB가 계속 Supabase row다.
- mutation 결과와 error handling이 기존 화면과 달라지면 안 된다.
- legacy fallback을 유지해 rollback 가능해야 한다.

## 검증 방법

- `pnpm build`
- 기존 checklist 생성/수정/삭제 수동 확인 또는 E2E
- repository mock으로 최소 unit test 작성

## 롤백 방법

- 화면 호출부를 기존 query 호출로 되돌린다.
- repository 파일은 미사용 상태로 남겨도 런타임 영향은 없다.

## 완료 조건

- UI 호출 경계에 repository interface가 생긴다.
- 기존 Supabase 기반 동작이 동일하다.
- 후속 `LocalFirstRepository`를 끼울 수 있는 factory 경계가 있다.
