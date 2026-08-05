# TASK-063: Web·Android Production 사전 점검 및 단계적 출시

- 상태: 대기
- 선행 작업: `TASK-061`
- 해소 대상: `B-07`~`B-10`, `B-11` 운영 설정

## 목적

Production `runbcaegpefqnljsswhv`의 schema, 현재 plan의 backup 제공 범위, Web·Android 외부 연동과
운영 책임을 독립 확인하고 Android 지원 대상의 100%까지 단계적으로 확대한다.

## 범위

- Production migration history·object drift 독립 감사
- 현재 Supabase plan과 backup 제공 범위, 초기 복구 위험 수용 기록
- Web/Android release SHA, 환경변수, OAuth, 이메일, Android push·deep link, 도메인
- `send-document-invitation` Production secret(`RESEND_API_KEY`,
  `ONVOY_APP_ORIGIN=https://app.nexvoy.xyz`)과 함수 배포, 인증·권한·실제 이메일 smoke
- asset cleanup scheduler, `ASSET_CLEANUP_SECRET`, 실패 alert
- API 인증·rate limit, Google Play 정보, 약관·개인정보, 지원·incident 연락망
- 내부→5%→25%→100% rollout과 단계별 hold·GO 승인
- 쓰기 동결, authority-only client rollback, 비파괴 migration/function rollback 훈련

## 완료 조건

- 마스터 계획 `G0`~`G4`, `G6`이 GO이고 미해결 P0/P1 결함이 없다.
- `G5`/`TASK-062`는 초기 출시 비차단·보류 상태이고 Supabase Pro 전환 시 재개한다.
- release manager, DB operator, Web/Android 배포자, on-call 담당자가 승인한다.
- 단계별 임계치와 최소 관찰 시간을 충족한 뒤에만 다음 비율로 확대한다.
- 100% 전환 후에도 alert, 현재 plan의 backup 범위·위험 승인과 rollback 준비가 유지된다.
- iOS가 지원 대상 또는 출시 완료로 표시되지 않는다.
- Production Android 이메일 초대가 Web 배포 보호 설정에 의존하지 않고, owner/editor 권한과
  수락 대기 상태가 Web과 동일하게 수렴한다.

## 제외 범위

- iOS 실기기·TestFlight·App Store·iOS OAuth/push 검증과 출시
- iOS Production 출시는 Android 안정화 이후 `TASK-064`에서 별도 승인

## 즉시 중단 조건

- 데이터 손실·변질, 계정 간 노출, 권한 우회
- migration drift, 미승인 schema 변경, Pro 전환 후 검증된 복구 절차의 불일치
- 반복되는 command reject/retry 또는 RPC latency 임계치 초과
