# Google Play Store 등록 준비 점검 보고서 (Readiness Report)

본 보고서는 온여정(OnVoy) 앱을 구글 플레이 스토어에 출시하기 위해 앱의 현재 상태를 점검하고, 승인 거절(Reject)을 방지하기 위해 보완이 필요한 사항을 정리한 문서입니다.

## 1. 종합 요약 (Executive Summary)

현재 앱은 핵심 기능 구현이 잘 되어 있으나, **법적 요구 사항(개인정보 처리방침 노출)** 및 **기술적 권한 설정(Android 13+ 대응)** 단계에서 보완이 필수적입니다. 특히 구글의 최신 정책인 '앱 내 계정 삭제' 기능은 이미 구현되어 있어 큰 강점을 가지고 있습니다.

| 항목 | 상태 | 중요도 | 비고 |
| :--- | :--- | :--- | :--- |
| 계정 삭제 기능 | ✅ 준수 | 높음 | `/profile/withdrawal` 구현 완료 |
| 개인정보 처리방침 | ✅ 준수 | 최고 | 프로필 메뉴 연동 완료 |
| Android 권한 설정 | ✅ 준수 | 높음 | Manifest 권한 추가 완료 |
| 데이터 보안 (HTTPS) | ✅ 준수 | 보통 | cleartext 비허용 및 HTTPS 설정 완료 |
| 스토어 자산 (Icons) | 🔍 확인 필요 | 낮음 | 기본 아이콘 외 브랜드 자산 준비 필요 |

---

## 2. 세부 점검 결과

### A. 법적 및 정책 준수 (Legal & Policy)
1. **개인정보 처리방침 (Privacy Policy)**:
    - **현황**: `signup/TermsModal.tsx`에 내용은 존재하지만, 가입 시에만 노출됨.
    - **요구사항**: 구글은 앱 내에서 언제든지 접근 가능한 위치(예: 설정 또는 프로필 화면)에 개인정보 처리방침 링크를 제공할 것을 요구합니다.
    - **조치**: 프로필 페이지 하단에 '개인정보 처리방침' 링크를 추가하고 외부 브라우저나 모달로 열리게 해야 합니다.

2. **계정 삭제 (Account Deletion)**:
    - **현황**: 회원 탈퇴 기능이 잘 구현되어 있으며, 데이터 파기 로직(RPC)도 포함됨.
    - **요구사항**: 최근 구글 정책에 따라 앱 내에서 계정 및 관련 데이터를 삭제할 수 있는 경로가 명확해야 합니다.
    - **조치**: 현재 상태로 충분히 통과 가능합니다.

### B. 기술적 준수 사항 (Technical Requirements)
1. **Android 권한 (Permissions)**:
    - **현황**: `AndroidManifest.xml`에 `INTERNET` 권한만 선언됨.
    - **보완 필요**:
        - `POST_NOTIFICATIONS`: Android 13(API 33) 이상에서 푸시/로컬 알림을 보내기 위해 필수입니다.
        - `SCHEDULE_EXACT_ALARM`: 정확한 시간에 일정 알람을 울리게 하려면 필요할 수 있습니다.
2. **네트워크 보안**:
    - **현황**: `capacitor.config.ts`에 `cleartext: true` 설정이 되어 있음.
    - **보완 필요**: 출시 버전에서는 보안을 위해 HTTPS 통신만 허용하도록 `false`로 변경하거나 특정 도메인만 허용해야 합니다.

### C. 데이터 세이프티 (Data Safety)
- **현황**: Firebase Analytics를 통해 이벤트를 수집하고 있습니다.
- **요구사항**: 플레이 콘솔의 '데이터 보안' 섹션에서 어떤 데이터(앱 활동, 사용자 ID 등)를 수집하는지 정확히 선언해야 합니다.
- **조치**: `AnalyticsService`에서 수집하는 항목들을 기반으로 플레이 콘솔 설정을 진행해야 합니다.

---

## 3. 권장 조치 사항 (Action Items)

### 1순위: 개인정보 처리방침 노출 최적화
- `ProfilePage` 하단에 약관 및 개인정보 처리방침을 다시 볼 수 있는 링크를 추가하세요.

### 2순위: Android 권한 업데이트
`AndroidManifest.xml`에 다음 내용을 추가하는 것을 권장합니다:
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<!-- 정확한 알람 기능 사용 시 -->
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
```

### 3순위: 외부 접근용 정책 URL 확보
- 구글 플레이 스토어 등록 시 외부 웹사이트 URL(Privacy Policy URL)이 필수입니다. 현재 노출되는 내용을 정적 웹페이지(예: GitHub Pages, Notion 등)로 제작하여 URL을 확보해야 합니다.

---
*작성일: 2026-03-25*
*작성자: Antigravity*
