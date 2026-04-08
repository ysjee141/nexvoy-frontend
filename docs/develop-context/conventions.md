# Coding Conventions & Guidelines

OnVoy 프로젝트의 일관성을 유지하기 위해 AI 모델이 반드시 지켜야 할 코딩 규칙과 스타일 가이드입니다.

---

## 1. 📂 Folder & File Conventions

### 1-1. Directory Structure
- `src/app`: Next.js App Router (Pages, Layouts).
- `src/components`: UI Components.
  - `common`: 전역 공통 컴포넌트.
  - `[DomainName]`: 특정 도메인에 종속된 컴포넌트 (예: `trips`, `profile`).
- `src/services`: 비즈니스 로직 및 API 호출 레이어. 싱글톤 패턴 권장.
- `src/utils/supabase`: Supabase 클라이언트 설정 (Server/Client/Middleware).
- `src/store`: Zustand 상태 관리 스토어.

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
모바일 하이브리드 앱 환경을 위해 상단 노치와 하단 홈 버튼 영역에 대한 패딩 처리가 필수적입니다.
- **Top**: `padding-top: env(safe-area-inset-top)`
- **Bottom**: `padding-bottom: env(safe-area-inset-bottom)`
- Panda CSS 토큰이나 유틸리티를 사용하여 레이아웃이 시스템 UI에 가려지지 않도록 조절합니다.

---

## 3. ⚙️ Logic Architecture (Service Layer)

### 3-1. Service Singleton Pattern
모든 비즈니스 로직은 클래스 기반 싱글톤 서비스로 구현됩니다. 컴포넌트는 오직 이 서비스들만을 통해 데이터에 접근합니다.

### 3-2. Platform Branching
사용자 환경(Web/Native)에 따라 동작이 달라야 하는 경우 `Capacitor` 유틸리티를 사용합니다.

```tsx
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // 모바일 앱 환경 브릿지 로직 (예: Native Share, CapacitorHttp)
} else {
  // 일반 브라우저 환경
}
```

---

## 4. ⚡ Supabase & Type Safety

### 4-1. Server vs Client Components
- **Server Components**: `src/utils/supabase/server.ts`의 `createClient`를 사용하여 세션 및 데이터를 서버 사이드에서 안전하게 인출합니다.
- **Client Components**: `'use client'` 지시어와 함께 `src/utils/supabase/client.ts`를 사용하여 사용자 인터랙션 및 실시간 업데이트를 처리합니다.

### 4-2. Path Alias & Type Safety
- 모든 임포트는 절대 경로(`@/`)를 사용합니다.
- `any` 사용을 엄격히 금지하며, DB 스키마 기반의 인터페이스를 준수합니다.

---

## 5. 🧪 Verification Code
작업 완료 후 AI는 다음 사항을 체크리스트로 확인해야 합니다.
1. [ ] 새로운 로직이 `src/services`에 작성되었는가?
2. [ ] 스타일링 시 `Safe Area`를 고려했는가?
3. [ ] 환경(웹/앱)에 따른 분기 처리가 필요한 부분인가?
4. [ ] 적절한 Supabase 클라이언트(Server/Client)를 선택했는가?
5. [ ] 절대 경로(`@/`)를 사용했는가?
