# TASK-061: DEV 안정성·비용 관측

- 상태: 대기
- 선행 작업: `TASK-060`
- 해소 대상: `B-05`

## 목적

Web·Android 초기 Production 예상 사용 패턴을 DEV에서 연속 7일 재현해 동기화 안정성과 Supabase
비용 신호가 승인 임계치 안에 있는지 판정한다.

## 범위

- Web·Android owner/editor/viewer의 일별 생성·수정·초대·offline·재연결 traffic
- outbox age, retry, reject, conflict, invalidation gap, full refresh
- RPC latency, Realtime message, DB·Storage egress, thumbnail 비율
- Android crash/lifecycle 오류, alert 전달, quota 추세와 월간 비용 추정
- 임계치 초과 시 원인 수정 후 관측 기간 재시작

## 완료 조건

- 연속 7일 동안 마스터 계획의 정량 기준을 만족한다.
- 데이터 손실·권한 incident·중복 row가 0건이다.
- 일별 원시 지표와 최종 요약이 release SHA에 연결된다.
- 월 예상 주요 quota 사용량이 70% 미만이거나 승인된 확장 계획이 있다.

## 제외 범위

- Production 실제 고객 traffic
- DB와 Storage 복구 rehearsal
- iOS 사용량·lifecycle 비용 관측 (`TASK-064`에서 별도 기준 확정)
