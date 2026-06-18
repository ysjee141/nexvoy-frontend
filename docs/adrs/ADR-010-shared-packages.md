# ADR-010: `@nexvoy/types` · `@nexvoy/core` 공유 패키지 전략

- 상태: 제안됨
- 결정일: 2026-06-19
- 결정자: ysjee141
- 관련 ADR: ADR-007 (Option C), ADR-008 (pnpm Monorepo)

---

## 컨텍스트

Option C(웹/앱 분리) 구조에서 두 앱이 공통으로 필요로 하는 코드가 있다.

1. **도메인 타입** — `Trip`, `Plan`, `ChecklistItem`, `Template`, `Collaborator` 등. 현재 `src/types/` 디렉토리가 비어 있고, 타입이 컴포넌트 5곳 이상에 중복 정의되어 있다.
2. **Supabase 쿼리 로직** — `trips`, `plans`, `checklist_items` 조회/변경 로직이 각 Service와 컴포넌트에 분산되어 있다.
3. **순수 비즈니스 로직** — 날짜 포맷, 통화 변환, 협업 초대 토큰 검증 등 플랫폼 독립적인 유틸.

이 코드를 어떻게 공유할지 결정해야 한다.

---

## 결정

**두 개의 workspace 패키지**로 공유 코드를 분리한다.

| 패키지 | 역할 | 포함 내용 |
|--------|------|---------|
| `@nexvoy/types` | 도메인 타입 SSOT | Supabase gen 타입 + 도메인 인터페이스 |
| `@nexvoy/core` | 플랫폼 독립 비즈니스 로직 | 쿼리 헬퍼, 유틸, 도메인 로직 |

---

## 공유 경계 원칙

### 공유함

- TypeScript 타입 및 인터페이스
- Supabase 쿼리 헬퍼 (클라이언트 주입 방식)
- 순수 비즈니스 로직 (날짜, 통화, 협업, 정렬/검증)
- Storage 경로 규칙 함수
- 디자인 토큰 상수 (색상, 간격 — 값만, UI 컴포넌트 제외)

### 공유 안 함

- UI 컴포넌트 (웹: Panda CSS, 앱: RN StyleSheet — 렌더링 방식 다름)
- 라우팅 로직 (웹: Next.js App Router, 앱: expo-router)
- 플랫폼 Service (Notification, NativeUI, Lifecycle 등)
- Supabase client 인스턴스 생성 (웹: 쿠키 기반, 앱: AsyncStorage 기반)

### 금지 (ESLint 강제)

`@nexvoy/core`에서 아래 import 금지:

```json
// .eslintrc.base.json (packages/core/.eslintrc.json 에서 extends)
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [
        { "group": ["next", "next/*"], "message": "core에서 Next.js import 금지" },
        { "group": ["react-native", "react-native/*"], "message": "core에서 RN import 금지" },
        { "group": ["@capacitor/*"], "message": "core에서 Capacitor import 금지" },
        { "group": ["expo", "expo/*"], "message": "core에서 Expo import 금지" }
      ]
    }]
  }
}
```

---

## 핵심 패턴 — Supabase 클라이언트 주입

`@nexvoy/core`는 Supabase client를 직접 생성하지 않는다. 호출자가 주입한다.

```ts
// packages/core/src/supabase/queries.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@nexvoy/types';

export async function getTripsByUser(
  sb: SupabaseClient<Database>,
  userId: string
): Promise<Trip[]> { ... }
```

**웹 (Server Component)**
```ts
// apps/web/src/app/page.tsx
import { createClient } from '@/lib/supabase/server';   // 쿠키 기반
import { getTripsByUser } from '@nexvoy/core/supabase/queries';

const sb = await createClient();
const trips = await getTripsByUser(sb, user.id);
```

**앱 (React Native)**
```ts
// apps/mobile/src/screens/HomeScreen.tsx
import { supabase } from '@/lib/supabase/client';        // AsyncStorage 기반
import { getTripsByUser } from '@nexvoy/core/supabase/queries';

const trips = await getTripsByUser(supabase, user.id);
```

→ **쿼리 로직 1벌로 웹·앱 공유.**

---

## `@nexvoy/types` 구조

```
packages/types/src/
├── database.ts      # supabase gen types typescript — 직접 수정 금지
├── trip.ts          # Trip, TripMember (database.ts Row 기반 파생)
├── plan.ts          # Plan, PlanLocation
├── checklist.ts     # ChecklistItem, ChecklistCategory
├── template.ts      # Template, TemplateItem
├── user.ts          # Profile, Premium
├── collaboration.ts # Collaborator, Invitation, Share
└── index.ts         # export *
```

### 기존 중복 타입 제거 대상

| 타입 | 현재 위치 (제거 대상) |
|------|---------------------|
| `Trip` | `profile/travel-log/page.tsx:13`, `TripSwitcherModal.tsx:15`, `TripSection.tsx:10` |
| `Plan` | `PlanList.tsx:8`, `RouteMapView.tsx:27` |
| `Collaborator` | `CollaboratorModal.tsx:22` |
| `TemplateItemInput` | `TemplateForm.tsx:7` |
| `TripBundle` | `DownloadService.ts:13` |

---

## `@nexvoy/core` 구조

```
packages/core/src/
├── supabase/
│   ├── queries.ts       # 쿼리 헬퍼 (client 주입)
│   └── storagePaths.ts  # Storage 경로 규칙 (domain.md 기반)
├── domain/
│   ├── tripLogic.ts     # 정렬, 검증, 날짜 범위 계산
│   ├── checklistLogic.ts
│   ├── collaboration.ts # 초대 토큰 검증 (현 src/utils/collaboration.ts 이관)
│   └── currency.ts      # 통화 포맷 (현 src/utils/currency.ts 이관)
└── utils/
    ├── date.ts          # 날짜 포맷 (현 src/utils/date.ts 이관)
    └── placePhoto.ts    # Google Places URL 빌드
```

---

## 기대 효과

1. **타입 중복 제거**: 5종 도메인 타입이 단일 출처에서 관리됨
2. **쿼리 로직 1벌 공유**: 웹과 앱이 동일한 Supabase 쿼리를 사용하여 데이터 불일치 방지
3. **테스트 가능성**: `@nexvoy/core`는 플랫폼 의존 없이 Node.js 환경에서 단위 테스트 가능
4. **schema 변경 전파**: `supabase gen types` 재실행 → `database.ts` 업데이트 → 웹·앱 타입 오류 즉시 노출

---

## 위험 요소 및 완화

| 위험 | 완화 |
|------|------|
| core 패키지에 플랫폼 코드 유입 | ESLint `no-restricted-imports` 가드 (CI에서 강제) |
| 타입 변경 시 웹·앱 동시 수정 부담 | workspace link로 즉시 타입 오류 노출 → 누락 방지 |
| `database.ts` 직접 수정 실수 | 파일 상단 주석 + CI에서 gen 재실행 검증 스크립트 추가 |

---

## 후속 과제

- `@nexvoy/core` 단위 테스트 작성 (vitest 또는 jest — 플랫폼 독립이므로 가능)
- `database.ts` gen 자동화 스크립트 루트 `package.json`에 추가: `"types:gen": "supabase gen types typescript --project-id $PROJECT_ID > packages/types/src/database.ts"`
