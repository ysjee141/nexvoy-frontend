# TASK-062 DB·Storage 복구 Rehearsal 보고서

작성일: 2026-08-05

Source: DEV `ivgkqzwosbjukonlpfdw`

상태: **DEFERRED / 초기 출시 비차단**

## 준비 결과

- Issue #383에 안전 원칙과 완료 조건을 등록했다.
- DEV·Production을 Recovery 대상으로 사용할 수 없도록 preflight를 고정했다.
- backup 파일 checksum manifest와 원본·복구 canonical table/Storage digest 비교 도구를 추가했다.
- capture 결과에는 count와 SHA-256만 남고 raw row, object path와 credential은 남지 않는다.

## 범위 재결정

2026-08-01 확인 당시 계정에는 DEV와 Production만 있고 별도 Recovery 프로젝트는 없었다. 2026-08-05
초기 운영 규모와 비용 우선순위를 재평가해 Recovery 프로젝트를 지금 추가하지 않기로 결정했다.

- `G5`와 `B-06`은 초기 Web·Android 출시 비차단·보류로 변경한다.
- 초기 운영 기간의 DB·Storage 복구 미보장 위험을 수용한다.
- Supabase Pro 전환 시 managed DB backup 상태를 확인하고 Recovery 프로젝트를 만든 뒤 본 보고서를
  다시 연다.
- Storage object byte의 별도 백업 여부는 Pro 전환 시 자산 중요도에 따라 결정한다.

준비된 digest 도구와 Runbook은 후속 rehearsal에 재사용한다. 이 보류 결정은 `TASK-061`과
`TASK-063`의 안정성, 권한, migration, 외부 연동 및 단계적 rollout Gate를 완화하지 않는다.
