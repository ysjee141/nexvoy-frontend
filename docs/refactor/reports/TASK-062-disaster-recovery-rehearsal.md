# TASK-062 DB·Storage 복구 Rehearsal 보고서

작성일: 2026-08-01

Source: DEV `ivgkqzwosbjukonlpfdw`

상태: **IN-PROGRESS / Recovery project 대기**

## 준비 결과

- Issue #383에 안전 원칙과 완료 조건을 등록했다.
- DEV·Production을 Recovery 대상으로 사용할 수 없도록 preflight를 고정했다.
- backup 파일 checksum manifest와 원본·복구 canonical table/Storage digest 비교 도구를 추가했다.
- capture 결과에는 count와 SHA-256만 남고 raw row, object path와 credential은 남지 않는다.

## 차단 항목

2026-08-01 `supabase projects list` 읽기 전용 확인 결과 계정에는 DEV와 Production만 있고 별도
Recovery 프로젝트는 없다. Recovery Supabase project ref, 백업 접근 권한과 복구 operator 확인이
필요하다. 격리 복원과 Web·Android smoke, RTO/RPO 측정 전까지 `G5`는 `NO-GO`다.
