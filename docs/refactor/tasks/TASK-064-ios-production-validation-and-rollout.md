# TASK-064: iOS Production 검증 및 단계적 출시

- 상태: 보류 (Web·Android Production 안정화 이후)
- 선행 작업: `TASK-063`
- 영향 범위: iOS 지원 선언, TestFlight/App Store, iOS 실기기 Gate

## 목적

Web·Android에서 검증된 authority-only 제품 계약을 변경하지 않고 iOS 실기기 동작과 운영 준비를
독립 검증한 뒤 iOS 사용자를 단계적으로 Production에 편입한다.

## 범위

- iPhone 실제 기기 2대의 release/TestFlight 설치와 Metro 비의존 실행
- Web/iOS, iOS/iOS, Android/iOS 동일 계정·collaborator 데이터 수렴
- 여행·일정·준비물·템플릿·초대·권한·asset 전체 P0/P1 회귀
- offline, background/terminate, reconnect, 충돌, role 변경·revoke
- iOS Google/Kakao 로그인, invitation deep link, push·일정 알림
- App Store metadata, privacy manifest/label, 권한 설명, 최소 버전과 rollback
- iOS 도입 후 Supabase·Storage·Realtime 비용 변화 관측

## 유지 Gate

TASK-064 시작 전에도 모든 공통 변경은 iOS typecheck, Expo export와 simulator launch를 통과해야 한다.
이 검사는 iOS 출시 승인이 아니라 공유 코드의 장기 파손을 막는 비차단 회귀 Gate다.

## 완료 조건

- Web/iOS, iOS/iOS, Android/iOS P0/P1 수동 케이스가 100% PASS한다.
- 실제 iPhone의 background/terminate, push, OAuth, deep link와 upgrade가 PASS한다.
- 데이터 손실·계정 노출·권한 우회·중복 canonical row와 미해결 P0/P1이 0건이다.
- TestFlight 내부 검증과 App Store 사전 점검이 승인된다.
- 내부→제한 사용자→100% iOS rollout의 각 hold 구간이 임계치를 충족한다.

## 제외 범위

- Web·Android 기능 재설계
- authority protocol 또는 schema의 iOS 전용 분기
- Android rollout의 재승인
