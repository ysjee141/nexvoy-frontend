# 구현 변경 로그

## 변경된 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/app/globals.css` | 수정 | `:root`에 `--safe-area-inset-*` CSS 변수 초기값(0px) 4개 선언 추가 |
| `src/app/layout.tsx` | 수정 | line 59-60: `env()` -> `max(env(), var())` 패턴 적용 (top, bottom) |
| `src/components/layout/Navbar.tsx` | 수정 | line 112: paddingTop `env()` -> `max(env(), var())` |
| `src/components/layout/BottomNavbar.tsx` | 수정 | line 30: paddingBottom `env()` -> `max(env(), var())` |
| `src/components/trips/NewPlanModal.tsx` | 수정 | line 301: pt `env()` -> `max(env(), var())` |
| `src/components/trips/EditTripModal.tsx` | 수정 | line 156: pt `env()` -> `max(env(), var())` |
| `src/components/template/EditTemplateModal.tsx` | 수정 | lines 188-189: pt/pb `env()` -> `max(env(), var())` |
| `src/components/trips/PlanDetailModal.tsx` | 수정 | lines 119, 150: pt `env()` -> `max(env(), var())` (2개소) |
| `src/components/template/NewTemplateModal.tsx` | 수정 | lines 121-122: pt/pb `env()` -> `max(env(), var())` |
| `src/app/trips/checklist/ChecklistClient.tsx` | 수정 | lines 290, 344, 1426: pb/bottom `env()` -> `max(env(), var())` (3개소) |
| `src/components/trips/TripSwitcherModal.tsx` | 수정 | line 421: pb `env()` -> `max(env(), var())` |
| `src/components/trips/NewTripModal.tsx` | 수정 | line 141: pt `env()` -> `max(env(), var())` |
| `src/components/layout/BugReportFAB.tsx` | 수정 | line 24: bottom `env()` -> `max(env(), var())` |
| `src/app/signup/TermsModal.tsx` | 수정 | lines 60, 92: pt/pb `env()` -> `max(env(), var())` |
| `src/app/profile/withdrawal/page.tsx` | 수정 | lines 92, 102: pt/pb `env()` -> `max(env(), var())` |
| `src/app/profile/places-visited/page.tsx` | 수정 | lines 160-161: marginTop/paddingTop `env()` -> `max(env(), var())` |
| `src/app/trips/detail/TripLayoutClient.tsx` | 수정 | line 133: top `env()` -> `max(env(), var())` |
| `src/app/profile/travel-log/page.tsx` | 수정 | lines 110-111, 114-115: marginTop/paddingTop `env()` -> `max(env(), var())` (4개소) |
| `src/app/trips/detail/TripClient.tsx` | 수정 | line 478: bottom `env()` -> `max(env(), var())` |
| `src/services/NativeUIService.ts` | 수정 | Android 15+ edge-to-edge 제한사항 JSDoc 주석 추가 |

## 주요 구현 내용

### 1. CSS 변수 초기값 선언 (`globals.css`)
- `:root`에 `--safe-area-inset-top/bottom/left/right` 변수를 `0px` 초기값으로 선언
- Capacitor 8.x SystemBars 플러그인이 런타임에 이 변수를 실제 inset 값으로 덮어씀

### 2. Safe Area 폴백 패턴 일괄 적용 (18개 파일, 총 29개소)
- 변환 패턴: `env(safe-area-inset-*)` -> `max(env(safe-area-inset-*), var(--safe-area-inset-*))`
- `calc()` 내부의 `env()` 함수도 동일하게 `max()` 래핑 처리
- `env(safe-area-inset-bottom, 0px)` 형태의 폴백 인자가 있는 경우도 올바르게 처리

### 3. NativeUIService 문서화
- Android 15+ (targetSdkVersion 36) edge-to-edge 강제 적용에 대한 JSDoc 주석 추가
- `setBackgroundColor()`/`setNavigationBarColor()`가 반투명 오버레이로만 작동하는 점 명시
- CSS 폴백 패턴 설명 추가

## 플랫폼 분기 처리
- iOS: `env(safe-area-inset-*)` 값이 정상 반환되므로 `max()` 결과도 동일
- Android (SDK < 36): `env()` = 0, `var()` = 0 -> 기존과 동일 (edge-to-edge 미적용)
- Android (SDK >= 36): `env()` = 0, `var()` = Capacitor 주입값 -> 올바른 inset 적용
- 웹 브라우저: `env()` = 0, `var()` = 0 -> 기존과 동일

## 알려진 제한사항
- `--safe-area-inset-left/right` 변수는 선언했으나 현재 앱 CSS에서 사용하는 곳이 없음 (향후 확장 대비)
- `max()` CSS 함수는 iOS Safari 11.1+, Chrome 79+, Android WebView 79+에서 지원되므로 호환성 문제 없음
