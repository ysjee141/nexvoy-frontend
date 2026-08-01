# TASK-060: Web·Android 실기기 통합 검증

- 상태: 완료 (`G3 GO`, 2026-08-01 Android 실기기 확인)
- 선행 작업: `TASK-059`
- 해소 대상: `B-04`, `B-11` 검증 부분
- GitHub Issue: [#378](https://github.com/ysjee141/nexvoy-frontend/issues/378)

## 목적

초기 Production 지원 범위인 Web과 Android가 동일한 server-authority 데이터, 권한, offline 복구
결과를 보장하는지 실제 브라우저와 Android 설치 빌드에서 확인한다.

## 범위

- Web/Web, Web/Android, Android/Android
- 동일 계정 새 브라우저·새 설치와 서로 다른 collaborator 계정
- 여행·일정·준비물·템플릿·초대·권한·asset 전체 회귀
- offline, 강제 종료, reconnect, Realtime gap, 충돌, revoke
- Web/Android canonical asset path 일치와 thumbnail network 요청
- orphan cleanup이 사용 중 object를 보존하고 retention 대상만 삭제하는지 확인
- Android Google/Kakao 로그인, 초대 deep link, push·일정 알림

## 완료 조건

- Web/Web, Web/Android, Android/Android P0/P1 수동 케이스가 100% PASS한다.
- 데이터 손실·계정 간 노출·권한 우회·중복 canonical row가 0건이다.
- Android 실제 기기 2대의 OS·build SHA, 영상, network/Logcat, DB revision 증적이 연결된다.
- 미해결 P0/P1 결함이 없다.

## 제외 범위

- 7일 장기 관측
- Production store 공개와 사용자 rollout
- iOS 실기기, TestFlight/App Store, iOS OAuth·push·lifecycle 전체 검증 (`TASK-064`)

## 현재 진행 결과

- Android 시뮬레이터 2대의 동일 계정 신규 설치 복구, 일정 UUID v4, 장소 사진 240/800 asset과
  canonical revision 수렴을 확인했다.
- iOS 시뮬레이터 2대에 release archive를 설치하고 앱 실행을 확인했다.
- 검증 중 발견한 Mobile 비표준 entity ID와 plan 저장 전 Storage upload race를 수정했다.
- iOS simulator release archive 설치·실행은 비차단 회귀 검사로 유지한다.
- 실제 기기 점검에서 발견한 Mobile 수신 초대 UI 누락과 오프라인 준비물 표시 차단은 Issue #380,
  PR #381에서 수정했다.
- Web/Web, Web/Android, Android/Android의 여행·일정·준비물·템플릿·초대·권한·asset 및
  offline/reconnect 실기기 Gate를 통과했다.
- TASK-060 판정은 `PASS`, 마스터 계획 `G3`는 `GO`다. Production은 TASK-061~063이 남아 `NO-GO`다.
