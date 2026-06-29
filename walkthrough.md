# Walkthrough: TASK-005 Web IndexedDB + Yjs Checklist Spike

## Summary

Web checklist 화면에서 feature flag로 켤 수 있는 local-first spike를 추가했다. 기본값은 기존 Supabase row repository이며, spike mode에서는 Yjs Trip document를 IndexedDB에 저장하고 checklist create/update/delete/toggle을 Supabase write 없이 로컬 document에 반영한다.

## Artifacts

- GitHub Issue: `#262`
- `docs/refactor/tasks/TASK-005-web-indexeddb-yjs-checklist-spike.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/refactor/adrs/ADR-001-local-first-data-engine.md`

## Key Changes

- `packages/core/src/local-first/yjsTripDocument.ts`에 Trip document용 Yjs encode/apply/read/write helper를 추가했다.
- Yjs helper는 모바일 번들 유입을 막기 위해 루트 export가 아니라 `@nexvoy/core/local-first/yjsTripDocument` subpath로만 노출한다.
- `apps/web/lib/local-first/indexedDbStore.ts`에 Web-only IndexedDB persistence와 BroadcastChannel update notification을 추가했다.
- `apps/web/lib/local-first/localFirstChecklistRepository.ts`에 Yjs/IndexedDB 기반 checklist repository spike를 추가했다.
- `apps/web/lib/local-first/repositoryFactory.ts`가 `NEXT_PUBLIC_LOCAL_FIRST_CHECKLIST_SPIKE=1`, `?localFirstChecklist=1`, 또는 `localStorage` flag에서 local-first repository를 선택한다.
- `ChecklistClient`는 local-first mode에서 네트워크가 없어도 add/update/delete/toggle UI를 사용할 수 있고, 템플릿 적용은 Supabase write 방지를 위해 숨긴다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm build` 성공
- `pnpm --filter nexvoy-app lint` 성공 (기존 warning 6건)
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm build:mobile` 성공
- reviewer 재검토 PASS
- QA 재검토 PASS

## Notes

- feature flag 기본값은 off라 기존 production checklist 화면은 Supabase repository를 계속 사용한다.
- 수동 브라우저 검증 경로: `/trips/checklist?id=<tripId>&localFirstChecklist=1`에서 항목 추가/수정/삭제/체크 후 새로고침 복원을 확인한다. `?localFirstChecklist=0`으로 localStorage flag를 끌 수 있다.
