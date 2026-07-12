# TASK-022: Document Registry Bootstrap for Regular Trips

## 목적

`TASK-021` 수동 검증 중 발견한 문제: 일반적으로 로그인해 만든 trip은 `public.documents`/
`public.document_members`에 전혀 등록되지 않는다. 코드 추적 결과 이 두 테이블에 row를 쓰는 경로는
`apps/web/lib/local-first/guestPromotionService.ts`(guest 계정 승격)와 Mobile의 owner key bootstrap
흐름(`TASK-019`)뿐이며, 일반 Web 로그인 사용자가 trip을 만들거나 checklist를 쓰는 통상적인 흐름에는
document 등록 코드가 없다. `document_invitation_links`의 `document_id` FK가
`public.documents(id)`를 참조하므로, documents row가 없으면 초대 링크 생성조차 실패한다(자동
부트스트랩 없음).

이 상태로는 `TASK-006`(backup schema), `TASK-008`(backup/restore), `TASK-013`(초대), `TASK-021`(P2P
signaling) 전부가 일반 계정으로는 실질적으로 테스트도, 사용도 불가능하다. 이 task는 일반 사용자의
trip이 자연스럽게 `documents`/`document_members`에 등록되도록 만든다.

## 범위

- 일반(비-guest) 로그인 사용자가 trip을 생성하거나 checklist를 처음 사용할 때 `documents` row(소유자
  기준)와 `document_members` owner row(role='owner', status='accepted')를 자동 생성
- 이미 존재하는(마이그레이션 이전에 만들어진) trip에 대한 lazy backfill 전략 — 배치 마이그레이션이
  아니라 사용자가 해당 trip에 접근하는 시점에 채우는 방식 채택 여부 결정
- `guestPromotionService.ts`의 `upsertOwnerMember` 재사용(중복 구현 금지)
- 동시 접근/중복 호출에 대한 idempotency (documents.id PK, document_members unique index 활용)
- bootstrap 실패가 기존 legacy row 기반 checklist 동작에 영향을 주지 않아야 한다(dual-write 원칙)

제외:

- 기존 trip 전체에 대한 일괄 배치 backfill(운영 스크립트) — 필요성이 확인되면 별도 task
- 초대된 멤버(editor/viewer)의 document_members 생성 — 이는 이미 `TASK-013`의 초대 수락 흐름에서
  다룬다. 이 task는 owner row만 다룬다.

## 선행 조건

- `TASK-006-backup-schema-and-rls.md` (documents/document_members 스키마, RLS)
- `TASK-008a-web-checklist-read-through-hydration.md` (read-through hydration 패턴 참고)
- `TASK-011-dual-write-and-mismatch-detector.md`
- `TASK-012-guest-auth-promotion.md` (`upsertOwnerMember` 원본 구현)

## 변경 대상

- `apps/web/lib/local-first/repositoryFactory.ts` 또는 `dualWriteChecklistRepository.ts` (trip 최초
  접근 시 bootstrap 트리거 지점)
- `packages/core/src/supabase/backupRepository.ts` (필요 시 `ensureDocumentBootstrapped` 유틸 추가,
  `upsertOwnerMember`/documents insert 로직 재사용)
- `docs/refactor/tasks/README.md`

## 구현 단계

1. trip 최초 로드 또는 checklist 최초 접근 시점에 `documents` row 존재 여부를 확인하는 지점을
   `repositoryFactory.ts`/`dualWriteChecklistRepository.ts`에서 찾는다.
2. 없으면 `documents` insert(`id=tripId`, `owner_id=현재 사용자`, `type='trip'`,
   `schema_version=1`) 후 `upsertOwnerMember`로 owner `document_members` row를 생성한다.
   `on conflict do nothing`/`upsert`로 idempotent하게 만든다.
3. 기존(이미 만들어진) trip 방문 시에도 같은 lazy bootstrap 로직이 타도록 한다 — 신규/기존 trip을
   구분하지 않고 "documents row가 없으면 만든다"는 조건만으로 통일한다.
4. bootstrap insert가 실패해도(RLS 거부, 네트워크 오류 등) 기존 legacy row 기반 checklist read/write는
   그대로 동작해야 한다 — dual-write의 기존 에러 격리 패턴을 재사용한다.
5. owner가 아닌 사용자(예: 이미 초대된 editor)가 먼저 접근하는 경우를 방어한다 — 이 흐름은 owner
   documents row가 이미 있어야 정상이므로, 없다면 조용히 스킵하고 owner 자신의 접근을 기다린다(잘못된
   소유자로 documents row를 만들지 않는다).

## 데이터 호환성 고려사항

- `documents.id = tripId`로 고정한다(이미 `checklistDocumentWriter.ts` 등에서 이 관례를 쓰고 있음).
- bootstrap은 순수 추가(insert)이며 기존 legacy `trips`/`checklists` row를 변경하지 않는다.
- 이미 guest 승격이나 Mobile bootstrap으로 documents row가 만들어진 trip은 `on conflict do nothing`으로
  건너뛴다.

## 검증 방법

- 새 계정으로 trip을 만들고 checklist를 한 번 사용한 뒤 `documents`/`document_members`에 owner row가
  생성되는지 확인한다.
- 마이그레이션 이전에 만들어진 기존 trip을 방문했을 때도 동일하게 lazy backfill되는지 확인한다.
- documents insert가 실패하도록 강제했을 때도 checklist 읽기/쓰기가 정상 동작하는지 확인한다.
- 초대된 editor가 owner보다 먼저 trip에 접근해도 잘못된 documents row가 생성되지 않는지 확인한다.
- `pnpm --filter @nexvoy/core test`, `pnpm typecheck`, `pnpm build` 성공

## 롤백 방법

- bootstrap 호출 지점만 제거하면 기존 legacy row 기반 동작으로 즉시 복귀한다(documents/document_members
  자체는 이미 있던 스키마이므로 되돌릴 필요 없음).
- 잘못 생성된 documents/document_members row는 owner 기준으로 identify 가능하므로 필요 시 수동 정리한다.

## 완료 조건

- 일반 로그인 사용자가 만든 trip이 자동으로 `documents`/`document_members`에 등록된다.
- `TASK-013`(초대), `TASK-021`(P2P signaling) 등 documents row에 의존하는 기능이 일반 계정으로 실제
  테스트 가능해진다.
- bootstrap 실패가 기존 checklist 기능을 손상시키지 않는다.
