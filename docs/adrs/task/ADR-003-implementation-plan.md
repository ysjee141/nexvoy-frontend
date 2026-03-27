# ADR-003 구현 작업 계획서 (Play Store Compliance Plan)

온여정(OnVoy) 앱의 구글 플레이 스토어 출시를 위해 ADR-003에 정의된 규정 준수 사항들을 구현합니다.

## 1단계: 개인정보 처리방침 가시성 (UI/UX)
- **대상 파일**: `src/app/profile/page.tsx`, `src/app/signup/TermsModal.tsx`
- **구현 내용**:
    - `ProfilePage` 하단 '회원 탈퇴' 위에 '이용약관 및 개인정보 처리방침' 메뉴 추가.
    - 클릭 시 기존 가입 로직에서 사용하던 `TermsModal`을 재사용하여 노출.
- **성공 기준**: 로그인한 사용자가 프로필 화면에서 언제든지 약관을 다시 볼 수 있음.

## 2단계: Android 플랫폼 권한 강화 (Native)
- **대상 파일**: `android/app/src/main/AndroidManifest.xml`
- **구현 내용**:
    - `POST_NOTIFICATIONS` 권한 선언 (Android 13+ 알림 허용).
    - `SCHEDULE_EXACT_ALARM` 권한 선언 (일정 알람 정확도 향상).
- **성공 기준**: 최신 안드로이드 기기에서 알림 권한 요청 팝업이 정상적으로 동작함.

## 3단계: 네트워크 및 보안 최적화 (Config)
- **대상 파일**: `capacitor.config.ts`, `android/app/src/main/res/xml/network_security_config.xml` (필요시)
- **구현 내용**:
    - `server.cleartext` 설정을 `false`로 변경 (운영 환경 대비).
    - `androidScheme`을 `https`로 변경 고려.
- **성공 기준**: 암호화되지 않은 HTTP 통신을 차단하여 보안성 강화.

## 4단계: 내부 검증 및 리포트 업데이트
- **검증 내용**:
    - 안드로이드 에뮬레이터에서 알림 권한 획득 확인.
    - 프로필 화면 레이아웃 및 모달 작동 확인.
- **보고서 업데이트**: `docs/play-store-readiness-report.md`의 보완 필요 사항을 '해결됨'으로 업데이트.

---
*작성일: 2026-03-25*
