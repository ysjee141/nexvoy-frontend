# TASK-053: Membership and Invitation Without Document Keys

- 상태: 구현 완료 (Issue [#362](https://github.com/ysjee141/nexvoy-frontend/issues/362), 로컬 자동 검증 완료 · DEV 다중 사용자 수동 검증 대기)

## 목적

초대 수락과 데이터 준비를 server membership 및 canonical row 접근으로 단순화한다. app-layer document key 전달,
device key material, encrypted snapshot readiness를 invitation/join 경로에서 제거한다.

## 범위

- `document_members` 최종 authority와 row RLS 연결 검증
- 이메일/링크/코드 invitation 생성·수락·거부
- accepted membership 직후 canonical bundle read
- role 변경/revoke와 local cache/outbox 정리
- Web/Mobile pending invitation 및 join UX 단순화
- stale client write/read 및 Realtime access 차단
- public/share read 권한 정합성

제외:

- legacy key table/RPC 물리 삭제 (`TASK-055`)
- invitation 이메일 디자인 전면 개편

## 선행 조건

- `TASK-050-web-server-authority-product-cutover.md`
- `TASK-052-mobile-server-authority-product-cutover.md`
- TASK-044의 targeted invitation authority

## 변경 대상

- `packages/core/src/supabase/invitationRepository.ts`
- `apps/web/app/join`
- `apps/web/components/trips/CollaboratorModal.tsx`
- `apps/mobile/app/join.tsx`
- Web/Mobile auth/login key bootstrap
- `supabase/migrations`, `supabase/tests`

## 구현 단계

1. invitation accept의 완료 조건을 accepted membership transaction으로 재정의한다.
2. join 후 key readiness/provisioning/snapshot restore 대기 없이 canonical bundle을 가져온다.
3. owner/editor/viewer별 row read/write 및 Realtime policy를 통합 SQL 테스트로 고정한다.
4. role 변경과 revoke를 authenticated server RPC로만 허용한다.
5. revoke event를 받은 Web/Mobile은 해당 account/resource cache와 pending outbox를 purge한다.
6. offline 중 revoke된 client의 command는 server가 거부하고 재시도하지 않는 terminal 상태로 처리한다.
7. 로그인 때 device key material을 생성·등록하는 신규 경로를 중지한다.
8. `데이터 준비 중`/key 전달 상태를 invitation UX에서 제거하고 membership/read 오류를 분리한다.

## 보안 고려사항

- 대상 이메일 invitation은 로그인 계정의 normalized email과 일치해야 한다.
- client가 invitation 대상, role, actor ID를 위조할 수 없어야 한다.
- revoked user는 row, Broadcast topic, signed asset URL에 접근할 수 없어야 한다.
- raw token/code는 log와 analytics에 남기지 않는다.

## 검증 방법

- Web/Web, Web/Mobile에서 이메일 링크와 코드 수락 후 즉시 같은 여행을 읽는다.
- viewer mutation, revoked stale command, 다른 이메일 수락이 차단되는지 확인한다.
- role 변경 후 활성 화면과 offline queue 권한이 즉시 일치하는지 확인한다.
- 반복 로그인 시 신규 device key material이 생성되지 않는지 확인한다.
- invitation RLS/RPC SQL 테스트와 multi-user E2E를 통과한다.

## 롤백 방법

- keyless join feature flag를 끄고 기존 TASK-045 key readiness UI를 복구한다.
- legacy key object는 TASK-055까지 유지한다.

## 완료 조건

- accepted member가 별도 key 전달 없이 canonical 데이터를 읽는다.
- invitation, role, revoke가 Web/Mobile과 DB에서 동일하게 동작한다.
- 신규 로그인과 초대 흐름이 document key/device key를 생성하지 않는다.
