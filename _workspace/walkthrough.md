# Walkthrough: Android 하단 시스템 바 Safe Area 수정

## 작업 요약

Android 15+ (targetSdkVersion 36) edge-to-edge 강제 적용 환경에서 시스템 바에 의해 앱 UI가 가려지는 문제를 수정했습니다.

## 해결한 문제 3가지

### 1. CSS 변수 미주입 (근본 원인)
- **원인**: Capacitor 8.2.0이 `setDecorFitsSystemWindows(false)`를 호출하지 않아 WindowInsets가 앱에 전달되지 않음 + 내장 SystemBars 플러그인의 `onDOMReady()` 타이밍 문제
- **해결**: `MainActivity.java`에서 직접 `WindowCompat.setDecorFitsSystemWindows(false)` + `setOnApplyWindowInsetsListener`로 `--safe-area-inset-*` CSS 변수 주입
- **설정**: `capacitor.config.ts`에 `SystemBars: { insetsHandling: 'disable' }`로 내장 플러그인 비활성화

### 2. 모달 하단 UI가 시스템 네비게이션 바에 가려짐
- **원인**: NewPlanModal, PlanDetailModal, NewTripModal, EditTripModal의 컨테이너에 `pb`(하단 safe area) 누락
- **해결**: 4개 모달 컨테이너에 `pb: max(env(), var())` 추가

### 3. 모달 스크롤 시 Status Bar 뒤로 콘텐츠 비침
- **원인**: `pt: safe-area-top`이 스크롤 컨테이너에 있어 스크롤 시 콘텐츠가 패딩 영역 침범
- **해결**: 컨테이너의 `pt`를 제거하고 sticky 헤더의 `pt`에 safe area를 포함시켜 불투명 배경으로 Status Bar 영역을 항상 덮도록 수정
- **대상**: NewPlanModal, NewTripModal, EditTripModal (PlanDetailModal은 비스크롤 구조라 해당 없음)

## 변경된 파일

| 구분 | 파일 | 변경 내용 |
|------|------|----------|
| Native | `MainActivity.java` | WindowInsets 리스너 + CSS 변수 주입 |
| Config | `capacitor.config.ts` | SystemBars insetsHandling: disable |
| CSS | `globals.css` | `--safe-area-inset-*` 초기값 + 주석 갱신 |
| Layout | `layout.tsx` | max(env(), var()) 폴백 |
| Nav | `Navbar.tsx`, `BottomNavbar.tsx` | max(env(), var()) 폴백 |
| Modal | `NewPlanModal.tsx` | pb 추가 + pt를 sticky 헤더로 이동 |
| Modal | `PlanDetailModal.tsx` | pb 추가 |
| Modal | `NewTripModal.tsx` | pb 추가 + pt를 sticky 헤더로 이동 |
| Modal | `EditTripModal.tsx` | pb 추가 + pt를 sticky 헤더로 이동 |
| Modal | 기타 모달 8개 | max(env(), var()) 폴백 |
| Page | 페이지 6개 | max(env(), var()) 폴백 |
| FAB | `BugReportFAB.tsx` | max(env(), var()) 폴백 |
| Service | `NativeUIService.ts` | JSDoc 갱신 |
| Docs | `conventions.md` | 모달 Safe Area 규칙 추가 |
| Docs | `checklist.md` | 모달 리뷰 체크리스트 추가 |
| Docs | `standard-dev-flow.md` | GH_TOKEN 규칙 |
| Harness | `onvoy-develop/SKILL.md` | GH_TOKEN 규칙 |

## 빌드 검증 결과

| 항목 | 결과 |
|------|------|
| `pnpm build` (웹) | PASS |
| `pnpm build:mobile` (모바일) | PASS |
| `npx cap sync` (Capacitor) | PASS |
| Android 실기기 테스트 | PASS (사용자 확인) |

## 피드백 루프에서 얻은 교훈

1. **스크롤 모달의 safe area는 sticky 헤더에**: 컨테이너에 두면 Status Bar 블리드 발생
2. **모달은 pt+pb 세트**: `pt`만 적용하고 `pb` 누락하는 실수 방지
3. **Capacitor 내장 플러그인 과신 금지**: SystemBars 자동 주입이 불안정 → 직접 구현이 안정적
4. **`setDecorFitsSystemWindows(false)` 필수**: Android edge-to-edge에서 인셋 전달의 전제 조건
