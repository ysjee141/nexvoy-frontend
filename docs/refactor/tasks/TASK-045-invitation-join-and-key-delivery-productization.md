# TASK-045: Invitation Join and Key Delivery Productization

- 상태: 예정

## 목적

초대 수락 성공과 encrypted document key 준비 상태를 분리하고, Web/Mobile에서 제품 수준의 join UX와 자동 key
provisioning을 완성한다. 초대받은 사용자가 owner/editor 기기가 온라인인 경우 별도 수동 조치 없이 여정 snapshot을
복원하고 동일한 데이터를 볼 수 있어야 한다.

## 확인된 문제

- DEV에서 초대 수락은 `document_members.status=accepted`까지 성공하지만 active key가 없고 provisioning 요청이 pending에 머문다.
- Web `ensureWebDocumentKeyReadiness()`는 owner/editor가 자기 key를 보유하면 pending 요청 처리 전에 반환한다.
- Web `/join`은 Tailwind가 없는 Panda CSS 프로젝트에서 Tailwind class를 사용해 스타일이 적용되지 않는다.
- 코드 입력을 error 상태로 재사용해 정상 진입도 `참여 실패`로 표시한다.
- membership 성공과 key 준비 지연이 하나의 참여 성공 여부처럼 표현된다.
- 기존 multi-user E2E는 수락 후 owner provisioning과 invited member restore를 실제로 증명하지 않았다.

## 범위

- Web `/join` Panda CSS 재구현과 명시적 상태 모델
- Mobile join 상태와 문구 정합
- owner/editor foreground pending key provisioning 자동 처리
- accepted member의 준비 중/완료 상태와 재시도 UX
- key 완료 후 encrypted snapshot restore와 상세 이동
- invitation acceptance부터 P2P/backup 진입까지 Web/Mobile 다중 사용자 E2E

제외:

- invitation 대상 이메일 및 pending authority (`TASK-044`)
- 서버가 plaintext DEK 또는 document content를 보관하는 방식
- P2P signaling transport 재설계

## 선행 조건

- `TASK-044-targeted-document-invitation-authority.md`
- `TASK-015-owner-side-document-key-provisioning.md`
- `TASK-016-mobile-native-key-provisioning-and-background-sync.md`
- `TASK-041-backup-freshness-and-cost-control.md`

## 변경 대상

- `apps/web/app/join`
- `apps/web/lib/local-first/keyProvisioningService.ts`
- `apps/web/app/trips/detail/TripLayoutClient.tsx`
- `apps/mobile/app/join.tsx`
- `apps/mobile/lib/local-first/keyProvisioningService.ts`
- `packages/core/src/sync/keyProvisioning.ts`
- `packages/core/src/supabase/invitationRepository.ts`
- `apps/web/e2e`

## 구현 단계

1. join 상태를 `code_entry`, `resolving`, `preview`, `accepting`, `accepted_preparing`, `ready`, `invalid`, `error`로 분리한다.
2. Web join 화면을 Panda CSS, design token, Lucide icon, Safe Area 기준으로 구현한다.
3. membership 수락 성공을 즉시 확정하고 key 준비 지연은 별도 재시도 가능한 상태로 표시한다.
4. key를 가진 owner/editor가 pending provisioning 요청을 항상 조회·처리하도록 Web 조기 return을 수정한다.
5. Web detail foreground/visibility와 Mobile foreground/background trigger에서 중복 처리에 안전하게 provisioning을 재시도한다.
6. active key 생성 후 invited device가 encrypted snapshot을 restore하고 local document를 저장한 뒤 상세로 이동한다.
7. owner offline 상태에서는 참여 완료와 준비 지연을 명확히 표시하고, owner/editor 재접속 후 자동 완료되는지 검증한다.
8. 링크/코드/로그인 복귀/Web-Web/Web-Mobile 시나리오를 E2E와 runbook으로 고정한다.

## UX 원칙

- 코드 입력은 오류 상태가 아니라 정상 진입점이다.
- `참여 완료`와 `데이터 준비 중`을 동시에 표현할 수 있어야 한다.
- 준비 지연 중 사용자를 실패 화면에 가두지 않고 홈에서 상태 확인과 재진입을 허용한다.
- owner/editor가 온라인이면 일반 사용자가 수동으로 준비 버튼을 반복하지 않아도 완료되어야 한다.

## 보안 및 데이터 고려사항

- raw DEK는 owner/editor device에서만 unwrap하고 대상 device public key로 다시 wrap한다.
- server, log, analytics, notification payload에 plaintext key/document content를 남기지 않는다.
- viewer는 key를 받아 restore할 수 있지만 document update/P2P write/backup upload는 계속 차단한다.
- provisioning request는 device/material/version 단위로 idempotent해야 한다.

## 검증 방법

- Web owner가 초대하고 Web editor가 링크와 코드 각각으로 수락해 동일 snapshot을 복원한다.
- owner가 여정을 열어 둔 상태에서 pending request가 자동 completed되고 invitee가 상세로 이동한다.
- owner offline 수락 후 owner가 재접속하면 별도 관리 UI 조작 없이 준비가 완료된다.
- stale/revoked device material은 안전한 오류 상태를 만들며 다른 device key를 손상시키지 않는다.
- viewer는 restore/read는 가능하지만 mutation과 P2P write가 차단된다.
- Web/Mobile build, Core tests, local Supabase reset, multi-user Playwright, Mobile smoke를 통과한다.

## 롤백 방법

- 자동 provisioning trigger를 비활성화하고 기존 수동 owner 처리 UI를 fallback으로 유지한다.
- 신규 join UI를 롤백해도 TASK-044의 invitation authority와 accepted membership은 유지한다.

## 완료 조건

- 링크와 코드로 수락한 사용자가 명확한 UI 상태를 거쳐 encrypted document를 실제로 복원한다.
- key 보유 owner/editor가 온라인이면 pending key 전달이 자동 완료된다.
- Web/Mobile에서 수락한 사용자가 owner와 동일한 여정 데이터를 보고 P2P 또는 backup sync에 참여한다.

