# ADR-008: 초대 방식 및 권한 Registry 전략

- 상태: 채택됨
- 결정일: 2026-06-29
- 결정자: ysjee141
- 관련 문서:
  - `docs/refactor/TECHNICAL-SPEC.md`
  - `docs/refactor/adrs/ADR-001-local-first-data-engine.md`
  - `docs/refactor/adrs/ADR-004-p2p-signaling-strategy.md`
  - `docs/refactor/adrs/ADR-007-auth-identity-and-delayed-auth.md`

---

## 문제 정의

Local-first/P2P 구조에서도 “누가 어떤 여행 문서에 접근할 수 있는가”는 신뢰 가능한 중앙 registry가 필요하다. 클라이언트 로컬 문서의 `members` snapshot은 UX와 optimistic guard로는 충분하지만, 보안 경계가 될 수 없다.

여행 공유에는 다음이 필요하다.

- 초대 생성
- 초대 링크/코드/QR/계정 초대
- 초대 수락
- owner/editor/viewer role 관리
- signaling room 접근 제어
- backup read/write 접근 제어
- 권한 회수

---

## 결정해야 할 질문

친구 초대와 권한 관리를 어떤 방식으로 제공하고, 최종 권한 authority를 어디에 둘 것인가?

---

## 선택지

### Option A: 딥 링크 기반 초대

장점:

- 카카오톡/문자 공유 UX가 자연스럽다.
- 앱 설치/미설치 시나리오와 연결하기 쉽다.
- 현재 서비스의 공유 링크 UX와 잘 맞는다.

단점:

- 링크 유출 시 접근 위험이 있다.
- 만료, 비밀번호, role 제한 정책이 필요하다.

### Option B: 초대 코드 입력

장점:

- 구현이 단순하다.
- 웹/앱/오프라인 대면 상황에서 모두 사용 가능하다.
- 딥 링크가 실패해도 fallback으로 좋다.

단점:

- 사용자가 직접 입력해야 한다.
- 코드 추측 방지를 위한 entropy와 rate limit이 필요하다.

### Option C: QR 코드 초대

장점:

- 대면 여행 계획 상황에서 UX가 좋다.
- 연락처 없이 즉시 참여 가능하다.

단점:

- 카메라 권한과 QR scanner가 필요하다.
- 원격 초대에는 적합하지 않다.

### Option D: 이메일/계정 검색 초대

장점:

- 지정 사용자만 초대할 수 있어 보안이 좋다.
- pending/accepted 상태 관리가 명확하다.
- 권한 부여와 audit trail이 쉽다.

단점:

- 초대받는 사용자가 계정을 가지고 있어야 하거나 가입 유도가 필요하다.
- 검색/프로필 노출 정책이 필요하다.

---

## 결정

초기 제품은 다음 조합을 채택한다.

- 기본: 딥 링크 초대
- fallback: 초대 코드 입력
- 현장 사용성: QR 코드는 후속 기능
- 보안 초대: 이메일/계정 초대는 owner/editor/viewer 권한 관리와 함께 유지

권한 authority는 Supabase `document_members`와 초대 registry에 둔다.

---

## Supabase Registry

제안 테이블:

- `document_members`
- `document_invitation_links`
- `document_share_tokens`

권장 컬럼:

```sql
create table public.document_invitation_links (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  token text unique not null,
  invite_code text unique,
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid references public.profiles(id) not null,
  expires_at timestamptz,
  max_uses integer,
  used_count integer default 0 not null,
  revoked_at timestamptz,
  created_at timestamptz default now() not null
);
```

RLS/RPC 원칙:

- owner만 초대 링크 생성/폐기 가능
- editor 초대 권한은 별도 결정 전까지 비활성
- 초대 수락은 RPC로 처리
- RPC는 token 만료/폐기/사용 횟수/role을 검증
- `document_members` 변경은 owner만 가능

---

## P2P Signaling 권한

시그널링 서버 또는 provider는 room join 시 다음을 검증해야 한다.

1. Supabase JWT 유효성
2. `document_members.status = accepted`
3. 해당 document 접근 role
4. room secret 유효성

viewer 정책:

- viewer는 document backup read 가능
- viewer는 local UI에서 편집 버튼 비활성화
- viewer가 로컬에서 임의 update를 만들어도 backup upload는 RLS/RPC에서 거부
- P2P provider는 viewer의 write update를 다른 peer에게 전파하지 않거나, peer가 role 검증 후 무시

---

## 개인정보 공유 고지

초대/공유 기능 사용 시 다음을 고지해야 한다.

- 여행 참여자 간 닉네임, 이메일 일부, 프로필 이미지가 공유될 수 있음
- 참여자 간 여행 일정, 장소, 준비물, 체크 상태, 메모가 공유됨
- P2P 연결 과정에서 네트워크 정보가 처리될 수 있음
- 초대 링크를 받은 사용자가 링크 조건에 따라 여행방에 접근할 수 있음

---

## 승인 기준

- 초대 링크로 신규 사용자가 문서를 복구할 수 있다.
- 초대 코드 fallback이 동작한다.
- owner/editor/viewer 권한이 backup upload와 P2P join에 반영된다.
- 권한 회수 후 새 sync/update가 차단된다.
- 링크 만료/폐기/rate limit 정책이 정의된다.

---

## 후속 작업

- document invitation schema 작성
- invite RPC 설계
- 딥 링크 route 설계
- QR 초대 후순위 task 작성
- signaling room 권한 검증 PoC
