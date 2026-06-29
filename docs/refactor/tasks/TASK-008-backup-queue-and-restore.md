# TASK-008: Backup Queue 및 Restore Flow

## 목적

Local write 이후 Supabase backup/update log로 업로드하고, 새 기기에서 snapshot + updates로 복원하는 기본 sync 경로를 구현한다.

## 범위

- pending update queue
- update batching/debounce
- snapshot 생성 기준
- Supabase upload/download repository
- restore state machine
- corruption/hash mismatch error handling

## 선행 조건

- `TASK-006-backup-schema-and-rls.md`
- `TASK-007-document-key-model.md`
- `ADR-004` Supabase backup pull/push 기본 sync 결정

## 변경 대상

- `packages/core/src/sync/backupTypes.ts`
- `packages/core/src/sync/syncState.ts`
- `packages/core/src/supabase/backupRepository.ts`
- `apps/web/lib/local-first/repositoryFactory.ts`
- `apps/mobile/lib/local-first/repositoryFactory.ts`

## 구현 단계

1. local update를 pending queue에 기록한다.
2. 온라인 상태에서 debounce/batch 후 `document_updates`에 업로드한다.
3. 일정 update 수 또는 크기마다 encrypted snapshot을 만든다.
4. restore flow를 snapshot download → updates replay → read model 재생성 순서로 구현한다.
5. 실패 상태와 retry 정책을 정의한다.

## 데이터 호환성 고려사항

- upload 실패가 local write 실패로 이어지면 안 된다.
- update seq는 client별 unique constraint와 맞아야 한다.
- restore 결과가 legacy row와 의미상 동일해야 한다.

## 검증 방법

- offline local write 후 online upload 통합 테스트
- snapshot + update replay restore 테스트
- hash mismatch 시 restore 실패 처리 확인
- `pnpm build`

## 롤백 방법

- Local-first repository 기본값을 끄고 Supabase legacy repository로 되돌린다.
- backup table에 쌓인 테스트 document는 별도 cleanup script로 정리한다.

## 완료 조건

- Supabase backup이 local-first의 기본 복구 경로로 동작한다.
- P2P 없이도 다른 기기 restore가 가능하다.
- backup 실패/복구 실패 상태가 관측 가능하다.
