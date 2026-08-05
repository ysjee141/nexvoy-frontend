# TASK-062: DB·Storage 재해 복구 Rehearsal

- 상태: 보류 (초기 Web·Android 출시 비차단, Supabase Pro 전환 시 재개)
- 선행 작업: `TASK-060`, Supabase Pro 전환
- 해소 대상: `B-06` (Growth 운영 강화)
- GitHub Issue: [#383](https://github.com/ysjee141/nexvoy-frontend/issues/383)

## 목적

같은 기준 시점의 DB와 `place-photos` object를 격리된 Supabase 프로젝트에 복구하고 핵심 제품
데이터가 Web과 Android에서 읽기·수정 가능한 상태로 돌아오는지 검증한다.

## 2026-08-05 범위 결정

- 초기 Web·Android 출시는 `TASK-062` 완료를 요구하지 않는다.
- 초기 운영 기간에는 별도 Recovery 프로젝트와 독립 DB·Storage 복구 보장을 두지 않는 위험을
  명시적으로 수용한다.
- Supabase Pro 전환 시 managed DB backup을 실제 복구 원본으로 확인한 뒤 이 작업을 재개한다.
- Storage object byte는 DB backup과 별개이므로 Pro 전환 시 자산 중요도와 별도 보관 필요성을 함께
  재평가한다.
- 이 결정은 `TASK-061` 안정성·비용 관측이나 `TASK-063` Production preflight를 면제하지 않는다.

## 범위

- 관리형 DB backup과 schema/data/role 보조 export
- Storage object manifest, checksum, metadata export
- 격리 복구 프로젝트에 schema·data·object 복원
- membership, revision, operation receipt, asset reference 정합성 비교
- Web·Android owner/editor/viewer 제품 smoke와 RTO/RPO 측정
- backup 접근 권한과 보관·폐기 정책 확인

## 완료 조건

- DB row와 Storage manifest가 기준 시점 checksum·count와 일치한다.
- 핵심 여행을 권한별로 읽고 수정할 수 있다.
- 허용된 RTO/RPO 안에 복구되며 실제 측정값이 기록된다.
- 누락 object, dangling metadata, 계정 간 노출이 0건이다.

## 제외 범위

- 초기 Web·Android Production 출시 승인
- Production 원본 프로젝트에서의 파괴적 복구
- legacy authority로의 rollback
- iOS 설치 빌드 smoke (`TASK-064`에서 동일 복구 기준을 재사용)

## 실행 도구

아래 도구는 Pro 전환 시 실행하며 초기 출시 준비 중에는 Recovery 프로젝트를 만들기 위해 실행하지 않는다.

- Runbook: [TASK-062 DB·Storage 복구](../runbooks/TASK-062-disaster-recovery-rehearsal.md)
- preflight·manifest·정합성 비교: `pnpm task062:recovery`
- 도구 회귀: `pnpm test:operational-gates`
