# TASK-063: Production 사전 점검 및 단계적 출시

- 상태: 대기
- 선행 작업: `TASK-061`, `TASK-062`
- 해소 대상: `B-07`~`B-10`, `B-11` 운영 설정

## 목적

Production `runbcaegpefqnljsswhv`의 schema, backup, 외부 연동, 운영 책임을 독립 확인하고 내부에서
100%까지 단계적으로 확대한다.

## 범위

- Production migration history·object drift 독립 감사
- 배포 직전 DB와 Storage backup·checksum
- Web/Mobile release SHA, 환경변수, OAuth, 이메일, push, 도메인
- asset cleanup scheduler, `ASSET_CLEANUP_SECRET`, 실패 alert
- API 인증·rate limit, 약관·개인정보, 지원·incident 연락망
- 내부→5%→25%→100% rollout과 단계별 hold·GO 승인
- 쓰기 동결, authority-only client rollback, 비파괴 DB 복원 훈련

## 완료 조건

- 마스터 계획 `G0`~`G6`이 GO이고 미해결 P0/P1 결함이 없다.
- release manager, DB operator, Web/Mobile 배포자, on-call 담당자가 승인한다.
- 단계별 임계치와 최소 관찰 시간을 충족한 뒤에만 다음 비율로 확대한다.
- 100% 전환 후에도 alert, backup, rollback 준비가 유지된다.

## 즉시 중단 조건

- 데이터 손실·변질, 계정 간 노출, 권한 우회
- migration drift, 복구 불일치, 미승인 schema 변경
- 반복되는 command reject/retry 또는 RPC latency 임계치 초과
