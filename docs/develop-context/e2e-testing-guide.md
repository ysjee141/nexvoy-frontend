# E2E 테스트 도입 가이드 (Playwright)

> 작성일: 2026-06-09 / 최종 업데이트: 2026-06-10
> 상태: **Phase 1~3 완료** — Playwright 설치, 로컬 Supabase 마이그레이션 체계, 인증 픽스처, 스모크 테스트 4개 통과.
> 목적: OnVoy 프로젝트에 Playwright 기반 E2E 테스트를 도입하기 위한 사전 분석 및 실행 계획 정리.

---

## 1. 현재 상태 (As-Is)

| 항목 | 내용 |
|------|------|
| 스택 | `apps/web` Next.js App Router + React, Supabase 인증, Panda CSS |
| 테스트 인프라 | Playwright 기반 웹 E2E가 `apps/web/e2e`에 위치 |
| 인증 방식 | Supabase + 카카오/구글 OAuth (`@supabase/ssr` 쿠키 기반) |
| 페이지 라우트 (약 20개) | `login`, `signup`, `join`, `trips`(new/detail/checklist), `templates`(new/detail), `profile`(licenses/places-visited/travel-log/withdrawal), `share/detail`, `offline`, `auth`(callback/success/error) |

→ 처음부터 테스트 인프라를 구축하는 셈이다.

---

## 2. 적용 가능성

| 대상 | 가능 여부 | 비고 |
|------|----------|------|
| **웹 빌드** (`pnpm --filter nexvoy-web dev` / `start`) | ✅ 완전히 가능 | Playwright의 정석 영역 |
| **모바일 앱** (Expo React Native) | ⚠️ 별도 필요 | RN 네이티브 화면은 Playwright 범위 밖. 필요 시 Detox/Appium 등 별도 도구 |

**결론: 웹 기준 E2E는 충분히 도입 가능하다.** 모바일 네이티브 영역은 범위에서 제외하고 시작하는 것을 권장한다.

---

## 3. 핵심 고려사항 (착수 전 반드시 결정)

### 3.1 인증 우회 전략 (가장 중요)
카카오/구글 OAuth는 E2E에서 실제 로그인 플로우를 그대로 타기 어렵다(외부 IdP 화면, 캡차 등).

- **권장 방식**: Supabase `service_role` 키로 **테스트 전용 유저의 세션을 발급 → 쿠키 / `storageState` 로 주입**하여 로그인 상태에서 테스트를 시작한다.
  - `@supabase/ssr`의 쿠키 구조(`sb-<project-ref>-auth-token` 등)에 맞춰 세션 쿠키를 심는 방식.
  - Playwright의 `storageState` 기능으로 인증 픽스처를 한 번 만들어 재사용.
- OAuth 콜백(`/auth/callback`) 자체를 검증하고 싶다면 별도 시나리오로 분리하되, 외부 IdP는 mock 처리.

> ⚠️ **[보안 주의]** 테스트에 `SUPABASE_SERVICE_ROLE_KEY`와 테스트 계정이 사용된다.
> - 운영 DB가 아닌 **별도 테스트/로컬 Supabase 인스턴스** 사용을 강력히 권장.
> - service_role 키·비밀번호·토큰은 **테스트 코드나 픽스처에 하드코딩 금지**, 환경변수(`.env.test.local` 등, gitignore 처리)로만 주입.
> - 테스트 데이터에 **실제 고객/임직원 정보 사용 금지** — 시드 데이터로 격리.

### 3.2 Google Maps API
- E2E에서 실제 호출 시 비용·쿼터 발생 → **mock** 처리하거나 **테스트 전용 키** 분리.
- 지도 렌더링 자체보다 지도 위의 우리 UI 동작 검증에 집중.

### 3.3 테스트 데이터 격리
- 실제 운영 데이터 사용 금지. **시드 스크립트**로 테스트 데이터 생성 → 테스트 후 정리(teardown).
- Supabase RLS 정책이 테스트 유저 기준으로 정상 동작하는지도 함께 검증 가능.

### 3.4 환경변수
필요한 키(값은 `.env.local` 참조):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(테스트 인스턴스용), `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`(또는 mock), `NEXT_PUBLIC_APP_URL`.

---

## 4. 제안 셋업 구성

```
apps/web/playwright.config.ts # webServer로 next dev 자동 기동, baseURL, projects(브라우저) 설정
apps/web/e2e/
  ├── fixtures/
  │   └── auth.ts             # 인증된 세션(storageState) 주입 픽스처
  ├── helpers/
  │   └── supabase.ts         # 테스트 유저 생성/세션 발급/정리
  ├── trips.spec.ts           # 여행 생성/조회/체크리스트
  ├── templates.spec.ts       # 템플릿 생성/조회
  └── ...
apps/web/.env.test.local      # 테스트 전용 환경변수 (gitignore)
```

`apps/web/package.json` 스크립트:
```jsonc
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

설치(예시):
```bash
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

`apps/web/playwright.config.ts` 골격:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3001', trace: 'on-first-retry' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

> 참고: root에서는 `pnpm --filter nexvoy-web test:e2e`로 실행하고, 웹 패키지 내부에서는 `pnpm test:e2e`로 실행한다.

---

## 5. 권장 진행 범위 (택1로 시작)

1. **셋업만** — Playwright 설치 + `apps/web/playwright.config.ts` + 인증 픽스처 골격까지.
2. **셋업 + 스모크 1~2개** — "로그인 → 여행 생성 → 체크리스트 작성" 핵심 플로우 1개.  ← **권장 시작점**
3. **전체 주요 플로우** — 위 라우트들의 핵심 시나리오 일괄 작성.

### 추천 우선순위 시나리오
1. (스모크) 로그인 상태 진입 → 홈 렌더링 확인
2. 여행 생성 → 상세 진입 → 체크리스트 항목 추가/체크
3. 템플릿 생성 → 여행에 적용
4. 프로필 조회 / 여행 기록 확인
5. 공유 링크(`share/detail`) 비로그인 접근 동작

---

## 6. 하네스 통합 (선택)

반복적인 E2E 작성·실행을 위해 OnVoy 하네스에 **E2E 전담 스킬/에이전트** 추가를 고려할 수 있다.
- 예: `e2e-author` 스킬 — 시나리오 명세 → spec 작성 → 실행 → 결과 리포트.
- 기존 `qa-engineer` 에이전트의 책임 범위에 E2E 실행 검증을 포함시키는 방안도 가능.

---

## 7. 구현 완료 현황

### Phase 1 — 셋업 ✅
- `@playwright/test` 설치 (`apps/web`)
- `apps/web/playwright.config.ts` — `webServer: pnpm dev:e2e`, baseURL, chromium
- `apps/web/e2e/fixtures/`, `apps/web/e2e/helpers/` 디렉토리 구조
- `apps/web/.env.test.local` (로컬 Supabase 접속 정보, gitignore 처리)
- `apps/web/package.json` 스크립트: `test:e2e`, `test:e2e:ui`, `dev:e2e`

### Phase 2 — 로컬 Supabase 마이그레이션 체계 ✅
- `supabase` CLI v2.105.0 설치
- `supabase/migrations/` — 14개 파일, 날짜순 정렬
- 운영 URL·키 하드코딩 → `app.supabase_functions_url` 참조 방식으로 교체
- `supabase db reset --local` 으로 13개 테이블 재현 확인

### Phase 2 — 인증 픽스처 ✅
- `apps/web/e2e/helpers/supabase.ts` — REST API 직접 호출로 유저 생성/세션 발급/teardown
- `apps/web/e2e/fixtures/auth.ts` — `createBrowserClient.setSession()`으로 쿠키 생성 후 주입
- `apps/web/scripts/dev-e2e.mjs` — `.env.local` 무수정 원칙 준수, `process.env` 직접 주입 방식

### Phase 3 — 스모크 테스트 ✅
`apps/web/e2e/smoke.spec.ts` — 4개 테스트 모두 통과:
1. 비인증 사용자 → 랜딩 페이지 렌더링
2. 비인증 사용자 → 보호 경로 접근 시 `/login` 리다이렉트
3. 인증된 사용자 → 홈 렌더링 ("님! 👋", "새 여행 만들기" 버튼)
4. 인증된 사용자 → 보호 경로 `/trips/new` 접근 가능

---

## 8. 다음 액션
- [ ] 여행 생성 → 상세 진입 → 체크리스트 항목 추가/체크 (스모크 시나리오 2)
- [ ] 템플릿 생성 → 여행에 적용 (시나리오 3)
- [ ] Google Maps API mock 구성 (Playwright route intercept)
- [ ] 시드 스크립트 작성 (테스트 데이터 생성 + teardown)
- [ ] CI 통합 (GitHub Actions)
