# TASK-060 Web·Android 통합 검증 보고서

작성일: 2026-08-01
환경: DEV `ivgkqzwosbjukonlpfdw`
상태: **TASK-060 PASS / G3 GO / Android Production NO-GO**

## 현재 판정

Android 시뮬레이터 사전 검증과 실제 기기 Gate를 모두 통과했다. Web/Web, Web/Android,
Android/Android에서 여행·일정·준비물·템플릿·초대·권한·asset과 offline/reconnect 결과가 동일한
canonical 데이터로 수렴했다. TASK-060과 `G3`는 완료한다. iOS는 초기 출시 범위에서 제외하며,
Android Production은 7일 관측과 Production preflight가 남아 `NO-GO`다. 복구 rehearsal은
2026-08-05 결정으로 초기 출시 비차단 보류 상태다.

## 출시 범위 결정

- 초기 지원 플랫폼은 Web과 Android다.
- iOS typecheck, export, simulator launch는 공유 코드 회귀 방지용 비차단 Gate로 유지한다.
- iOS 실기기·OAuth·push·TestFlight/App Store 출시는 `TASK-064`에서 별도 검증한다.
- iOS 미검증은 Android 출시의 차단 항목이 아니며 iOS 지원을 선언하지 않는 조건으로 관리한다.

## 기준선

- 기준 SHA: `75cfa8ba34c8373d4c900e4344e8b93d63d2a514`
- 최종 회귀 SHA: `4a8b374` (PR #381 포함)
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
| 실제 Android A1/A2 | PASS | 사용자 실기기 Gate 확인, 2026-08-01 |
| iOS 데이터·권한·실기기 | DEFERRED | `TASK-064`, Android Gate 비차단 |

## 발견 결함과 조치

1. React Native에서 `crypto.randomUUID()`가 없을 때 `plan-*` 형식 ID가 생성돼 PostgreSQL UUID
   변환에서 command가 거부됐다. Core 공통 secure UUID v4 생성기로 모든 Mobile entity ID를
   통일하고 fallback 단위 테스트를 추가했다.
2. 장소 사진 Storage upload가 plan command의 canonical 반영보다 먼저 실행돼 RLS가 거부했다.
   plan outbox가 `synced`가 된 뒤 upload·metadata 등록을 수행하고, image URL command도 즉시
   flush하도록 순서를 고정했다.
3. 수정 후 Android A에서 생성한 여행·일정·사진을 Android B의 새 설치에서 복구했고, DEV
   canonical row는 UUID v4, 사진 URL, 240/800 폭 asset 두 개와 동일 revision으로 확인됐다.
4. Mobile 동행자 화면은 승인 멤버만 읽어 Web에서 만든 이메일 초대의 `pending` 상태를 누락했다.
   승인 멤버와 대상 이메일 초대를 함께 조회하고 `수락 대기`를 별도 표시하도록 수정했다.
5. DEV Android 앱의 이메일 초대가 Vercel 보호된 Preview API에서 401 객체 응답을 받아
   `[object Object]`를 표시했다. Mobile 초대를 동일 Supabase 프로젝트의 JWT 인증 Edge Function으로
   전환하고 구조화 오류 파서를 추가했다. DEV 인증 스모크에서 초대 생성, 이메일 전송, owner 조회와
   취소를 확인했다.
6. 실제 Android 기기에서 초대받은 계정의 수락 UI가 없음을 확인했다. Core invitation repository의
   수신 목록·수락·거절 경로를 Mobile 홈 인박스에 연결하고, 수락 후 trip authority hydration을
   완료한 다음 상세로 이동하도록 수정했다.
7. 오프라인 준비물 저장은 SQLite authority commit 이후 원격 category 조회에서 화면 갱신이
   중단됐고, 신규 category insert는 commit 자체보다 먼저 실행됐다. 준비물 snapshot을 즉시 표시하고
   category catalog 요청을 비차단 보조 동기화로 분리했다.

## 잔여 위험

- Expo Doctor는 dynamic config, Metro 기본값, 직접 `expo-modules-core` 의존성 경고를 남긴다.
- Google/Kakao OAuth, Android push·deep link와 Production 외부 연동은 TASK-063에서 별도 확인한다.
- `send-document-invitation`은 DEV에만 배포했다. Production secret과 함수 배포는 TASK-063
  preflight 전까지 출시 차단 항목이다.
- iOS EAS cleanup 경고, icon, Firebase/RNFirebase deprecation과 심사 범위는 `TASK-064` 입력으로
  이관한다.

## 완료 판정

Android 실기기 필수 조합과 P0/P1 수동 케이스를 통과했고 데이터 손실, 계정 노출, 권한 우회,
canonical 중복이 보고되지 않았다. TASK-060과 `G3`를 `GO`로 종료한다. 다음 Gate는 TASK-061의 DEV
7일 관측이다. 통과 후 TASK-063 Production preflight로 진행한다. TASK-062는 Supabase Pro 전환 시
재개한다.
