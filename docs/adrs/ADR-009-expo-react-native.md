# ADR-009: Capacitor → React Native / Expo 전환

- 상태: 제안됨
- 결정일: 2026-06-19
- 결정자: ysjee141
- 관련 ADR: ADR-007 (Option C 플랫폼 분리)

---

## 컨텍스트

현재 `nexvoy-app`은 Capacitor 8.2.0 + Next.js 정적 내보내기(WebView 래핑) 방식으로 구현되어 있다. 이 구조의 한계는 다음과 같다.

1. **WebView 성능 한계**: 스크롤, 애니메이션, 메모리 사용이 네이티브 대비 열위. 특히 여행 타임라인(PlanList), 체크리스트 스와이프 등 인터랙션이 많은 화면에서 체감 성능 저하.

2. **플랫폼 API 결합도 분산**: `Capacitor.isNativePlatform()` 분기가 19개 파일에 흩어져 있으며, 각 Service마다 플랫폼별 분기 코드가 유지보수를 어렵게 한다.

3. **Sentry 모바일 오류 추적 불가**: 정적 내보내기에서 Sentry Tunnel Route를 사용할 수 없어 앱 오류가 추적되지 않는다.

4. **빌드 복잡도**: `prebuild`/`postbuild` 스크립트로 API Routes를 임시 이동하는 방식이 빌드 안정성을 해친다.

React Native 전환의 핵심 선택은 **Expo Managed Workflow** vs **Bare React Native** 두 가지다.

---

## 결정

**Expo Managed Workflow** (`expo-router` + EAS Build)를 채택한다.

---

## 근거

### Expo Managed vs Bare RN 비교

| 기준 | Expo Managed | Bare RN |
|------|-------------|---------|
| 초기 셋업 | 매우 빠름 (1일) | 느림 (iOS/Android 네이티브 설정 필요) |
| OTA 업데이트 | `expo-updates` 기본 제공 | Codepush 별도 설정 |
| EAS Build | 네이티브 코드 없이 클라우드 빌드 | 동일하나 커스텀 네이티브 설정 가능 |
| 네이티브 모듈 제약 | 일부 네이티브 모듈 지원 안 됨 | 제약 없음 |
| 1인 개발 | **권장** — 네이티브 빌드 환경 관리 불필요 | Xcode/Android Studio 관리 필요 |

OnVoy의 현재 기능 범위(지도, 알림, 인증, 파일시스템, OTA)는 모두 Expo SDK에서 지원된다. 네이티브 모듈 eject가 필요한 기능이 없으므로 Managed Workflow가 적합하다.

### Capgo → `expo-updates` 전환

현재 OTA 업데이트는 Capgo를 사용한다. Expo Managed로 전환하면 `expo-updates`가 기본 제공되므로 Capgo를 제거하고 EAS Update로 대체한다.

---

## 주요 패키지 매핑

| Capacitor 패키지 | Expo 대체 |
|----------------|---------|
| `@capacitor/push-notifications` | `expo-notifications` |
| `@capacitor/status-bar` | `expo-status-bar` |
| `@capacitor/splash-screen` | `expo-splash-screen` |
| `@capacitor/filesystem` | `expo-file-system` |
| `@capgo/capacitor-updater` | `expo-updates` |
| `@capacitor/app` | `expo-app` |
| Capacitor OAuth 플로우 | `expo-auth-session` |
| Google Maps (WebView) | `react-native-maps` (Google provider) |

---

## 네비게이션 — `expo-router`

`expo-router`는 Next.js App Router와 동일한 파일 기반 라우팅 멘탈모델을 사용한다. 웹 개발자(본인)에게 학습 곡선이 최소화되고, Universal Link URL 매핑이 직관적이다.

```
apps/mobile/src/app/
├── (auth)/login.tsx    → /login
├── (main)/index.tsx    → /
└── share/detail.tsx    → /share/detail  ← Universal Link와 일치
```

---

## 스타일링 — RN StyleSheet

Panda CSS는 React Native를 지원하지 않는다. 다음 옵션을 검토했다.

| 옵션 | 장점 | 단점 |
|------|------|------|
| RN StyleSheet | 공식, 예측 가능 | Panda 토큰 재사용 불가 |
| `nativewind` | Tailwind CSS 토큰 유사 구문 | Panda와 다른 토큰 체계 |
| `@shopify/restyle` | 디자인 토큰 공유 가능 | 추가 학습 |

**결정: RN StyleSheet 기본 사용.** 디자인 토큰(색상, 간격)은 `packages/core/src/theme/tokens.ts`로 추출하여 웹·앱이 동일 상수를 참조하는 방식으로 일관성을 유지한다. UI 컴포넌트 자체는 공유하지 않는다.

---

## 위험 요소 및 완화

| 위험 | 완화 |
|------|------|
| OAuth/딥링크 설정 복잡도 | Phase 2 W7 첫 주 최우선 처리. Supabase RN 공식 가이드 준수 |
| Realtime (`supabase.channel()`) RN 동작 미검증 | Phase 2 착수 직후 PoC로 검증 (R6) |
| react-native-maps Google provider 설정 | iOS: GoogleMaps pod, Android: API key manifest 설정 필요 |
| Expo SDK 버전 호환성 | EAS SDK 버전 고정, 업그레이드 시 CHANGELOG 확인 |

---

## 후속 과제

- 앱 번들 ID `xyz.nexvoy.app` Apple Developer 등록
- EAS Project ID 발급 및 `eas.json` 설정
- `expo-updates` 채널 전략 (development/preview/production) 정의
