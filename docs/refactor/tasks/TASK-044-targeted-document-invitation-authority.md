# TASK-044: Targeted Document Invitation Authority

- 상태: 예정

## 목적

이메일로 보낸 초대, 로그인 후 pending 초대, 링크와 초대 코드가 모두 같은
`document_invitation_links`/`document_members` authority를 사용하도록 통합한다. 초대 대상 계정만 이메일 초대를
수락할 수 있게 하고, 초대 생성과 메일 발송을 인증된 서버 경계에서 처리한다.

## 확인된 문제

- 홈 `InvitationBanner`와 `CollaboratorModal`은 legacy `trip_members`를 조회하지만 신규 초대는 document registry에 생성된다.
- invitation link에 대상 이메일이 없어 현재 사용자의 pending 초대를 조회하거나 계정 일치를 검증할 수 없다.
- `/api/invite`가 인증과 document 권한 검증 없이 임의 이메일, URL, 코드를 발송한다.
- accepted `document_members`가 협업자 목록과 local document member snapshot에 반영되지 않는다.
- 신규 document invitation summary가 legacy `trips` metadata에 의존해 제목과 기간이 비어 있다.

## 범위

- 이메일 대상 invitation metadata와 정규화 규칙
- 인증된 초대 생성 및 이메일 발송 API
- 내 pending invitation 목록, 수락, 거절 RPC
- token/code 수락 시 대상 계정 이메일 검증
- Web pending invitation UI와 collaborator 관리의 document registry 전환
- accepted member를 local `TripDocumentV1.members`에 반영하는 registry sync 경계

제외:

- wrapped document key 발급과 join 준비 상태 UX (`TASK-045`)
- public/password share token UX
- legacy `trip_members` 자동 변환

## 선행 조건

- `TASK-043` document authority bootstrap 및 write hardening
- `TASK-013-invitation-permission-registry.md`
- `TASK-031-web-full-document-primary-transition.md`

## 변경 대상

- `supabase/migrations`
- `packages/core/src/supabase/invitationRepository.ts`
- `apps/web/app/api/invite/route.ts`
- `apps/web/components/trips/InvitationBanner.tsx`
- `apps/web/components/trips/CollaboratorModal.tsx`
- Web/Mobile document member registry adapter

## 구현 단계

1. invitation registry에 normalized target email과 최소 표시 metadata를 추가한다.
2. `create_document_invitation_link`가 대상 이메일을 저장하고 중복 pending 초대를 idempotent하게 처리하도록 확장한다.
3. 현재 JWT email 기준 pending 목록, 수락, 거절 RPC를 추가한다.
4. targeted token/code는 로그인 계정 이메일이 일치할 때만 수락하도록 강화한다.
5. `/api/invite`가 세션과 document editor 권한을 검증한 뒤 invitation 생성과 Resend 발송을 수행하게 한다.
6. Web pending banner와 collaborator 목록/역할/회수를 document registry repository로 전환한다.
7. registry member 변경을 local document member snapshot과 P2P peer 입력에 반영한다.

## 보안 및 데이터 고려사항

- raw token/code는 기존과 같이 저장하지 않고 hash만 저장한다.
- 대상 이메일은 invitation 관련 SECURITY DEFINER RPC 밖에서 직접 조회할 수 없게 한다.
- 클라이언트가 전달한 invite URL, title, role을 메일 발송 authority로 신뢰하지 않는다.
- generic link 초대와 targeted email 초대를 명시적으로 구분한다.
- 기존 bearer token/code는 호환성을 유지하되 신규 targeted 초대에는 이메일 일치를 강제한다.

## 검증 방법

- 초대 대상 계정에는 로그인 후 pending 초대가 표시되고 다른 계정에는 표시되지 않는다.
- 다른 계정이 targeted token/code를 사용하면 수락이 거부된다.
- 링크, 코드, 홈 pending UI의 수락 결과가 동일한 accepted `document_members` row로 수렴한다.
- owner/editor/viewer의 초대 생성, 역할 변경, 회수 권한을 RLS/RPC 통합 테스트로 검증한다.
- 인증되지 않았거나 권한 없는 `/api/invite` 호출과 임의 외부 URL 발송이 차단된다.
- CollaboratorModal과 P2P member 입력이 동일한 accepted registry를 사용한다.

## 배포 및 롤백

- migration은 DEV(`ivgkqzwosbjukonlpfdw`)에 먼저 적용하고 Web 다중 사용자 검증 후 PROD에 별도 적용한다.
- PROD(`runbcaegpefqnljsswhv`) 적용은 사용자 승인 없이 수행하지 않는다.
- 롤백 시 신규 targeted RPC/API를 비활성화하고 기존 token/code lookup은 유지한다.

## 완료 조건

- 이메일, pending UI, 링크, 코드 초대가 하나의 document authority로 동작한다.
- targeted invitation은 대상 계정만 수락할 수 있다.
- accepted member가 협업자 목록, local document member snapshot, P2P peer 구성에 일관되게 반영된다.

