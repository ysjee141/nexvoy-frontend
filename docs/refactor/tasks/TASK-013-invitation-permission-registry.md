# TASK-013: Invitation 및 Permission Registry

## 목적

딥 링크 초대와 초대 코드 fallback을 Supabase authority 기반으로 구현하고, document backup/P2P 접근 권한을 registry로 검증한다.

## 범위

- `document_members`
- `document_invitation_links`
- `document_share_tokens`
- invite create/accept/revoke RPC
- owner/editor/viewer role 반영
- signaling room join 검증 정책

## 선행 조건

- `TASK-006-backup-schema-and-rls.md`
- `TASK-010-cloudflare-ice-config.md`
- `ADR-008` 권장안 결정

## 변경 대상

- `supabase/migrations/*.sql`
- `supabase/functions/*` 또는 RPC SQL
- `packages/core/src/local-first/permissions.ts`
- Web/Mobile 초대 수락 route

## 구현 단계

1. invitation registry schema와 RLS/RPC를 작성한다.
2. owner만 초대 링크를 생성/폐기할 수 있게 한다.
3. 초대 수락 RPC에서 token 만료, 폐기, 사용 횟수, role을 검증한다.
4. accepted member만 backup restore와 document key read가 가능하게 연결한다.
5. P2P room join 시 Supabase JWT, membership, role, room secret을 검증하는 interface를 정의한다.

## 데이터 호환성 고려사항

- 기존 share token과 invitation token은 유효성을 유지한다.
- 링크 자체에 document content를 포함하지 않는다.
- viewer는 local UI에서 편집이 막히고, backup upload도 서버에서 거부되어야 한다.

## 검증 방법

- owner/editor/viewer별 invite 생성/수락 권한 테스트
- revoked link와 expired link 거부 테스트
- viewer write upload 차단 테스트
- 딥 링크와 초대 코드 fallback 수동 테스트

## 롤백 방법

- 새 registry를 비활성화하고 기존 초대/공유 flow를 유지한다.
- 신규 invitation rows는 cleanup migration 또는 admin script로 정리한다.

## 완료 조건

- 초대 링크로 신규 사용자가 document를 복구할 수 있다.
- 초대 코드 fallback이 동작한다.
- 권한 회수 후 새 sync/update가 차단된다.
