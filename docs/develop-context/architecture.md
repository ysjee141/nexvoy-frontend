# Architecture Specification

이 문서는 OnVoy 프로젝트의 기술 스택 및 채택된 아키텍처에 대한 정밀한 가이드를 제공합니다. AI 모델은 모든 작업 시 이 장의 아키텍처 원칙을 최우선으로 준수해야 합니다.

## 1. 🎨 Frontend Architecture

### 1-1. Framework & Core
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Runtime**: Node.js / Browser (Partial Capacitor WebView)

### 1-2. Styling System (Panda CSS)
- **Tool**: [Panda CSS](https://panda-css.com/)
- **Strategy**: Type-safe Build-time CSS-in-JS.
- **Usage**: 원격 스타일 시트를 지향하며, `styled-system`의 `css()` 함수와 디자인 토큰을 사용합니다. 인라인 스타일 및 Tailwind CSS 사용은 지양합니다 (별도 요청 시에만 허용).
- **Brand Identity**: **Cobalt Blue (#2563EB)**가 시스템의 `brand.primary`입니다.
- **Design Guide**: [Design Guide](design-guide.md)

### 1-3. State Management (Zustand)
- **Strategy**: 비즈니스 로직과 UI 상태의 분리.
- **Global States**: 
  - `UI Store`: 모달, 알림, 전역 로딩 상태.
  - `Data Store`: 사용자 프로필, 세션, 환경 설정.
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
- **Client**: `src/services/ApiService.ts` (Singleton)
- **Pattern**: `Supabase Client`를 직접 호출하지 않고 서비스 레이어에서 추상화합니다. 서버 컴포넌트(`src/utils/supabase/server.ts`)와 클라이언트 컴포넌트(`src/utils/supabase/client.ts`)의 용도를 엄격히 구분합니다.

---

## 3. 📱 Mobile App Architecture (Capacitor)

### 3-1. App Identity & Framework
- **App ID**: `xyz.nexvoy.app`
- **Framework**: [Capacitor](https://capacitorjs.com/) 기반 하이브리드 브릿지.
- **Build Strategy**: Next.js의 정적 내보내기(`next export` -> `out` 폴더)를 통해 생성된 자산을 Capacitor 네이티브 플랫폼이 로드합니다.

### 3-2. Essential Plugins
- **CapacitorHttp**: CORS 우회 및 성능 최적화를 위해 기본 `fetch` 대신 네이티브 네트워크 스택을 사용합니다.
- **CapacitorUpdater (Capgo)**: `@capgo/capacitor-updater`를 통해 스토어 심사 없이 OTA(Over-The-Air) 실시간 앱 업데이트를 수행합니다.
- **Push Notifications**: `@capacitor/push-notifications`를 통해 FCM 알림을 수신합니다.
- **SplashScreen & StatusBar**: 앱 기동 UI 및 시스템 상단바 제어.

### 3-3. Hybrid Logic
- 웹과 네이티브 환경을 감지하여 동작이 분기됩니다.
- 모바일 환경에서는 안전 영역(Safe Area) 처리가 필수적이며, 시스템 폰트 가시성을 확보해야 합니다.

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
1.  **View (App Router & Components)**: UI 렌더링 및 사용자 인터랙션.
2.  **Service (src/services)**: 비즈니스 로직, 데이터 가공, 상태 업데이트.
3.  **API Client (ApiService / Supabase Client)**: 데이터 인출 및 외부 서버 통신.

> [!IMPORTANT]
> AI는 컴포넌트(View) 내에서 직접 Supabase DB 쿼리를 작성하지 마십시오. 모든 데이터 인터페이스는 **Service 레이어**를 거쳐야 합니다.
