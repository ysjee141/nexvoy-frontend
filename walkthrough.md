# Walkthrough: Checklist Web/App Alignment

## Summary

체크리스트를 사용자 화면에서는 “준비물”로 일관되게 다루고, 웹/앱의 템플릿 및 여행 준비물 기능 차이를 줄였다. 기존 웹에 없던 사용자 카테고리 관리, 템플릿 공유, 다중 담당자 모델을 Supabase 스키마와 core helper에 추가하고 웹/모바일 UI에 반영했다.

## Artifacts

- `docs/request_checklist.md`
- `.cursor/plans/checklist alignment-931a21ac.plan.md` (수정하지 않음)

## Key Changes

- `supabase/migrations/20260623000001_checklist_alignment.sql`에 사용자 카테고리, 템플릿 공유, 준비물 다중 담당자 테이블과 RLS 정책을 추가했다.
- `@nexvoy/types`와 `@nexvoy/core`에 카테고리 CRUD, 템플릿 접근 권한, 템플릿 공유 관리, 다중 담당자/개인별 체크 helper를 추가했다.
- 웹 템플릿 화면은 내 템플릿/공유 템플릿/기본 템플릿 접근 구분을 표시하고, 템플릿 폼에서 카테고리 생성/수정/삭제와 항목 비공개 설정을 관리한다.
- 웹 준비물 화면은 완료 항목 숨김, 다중 담당자 선택, 담당자별 체크 카운트, 공유 템플릿 적용을 지원한다.
- 모바일 템플릿 목록/생성/수정 화면은 접근 배지, 항목별 카테고리, 비공개 설정을 보존한다.
- 모바일 여행 상세 준비물 탭은 카테고리별/템플릿별 보기, 상태순/가나다순, 완료 숨김, 담당자/모두 체크 상태를 반영한다.

## Verification

- `pnpm --filter @nexvoy/types typecheck` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- `cd apps/web && pnpm test:e2e -- e2e/checklist.spec.ts` 성공 (3 passed)

## Notes

- 기존 `checklist_items.assigned_user_id`는 호환용으로 유지하고, 새 `checklist_item_assignees` 테이블로 다중 담당자를 저장한다.
- 오프라인 모드는 정책상 읽기 전용이므로 편집 UI는 온라인 준비물 화면에서만 동작하도록 유지했다.
