# Phase 1 — nexvoy-web (Next.js SSR)

> 기간: 4~5주 (W2 ~ W6)
> 목표: 기존 Client Component 전용 구조를 RSC + SSR로 재구성하여 초기 로딩 딜레이를 500~1000ms → 100~200ms로 단축하고, Capacitor 의존 코드를 전량 제거한다.
> 전제: Phase 0 게이트 통과 (packages 컴파일 성공)
> 관련 ADR: [ADR-007](../../adrs/ADR-007-option-c-platform-split.md)

---

## 1. 산출물 (게이트 조건)

- [ ] `pnpm --filter nexvoy-web build` 성공
- [ ] Vercel 프리뷰 배포 URL 확인
- [ ] 핵심 3페이지 (home / trips·detail / checklist) Playwright 통과
- [ ] Lighthouse: FCP < 1.5s (trips/detail 기준)

---

## 2. 프로젝트 셋업 (W2 — 3일)

### 2.1 초기 생성

```bash
pnpm create next-app apps/web \
  --ts --app --no-tailwind \
  --import-alias "@/*"

cd apps/web
pnpm add @supabase/ssr @supabase/supabase-js \
  @nexvoy/types@workspace:* @nexvoy/core@workspace:*
pnpm add @pandacss/dev postcss
pnpm add @sentry/nextjs
```

**`apps/web/package.json`**
```json
{
  "name": "nexvoy-web",
  "dependencies": {
    "@nexvoy/core": "workspace:*",
    "@nexvoy/types": "workspace:*"
  }
}
```

### 2.2 `next.config.ts` — 핵심 변경

```ts
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const config: NextConfig = {
  // output: 'export' 제거 — SSR 활성화
  images: {
    // unoptimized: true 제거 — Image Optimization 활성
    remotePatterns: [/* Supabase Storage, Google Places */],
  },
};

export default withSentryConfig(config, {
  tunnelRoute: '/monitoring',   // Sentry Tunnel Route 복원 (모바일 빌드 때 막혔던 것)
});
```

### 2.3 Supabase SSR 클라이언트

기존 `src/utils/supabase/` → `apps/web/src/lib/supabase/`로 이관. 구조 변경 없음 (`@supabase/ssr` 이미 사용 중).

```
lib/supabase/
├── server.ts     # createServerClient (쿠키 기반, RSC·Server Action·API Route용)
├── client.ts     # createBrowserClient (Client Component용)
└── middleware.ts # 세션 갱신 헬퍼
```

**`apps/web/src/middleware.ts`**
```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // 세션 토큰 자동 갱신 + 인증 가드
  // /login, /signup, /join, /auth/*, /share/*, /offline 제외
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

---

## 3. 페이지 SSR 재구성 (W3 ~ W5)

### RSC/Client 경계 원칙

```
page.tsx           ← RSC (Server Component)
                     createClient() from server
                     await getTripsByUser(sb, userId)
                     → props 전달
└── PageClient.tsx ← 'use client'
                     인터랙션, 모달, 폼 등
```

### 페이지별 렌더링 전략

| 페이지 | 전략 | server fetch | 비고 |
|--------|------|-------------|------|
| `/` (home) | RSC shell + Client | trips 목록 | 로딩 딜레이 해소 핵심 |
| `/trips/detail` | RSC prefetch + Client | trip + plans 동시 fetch (Promise.all) | 0.5~1s → 100~200ms |
| `/trips/checklist` | RSC prefetch + Client | checklist items | 스와이프 동작은 Client |
| `/trips/new` | Client 전용 | — | Google Maps 입력 |
| `/templates` | RSC prefetch | 공개 템플릿 목록 (ISR 60s) | |
| `/templates/detail` | RSC prefetch | 템플릿 상세 (ISR) | |
| `/templates/new` | Client 전용 | — | 폼 |
| `/share/detail` | RSC + `generateMetadata` | 공유 trip (공개 데이터) | OG/SEO 핵심 |
| `/profile` (5개) | RSC prefetch + Client | profile, travel-log | |
| `/login`, `/signup`, `/join` | Client 전용 | — | 인증 폼 |
| `/auth/success`, `/auth/error` | Client 전용 | — | OAuth 콜백 |
| `/offline` | Static | — | |

### `/trips/detail` 예시 — 핵심 패턴

```ts
// apps/web/src/app/trips/detail/page.tsx  (RSC)
import { createClient } from '@/lib/supabase/server';
import { getTripWithPlans } from '@nexvoy/core/supabase/queries';
import { TripDetailClient } from './TripDetailClient';
import { redirect } from 'next/navigation';

export default async function TripDetailPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const tripId = searchParams.id;
  if (!tripId) redirect('/');

  const { trip, plans } = await getTripWithPlans(sb, tripId);

  return <TripDetailClient trip={trip} initialPlans={plans} userId={user.id} />;
}
```

### `/share/detail` — 동적 메타데이터

```ts
// apps/web/src/app/share/detail/page.tsx  (RSC)
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sb = await createClient();
  const { data: trip } = await sb
    .from('trips')
    .select('title, description, cover_image_url')
    .eq('share_token', searchParams.token)
    .single();

  return {
    title: trip?.title ?? 'OnVoy 여행',
    openGraph: {
      images: trip?.cover_image_url ? [trip.cover_image_url] : [],
    },
  };
}
```

---

## 4. API Routes 이관 (W3 — 1~2일)

기존 `src/app/api/` → `apps/web/src/app/api/` 이관. 로직 변경 없음.

| Route | 변경사항 |
|-------|---------|
| `/api/exchange` | 무변형 이관 |
| `/api/feedback` | 무변형 이관 |
| `/api/invite` | 무변형 이관 |
| `/api/og-preview` | `generateMetadata`로 대체 가능 — 검토 후 결정 |
| `/api/timezone` | 무변형 이관 |
| `/auth/callback` | `@supabase/ssr` 방식 유지 |

**`mv` 빌드 스크립트 폐기** — `package.json`의 `prebuild:mobile` / `postbuild:mobile` 스크립트 제거.

---

## 5. 컴포넌트 이관 (W4 ~ W5 — 10~14일)

### 이관 대상 (40개 중 ~33개)

모달/폼/리스트 계열은 `'use client'`로 거의 무변형 이관.

```
components/
├── trips/         TripCard, TripSwitcherModal, TripSection, PlanList, ...
├── checklist/     ChecklistItem, ChecklistCategory, ...
├── templates/     TemplateForm, TemplateCard, ...
├── maps/          RouteMapView, NewPlanModal  (Client 유지, Google Maps 의존)
├── profile/       ProfileEdit, AvatarUpload, ...
├── share/         ShareModal, CollaboratorModal, ...
└── ui/            공통 UI (Button, Input, Modal 등)
```

### 제거 대상 (Capacitor 전용)

| 컴포넌트/훅 | 사유 |
|------------|------|
| `UpdateOverlay` | Capgo OTA → 웹 불필요 |
| `useOTAUpdate` | Capgo 의존 |
| `Capacitor.isNativePlatform()` 분기 (19파일) | 웹 단일 경로 |
| `CapacitorHttp` 호출 | fetch로 대체 |
| `@capacitor/status-bar`, `@capacitor/splash-screen` 제어 코드 | 앱 전용 |

### AnalyticsService → GA4

```ts
// apps/web/src/lib/analytics.ts
import { sendGAEvent } from '@next/third-parties/google';

export function trackEvent(name: string, params?: Record<string, unknown>) {
  sendGAEvent('event', name, params);
}
```

### AuthService → `@supabase/ssr` 단순화

OAuth 리다이렉트: `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })` — Capacitor 브랜치 제거.

---

## 6. Panda CSS 이관

기존 `panda.config.ts`와 `styled-system/` → `apps/web/`으로 이관. 변경 없음.

---

## 7. 환경변수

```env
# apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_APP_URL=https://nexvoy.com
```

> 앱 환경변수는 `EXPO_PUBLIC_*` prefix — 혼동 방지 ([ADR-007](../../adrs/ADR-007-option-c-platform-split.md) §R9).

---

## 8. 배포 (W6)

```bash
# Vercel CLI
vercel link
vercel env pull
pnpm --filter nexvoy-web build
vercel --prod
```

- Root Directory: `apps/web`
- Framework: Next.js (자동 감지)
- Build Command: `pnpm build`

---

## 9. 검증 체크리스트

### 빌드
- [ ] `pnpm --filter nexvoy-web build` 0 errors
- [ ] TypeScript strict 통과
- [ ] `@nexvoy/core`에 플랫폼 import 없음

### 기능
- [ ] Google OAuth 로그인/로그아웃
- [ ] 여행 목록 → 상세 → 플랜 추가 플로우
- [ ] 체크리스트 스와이프 삭제 (좌측만 — domain.md 규칙)
- [ ] `/share/detail` OG 태그 확인 (og:title, og:image)
- [ ] 이미지 최적화 동작 (`next/image` unoptimized 제거 확인)
- [ ] Sentry Tunnel `/monitoring` 동작

### 성능
- [ ] trips/detail LCP < 2.5s (Lighthouse)
- [ ] home FCP < 1.5s
