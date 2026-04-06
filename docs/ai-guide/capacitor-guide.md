# 📱 Capacitor 및 모바일 개발 가이드

OnVoy의 하이브리드 앱 환경인 Capacitor를 다루기 위한 AI 지침입니다.

## 1. ⚙️ 플랫폼 정보 및 설정

- **App ID**: `xyz.nexvoy.app`
- **프로젝트 명칭**: `OnVoy`
- **빌드 방식**: Next.js의 정적 내보내기(`next export` → `out` 폴더)를 Capacitor가 로드합니다.

## 2. 🧩 주요 Capacitor 플러그인

- **CapacitorHttp**: 기본 `fetch` 대신 네이티브 HTTP 라이브러리를 사용하여 CORS 문제를 우회하고 성능을 높입니다.
- **CapacitorUpdater**: OTA(Over-The-Air) 업데이트 기능을 위해 `@capgo/capacitor-updater`를 사용합니다.
- **SplashScreen**: 앱 기동 시 스플래시 화면 제어.
- **Push Notifications**: `@capacitor/push-notifications`를 통한 푸시 알림 연동.

## 3. 🛠 모바일 전용 빌드 프로세스

모바일 앱 배포를 위해 반드시 다음 워크플로우를 숙지하십시오.

### pnpm build:mobile
이 명령어는 다음과 같은 작업을 수행합니다:
1.  API, Auth 등 모바일 환경에서 불필요한 서버 측 기능을 임시로 격리합니다.
2.  `BUILD_TARGET=mobile` 환경 변수와 함께 `next build`를 실행하여 정적 자산을 생성합니다.
3.  생성된 `out` 폴더를 Capacitor 네이티브 폴더로 동기화할 준비를 합니다.

```bash
# 모바일 빌드 실행
pnpm build:mobile

# 결과물 동기화
npx cap sync
```

## 4. 💻 플랫폼별 분기 로직

코드 내에서 웹과 네이티브를 구분해야 하는 경우 다음 패턴을 사용합니다.

```tsx
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // 모바일 네이티브 환경 전용 로직
  // (예: StatusBar 설정, Native Share 호출 등)
} else {
  // 일반적인 웹 브라우저 환경
}
```

## 5. 🤖 AI 주의 사항

1.  **CORS 주의**: 모바일 앱 환경에서는 브라우저와 다른 CORS 정책이 적용됩니다. `src/services`에서 외부 통신 시 `CapacitorHttp`가 적절히 구성되어 있는지 확인하십시오.
2.  **Asset 경로**: 모든 이미지나 정적 자산의 경로는 정적 빌드 후에도 깨지지 않도록 절대 경로 혹은 적절한 자산 관리 방식을 사용해야 합니다.
3.  **네이티브 UI**: 모바일 환경에서는 `Safe Area`를 고려한 레이아웃이 필요합니다. 상단 노치나 하단 네비게이션 영역이 UI를 가리지 않도록 Panda CSS 유틸리티를 활용하십시오.
