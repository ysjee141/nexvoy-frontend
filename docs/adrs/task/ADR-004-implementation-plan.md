ADR-004에 정의된 광고 도입 및 수익화 전략을 기반으로 단계별 구현 계획을 수립합니다. 본 계획은 프리미엄 사용자의 사용자 경험을 보호하면서 하이브리드 환경에 최적화된 광고 통합을 목표로 합니다.

## 0단계: 사전 준비 사항 (Pre-requisites)
실제 코드 구현 전, 다음 항목들이 준비되어야 합니다.

1.  **계정 생성 및 앱 등록**:
    - **Google AdMob**: 계정 가입 후 Android 및 iOS 앱을 각각 등록합니다.
    - **Google AdSense**: 웹 사이트(도메인) 등록 및 승인이 필요합니다.
2.  **광고 ID 확보**:
    - **App ID**: 각 플랫폼별 AdMob App ID (예: `ca-app-pub-XXX~YYY`)
    - **Unit ID**: 배너(Banner), 전면(Interstitial), 네이티브(Native) 광고 단위 ID를 각각 생성합니다.
3.  **환경 변수 설정**:
    - `.env` 파일에 각 ID를 변수로 정의합니다. (예: `NEXT_PUBLIC_ADMOB_ANDROID_ID`)
4.  **Supabase 권한**: 
    - `profiles` 테이블의 스키마를 변경할 수 있는 권한을 확인합니다.


## 1단계: 데이터베이스 및 상태 관리 구성 (Foundation)
- **대상 파일**: Supabase Dashboard (DB), `src/app/api/auth` 관련 로직, 전역 상태(Zustand)
- **구현 내용**:
    - `profiles` 테이블에 `premium_until` (timestamp, default: null) 필드 추가.
    - 사용자 로그인/세션 갱신 시 `premium_until` 값을 가져와 전역 상태(`useUserStore`)에 저장.
    - 광고 노출 여부 판단 시 `new Date(premium_until) > new Date()` 로직 적용.
- **성공 기준**: 유효 기간 정보를 바탕으로 프리미엄 권한을 동적으로 관리할 수 있음.

## 2단계: 플랫폼별 광고 SDK 설정 (Platform Setup)
- **기술 스택**: `@capacitor-community/admob` (App), Google AdSense Script (Web)
- **구현 내용**:
    - **App**: `npm install @capacitor-community/admob` 설치 및 `android/app/src/main/AndroidManifest.xml`에 AdMob App ID 추가.
    - **Web**: `src/app/layout.tsx`에 환경 변수를 기반으로 AdSense `adsbygoogle.js` 스크립트 조건부 삽입.
- **성공 기준**: 각 플랫폼 환경에서 광고 엔진이 정상적으로 초기화됨.

## 3단계: 공통 광고 컴포넌트 개발 (Core Components)
- **대상 파일**: `src/components/common/AdContainer.tsx`, `src/components/common/AdProvider.tsx`
- **구현 내용**:
    - **AdProvider**: 앱 실행 시 AdMob 초기화 및 동의 절차(ATT 등) 처리.
    - **AdContainer**: 
        - `is_premium`이 `true`인 경우 아무것도 렌더링하지 않음.
        - `Capacitor.isNativePlatform()` 여부에 따라 `AdMob` 배너 또는 `AdSense` 유닛을 선택하여 렌더링.
- **성공 기준**: 광고 노출 로직이 캡슐화되어 재사용 가능하며, 프리미엄 사용자에게는 노출되지 않음.

## 4단계: UI 배치 및 네이티브 광고 최적화 (Placement)
- **대상 파일**: `src/app/trips/page.tsx`, `src/app/trips/[id]/page.tsx`
- **구현 내용**:
    - 여정 리스트 중간(In-feed)에 디자인 가이드를 준수한 배너/네이티브 광고 배치.
    - 여정 상세 화면 하단에 스무스하게 녹아드는 광고 유닛 삽입.
- **성공 기준**: 광고가 앱의 전체적인 미적 요소를 해치지 않고 자연스럽게 노출됨.

## 5단계: 검증 및 최종 테스트 (Verification)
- **테스트 시나리오**:
    1. 일반 계정으로 로그인 시 웹/앱 모두에서 광고가 정상 노출되는가?
    2. 프리미엄 권한 부여 후 모든 광고가 즉시 사라지는가?
    3. 광고 클릭 시 외부 브라우저나 앱 스토어로 정상 이동하는가?
- **성공 기준**: 모든 시나리오 통과 및 성능 저하(Lighthouse 점수 등) 최소화 확인.

---
*작성일: 2026-03-27*
*작성자: Antigravity*
