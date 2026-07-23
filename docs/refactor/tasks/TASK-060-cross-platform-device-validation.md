# TASK-060: Web·Mobile 실기기 통합 검증

- 상태: 대기
- 선행 작업: `TASK-059`
- 해소 대상: `B-04`, `B-11` 검증 부분

## 목적

Web과 Android/iOS가 동일한 server-authority 데이터, 권한, offline 복구 결과를 보장하는지 실제
브라우저와 설치 빌드에서 확인한다.

## 범위

- Web/Web, Web/Android, Web/iOS, Android/Android, Android/iOS, iOS/iOS
- 동일 계정 새 브라우저·새 설치와 서로 다른 collaborator 계정
- 여행·일정·준비물·템플릿·초대·권한·asset 전체 회귀
- offline, 강제 종료, reconnect, Realtime gap, 충돌, revoke
- Web/Mobile canonical asset path 일치와 thumbnail network 요청
- orphan cleanup이 사용 중 object를 보존하고 retention 대상만 삭제하는지 확인

## 완료 조건

- 필수 플랫폼 조합의 P0/P1 수동 케이스가 100% PASS한다.
- 데이터 손실·계정 간 노출·권한 우회·중복 canonical row가 0건이다.
- 기기·OS·build SHA와 영상, network/Logcat, DB revision 증적이 케이스별로 연결된다.
- 미해결 P0/P1 결함이 없다.

## 제외 범위

- 7일 장기 관측
- Production store 공개와 사용자 rollout
