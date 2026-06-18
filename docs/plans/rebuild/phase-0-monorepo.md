# Phase 0 — Monorepo + 공유 패키지

> 기간: 1.5주 (W1 ~ W1.5)
> 목표: 웹/앱이 공유하는 타입·비즈니스 로직 패키지를 확립하여 Phase 1·2의 토대를 만든다.
> 관련 ADR: [ADR-008](../../adrs/ADR-008-pnpm-monorepo.md), [ADR-010](../../adrs/ADR-010-shared-packages.md)

---

## 1. 산출물 (게이트 조건)

- [ ] `pnpm -r build` (packages만) 성공
- [ ] `@nexvoy/types`를 `import`하는 임시 파일이 웹/앱 양 환경에서 컴파일됨
- [ ] `@nexvoy/core`의 쿼리 헬퍼가 `SupabaseClient` 인자 주입으로 빌드됨

---

## 2. 디렉토리 구조

```
nexvoy/
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .eslintrc.base.json            # no-restricted-imports 공통 규칙 포함
├── packages/
│   ├── types/
│   │   ├── package.json           # name: @nexvoy/types
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── database.ts        # supabase gen types 결과물
│   │       ├── trip.ts
│   │       ├── plan.ts
│   │       ├── checklist.ts
│   │       ├── template.ts
│   │       ├── user.ts
│   │       ├── collaboration.ts
│   │       └── index.ts
│   └── core/
│       ├── package.json           # name: @nexvoy/core
│       ├── tsconfig.json
│       └── src/
│           ├── supabase/
│           │   ├── queries.ts     # 클라이언트 주입형 쿼리 헬퍼
│           │   └── storagePaths.ts
│           ├── domain/
│           │   ├── tripLogic.ts
│           │   ├── checklistLogic.ts
│           │   ├── collaboration.ts
│           │   └── currency.ts
│           └── utils/
│               ├── date.ts
│               └── placePhoto.ts
└── apps/                          # Phase 1·2에서 채움
```

---

## 3. 태스크 상세

### W1 — Monorepo 골격 + `@nexvoy/types`

#### 3.1 루트 설정

```bash
mkdir nexvoy && cd nexvoy
pnpm init
```

**`pnpm-workspace.yaml`**
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

**`tsconfig.base.json`**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "skipLibCheck": true,
    "paths": {
      "@nexvoy/types": ["./packages/types/src/index.ts"],
      "@nexvoy/core": ["./packages/core/src/index.ts"]
    }
  }
}
```

**루트 `.eslintrc.base.json`** — core 패키지 순수성 강제
```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "paths": [],
      "patterns": [
        { "group": ["next/*", "next"], "message": "@nexvoy/core에서 Next.js import 금지" },
        { "group": ["react-native", "react-native/*"], "message": "@nexvoy/core에서 RN import 금지" },
        { "group": ["@capacitor/*"], "message": "@nexvoy/core에서 Capacitor import 금지" },
        { "group": ["expo", "expo/*"], "message": "@nexvoy/core에서 Expo import 금지" }
      ]
    }]
  }
}
```

#### 3.2 `@nexvoy/types` 생성

```bash
mkdir -p packages/types/src
cat > packages/types/package.json << 'EOF'
{
  "name": "@nexvoy/types",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
EOF
```

**Supabase 타입 생성 (스키마 무변경)**
```bash
pnpm dlx supabase gen types typescript \
  --project-id <PROJECT_ID> \
  > packages/types/src/database.ts
```

**`packages/types/src/trip.ts`** — 현재 중복 정의 통합
```ts
import type { Database } from './database';

export type TripRow = Database['public']['Tables']['trips']['Row'];
export type TripInsert = Database['public']['Tables']['trips']['Insert'];

export interface Trip extends TripRow {
  member_count?: number;
  cover_image_url?: string | null;
}

export interface TripMember {
  user_id: string;
  trip_id: string;
  role: 'owner' | 'editor' | 'viewer';
  profile?: { display_name: string; avatar_url: string | null };
}
```

> 나머지 타입 파일(`plan.ts`, `checklist.ts`, `template.ts`, `user.ts`, `collaboration.ts`)도 동일 패턴으로 작성.
> 기존 중복 위치: `profile/travel-log/page.tsx:13`, `TripSwitcherModal.tsx:15`, `PlanList.tsx:8` 등

**`packages/types/src/index.ts`**
```ts
export * from './database';
export * from './trip';
export * from './plan';
export * from './checklist';
export * from './template';
export * from './user';
export * from './collaboration';
```

### W1.5 — `@nexvoy/core` + 클라이언트 주입 패턴

#### 3.3 `@nexvoy/core` 생성

```bash
mkdir -p packages/core/src/{supabase,domain,utils}
```

**핵심 패턴 — 클라이언트 주입형 쿼리 헬퍼**

```ts
// packages/core/src/supabase/queries.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@nexvoy/types';
import type { Trip } from '@nexvoy/types';

export async function getTripsByUser(
  sb: SupabaseClient<Database>,
  userId: string
): Promise<Trip[]> {
  const { data, error } = await sb
    .from('trips')
    .select('*, trip_members!inner(role)')
    .eq('trip_members.user_id', userId)
    .order('start_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getTripWithPlans(
  sb: SupabaseClient<Database>,
  tripId: string
) {
  const [tripResult, plansResult] = await Promise.all([
    sb.from('trips').select('*').eq('id', tripId).single(),
    sb.from('plans').select('*').eq('trip_id', tripId).order('date').order('time'),
  ]);
  if (tripResult.error) throw tripResult.error;
  if (plansResult.error) throw plansResult.error;
  return { trip: tripResult.data, plans: plansResult.data ?? [] };
}
```

**Storage 경로 규칙 함수화**

```ts
// packages/core/src/supabase/storagePaths.ts
// 규칙: domain.md §Storage 경로 — [user_id]/[trip_id]/[filename]
export function planPhotoPath(userId: string, tripId: string, planId: string, hash: string) {
  return `place-photos/${userId}/${tripId}/${planId}_${hash}.jpg`;
}
export function tripCoverPath(userId: string, tripId: string) {
  return `trip-covers/${userId}/${tripId}/cover.jpg`;
}
export function avatarPath(userId: string) {
  return `avatars/${userId}/avatar.jpg`;
}
```

**유틸 이관** — 현 `src/utils/`에서 순수 함수만 이관

```
src/utils/date.ts        → packages/core/src/utils/date.ts        (무변형)
src/utils/currency.ts    → packages/core/src/domain/currency.ts   (무변형)
src/utils/collaboration.ts → packages/core/src/domain/collaboration.ts (무변형)
```

PlanList·DownloadService에 흩어진 날짜/시간 정렬 로직 → `packages/core/src/domain/tripLogic.ts`로 추출

---

## 4. 검증

```bash
# packages만 빌드 확인
pnpm -r --filter "./packages/*" build

# 타입 import 테스트 (임시 파일)
echo "import type { Trip } from '@nexvoy/types'; const t: Trip = {} as Trip;" \
  | npx tsc --noEmit --stdin --rootDir . --paths @nexvoy/types=./packages/types/src/index.ts
```

---

## 5. 주의사항

- `@nexvoy/core`는 어떠한 플랫폼 패키지도 import해서는 안 된다 ([ADR-010](../../adrs/ADR-010-shared-packages.md) §공유 경계 원칙).
- `database.ts`는 Supabase CLI로 자동 생성하며 직접 수정하지 않는다. 스키마 변경 시 재생성.
- Phase 1·2에서 `@nexvoy/types`, `@nexvoy/core`를 workspace link로 참조 (`"@nexvoy/types": "workspace:*"`).
