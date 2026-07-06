# ADR-011: 초대 수락 후 Document Key Provisioning 전략

- 상태: 제안됨
- 제안일: 2026-07-06
- 결정자: ysjee141
- 관련 문서:
  - `docs/refactor/TECHNICAL-SPEC.md`
  - `docs/refactor/adrs/ADR-003-backup-encryption-key-management.md`
  - `docs/refactor/adrs/ADR-008-invitation-and-permission-registry.md`
  - `docs/refactor/tasks/TASK-013-invitation-permission-registry.md`

---

## 문제 정의

`TASK-013`에서 초대 링크/초대 코드 수락과 권한 registry는 구현되었지만, 초대받은 신규 사용자가 encrypted backup snapshot/update를 실제로 복호화하려면 해당 사용자용 active `document_keys` row가 필요하다.

현재 암호화 원칙은 `ADR-003`에 따라 다음을 유지한다.

- Supabase는 document snapshot/update 본문을 복호화하지 않는다.
- Supabase에는 plain DEK/KEK를 저장하지 않는다.
- 서버는 wrapped DEK와 권한 registry만 관리한다.
- `document_keys.wrapped_dek`에는 사용자별로 wrapping된 DEK만 저장한다.

따라서 초대 수락 RPC가 membership을 accepted로 바꾸더라도, 서버 단독으로 새 사용자의 wrapped DEK를 발급할 수 없다. 서버가 이를 자동 발급하려면 raw DEK 또는 복호화 가능한 KEK를 알아야 하며, 이는 E2EE/서버 암호문 저장 원칙을 깨뜨린다.

---

## 결정해야 할 질문

초대 수락 후 accepted member가 문서를 복구할 수 있도록 document key를 어떤 주체가, 어떤 재료로, 어떤 시점에 발급할 것인가?

---

## 선택지

### Option A: 서버가 raw DEK 또는 server KEK로 자동 발급

장점:

- 초대 수락 즉시 restore UX가 가장 단순하다.
- owner 온라인 여부와 무관하게 서버가 key row를 만들 수 있다.

단점:

- 서버가 raw DEK 또는 복호화 가능한 key material을 가져야 한다.
- `ADR-003`의 "서버는 문서 본문과 plain key를 알지 않는다" 원칙을 위반한다.
- DB/서버 침해 시 encrypted backup 보호 수준이 크게 낮아진다.

판단: 채택하지 않는다.

### Option B: Owner-side key wrapping

장점:

- owner client가 이미 문서를 열 수 있는 DEK를 보유한 상태에서 새 member용 wrapped DEK를 생성한다.
- 서버는 wrapped DEK만 저장하므로 `ADR-003` 원칙을 유지한다.
- 권한 회수 시 `document_keys.revoked_at`과 key rotation으로 대응할 수 있다.

단점:

- owner가 온라인이거나, owner device가 pending provisioning 요청을 처리해야 한다.
- 새 member의 wrapping material/public key registry가 필요하다.
- 초대 수락 직후에는 `requires_key_provisioning=true` 상태로 대기할 수 있다.

### Option C: Member public key registry + asynchronous provisioning

장점:

- accepted member가 공개 wrapping key를 서버에 등록해두면 owner/editor client가 이를 사용해 wrapped DEK를 비동기로 발급할 수 있다.
- owner가 즉시 온라인이 아니어도 pending request를 queue로 남길 수 있다.
- multi-device와 key rotation 확장에 적합하다.

단점:

- user/device public key 등록, 신뢰, 폐기, rotation 정책이 필요하다.
- owner-side provisioning queue와 알림/재시도 UX가 필요하다.
- 구현 범위가 `TASK-013`보다 크다.

### Option D: 초대 수락 시 local P2P로 ephemeral key transfer

장점:

- 두 peer가 동시에 온라인이면 빠른 복구가 가능하다.
- 서버에는 여전히 wrapped key만 남길 수 있다.

단점:

- P2P 연결 실패 시 restore가 막힌다.
- room join 권한과 key transfer proof가 추가로 필요하다.
- offline/async 초대 수락 UX를 해결하지 못한다.

---

## 결정

초기 후속 구현은 **Option B + Option C** 조합을 채택한다.

- 서버는 raw DEK/KEK를 저장하거나 복호화하지 않는다.
- 초대 수락 RPC는 membership을 accepted로 만들고, active key가 없으면 `requires_key_provisioning=true`를 반환한다.
- accepted member는 user/device wrapping material 또는 public key를 registry에 등록한다.
- owner/editor client는 pending provisioning request를 확인하고, 현재 문서 DEK를 새 member의 wrapping material로 wrapping한 뒤 `document_keys`에 저장한다.
- provisioning 완료 후 member는 restore를 재시도한다.
- P2P ephemeral transfer는 optional fast path로 후속 검토하며, 기본 경로는 Supabase registry + wrapped key 저장이다.

---

## 기대 효과

- `ADR-003`의 encrypted backup/key management 원칙을 유지한다.
- `TASK-013`의 permission registry와 `document_keys`를 분리하지 않고 연결할 수 있다.
- 초대 수락과 restore 가능 상태를 명확히 구분한다.
- owner/editor가 권한을 회수하면 `document_members.status`와 `document_keys.revoked_at`을 함께 적용할 수 있다.

---

## 위험 요소 및 고려사항

- owner가 장기간 온라인이 아니면 accepted member가 문서를 열 수 없다.
- member public key registry가 잘못 설계되면 다른 사용자의 key로 wrapping할 위험이 있다.
- multi-device 사용자는 device별 key인지 user-level key인지 결정이 필요하다.
- key rotation 시 기존 member와 pending member의 wrapped key를 모두 다시 발급해야 할 수 있다.
- provisioning 요청/완료 알림에는 document content, raw token, raw key, wrapped key payload를 포함하지 않아야 한다.

---

## 승인 기준

- accepted member가 active wrapped document key를 받은 뒤 encrypted snapshot을 복호화할 수 있다.
- 서버/RPC/log/storage 어디에도 raw DEK/KEK가 저장되지 않는다.
- owner/editor client만 pending provisioning을 처리할 수 있다.
- member revoke 시 해당 user의 active `document_keys.revoked_at`이 설정된다.
- provisioning pending/failed/completed 상태가 Web/Mobile UX에 표시된다.

---

## 후속 작업

- `TASK-015-owner-side-document-key-provisioning.md`
- member wrapping material/public key registry schema 설계
- owner-side provisioning queue/notification UX 설계
- restore retry flow와 E2E 검증
