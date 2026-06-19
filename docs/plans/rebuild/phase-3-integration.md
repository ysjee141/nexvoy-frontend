# Phase 3 — 통합 및 안정화

> 기간: 2~3주 (W15 ~ W17)
> 목표: 웹·앱을 하나의 서비스로 연결하고 (Universal Link, 공유 링크), 모니터링·CI·스토어 등록을 완성하여 정식 출시 준비를 마친다.
> 전제: Phase 2 게이트 통과 (EAS build 실기기 완주)

---

## 1. 산출물 (완료 조건)

- [ ] Universal Link 동작: 앱 미설치 → 웹, 설치 → 앱 핸드오프
- [ ] Sentry 웹 + 앱 양쪽 오류 수집 확인
- [ ] GitHub Actions CI: web build + EAS build 각 트리거
- [ ] TestFlight (iOS) / Play 내부 테스트 트랙 (Android) 업로드

---

## 2. Universal Link / App Links (W15)

### 2.1 대상 경로

| 경로 | 설명 | 처리 |
|------|------|------|
| `/share/detail?token=...` | 여행 공유 링크 | 앱: share/detail 화면, 웹: SSR 공개 뷰 |
| `/join?token=...` | 협업 초대 링크 | 앱: join 화면, 웹: join 페이지 |

### 2.2 웹 — AASA / assetlinks.json 서빙

```ts
// apps/web/src/app/.well-known/apple-app-site-association/route.ts
export function GET() {
  return Response.json({
    applinks: {
      apps: [],
      details: [{
        appID: '<TEAM_ID>.xyz.nexvoy.app',
        paths: ['/share/*', '/join*'],
      }],
    },
  });
}
```

```ts
// apps/web/src/app/.well-known/assetlinks.json/route.ts
export function GET() {
  return Response.json([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: 'xyz.nexvoy.app',
              sha256_cert_fingerprints: ['<SHA256>'] },
  }]);
}
```

### 2.3 앱 — Deep Link 수신

**`apps/mobile/app.json`** (Phase 2에서 이미 설정)
```json
{
  "expo": {
    "ios": { "associatedDomains": ["applinks:nexvoy.com"] },
    "android": { "intentFilters": [{ "action": "VIEW", "autoVerify": true,
      "data": [{ "scheme": "https", "host": "nexvoy.com", "pathPrefix": "/share" },
               { "scheme": "https", "host": "nexvoy.com", "pathPrefix": "/join" }] }] }
  }
}
```

**expo-router에서 링크 수신**
```ts
// apps/mobile/src/app/share/detail.tsx
import { useLocalSearchParams } from 'expo-router';
export default function ShareDetailScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  // supabase로 공유 trip 조회
}
```

---

## 3. Sentry 연결 (W15)

### 3.1 웹 — Sentry Tunnel 복원

`apps/web/next.config.ts`에서 `tunnelRoute: '/monitoring'` 설정 (Phase 1에서 이미 적용).

```bash
cd apps/web
pnpm add @sentry/nextjs
# SENTRY_DSN, SENTRY_AUTH_TOKEN 환경변수 확인
```

### 3.2 앱 — `@sentry/react-native`

```bash
cd apps/mobile
pnpm add @sentry/react-native
npx @sentry/wizard@latest -i reactNative --no-telemetry
```

```ts
// apps/mobile/src/app/_layout.tsx
import * as Sentry from '@sentry/react-native';
Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN });
```

---

## 4. E2E 테스트 (W15 ~ W16)

### 4.1 웹 — Playwright 이관

기존 `travel-pack`의 Playwright 자산 재사용.

```
apps/web/e2e/
├── auth.spec.ts
├── trips.spec.ts
├── checklist.spec.ts
└── templates.spec.ts
```

```bash
cd apps/web
pnpm add -D @playwright/test
# 기존 테스트 경로 수정 (API 엔드포인트, 셀렉터 검증)
pnpm exec playwright test
```

### 4.2 앱 — Detox (핵심 플로우만)

```bash
cd apps/mobile
pnpm add -D detox
```

**대상 시나리오 (핵심만)**
1. 로그인 → 여행 목록 진입
2. 여행 생성 → 플랜 추가
3. 체크리스트 스와이프 삭제

---

## 5. CI — GitHub Actions (W16)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop]

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm --filter nexvoy-web build
      - run: pnpm --filter nexvoy-web exec playwright test
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

  packages:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm -r --filter "./packages/*" build

  app-eas:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: pnpm install
      - run: eas build --non-interactive --profile preview
        working-directory: apps/mobile
```

---

## 6. 스토어 등록 (W16 ~ W17)

### iOS
- [ ] Apple Developer 계정 ($99/년) 활성 확인
- [ ] App Store Connect — 앱 정보 입력 (스크린샷, 설명, 카테고리)
- [ ] TestFlight 내부 테스터 등록
- [ ] `eas submit --platform ios`

### Android
- [ ] Google Play Console — 내부 테스트 트랙 생성
- [ ] `eas submit --platform android`

---

## 7. 환경변수 최종 정리

### `apps/web/.env.production`
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_APP_URL=https://nexvoy.com
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

### `apps/mobile/.env`
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
EXPO_PUBLIC_SENTRY_DSN=
```

> `NEXT_PUBLIC_*`와 `EXPO_PUBLIC_*` prefix를 절대 혼용하지 않는다.

---

## 8. 최종 검증 체크리스트

### Universal Link
- [ ] `https://nexvoy.com/share/detail?token=xxx` — 앱 미설치 시 웹으로 열림
- [ ] 앱 설치 후 동일 링크 — 앱 share/detail 화면으로 열림
- [ ] `https://nexvoy.com/join?token=xxx` — 동일 핸드오프 동작

### 데이터 정합성
- [ ] 웹에서 여행 생성 → 앱에서 즉시 조회
- [ ] 앱에서 플랜 추가 → 웹에서 Realtime으로 반영
- [ ] 협업: 웹 사용자 ↔ 앱 사용자 동시 편집

### 모니터링
- [ ] Sentry 웹: 오류 발생 시 이슈 생성 확인
- [ ] Sentry 앱: Crash 발생 시 이슈 생성 확인

### 스토어
- [ ] TestFlight 빌드 정상 설치 및 실행
- [ ] Play 내부 테스트 트랙 설치 및 실행
