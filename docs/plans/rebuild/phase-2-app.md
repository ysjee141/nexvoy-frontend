# Phase 2 — nexvoy-app (React Native / Expo)

> 기간: 7~8주 (W7 ~ W14)
> 목표: Capacitor WebView 기반 앱을 네이티브 React Native/Expo로 재작성하여 스크롤·애니메이션·메모리 성능을 개선하고 플랫폼 API를 제약 없이 활용한다.
> 전제: Phase 1 게이트 통과 (웹 배포 + Playwright 그린)
> 관련 ADR: [ADR-007](../../adrs/ADR-007-option-c-platform-split.md), [ADR-009](../../adrs/ADR-009-expo-react-native.md)

---

## 1. 산출물 (게이트 조건)

- [ ] EAS development build 실기기(iOS/Android) 설치 성공
- [ ] 인증 → 여행 생성 → 플랜 추가 플로우 실기기에서 완주
- [ ] Realtime 구독 (`supabase.channel()`) RN에서 동작 확인

---

## 2. 프로젝트 셋업 (W7 — 1주)

### 2.1 Expo 생성

```bash
pnpm create expo apps/mobile --template blank-typescript
cd apps/mobile

# 핵심 의존성
pnpm add @supabase/supabase-js \
  @react-native-async-storage/async-storage \
  expo-router \
  react-native-maps \
  expo-notifications \
  expo-updates \
  expo-file-system \
  expo-auth-session \
  expo-system-ui \
  expo-status-bar \
  react-native-gesture-handler \
  react-native-reanimated \
  @nexvoy/types@workspace:* \
  @nexvoy/core@workspace:*
```

**`apps/mobile/package.json`**
```json
{
  "name": "nexvoy-app",
  "main": "expo-router/entry",
  "dependencies": {
    "@nexvoy/core": "workspace:*",
    "@nexvoy/types": "workspace:*"
  }
}
```

### 2.2 Supabase RN 클라이언트

```ts
// apps/mobile/src/lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@nexvoy/types';

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,   // RN에서 URL 감지 비활성
    },
  }
);
```

### 2.3 expo-router 네비게이션 구조

```
apps/mobile/src/app/
├── _layout.tsx              # RootLayout (AuthProvider, SafeAreaProvider)
├── (auth)/
│   ├── login.tsx
│   ├── signup.tsx
│   └── join.tsx
├── (main)/
│   ├── _layout.tsx          # 탭 네비게이션 (여행/템플릿/프로필)
│   ├── index.tsx            # home
│   ├── trips/
│   │   ├── detail.tsx
│   │   ├── new.tsx
│   │   └── checklist.tsx
│   ├── templates/
│   │   ├── index.tsx
│   │   ├── detail.tsx
│   │   └── new.tsx
│   └── profile/
│       ├── index.tsx
│       ├── settings.tsx
│       ├── travel-log.tsx
│       ├── collaborators.tsx
│       └── premium.tsx
├── share/
│   └── detail.tsx           # Universal Link 수신 화면
└── offline.tsx
```

### 2.4 EAS 설정

**`apps/mobile/eas.json`**
```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

```bash
# 최초 EAS 빌드
eas build --profile development --platform ios
```

---

## 3. 화면 재작성 (W7 ~ W14)

### 3.1 묶음별 일정

| 주차 | 묶음 | 화면 | 핵심 RN 작업 |
|------|------|------|------------|
| W7 | 인증 | login, signup, join, auth callback | `expo-auth-session` OAuth, deep link 콜백 |
| W8~9 | 핵심 1 | home, trips/detail | FlatList 타임라인, Reanimated shared element |
| W10~11 | 핵심 2 | trips/new, plan 추가/상세 | `react-native-maps`, 날짜·장소 입력 |
| W11~12 | 체크리스트 | checklist | `gesture-handler` 스와이프 (좌측만) |
| W12~13 | 템플릿 | templates, detail, new | 폼, 공개/비공개 토글 |
| W13~14 | 부가 | profile×5, share/detail, offline | 프로필 편집, 공유 핸드오프 |

### 3.2 인증 (W7)

**OAuth + Deep Link**
```ts
// apps/mobile/src/app/(auth)/login.tsx
import * as AuthSession from 'expo-auth-session';
import { supabase } from '@/lib/supabase/client';

const redirectUri = AuthSession.makeRedirectUri({ scheme: 'nexvoy' });

async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    },
  });
  if (data.url) {
    const result = await AuthSession.startAsync({ authUrl: data.url });
    if (result.type === 'success') {
      const { access_token, refresh_token } = result.params;
      await supabase.auth.setSession({ access_token, refresh_token });
    }
  }
}
```

**`app.json` Deep Link 설정**
```json
{
  "expo": {
    "scheme": "nexvoy",
    "ios": { "associatedDomains": ["applinks:nexvoy.com"] },
    "android": { "intentFilters": [{ "action": "VIEW", "data": [{ "scheme": "https", "host": "nexvoy.com" }] }] }
  }
}
```

### 3.3 핵심 화면 패턴 (W8~9)

**trips/detail — `@nexvoy/core` 쿼리 재사용**
```ts
// apps/mobile/src/app/(main)/trips/detail.tsx
import { getTripWithPlans } from '@nexvoy/core/supabase/queries';
import { supabase } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function TripDetailScreen() {
  const [data, setData] = useState<{ trip: Trip; plans: Plan[] } | null>(null);
  const tripId = useLocalSearchParams<{ id: string }>().id;

  useEffect(() => {
    getTripWithPlans(supabase, tripId).then(setData);

    // Realtime 구독 (웹과 동일한 channel API)
    const channel = supabase
      .channel(`trip-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans',
          filter: `trip_id=eq.${tripId}` }, () => {
        getTripWithPlans(supabase, tripId).then(setData);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tripId]);

  // ...
}
```

### 3.4 체크리스트 스와이프 (W11~12)

```ts
// gesture-handler + Reanimated 조합
// 좌측 스와이프만 액션 노출 (domain.md 규칙)
import Swipeable from 'react-native-gesture-handler/Swipeable';
```

### 3.5 지도 — `react-native-maps` (W10~11)

```ts
// apps/mobile/src/components/maps/RouteMap.tsx
import MapView, { Marker, Polyline } from 'react-native-maps';
// @react-google-maps/api 대체
// Polyline은 RN에서 <Polyline> 컴포넌트로 직접 관리
// (Polyline 직접 관리 피드백 memory 참조)
```

---

## 4. 플랫폼 Service 재작성 (W14)

| 기존 Service | 대체 패키지 | 비고 |
|-------------|-----------|------|
| `NotificationService` | `expo-notifications` | FCM 토큰 등록, 로컬 알림 |
| `NativeUIService` | `expo-system-ui` + `expo-status-bar` | SafeAreaView 포함 |
| `LifecycleService` | `expo-updates` + `AppState` | OTA (Capgo → Expo Updates) |
| `DownloadService` | `expo-file-system` + `AsyncStorage` | 오프라인 번들 |
| `AnalyticsService` | `@react-native-firebase/analytics` | GA4 대신 Firebase |
| `AuthService` | `expo-auth-session` | 위 인증 섹션 참조 |
| `PlanPhotoStorageService` | `@nexvoy/core` 로직 + RN client 주입 | 쿼리 로직 공유 |
| `PlacePhotoService` | `@nexvoy/core` 로직 + RN fetch | URL 빌드 로직 공유 |
| `ApiService` (CapacitorHttp) | 표준 `fetch` | RN에서 fetch 네이티브 지원 |

---

## 5. 환경변수

```env
# apps/mobile/.env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
SENTRY_DSN=
```

> `NEXT_PUBLIC_*` ↔ `EXPO_PUBLIC_*` 혼용 금지 ([ADR-007](../../adrs/ADR-007-option-c-platform-split.md) §R9).

---

## 6. Realtime PoC (W7 초기)

Phase 2 착수 직후 최우선으로 Realtime 동작을 검증한다.

```bash
# 간단한 PoC 스크린 작성 → 실기기에서 channel() subscribe 확인
# 실패 시: Supabase RN WebSocket 이슈 대응 (R6 위험)
```

---

## 7. 검증 체크리스트

### 빌드
- [ ] `eas build --profile development` 성공 (iOS / Android)
- [ ] TypeScript strict 통과

### 기능
- [ ] Google OAuth → 실기기에서 앱으로 복귀
- [ ] 웹에서 생성한 여행이 앱에서 즉시 조회됨 (공유 DB 정합성)
- [ ] Realtime: 웹/앱 동시 접속 시 플랜 변경 반영
- [ ] 체크리스트 좌측 스와이프 삭제 동작
- [ ] 지도 Polyline 경로 표시
- [ ] Push 알림 수신 (실기기)
- [ ] OTA 업데이트 (`expo-updates`) 동작

### 플랫폼
- [ ] iOS Safe Area (노치/Dynamic Island) 정상 처리
- [ ] Android 하단 제스처 바 영역 처리
- [ ] 다크 모드 대응
