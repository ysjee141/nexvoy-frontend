# Operational Rules & Guidelines

OnVoy 프로젝트에 참여하는 모든 AI 모델은 본 문서에 정의된 행동 규칙을 반드시 숙지하고 준수해야 합니다. 

---

## 1. 🔄 Standard Development Workflow

모든 작업은 플랫폼(Web/Mobile)에 관계없이 다음 순서를 엄격히 따릅니다.

1.  **연구 및 분석 (Research)**: 작업 전 소스 코드를 면밀히 분석합니다.
2.  **구현 계획 승인 (Implementation Plan)**: 복잡한 작업 시 반드시 `implementation_plan.md`를 작성하여 사용자 승인을 받습니다.
3.  **이슈 등록 (GitHub Issue)**: GitHub MCP를 사용하여 이슈를 생성합니다.
4.  **로컬 브랜치 생성**: `develop` 브랜치를 기준으로 `feature/[issue-title]-[issue-number]` 형식의 브랜치를 생성합니다.
5.  **검증 (Verification)**: 
    - **Web**: `pnpm --filter nexvoy-web build` 또는 root 위임 스크립트 `pnpm build`로 빌드 무결성을 확인합니다.
    - **Mobile**: `pnpm --filter nexvoy-app lint`, `pnpm --filter nexvoy-app typecheck`, `pnpm --filter nexvoy-app build`로 Expo/RN 앱을 확인합니다.
6.  **PR 생성 (Pull Request)**: `develop` 브랜치를 대상으로 PR을 생성하며, 본문에 `Resolves #NN`, `Close #NN` 문구를 포함하여 이슈를 자동 연동합니다.

### 1.1 Local-First Refactor Workflow

Local-first 전환 작업은 일반 기능 개발보다 먼저 `docs/refactor/` 문서를 확인한다.

필수 참조:

- `docs/refactor/TECHNICAL-SPEC.md`
- `docs/refactor/adrs/`
- `docs/refactor/tasks/`

작업 원칙:

- task 문서 하나를 가능한 한 하나의 PR 단위로 다룬다.
- 현재 운영 구조가 Supabase row primary임을 전제로 fallback을 유지한다.
- UI는 Repository interface를 통해서만 data source에 접근한다.
- Local write는 네트워크 실패와 무관하게 성공해야 한다.
- Supabase backup pull/push가 기본 sync/restore 경로이며, WebRTC는 optional fast path다.
- Cloudflare STUN/TURN은 P2P connectivity 보조 인프라로 사용한다.
- document content는 로그, push payload, signaling metadata에 포함하지 않는다.

---

## 2. 🔐 Security & RLS Principles

데이터베이스 접근 정책(RLS) 수립 시 다음 3단계를 반드시 준수하십시오.

1.  **Enable RLS**: `ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;`를 최우선 실행합니다.
2.  **Owner Policy**: 사용자 본인의 데이터(`user_id = auth.uid()`)에 대해서만 모든 권한을 주는 정책을 먼저 생성합니다.
3.  **Shared Policy**: 협업 및 공개 기능이 필요한 경우, `collaborators` 테이블 등 관계형 체크를 통해 접근 권한을 확장합니다.

Local-first backup/registry 테이블은 다음 원칙을 추가로 적용한다.

- `documents`, `document_updates`, `document_members`, `document_keys`, `document_invitation_links`는 RLS를 필수로 활성화한다.
- owner/editor만 backup update upload가 가능하다.
- viewer는 read/restore만 가능하고 write propagation은 차단한다.
- 초대 수락, role 변경, hard delete는 RPC 또는 server-side 검증을 거친다.
- encrypted snapshot/update blob은 서버에서 복호화하지 않는다.

---

## 3. 🎨 Design DNA & Aesthetics

OnVoy의 디자인 가치와 브랜드 아이デン티티를 훼손하지 마십시오.

- **Brand Color**: **Cobalt Blue (#2563EB)**가 프로젝트의 상징색입니다.
- **Legacy Removal**: 과거의 민트색(#2EC4B6) 코드가 발견될 경우 즉시 코발트 블루로 변경합니다.
- **Premium UI**: Framer Motion을 활용한 부드러운 전환과 `Safe Area`를 고려한 모바일 최적화 레이아웃을 지향합니다.

---

## 4. 🧠 Antigravity Rules (AI Special)

- **맥락 확인**: 작업을 시작하기 전 반드시 `docs/develop-context/` 폴더의 모든 문서를 읽고 지식을 최신화하십시오.
- **Refactor 문서 우선**: local-first 관련 작업은 `docs/refactor/TECHNICAL-SPEC.md`, 관련 ADR, 해당 task 문서를 먼저 확인하십시오.
- **모바일 플랫폼 경계**: RN/Expo 환경 구현 시 웹 전용 API와 네이티브 모듈 사용 위치를 분리하십시오.
- **설명 최소화**: 코드 변경 후에는 요점만 간략히 설명하고, 상세 내역은 아티팩트(`walkthrough.md`)를 활용하십시오.

---

---

## 5. 🧪 E2E 테스트 환경 규칙

E2E 테스트 실행 및 인프라 작업 시 다음 규칙을 **절대적으로** 준수한다.

### 5.1 환경변수 파일 보호 (절대 규칙)

- **`.env.local`은 스크립트나 코드로 절대 수정·덮어쓰기·이동·삭제하지 않는다.**
  - 이 파일에는 운영 API 키, Supabase 키, 카카오/구글 키 등 복구 불가능한 민감 정보가 포함된다.
  - 백업 후 교체 방식(`rename` → `copyFile` → 복원)도 금지한다. 프로세스 비정상 종료 시 복원이 보장되지 않는다.
- **E2E 전용 환경변수는 `process.env`에 직접 주입하는 방식으로만 처리한다.**
  - Next.js 우선순위: `process.env` > `.env.local` — 이미 주입된 값은 `.env.local`이 덮어쓰지 않는다.
  - 구현체: `apps/web/scripts/dev-e2e.mjs` — `.env.test.local`을 읽어 `process.env`에 assign 후 `next dev` 실행.
- `.env.test.local`은 `.gitignore`로 보호되며, 예시 구조는 `.env.test.local.example`에 유지한다.

### 5.2 로컬 Supabase 인스턴스

- E2E 테스트는 **반드시 로컬 Supabase 인스턴스**(`supabase start`)를 사용한다. 운영 DB 절대 금지.
- 마이그레이션은 `supabase/migrations/`에 날짜순으로 관리하며, `supabase db reset --local`로 재현 가능해야 한다.
- 운영 URL·키가 마이그레이션 파일에 하드코딩되지 않도록 한다 (`app.supabase_functions_url` 설정 참조 방식 사용).

### 5.3 테스트 유저 관리

- 테스트 유저는 `e2e/helpers/supabase.ts`의 `createTestUser` / `deleteTestUser`로만 생성·삭제한다.
- 실제 고객·임직원 정보를 테스트 데이터로 사용하지 않는다.
- 테스트 유저 이메일은 `*.onvoy.local` 도메인을 사용한다 (운영 도메인과 명확히 구분).

### 5.4 @supabase/ssr 쿠키 주입

- 인증 픽스처(`e2e/fixtures/auth.ts`)는 `createBrowserClient`의 `setSession()`을 통해 쿠키를 생성한다.
  - 쿠키 이름은 SDK가 자동 결정한다 — 직접 계산하거나 하드코딩하지 않는다.
  - 로컬 인스턴스(`127.0.0.1`)의 쿠키 이름은 `sb-127-auth-token`으로 생성된다.
- 쿠키 주입 후 보호 경로 접근 가능 여부를 스모크 테스트로 반드시 검증한다.

---

## 6. 🌐 플랫폼 개발 순서 원칙 (Web First)

OnVoy는 **웹(nexvoy-web)이 디자인 레퍼런스** 역할을 한다. Figma 등 별도 디자인 툴 없이 웹 구현체 자체가 리빙 디자인 시스템(Living Design System)이다.

### 6.1 절대 순서

```
웹 기능 구현 + E2E 통과 → @nexvoy/core 반영 → 앱 재표현
```

- **Web First**: 모든 신규 기능은 `apps/web`에서 먼저 구현하고 Playwright E2E가 통과해야 한다
- **앱은 재표현**: `nexvoy-app`은 웹에서 검증된 기능을 React Native 방식으로 재표현한다
- **동시 작업 금지**: 웹이 완성되지 않은 기능을 앱에서 먼저 시작하지 않는다

### 6.2 디자인 일관성 유지 방법

| 레이어 | 공유 방법 |
|--------|---------|
| 색상/간격/반경 | `@nexvoy/design-tokens` 패키지 (SSOT) |
| 비즈니스 로직 | `@nexvoy/core` 패키지 |
| 레이아웃/컴포넌트 | 웹 화면을 레퍼런스로 RN에서 독립 구현 |

### 6.3 이유

- 웹에서 UX를 먼저 검증하므로 앱 단계에서 의사결정 비용 감소
- 웹 E2E가 로직 버그를 선제 차단하여 앱에 전파되지 않음
- 디자인 변경 시 웹을 먼저 수정 → 앱은 웹 결과물을 보고 맞춤

---

> [!WARNING]
> 본 가이드라인을 어기는 것은 프로젝트의 일관성을 해치는 심각한 위험으로 간주됩니다. 불확실할 경우 항상 질문하십시오.
