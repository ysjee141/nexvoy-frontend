# ADR-003 구현 작업 계획서 (Play Store Compliance Plan)

온여정(OnVoy) 앱의 구글 플레이 스토어 출시를 위해 ADR-003에 정의된 규정 준수 사항들을 구현합니다.

## 1단계: 개인정보 처리방침 가시성 (UI/UX) [x]
- **대상 파일**: `src/app/profile/page.tsx`, `src/app/signup/TermsModal.tsx`
- **결정**: 프로필 메뉴 연동 완료.
- **성공 기준**: 달성

## 2단계: Android 플랫폼 권한 강화 (Native) [x]
- **대상 파일**: `android/app/src/main/AndroidManifest.xml`
- **구현 내용**: `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM` 권한 추가 완료.
- **성공 기준**: 달성

## 3단계: 네트워크 및 보안 최적화 (Config) [x]
- **대상 파일**: `capacitor.config.ts`
- **결정**: `cleartext: false` 설정 완료.
- **성공 기준**: 달성

## 4단계: 내부 검증 및 리포트 업데이트 [x]
- **검증 내용**: 안드로이드 에물레이터에서 정상 동작 확인.
- **보고서 업데이트**: `docs/play-store-readiness-report.md`에 최종 반영 완료.

---
*업데이트일: 2026-03-27*
