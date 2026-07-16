# Coding Conventions & Guidelines

OnVoy 프로젝트의 일관성을 유지하기 위해 AI 모델이 반드시 지켜야 할 코딩 규칙과 스타일 가이드입니다.

---

## 1. 📂 Folder & File Conventions

### 1-1. Directory Structure
- `apps/web/app`: Next.js App Router (Pages, Layouts, API Routes).
- `apps/web/components`: Web UI Components.
  - `common`: 전역 공통 컴포넌트.
  - `[DomainName]`: 특정 도메인에 종속된 컴포넌트 (예: `trips`, `profile`).
- `apps/web/services`: 웹 전용 서비스 레이어.
- `apps/web/lib/supabase`: Supabase 클라이언트 설정 (Server/Client/Middleware).
- `apps/web/stores`: Zustand 상태 관리 스토어.
- `apps/mobile/app`: Expo Router 기반 React Native 화면.
- `apps/mobile/components`: RN 전용 UI 컴포넌트.
- `apps/mobile/lib`: RN/Expo 플랫폼 클라이언트와 유틸리티.
- `packages/core`: 플랫폼 독립 도메인 로직 및 Supabase query helper.
- `packages/types`: 도메인 타입 SSOT.
- `packages/design-tokens`: 웹/RN 공용 디자인 토큰 SSOT.

### 1-1-1. Data Architecture Refactor Directories

TASK-046 이후 전환 작업은 `ADR-015`와 `docs/refactor/tasks/`를 따른다. 신규 파일은 아래 경계를 우선한다.

- `packages/core/src/repositories`: 도메인 Repository interface와 플랫폼 독립 구현 계약
- `packages/core/src/sync`: domain command, outbox state, revision, conflict/retry policy
- `packages/core/src/supabase`: batch RPC와 canonical read adapter
- `apps/web/lib/data`: IndexedDB cache/outbox, Realtime, Web repository adapter
- `apps/mobile/lib/data`: SQLite cache/outbox, Realtime, Mobile repository adapter
- `packages/core/src/local-first`, `apps/*/lib/local-first`: TASK-055까지의 legacy 제거 대상

### 1-2. Naming Rules
- **Components**: PascalCase (예: `TripHeaderContainer.tsx`)
- **Pages/Layouts**: 넥스트 라우팅 규칙에 따름 (`page.tsx`, `layout.tsx`)
- **Functions & Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE (예: `MAX_TRIP_LIMIT`)
- **Interfaces/Types**: PascalCase, 별도의 접두사(I, T) 미사용 권장.

---

## 2. 🎨 Styling Conventions (Panda CSS)

### 2-1. Using `css()` Function
이 프로젝트는 인라인 스타일링의 유연성과 빌드 타임 성능을 위해 Panda CSS를 사용합니다.

```tsx
// ✅ 올바른 예시
import { css } from 'styled-system/css';

const Card = ({ children }) => (
  <div className={css({
    p: '20px',
    bg: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    _hover: { transform: 'translateY(-2px)' }
  })}>
    {children}
  </div>
);
```

### 2-2. Mobile UI (Safe Area)
모바일 React Native 앱 환경을 위해 상단 노치와 하단 홈 버튼 영역에 대한 Safe Area 처리가 필수적입니다.
- **RN 패턴**: `react-native-safe-area-context`의 `useSafeAreaInsets()` 또는 `SafeAreaView`를 사용합니다.
- **Top/Bottom**: FAB, BottomSheet, sticky footer는 `insets.top`/`insets.bottom`을 반영합니다.
- **Web 패턴**: `apps/web`에서만 CSS `env(safe-area-inset-*)` 폴백을 사용합니다.

#### 풀스크린 모달의 Safe Area 규칙
- **상단+하단 모두 필수**: `pt`만 적용하고 `pb`를 누락하면 하단 시스템 바에 UI가 가려짐
- **스크롤 가능한 모달**: `pt`를 스크롤 컨테이너가 아닌 **sticky 헤더**에 적용해야 함. 컨테이너에 두면 스크롤 시 콘텐츠가 Status Bar 뒤로 비침
  ```
  // ✅ 올바른 패턴
  Container (overflowY: auto, pb: safe-area-bottom)
    Header (sticky, top: 0, bg: white, pt: calc(기존패딩 + safe-area-top))

  // ❌ 잘못된 패턴
  Container (overflowY: auto, pt: safe-area-top)  ← 스크롤 시 블리드
    Header (sticky, top: 0)
  ```
- **비스크롤 모달** (overflow: hidden + 내부 스크롤 영역 분리): 컨테이너에 `pt` 적용 가능

---

## 3. ⚙️ Logic Architecture (Service Layer)

### 3-1. Service Singleton Pattern
웹 전용 외부 API 연동은 `apps/web/services`에 둡니다. 웹/앱에서 공유 가능한 순수 도메인 로직과 Supabase query helper는 `packages/core`에 둡니다.

### 3-2. Platform Branching
사용자 환경(Web/RN)에 따라 동작이 달라야 하는 경우 플랫폼 경계에서 분리합니다. `packages/core`에는 Next.js, Expo, React Native, DOM API를 import하지 않습니다.

```tsx
// apps/web: Web API, Next.js, Panda CSS 사용
// apps/mobile: Expo/RN API, StyleSheet, native module 사용
// packages/core: 플랫폼 독립 TypeScript만 사용
```

### 3-3. Repository Boundary (Server-Authority 전환)

데이터 전환 범위에서는 화면 컴포넌트가 data source를 직접 호출하지 않는다.

- UI는 `TripRepository`, `ChecklistRepository` 같은 interface만 사용한다.
- Supabase query/RPC 호출은 remote authority adapter 내부로 제한한다.
- local mutation과 outbox append는 platform store의 한 transaction으로 처리한다.
- command/revision/conflict 계약은 `packages/core`에서 공유한다.
- WebRTC/Yjs/custom backup adapter에 신규 기능을 추가하지 않는다.
- 기존 direct query/document-primary 경로는 cutover feature flag의 임시 rollback으로만 유지한다.

---

## 4. ⚡ Supabase & Type Safety

### 4-1. Server vs Client Components
- **Server Components**: `apps/web/lib/supabase/server.ts`의 `createClient`를 사용하여 세션 및 데이터를 서버 사이드에서 안전하게 인출합니다.
- **Client Components**: `'use client'` 지시어와 함께 `apps/web/lib/supabase/client.ts`를 사용하여 사용자 인터랙션 및 실시간 업데이트를 처리합니다.
- **React Native**: `apps/mobile/lib/supabase.ts`의 RN용 client를 사용합니다.

### 4-2. Path Alias & Type Safety
- 모든 임포트는 절대 경로(`@/`)를 사용합니다.
- `any` 사용을 엄격히 금지하며, DB 스키마 기반의 인터페이스를 준수합니다.

### 4-3. Server-Authority Security Rules

- final permission은 Supabase registry/RLS/RPC가 담당한다.
- command/row content를 로그, push payload, Realtime invalidation에 남기지 않는다.
- operation idempotency와 entity/resource revision을 server transaction에서 검증한다.
- viewer/revoked user는 UI뿐 아니라 RPC, Realtime, Storage에서도 차단한다.
- local cache는 account namespace로 격리하고 로그아웃/전환/revoke lifecycle을 구현한다.

---

## 5. 🧪 Verification Code
작업 완료 후 AI는 다음 사항을 체크리스트로 확인해야 합니다.
1. [ ] 공유 가능한 로직이 `packages/core`에 작성되었는가?
2. [ ] 스타일링 시 `Safe Area`를 고려했는가?
3. [ ] 환경(웹/앱)에 따른 분리가 필요한 부분인가?
4. [ ] 적절한 Supabase 클라이언트(Server/Client)를 선택했는가?
5. [ ] 각 workspace의 절대 경로(`@/`)와 package import(`@nexvoy/*`)를 올바르게 사용했는가?
6. [ ] 데이터 전환 작업이라면 UI가 Repository interface만 사용하는가?
7. [ ] `packages/core`에 platform API가 들어가지 않았는가?
8. [ ] command/row payload가 로그/푸시/Realtime metadata에 노출되지 않는가?
9. [ ] local cache mutation과 outbox append가 한 transaction인가?
