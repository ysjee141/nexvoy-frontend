# TASK-062: DB·Storage 재해 복구 Rehearsal

- 상태: 대기
- 선행 작업: `TASK-060`
- 해소 대상: `B-06`

## 목적

같은 기준 시점의 DB와 `place-photos` object를 격리된 Supabase 프로젝트에 복구하고 핵심 제품
데이터가 Web과 Android에서 읽기·수정 가능한 상태로 돌아오는지 검증한다.

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

- Production 원본 프로젝트에서의 파괴적 복구
- legacy authority로의 rollback
- iOS 설치 빌드 smoke (`TASK-064`에서 동일 복구 기준을 재사용)
