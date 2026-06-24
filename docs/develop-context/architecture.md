# Architecture Specification

이 문서는 OnVoy 프로젝트의 기술 스택 및 채택된 아키텍처에 대한 정밀한 가이드를 제공합니다. AI 모델은 모든 작업 시 이 장의 아키텍처 원칙을 최우선으로 준수해야 합니다.

## 1. Monorepo Architecture

### 1-1. Workspaces
- **Web**: `apps/web` — Next.js App Router 기반 웹 애플리케이션.
- **Mobile**: `apps/mobile` — Expo Router 기반 React Native 앱.
- **Shared Packages**:
  - `packages/types` — 도메인/DB 타입 SSOT.
  - `packages/core` — 플랫폼 독립 비즈니스 로직 및 Supabase query helper.
  - `packages/design-tokens` — 웹/RN 공용 디자인 토큰 SSOT.
- **Protected roots**: `supabase/`와 `docs/`는 monorepo 정리 작업에서도 유지한다.

### 1-2. Web Frontend
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Runtime**: Node.js / Browser
- **Deployment**: Vercel은 `pnpm --filter nexvoy-web build`와 `apps/web/.next`를 사용한다.

### 1-3. Styling System
- **Tool**: [Panda CSS](https://panda-css.com/)
- **Strategy**: Type-safe Build-time CSS-in-JS.
- **Usage**: 웹은 `apps/web/styled-system`의 `css()` 함수와 `@nexvoy/design-tokens`를 사용합니다. 모바일은 `@nexvoy/design-tokens`를 RN StyleSheet/theme adapter로 재표현합니다.
- **Brand Identity**: **Cobalt Blue (#2563EB)**가 시스템의 `brand.primary`입니다.
- **Design Guide**: [Design Guide](design-guide.md)

### 1-4. State Management
- **Strategy**: 비즈니스 로직과 UI 상태의 분리.
- **Web**: `apps/web/stores`의 Zustand store를 사용합니다.
- **Mobile**: 화면 단위 React state와 Expo/RN 저장소를 우선 사용하고, 공통 도메인 로직은 `@nexvoy/core`로 공유합니다.
- **Persistence**: 세션 유지가 필요한 경우 브라우저 LocalStorage와 동기화하며, `zustand/middleware`의 `persist` 기능을 적극 활용합니다.

---

## 2. ⚡ Backend & Data Architecture

### 2-1. Platform (Supabase)
- **Database**: PostgreSQL (Managed by Supabase)
- **Authentication**: Supabase Auth (Email/Social Login)
- **Edge Functions**: 고비용 작업이나 외부 API 보안 연동을 위해 Deno 기반 Edge Functions 활용.

### 2-2. Security (RLS)
- **Row Level Security (RLS)**: 모든 테이블에 RLS 정책이 적용되어 있습니다.
- **Principles**: `auth.uid()`를 기반으로 사용자 본인의 데이터에만 접근할 수 있도록 설계되었으며, 공유 기능은 관계형 체크 테이블을 통해 확장됩니다.

### 2-3. API Communication
- **Shared Core**: 플랫폼 독립 데이터 접근은 `@nexvoy/core/supabase/queries`에 둡니다. 각 앱은 Supabase client를 생성해 첫 인자로 주입합니다.
- **Web Client**: `apps/web/lib/supabase/{server,client,middleware}.ts`를 용도별로 구분합니다.
- **Mobile Client**: `apps/mobile/lib/supabase.ts`에서 RN/Expo용 Supabase client를 구성합니다.
- **Pattern**: 화면 컴포넌트에 임의의 중복 query를 늘리지 말고, 공유 가능한 로직은 `packages/core`로 끌어올립니다.

---

## 3. Mobile App Architecture (Expo React Native)

### 3-1. App Identity & Framework
- **App ID**: `xyz.nexvoy.app`
- **Framework**: Expo + React Native + Expo Router.
- **Build Strategy**: `pnpm --filter nexvoy-app build`로 Expo export를 검증하고, 스토어 배포는 EAS 기반으로 별도 관리합니다.

### 3-2. Essential Libraries
- **Routing**: `expo-router`
- **Auth storage**: `expo-secure-store`
- **OAuth / Browser**: `expo-auth-session`, `expo-web-browser`
- **Maps**: `react-native-maps`
- **Safe Area**: `react-native-safe-area-context`

### 3-3. Native UI Rules
- 모바일 화면은 React Native 컴포넌트와 `StyleSheet`를 기준으로 작성합니다.
- Safe Area, 상태바, 하단 탭 영역을 항상 고려합니다.
- 웹 전용 CSS/Panda 컴포넌트를 모바일에 직접 재사용하지 않습니다.

---

## 4. 🌐 External Services (Etc)

### 4-1. Push & Communication
- **Push**: Firebase Cloud Messaging (FCM).
- **Mail**: [Resend](https://resend.com/) (이메일 인증 및 알림).
- **Feedback**: Discord Webhook (실시간 피드백 모니터링).

### 4-2. Analytics
- **Web**: Google Analytics 4 (GA4).
- **App**: Firebase Analytics.

---

## 5. 🏗️ Layered Architecture
프로젝트는 다음과 같은 엄격한 레이어 구분을 가집니다:
1.  **View**: `apps/web/app`, `apps/web/components`, `apps/mobile/app`, `apps/mobile/components`.
2.  **Shared Domain**: `packages/core`, `packages/types`, `packages/design-tokens`.
3.  **Platform Client**: `apps/web/lib/supabase/*`, `apps/mobile/lib/supabase.ts`.

> [!IMPORTANT]
> AI는 컴포넌트(View) 내에 플랫폼별 중복 비즈니스 로직을 늘리지 마십시오. 웹/앱에서 공유 가능한 데이터 접근과 도메인 규칙은 `@nexvoy/core`로 이동합니다.
