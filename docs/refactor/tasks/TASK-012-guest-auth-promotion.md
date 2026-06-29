# TASK-012: Guest Auth Promotion

## 목적

로그인 없이 만든 local document를 Supabase Auth 계정에 안전하게 연결하고, 최초 backup snapshot을 업로드하는 승격 흐름을 구현한다.

## 범위

- guest `localOwnerId`
- user namespace별 local store 격리
- 로그인 후 `ownerId = auth.user.id` 승격
- 최초 encrypted backup upload
- 로그아웃/계정 전환/회원 탈퇴 시 local document 정리 정책

## 선행 조건

- `TASK-005-web-indexeddb-yjs-checklist-spike.md`
- `TASK-008-backup-queue-and-restore.md`
- `ADR-007` Option B 결정

## 변경 대상

- `packages/core/src/local-first/permissions.ts`
- `packages/core/src/sync/syncState.ts`
- `apps/web/lib/local-first/repositoryFactory.ts`
- `apps/mobile/lib/local-first/repositoryFactory.ts`
- auth UX 안내가 필요한 화면

## 구현 단계

1. guest document owner model을 정의한다.
2. local store namespace를 guest/auth user 단위로 분리한다.
3. 공유/백업/동기화 요청 시 로그인 필요 상태를 반환한다.
4. 로그인 성공 후 owner id를 auth user id로 승격한다.
5. 최초 snapshot upload가 성공하거나 retry queue에 들어가야 승격 완료로 본다.

## 데이터 호환성 고려사항

- 기존 계정에 같은 document id가 있으면 중복 생성하지 않는다.
- 앱 삭제 시 guest 데이터가 유실될 수 있음을 UX에 안내한다.
- 회원 탈퇴 시 local documents, backup rows, push tokens를 정리한다.

## 검증 방법

- guest 작성 → 로그인 → backup upload 통합 테스트
- 로그아웃 후 다른 계정 local store 격리 확인
- 앱 삭제/데이터 초기화 안내 UX 확인

## 롤백 방법

- guest mode feature flag를 off로 두고 login-first flow로 되돌린다.
- 승격 전 guest local data는 서버에 업로드하지 않는다.

## 완료 조건

- guest document가 authenticated document로 승격된다.
- 중복 document가 생기지 않는다.
- 계정 전환과 탈퇴 정리 정책이 테스트된다.
