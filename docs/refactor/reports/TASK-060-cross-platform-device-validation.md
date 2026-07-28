# TASK-060 Web·Mobile 통합 검증 보고서

작성일: 2026-07-28
환경: DEV `ivgkqzwosbjukonlpfdw`
상태: **Simulator PREPASS / 실기기 BLOCKED / Production NO-GO**

## 현재 판정

Android 시뮬레이터 두 대에서 동일 계정의 여행·일정·장소 사진 생성과 신규 설치 복구가 canonical
데이터로 수렴했다. iOS 시뮬레이터용 release archive도 빌드·설치·실행됐다. 다만 실제 Android/iOS
기기와 다중 역할 전체 매트릭스는 실행하지 못했으므로 TASK-060과 Production Gate는 완료 처리하지
않는다.

## 기준선

- 기준 SHA: `75cfa8ba34c8373d4c900e4344e8b93d63d2a514`
- Android: `Pixel_9_Pro`, `Medium_Phone_API_35`
- iOS: `iPhone 16 Pro`, `iPhone 16e`, Xcode 26.1
- Firebase 설정: Mobile 로컬 경로에 배치, Git 제외
- OAuth와 실제 초대 메일 수락: 사용자 승인에 따라 이번 Simulator Gate에서 제외

## Gate 결과

| Gate | 결과 | 핵심 증적 |
|---|---|---|
| DEV guard·도구 inventory | PASS | project ref, 도구 버전, Firebase hash, 마스킹된 기기 ID |
| Production P0 자동화 | PASS | Core·Web/Mobile store·SQL·Playwright 23건 |
| Typecheck·Web/Mobile build·lint | PASS | 전체 명령 종료 코드 0 |
| Android preview build | PASS | APK SHA-256 `f63f08b...d5fb3` |
| Android 동일 계정 신규 설치 복구 | PASS | 여행·일정·사진, revision 3, UUID v4 |
| iOS simulator release archive | PREPASS | archive SHA-256 `43d8ffd...1699`, 2대 설치·실행 |
| iOS 데이터·권한 전체 시나리오 | 대기 | 로그인 이후 기능 매트릭스 미실행 |
| 실제 Android A1/A2 | BLOCKED | 실제 기기 미제공 |
| 실제 iOS I1/I2 | BLOCKED | 실제 기기 미제공 |

## 발견 결함과 조치

1. React Native에서 `crypto.randomUUID()`가 없을 때 `plan-*` 형식 ID가 생성돼 PostgreSQL UUID
   변환에서 command가 거부됐다. Core 공통 secure UUID v4 생성기로 모든 Mobile entity ID를
   통일하고 fallback 단위 테스트를 추가했다.
2. 장소 사진 Storage upload가 plan command의 canonical 반영보다 먼저 실행돼 RLS가 거부했다.
   plan outbox가 `synced`가 된 뒤 upload·metadata 등록을 수행하고, image URL command도 즉시
   flush하도록 순서를 고정했다.
3. 수정 후 Android A에서 생성한 여행·일정·사진을 Android B의 새 설치에서 복구했고, DEV
   canonical row는 UUID v4, 사진 URL, 240/800 폭 asset 두 개와 동일 revision으로 확인됐다.

## 잔여 위험

- iOS EAS local wrapper는 native build와 archive 생성 후 임시 디렉토리 정리에서 `ENOTEMPTY`로
  종료 코드 1을 반환했다. archive hash, 압축 해제, 설치, 실행은 성공했지만 도구 정리 오류는
  재확인이 필요하다.
- Expo Doctor는 dynamic config, Metro 기본값, 직접 `expo-modules-core` 의존성 경고를 남긴다.
- iOS icon, Firebase/RNFirebase deprecation, Ad ID/ATT 심사 범위를 출시 전 확인해야 한다.
- 실제 기기의 airplane mode, background/force-stop, push, 역할 변경·revoke, 초대 수락은 미검증이다.

## 다음 판정 조건

실제 Android/iOS 기기에서 필수 플랫폼 조합과 P0/P1 수동 케이스를 100% 통과하고 데이터 손실,
계정 노출, 권한 우회, canonical 중복이 0건이어야 TASK-060을 완료한다. 그 전까지 Production은
`NO-GO`다.
