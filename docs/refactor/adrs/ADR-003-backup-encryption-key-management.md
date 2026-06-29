# ADR-003: 백업 암호화 및 키 관리 전략

- 상태: 채택됨
- 결정일: 2026-06-29
- 결정자: ysjee141
- 관련 문서:
  - `docs/refactor/TECHNICAL-SPEC.md`
  - `docs/refactor/adrs/ADR-001-local-first-data-engine.md`

---

## 문제 정의

Local-first 전환 후 Supabase에는 기존 정규화 row가 아니라 Yjs snapshot/update blob이 백업될 수 있다. 이 blob은 여행 일정, 장소, 메모, 준비물, 동행자 정보 등 민감한 개인 데이터를 포함한다.

Supabase RLS로 접근 제어를 할 수 있지만, 서버 저장소에 평문 snapshot/update를 보관할지, 클라이언트에서 암호화한 blob만 보관할지 결정해야 한다.

암호화할 경우 키 관리가 가장 큰 문제가 된다. 사용자가 새 기기에서 로그인했을 때 기존 백업을 복호화할 수 있어야 하고, 동행자 초대 시 문서 decrypt 권한도 공유되어야 한다.

---

## 결정해야 할 질문

Yjs update blob을 Supabase에 평문 저장할 것인가, 암호화할 것인가?

---

## 선택지

### Option A: Supabase RLS만 사용하고 blob은 평문 저장

장점:

- 구현이 가장 단순하다.
- 서버에서 백업 검증, 인덱싱, migration이 쉽다.
- 새 기기 복구가 쉽다.

단점:

- Supabase 저장소에는 사용자의 여행 데이터가 평문으로 존재한다.
- 보안/프라이버시 기대치가 높아질수록 부담이 된다.
- 문서 단위 공유/권한 변경 시 서버가 모든 내용을 볼 수 있다.

### Option B: 클라이언트 E2EE, 서버는 암호문만 저장

장점:

- 서버에 평문 데이터가 저장되지 않는다.
- 프라이버시 측면에서 가장 강하다.

단점:

- 키 복구 UX가 어렵다.
- 초대받은 사용자에게 키를 안전하게 전달해야 한다.
- 검색/통계/indexing이 어렵다.
- 키 분실 시 데이터 복구가 불가능할 수 있다.

### Option C: 민감 본문은 암호화, 서버 index는 제한적으로 평문 저장

장점:

- 주요 내용은 보호하면서 목록/검색/복구 UX를 일부 유지할 수 있다.
- 문서 title, date range 같은 최소 metadata만 서버 index로 둘 수 있다.
- 단계적 도입이 가능하다.

단점:

- 어떤 필드를 평문 metadata로 둘지 정책이 필요하다.
- 구현이 Option A보다 복잡하다.
- 완전한 E2EE는 아니다.

---

## 결정

Option B를 기반으로 채택한다. Supabase에 저장되는 Yjs snapshot/update blob은 클라이언트에서 암호화하고, 서버는 암호문만 저장한다.

Key model은 Server-wrapped key를 채택한다. 문서별 content encryption key(DEK)는 클라이언트에서 생성하고, Supabase Auth 사용자/멤버 권한에 따라 wrapping된 key material만 서버에 저장한다.

결정 원칙:

- `documents.encrypted = true`를 기본값으로 한다.
- `document_updates.update_blob`과 `documents.snapshot`은 암호문이다.
- 서버는 문서 본문을 복호화하지 않는다.
- 서버에는 복호화 가능한 원문 key를 저장하지 않는다.
- 서버는 wrapped key와 권한 registry만 관리한다.
- 로그에는 document payload를 남기지 않는다.
- snapshot/update integrity hash를 저장한다.
- 검색/목록/알림에 필요한 최소 metadata는 `ADR-006`과 `ADR-009`의 index/notification payload 정책을 따른다.

---

## Key Model

채택 모델: Server-wrapped key.

개념:

- DEK(Document Encryption Key): 문서 snapshot/update 암호화에 사용하는 대칭키
- KEK(Key Encryption Key): 사용자/디바이스/세션 기반으로 DEK를 wrapping하는 키
- Wrapped DEK: Supabase에 저장되는 암호화된 DEK

제안 테이블:

```sql
create table public.document_keys (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  key_version integer not null,
  wrapped_dek bytea not null,
  wrapping_alg text not null,
  created_at timestamptz default now() not null,
  revoked_at timestamptz,
  unique(document_id, user_id, key_version)
);
```

권한 원칙:

- owner는 document key를 생성하고 멤버별 wrapped key를 발급할 수 있다.
- accepted member만 자신의 wrapped key를 읽을 수 있다.
- role revoked 또는 member removed 시 해당 사용자의 key를 revoke한다.
- key rotation은 document membership 변경 또는 보안 이벤트 발생 시 수행한다.

추가 검토:

- KEK를 Supabase 세션 기반으로 만들지, 디바이스 local key와 조합할지
- Apple/Google/Kakao OAuth 계정 복구 시 key unwrap UX
- multi-device 사용자가 새 기기에서 wrapped key를 복구하는 절차

---

## 승인 기준

- 선택한 방식으로 새 기기 복구가 가능하다.
- 초대받은 사용자가 접근 가능한 문서만 복호화할 수 있다.
- 탈퇴/권한 회수 시 키 접근 정책이 정의되어 있다.
- 백업 손상 감지와 복구 실패 처리가 가능하다.

---

## 후속 작업

- 백업 암호화 PoC
- key wrapping 모델 비교
- document metadata 평문 범위 정의
- 개인정보 처리방침 영향 검토
