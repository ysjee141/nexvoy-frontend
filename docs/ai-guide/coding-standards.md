# 🎨 OnVoy 코딩 표준 및 스타일 가이드

OnVoy 프로젝트의 코딩 스타일을 유지하기 위해 AI 어시스턴트가 준수해야 할 핵심 지침입니다.

## 1. 스타일링 가이드: Panda CSS

본 프로젝트는 [Panda CSS](https://panda-css.com/)를 사용하여 스타일을 관리합니다.

### 핵심 원칙
- **Utility-First**: 인라인 스타일 대신 Panda CSS의 스타일 유틸리티를 사용합니다.
- **Tokens 사용**: `panda.config.ts` 에 정의된 브랜드 토큰을 우선적으로 사용하십시오.
  - colors: `brand.primary`, `brand.primaryDark`, `brand.secondary`, `brand.accent` 등.
  - shadows: `airbnb`, `floating`, `dimensional` 등.
- **반응형 디자인**: `base`, `sm`, `md`, `lg`, `xl` 등 표준 중단점을 활용하십시오.

### 코드 예시
```tsx
import { css } from '../../styled-system/css';

export const Button = () => (
  <button className={css({
    bg: 'brand.primary',
    color: 'white',
    px: '4',
    py: '2',
    borderRadius: 'md',
    boxShadow: 'floating',
    cursor: 'pointer',
    _hover: { bg: 'brand.primaryDark' },
    _active: { transform: 'scale(0.98)' }
  })}>
    여행 시작하기
  </button>
);
```

## 2. React & Next.js 가이드

### App Router 활용
- **서버 컴포넌트(Server Components)**: 기본적으로 모든 컴포넌트는 서버 컴포넌트로 작성합니다. 데이터 패칭과 SEO가 필요한 페이지의 경우 필수입니다.
- **클라이언트 컴포넌트(Client Components)**: 인터랙션(Button Click, Form Input, Hooks usage)이 필요한 경우에만 상단에 `'use client'` 지침을 추가하여 최소한으로 사용합니다.

### 컴포넌트 구조
- `src/components`: 재사용 가능한 UI 컴포넌트를 위치합니다.
- `src/app`: 라우팅 구조를 따르며, 각 페이지의 `page.tsx`와 레이아웃을 관리합니다.

## 3. TypeScript 규칙

- **엄격한 타입 선언**: `any` 사용을 엄격히 금지합니다.
- **Interface vs Type**: 객체의 구조를 정의할 때는 확장이 용이한 `interface`를 우선적으로 사용합니다. 유니온 타입이나 교차 타입이 필요한 경우에만 `type`을 사용합니다.
- **Zustand Store 타입**: 스토어의 상태와 액션을 명확히 분리하여 정의합니다.

## 4. 파일 네이밍 및 경로

- **컴포넌트**: `PascalCase.tsx` (예: `PrimaryButton.tsx`)
- **훅**: `useCamelCase.ts` (예: `useChecklist.ts`)
- **유틸리티/서비스**: `camelCase.ts` (예: `supabaseClient.ts`)
- **경로**: 절대 경로 별칭(alias)을 적극 활용합니다 (예: `@/components/...`).
