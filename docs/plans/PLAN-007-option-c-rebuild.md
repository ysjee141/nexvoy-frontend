# OnVoy Option C 재개발 플랜 — 웹/앱 완전 분리

> 작성일: 2026-06-19
> 상태: **제안됨 (Proposed)**
> 대상 선택지: **Option C** (nexvoy-web: Next.js SSR + nexvoy-app: React Native/Expo + 공유 Supabase)
> 전제: 정식 오픈 전, 운영 사용자 없음, 1인 개발자, Supabase 스키마/RLS 그대로 유지
> 참조: `docs/rebuild-analysis.md`

---

## 0. 현황 요약 (코드베이스 실측)

| 항목 | 수량/내용 | Option C 영향 |
|------|----------|--------------|
| 페이지 (`src/app/**/page.tsx`) | 20 (auth/success·error, join, login, signup, offline, home, profile×5, share/detail, templates×3, trips×3) | 웹: SSR 재구성 / 앱: 화면 재작성 |
| API Routes | 5 (`/api/exchange`, `/api/feedback`, `/api/invite`, `/api/og-preview`, `/api/timezone`) + `auth/callback` route | 웹으로 이관, 앱은 직접 호출 또는 Edge Function |
| Service 클래스 | 13 (총 1,805줄) | 9개 Capacitor 결합, 4개 순수 로직 |
| 컴포넌트 | 40 (.tsx) | 웹: 일부 RSC화 / 앱: 전량 RN 재작성 |
| Supabase 마이그레이션 | 16개 (적용 완료) | **변경 없음** |
| Capacitor 의존 Service | 9/13 (`Analytics, Api, Auth, ExternalApi, Feedback, NativeUI, Lifecycle, Notification, PlacePhoto`) | 분해 대상 |
| `@supabase/ssr` | 이미 deps에 존재 (^0.8.0) | 웹 SSR 즉시 활용 가능 |
| `mv` 기반 모바일 빌드 스크립트 | `build:mobile` | **폐기** |

### 0.1 도메인 타입이 흩어져 있음 (핵심 부채)

`src/types/` 디렉토리가 **비어있음**. `Trip`, `Plan`, `ChecklistItem`, `Template`, `Collaborator` 타입이 각 컴포넌트/서비스 안에 중복 정의되어 있다.

| 타입 | 현재 정의 위치 (중복) |
|------|---------------------|
| `Trip` | `profile/travel-log/page.tsx:13`, `TripSwitcherModal.tsx:15`, `TripSection.tsx:10` |
| `Plan` | `PlanList.tsx:8`, `RouteMapView.tsx:27` |
| `Collaborator` | `CollaboratorModal.tsx:22` |
| `TemplateItemInput` | `TemplateForm.tsx:7` |
| `TripBundle` | `DownloadService.ts:13` |

→ **이 중복 해소가 Option C 공유 패키지 전략의 출발점이자 가장 큰 즉시 이득.**

### 0.2 Service Capacitor 결합도 (실측)

| Service | Capacitor 참조 | 분류 | Option C 처리 |
|---------|---------------|------|--------------|
| AdService | 0 | 미구현/스텁 | 폐기 |
| PremiumService | 0 | 미구현/스텁 | 폐기 |
| DownloadService | 0 | 순수 로직 (오프라인 번들) | 앱 전용 재작성 (RN FileSystem) |
| PlanPhotoStorageService | 0 | 순수 Supabase Storage | **공유 가능** (SDK 분기만) |
| ExternalApiService | 1 | 거의 순수 (fetch 래퍼) | 공유 + 플랫폼 fetch 분기 |
| ApiService | 3 | CapacitorHttp 래퍼 | 분해: 웹=fetch, 앱=RN fetch |
| FeedbackService | 2 | Discord webhook + 디바이스 정보 | 공유 (로직) + 분기 (정보 수집) |
| NativeUIService | 4 | StatusBar/SplashScreen | 앱 전용 (Expo SystemUI) |
| LifecycleService | 4 | App state/OTA | 앱 전용 (Expo Updates) |
| AuthService | 5 | OAuth 리다이렉트 | 분해: 웹=@supabase/ssr, 앱=expo-auth-session |
| AnalyticsService | 6 | GA4(웹)/Firebase(앱) | 분해: 웹=GA4, 앱=expo-firebase-analytics |
| PlacePhotoService | 3 | Google Places 사진 | 공유 로직 + 호출 분기 |
| NotificationService | 7 | FCM/LocalNotifications | 앱 전용 (expo-notifications) |

---

## 1. 전체 Phase 구성

| Phase | 목표 | 기간 | 핵심 산출물 |
|-------|------|------|-----------|
| **Phase 0** | Monorepo 골격 + 공유 패키지 | 1.5주 | pnpm workspace, `packages/core`, `packages/types`, 도메인 타입 SSOT |
| **Phase 1** | nexvoy-web (Next.js SSR) | 4~5주 | 20페이지 SSR, 5 API Routes, Vercel 배포 |
| **Phase 2** | nexvoy-app (Expo RN) | 7~8주 | 20화면, 직접 Supabase SDK, EAS 빌드 |
| **Phase 3** | 통합 및 안정화 | 2~3주 | Universal Link, E2E/Detox, 스토어 심사, 모니터링 |
| | **합계** | **14.5~17.5주 (~4개월)** | rebuild-analysis.md 추정과 일치 |

### Phase 게이트 (다음 Phase 진입 조건)

- Phase 0 → 1: `packages/types` import만으로 컴파일 통과, `packages/core`의 Supabase 헬퍼가 웹/앱 양쪽 환경에서 빌드됨
- Phase 1 → 2: `pnpm --filter nexvoy-web build` 성공 + Vercel 프리뷰 배포 + 핵심 3페이지(home/trips·detail/checklist) Playwright 통과
- Phase 2 → 3: EAS development build가 실기기에서 인증→여행생성→플랜추가 플로우 완주
- Phase 3 종료: 양 플랫폼 E2E 그린 + Sentry 양쪽 연결 + TestFlight/내부테스트 트랙 업로드

---

## 2. 타깃 디렉토리 구조

```
nexvoy/                              # 신규 monorepo 루트
├── pnpm-workspace.yaml
├── package.json                     # 루트 (workspace scripts)
├── tsconfig.base.json
├── packages/
│   ├── types/                       # @nexvoy/types — 도메인 타입 SSOT
│   │   ├── package.json
│   │   └── src/
│   │       ├── trip.ts              # Trip, TripMember
│   │       ├── plan.ts              # Plan, PlanLocation
│   │       ├── checklist.ts         # ChecklistItem, ChecklistCategory
│   │       ├── template.ts          # Template, TemplateItem
│   │       ├── user.ts              # Profile, Premium
│   │       ├── collaboration.ts     # Collaborator, Invitation, Share
│   │       ├── database.ts          # Supabase 생성 타입 (gen types)
│   │       └── index.ts
│   └── core/                        # @nexvoy/core — 플랫폼 독립 비즈니스 로직
│       ├── package.json
│       └── src/
│           ├── supabase/
│           │   ├── queries.ts       # 순수 쿼리 빌더 (client 주입 방식)
│           │   └── storagePaths.ts  # [user_id]/[trip_id]/[filename] 규칙
│           ├── domain/
│           │   ├── tripLogic.ts     # 정렬/검증/집계 (date·time 정렬 등)
│           │   ├── checklistLogic.ts
│           │   ├── collaboration.ts # (현 src/utils/collaboration.ts 이관)
│           │   └── currency.ts      # (현 src/utils/currency.ts 이관)
│           └── utils/
│               ├── date.ts          # (현 src/utils/date.ts 이관)
│               └── placePhoto.ts    # Google Places URL 빌드 (호출은 주입)
├── apps/
│   ├── web/                         # nexvoy-web (Next.js 16, SSR)
│   │   ├── package.json
│   │   ├── next.config.ts           # output 'export' 제거, Sentry tunnel 복원
│   │   ├── panda.config.ts
│   │   └── src/
│   │       ├── app/                 # App Router (RSC + Client 혼용)
│   │       ├── components/
│   │       ├── lib/supabase/        # server.ts / client.ts / middleware.ts
│   │       └── store/
│   └── mobile/                      # nexvoy-app (Expo, React Native)
│       ├── package.json
│       ├── app.json / eas.json
│       └── src/
│           ├── screens/             # 20 화면
│           ├── components/          # RN 컴포넌트
│           ├── lib/supabase/        # AsyncStorage 기반 client
│           ├── navigation/          # expo-router 또는 react-navigation
│           └── store/
└── supabase/                        # 기존 그대로 이관 (migrations 16개)
```

> **마이그레이션 전략:** 기존 `travel-pack` 리포는 보존(아카이브). 신규 `nexvoy` monorepo를 새로 만들고, 코드는 "복사 후 변형"으로 이관한다. git 히스토리는 신규 리포에서 새로 시작 (오픈 전이라 부담 없음).

---

## 3. Phase 0 — 준비 (Monorepo + 공유 패키지) · 1.5주

### 3.1 태스크

- [ ] `nexvoy/` 루트 생성, `pnpm-workspace.yaml` 작성
  ```yaml
  packages:
    - "packages/*"
    - "apps/*"
  ```
- [ ] 루트 `tsconfig.base.json` 작성 (paths: `@nexvoy/types`, `@nexvoy/core`)
- [ ] `packages/types` 생성 — **0.1의 흩어진 타입을 단일 정의로 통합**
  - [ ] `supabase gen types typescript --project-id <id> > packages/types/src/database.ts`
  - [ ] `Trip`/`Plan`/`Checklist`/`Template`/`Collaborator` 정의 (database.ts Row 기반 파생)
- [ ] `packages/core` 생성 — 플랫폼 독립 로직만 이관
  - [ ] `src/utils/date.ts` → `packages/core/src/utils/date.ts`
  - [ ] `src/utils/currency.ts` → `packages/core/src/domain/currency.ts`
  - [ ] `src/utils/collaboration.ts` → `packages/core/src/domain/collaboration.ts`
  - [ ] Plan 날짜/시간 정렬 로직(`PlanList`에서 추출) → `tripLogic.ts`
  - [ ] Storage 경로 규칙 함수화 (`[user_id]/[trip_id]/[filename]`)
- [ ] **Supabase 클라이언트 주입 패턴** 확립 — core는 client를 import하지 않고 인자로 받음
  ```ts
  // packages/core/src/supabase/queries.ts
  import type { SupabaseClient } from '@supabase/supabase-js';
  import type { Database, Trip } from '@nexvoy/types';

  export async function getTripsByUser(
    sb: SupabaseClient<Database>, userId: string
  ): Promise<Trip[]> {
    const { data, error } = await sb.from('trips')
      .select('*').eq('owner_id', userId).order('start_date');
    if (error) throw error;
    return data;
  }
  ```
  → 웹은 server client, 앱은 RN client를 주입 → **쿼리 로직 1벌 공유**
- [ ] 빌드 검증: `pnpm -r build` (packages만)

### 3.2 산출물
- 컴파일되는 `@nexvoy/types`, `@nexvoy/core`
- 도메인 타입 SSOT 1벌 (중복 5종 제거)
- 클라이언트 주입형 쿼리 헬퍼

---

## 4. Phase 1 — nexvoy-web (Next.js SSR) · 4~5주

### 4.1 프로젝트 셋업 (3일)
- [ ] `apps/web` Next.js 16 + App Router 생성, Panda CSS 설정 이관
- [ ] `next.config.ts`: **`output: 'export'` 제거**, Sentry Tunnel Route 복원, Image Optimization 활성
- [ ] `lib/supabase/{server,client,middleware}.ts` 이관 (현 `src/utils/supabase/*` 거의 그대로 — 이미 `@supabase/ssr` 사용 중)
- [ ] `middleware.ts`로 세션 갱신 + 인증 가드

### 4.2 페이지 SSR 재구성 (페이지별 RSC/Client 경계 명시)

| 페이지 | 렌더링 전략 | 데이터 페칭 | 비고 |
|--------|-----------|-----------|------|
| `/` (home) | RSC shell + Client 위젯 | server: 사용자 trips 목록 prefetch | **로딩 딜레이 해소 핵심** |
| `/trips/detail` | RSC prefetch + Client interaction | server: trip + plans 동시 fetch | 0.5~1s → 100~200ms 목표 |
| `/trips/checklist` | RSC prefetch | server: checklist items | 스와이프는 Client |
| `/trips/new` | Client | — | Google Maps 입력 (Client 필수) |
| `/templates`, `/templates/detail` | RSC prefetch | server: 템플릿 목록 | 공개 템플릿 ISR 후보 |
| `/templates/new` | Client | — | 폼 |
| `/share/detail` | **RSC + 동적 메타데이터** | server: 공유 trip + OG | SEO/링크 미리보기 핵심 |
| `/profile/*` (5개) | RSC prefetch | server: profile, travel-log | |
| `/login`, `/signup`, `/join` | Client | — | 인증 폼 |
| `/auth/success`, `/auth/error`, `/offline` | Client/Static | — | |

- [ ] 각 페이지: `page.tsx`(RSC, `createClient` from server) → 자식 `*Client.tsx`로 데이터 props 전달
- [ ] `Capacitor.isNativePlatform()` 분기 **전량 제거** (웹 단일 경로)

### 4.3 API Routes 이관 (1~2일)
- [ ] `/api/exchange`, `/api/feedback`, `/api/invite`, `/api/og-preview`, `/api/timezone` → `apps/web/src/app/api/`
- [ ] `auth/callback/route.ts` 이관
- [ ] `mv` 빌드 스크립트 **폐기** (SSR이므로 불필요)

### 4.4 컴포넌트 이관 (10~14일)
- [ ] 40개 컴포넌트 중 모달/폼/리스트는 Client Component로 거의 그대로 이관
- [ ] `RouteMapView`, `NewPlanModal` 등 Google Maps 의존 컴포넌트는 Client 유지
- [ ] Capacitor 전용 컴포넌트(`UpdateOverlay`, `NativeAnalytics`, `OTAUpdate` 훅 등) **제외**
- [ ] AnalyticsService → 웹 GA4 (`@next/third-parties`)만 남김
- [ ] AuthService → `@supabase/ssr` OAuth 콜백 방식으로 단순화

### 4.5 산출물
- 20페이지 SSR 웹, Vercel 프리뷰 배포
- 핵심 3페이지 Playwright 그린
- `pnpm --filter nexvoy-web build` 성공

---

## 5. Phase 2 — nexvoy-app (React Native / Expo) · 7~8주

### 5.1 프로젝트 셋업 (1주)
- [ ] `apps/mobile` Expo (managed workflow) 생성, App ID `xyz.nexvoy.app` 유지
- [ ] 네비게이션: `expo-router` (App Router 멘탈모델 유사) 채택
- [ ] Supabase RN client (`lib/supabase/client.ts`)
  ```ts
  import { createClient } from '@supabase/supabase-js';
  import AsyncStorage from '@react-native-async-storage/async-storage';
  export const supabase = createClient(url, anonKey, {
    auth: { storage: AsyncStorage, autoRefreshToken: true,
            persistSession: true, detectSessionInUrl: false },
  });
  ```
- [ ] EAS 설정 (`eas.json`: development/preview/production 프로필)

### 5.2 화면 재작성 (Phase별 묶음)

| 묶음 | 화면 | 기간 | 핵심 RN 작업 |
|------|------|------|------------|
| 인증 | login, signup, join, auth callback | 1주 | `expo-auth-session` OAuth, deep link |
| 핵심 1 | home, trips/detail | 2주 | FlatList 타임라인, Reanimated 전환 |
| 핵심 2 | trips/new, plan 추가/상세 | 1.5주 | `react-native-maps`, 날짜·장소 입력 |
| 체크리스트 | checklist | 1.5주 | `react-native-gesture-handler` 스와이프 (좌측 스와이프 규칙 유지) |
| 템플릿 | templates, detail, new | 1.5주 | 폼, 공개/비공개 |
| 부가 | profile×5, share/detail, offline | 1.5주 | 프로필 편집, 공유 핸드오프 |

### 5.3 플랫폼 전용 Service 재작성 (앱)
- [ ] `NotificationService` → `expo-notifications` (FCM 토큰 등록 + 로컬 알림)
- [ ] `NativeUIService` → `expo-system-ui` + `expo-status-bar` + SafeAreaView
- [ ] `LifecycleService` → `expo-updates` (OTA, Capgo 대체) + AppState
- [ ] `DownloadService` (오프라인 번들) → `expo-file-system` + AsyncStorage
- [ ] `AnalyticsService` → `@react-native-firebase/analytics` 또는 Expo 호환 SDK
- [ ] `PlanPhotoStorageService`/`PlacePhotoService` → `@nexvoy/core` 로직 + RN client 주입
- [ ] Realtime: `supabase.channel()` 그대로 사용 (RN에서도 동작)

### 5.4 Map 처리
- [ ] `@react-google-maps/api`(웹 전용) → 앱은 `react-native-maps` (Google provider)로 재구현
- [ ] Polyline 직접 관리 패턴은 RN에서 `<Polyline>` 컴포넌트로 대체

### 5.5 산출물
- 20화면 Expo 앱, EAS development build 실기기 동작
- Detox 핵심 시나리오 통과

---

## 6. Phase 3 — 통합 및 안정화 · 2~3주

- [ ] Universal Link / App Links: `/share/detail`, `/join` 초대 링크 → 앱 미설치 시 웹, 설치 시 앱 핸드오프
  - 웹: `apple-app-site-association`, `assetlinks.json` 서빙
  - 앱: `app.json` associatedDomains / intentFilters
- [ ] Sentry: 웹(`@sentry/nextjs` Tunnel 복원) + 앱(`@sentry/react-native`)
- [ ] E2E: 웹 Playwright (기존 자산 이관) + 앱 Detox
- [ ] CI: GitHub Actions — `pnpm --filter` 단위 web/app 분리 파이프라인 + EAS build
- [ ] 스토어: Apple Developer($99/년) 등록, TestFlight / Play 내부테스트 업로드
- [ ] 모니터링 대시보드 점검, 환경변수(.env) 양쪽 분리 정리

---

## 7. 마이그레이션 분석 (재사용 / 재작성 / 폐기)

### 7.1 재사용 가능 (→ `@nexvoy/core` / `@nexvoy/types`)
| 대상 | 출처 | 비고 |
|------|------|------|
| 도메인 타입 5종 | 흩어진 정의 통합 | SSOT화 |
| `date.ts`, `currency.ts`, `collaboration.ts` | `src/utils/` | 순수 함수, 무변형 이관 |
| Plan 정렬/검증 로직 | `PlanList`, `DownloadService` | 추출 후 공유 |
| Supabase 쿼리 형태 | 각 Service의 `.from().select()` | client 주입형으로 재구성 |
| Storage 경로 규칙 | domain.md 규칙 | 함수화 |
| RLS/마이그레이션 16개 | `supabase/` | **무변경 이관** |

### 7.2 웹에서 새로 작성
- 각 페이지 RSC shell + server fetch 레이어 (`createClient` from `@supabase/ssr` server)
- `middleware.ts` 세션 갱신/가드
- 동적 메타데이터(`generateMetadata`) — share/detail SEO
- ISR 적용 (공개 템플릿)

### 7.3 앱에서 새로 작성
- 20화면 RN UI 전량 (Panda CSS → RN StyleSheet/`nativewind` 택1)
- `expo-router` 네비게이션
- 플랫폼 Service 6종 (Notification/NativeUI/Lifecycle/Download/Analytics/Auth)
- `react-native-maps`, `gesture-handler` 스와이프, Reanimated 애니메이션

### 7.4 폐기
| 대상 | 사유 |
|------|------|
| Capacitor 전체 (`@capacitor/*`, `@capgo/*`) | RN으로 대체 |
| `build:mobile` `mv` 스크립트 | SSR 웹 + 별도 앱이라 불필요 |
| `prebuild`/`postbuild` API 이동 로직 | 동일 |
| `output: 'export'` 정적 내보내기 설정 | 웹은 SSR |
| `AdService`, `PremiumService` (미구현 스텁) | 빈 파일 정리 |
| `Capacitor.isNativePlatform()` 분기 (19파일) | 플랫폼 분리로 소멸 |
| `@sentry/capacitor` | `@sentry/react-native`로 대체 |
| `useOTAUpdate` 훅 (Capgo) | `expo-updates`로 대체 |

---

## 8. 공유 코드 전략

### 8.1 Monorepo vs 별도 저장소

| 기준 | pnpm Monorepo | 별도 저장소 + npm 패키지 |
|------|--------------|------------------------|
| 타입 동기화 | 즉시 (workspace 링크) | 퍼블리시/버전 관리 필요 |
| 변경 추적 | 단일 PR로 web+app+core | 3개 리포 조율 |
| 1인 개발 인지부하 | **낮음** (한 곳) | 높음 (버전 핀, 릴리스) |
| CI 복잡도 | filter로 분리 가능 | 리포별 독립 (단순하나 중복) |
| 초기 셋업 | workspace 설정 1회 | 패키지 레지스트리 구성 |

> **권장: pnpm Monorepo.** 1인 개발자에게 별도 저장소의 버전 핀/퍼블리시 오버헤드는 순손실. 이미 pnpm 사용 중이고, workspace로 타입을 실시간 공유하면 0.1의 중복 부채를 근본 해소한다.

### 8.2 공유 경계 원칙
- **공유함 (`@nexvoy/core`, `@nexvoy/types`):** 타입, 순수 비즈니스 로직, client 주입형 쿼리, 상수
- **공유 안 함:** UI 컴포넌트(웹 Panda vs RN StyleSheet), 라우팅, 플랫폼 Service, Supabase client 인스턴스 생성
- **금지:** `@nexvoy/core`에서 `next/*`, `react-native`, `@capacitor/*`, 특정 client import 금지 → 순수성 유지 (ESLint `no-restricted-imports`로 강제)

---

## 9. Supabase 유지 전략

### 9.1 스키마/RLS 변경 없음 확인
- 16개 마이그레이션 적용 완료 상태 그대로 사용. RLS는 `auth.uid()` 기반이라 클라이언트 종류와 무관하게 동작.
- 웹 server client, 앱 RN client 모두 동일 anon key + 사용자 JWT → 동일 RLS 적용.

### 9.2 웹 — `@supabase/ssr`
- 이미 deps에 존재. `createServerClient`(쿠키 기반) + `createBrowserClient`.
- `middleware.ts`에서 토큰 자동 갱신.

### 9.3 앱 — Supabase JS SDK + AsyncStorage
- `@supabase/supabase-js` + `@react-native-async-storage/async-storage`로 세션 영속화.
- OAuth는 `expo-auth-session` + `detectSessionInUrl: false` + deep link 콜백.

### 9.4 공유 쿼리
- `@nexvoy/core/supabase/queries.ts`가 `SupabaseClient<Database>`를 인자로 받아 웹/앱 양쪽에서 동일 로직 재사용 (Phase 0 패턴).

---

## 10. 위험 요소 및 완화

| # | 위험 | 영향 | 완화 |
|---|------|------|------|
| R1 | RN 화면 20개 재작성 공수 과소평가 | 일정 지연 | 핵심 5화면 먼저 완성 후 재추정. UI는 RN 표준 컴포넌트 우선, 커스텀 최소화 |
| R2 | Panda CSS → RN 스타일 재작성 비용 | 앱 Phase 비대 | `nativewind`로 토큰 일부 재사용 검토 (단, 디자인 토큰만 공유, 컴포넌트는 분리) |
| R3 | OAuth/딥링크가 RN에서 까다로움 | 인증 막힘 | Phase 2 최우선(인증 묶음 1주차) 처리, Supabase RN 공식 가이드 준수 |
| R4 | 1인 개발 두 플랫폼 동시 유지 부담 | 품질 저하 | **순차 진행** (웹 안정화 후 앱 착수), core 공유로 로직 중복 최소화 |
| R5 | Google Maps 웹/앱 API 상이 | 지도 기능 중복 | 웹 `@react-google-maps/api`, 앱 `react-native-maps` — 데이터 가공만 core 공유 |
| R6 | Realtime 구독 RN 동작 검증 미흡 | 협업 기능 결함 | Phase 2 초기 PoC로 `channel()` RN 동작 확인 |
| R7 | E2E/테스트 이중화 비용 | 회귀 위험 | 웹 Playwright 자산 재사용, 앱은 핵심 플로우만 Detox |
| R8 | core 패키지에 플랫폼 코드 유입 | 공유 깨짐 | ESLint `no-restricted-imports` 가드 |
| R9 | 환경변수 양쪽 분기 혼동 | 빌드/런타임 오류 | web=`NEXT_PUBLIC_*`, app=`EXPO_PUBLIC_*` 명명 규칙 분리 |

---

## 11. 현실적 일정 (1인 개발자, 주 단위)

| 주차 | Phase | 작업 |
|------|-------|------|
| W1 | P0 | monorepo, types SSOT, core 골격 |
| W1.5 | P0 | client 주입형 쿼리, 빌드 검증 |
| W2 | P1 | web 셋업, supabase SSR, middleware |
| W3~4 | P1 | 핵심 페이지 SSR (home/trips/checklist), API Routes 이관 |
| W5~6 | P1 | 나머지 페이지 + 컴포넌트 이관, Vercel 배포, Playwright |
| W7 | P2 | Expo 셋업, RN supabase client, 인증 화면 |
| W8~9 | P2 | home/trips·detail (핵심 1) |
| W10~11 | P2 | trips/new·plan, checklist (스와이프) |
| W12~13 | P2 | 템플릿, 프로필/공유/부가 화면 |
| W14 | P2 | 플랫폼 Service 6종, 지도, Realtime PoC 마무리 |
| W15 | P3 | Universal Link, Sentry 양쪽, CI |
| W16~17 | P3 | Detox, 스토어 등록/심사, 안정화 |

> **순차 권장:** P1(웹) 완성·배포 후 P2(앱) 착수. 동시 진행은 1인 개발에서 R4 리스크. 단, P0의 core/types는 양 Phase의 토대이므로 반드시 선행.

---

## 12. 검증 포인트 (reviewer / qa-engineer 전달용)

### reviewer
- [ ] `@nexvoy/core`에 플랫폼 import 없음 (`next/*`, `react-native`, `@capacitor/*` 부재)
- [ ] 도메인 타입이 `@nexvoy/types` 단일 출처에서만 정의됨 (중복 0)
- [ ] 컴포넌트가 Supabase 직접 쿼리 안 함 — core 쿼리 헬퍼 경유 (architecture.md 레이어 규칙)
- [ ] 웹: RSC/Client 경계 명확, `'use client'` 최소 범위
- [ ] RLS 의존 — 클라이언트에서 권한 우회 쿼리 없음

### qa-engineer
- [ ] `pnpm -r build` (packages) / `pnpm --filter nexvoy-web build` / EAS build 각각 성공
- [ ] 웹 핵심 3페이지 로딩 100~200ms (SSR 효과 측정)
- [ ] 동일 계정으로 웹 생성 데이터가 앱에서 즉시 조회됨 (공유 DB 정합성)
- [ ] Universal Link: 앱 미설치=웹 / 설치=앱 핸드오프
- [ ] Safe Area (앱 상단/하단), 스와이프 (좌측만 액션 노출 — domain.md 규칙)
- [ ] Realtime 협업: 한 클라이언트 변경이 다른 클라이언트에 반영

---

## 부록 A. 초기 명령어

```bash
# 1) monorepo 골격
mkdir nexvoy && cd nexvoy
pnpm init
printf 'packages:\n  - "packages/*"\n  - "apps/*"\n' > pnpm-workspace.yaml

# 2) 패키지 생성
mkdir -p packages/types/src packages/core/src
pnpm --filter ./packages/types init
pnpm --filter ./packages/core init

# 3) Supabase 타입 생성 (스키마 무변경)
pnpm dlx supabase gen types typescript --project-id <PROJECT_ID> \
  > packages/types/src/database.ts

# 4) 웹 앱
pnpm create next-app apps/web --ts --app --no-tailwind
pnpm --filter nexvoy-web add @supabase/ssr @supabase/supabase-js @nexvoy/types @nexvoy/core

# 5) 모바일 앱
pnpm create expo apps/mobile
pnpm --filter nexvoy-app add @supabase/supabase-js \
  @react-native-async-storage/async-storage expo-router \
  react-native-maps expo-notifications expo-updates \
  @nexvoy/types @nexvoy/core
```

## 부록 B. 비용

| 서비스 | 플랜 | 월 비용 |
|--------|------|--------|
| Vercel | Free (Hobby) | $0 |
| Supabase | Free | $0 |
| EAS | Free tier | $0 |
| Apple Developer | $99/년 | ~$8/월 |
| **합계** | | **~$8/월** |
