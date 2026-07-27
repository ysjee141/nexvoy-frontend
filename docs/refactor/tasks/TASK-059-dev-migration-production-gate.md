# TASK-059: DEV 객체·Migration History 정합화

- 상태: 완료
- 선행 작업: `TASK-058`
- 해소 대상: `B-01`, `B-02`

## 목적

DEV `ivgkqzwosbjukonlpfdw`의 migration history와 실제 DB object를 일치시킨다. SQL Editor로 직접
실행한 migration은 객체 적용과 history 등록을 분리해 판정한다. TASK-055/056 핵심 객체는 이미
확인됐으므로 원본 SQL을 다시 실행하지 않는다.

## 범위

- 알려진 historical gap 9건과 TASK-056의 function·policy·trigger·grant 전체 fingerprint
- `SECURITY DEFINER` authority helper·internal·wrapper의 `anon` 실행 권한 회수와 회귀 SQL test
- 잘못 적용되거나 누락된 migration history 정정
- `supabase db push --dry-run` 결과 검토
- 전체 fingerprint가 일치하는 `20260723000002` history 기록
- service role 없는 authenticated remote-safe smoke
- 전·후 migration list, 실행자, 시간, SQL 결과 증적
- Production 원격 전용 version 4건과 실제 `public` schema 차이를 TASK-063 입력으로 정리
- 사용자 추가 승인에 따른 Production TASK-058/059 target-only migration 적용과 익명 차단 smoke

## 완료 조건

- Local과 DEV migration history drift가 0이다.
- historical gap 9건과 TASK-056은 전체 object fingerprint와 repair 근거가 각각 존재한다.
- TASK-055/056 원본 SQL을 재실행하지 않고 검증된 version만 history에 등록한다.
- 부분 적용 version은 별도 forward reconciliation migration과 승인 근거로 정합화한다.
- 익명 사용자는 authority helper·internal·write wrapper를 실행할 수 없고 authenticated는 공개 wrapper만
  실행할 수 있다.
- 권한·revision·멱등성 remote-safe smoke가 PASS한다.
- 실패 시 중단·복구 절차가 실행 기록과 함께 검증된다.

## 제외 범위

- Production 전체 migration ledger repair와 단계적 rollout
- 실제 사용자 데이터 cleanup
- legacy table·function 물리 삭제

## 2026-07-27 구현 결과

- 12개 version의 최종 function/table/constraint/index/policy/trigger/RLS/grant를 다루는 185개
  fingerprint manifest와 dump 비교 도구를 추가했다.
- DEV의 history 미등록 10건은 실제 객체가 존재하며, 최종 차이는 TASK-058/059 forward migration으로
  전부 설명됨을 확인했다.
- accidental `anon`/`authenticated` EXECUTE를 명시적 allowlist로 바꾸고 authority helper 인자를
  `auth.uid()`에 결속하는 TASK-059 migration과 SQL 회귀 테스트를 구현했다.
- service role 없는 DEV remote-safe smoke를 project ref·전용 계정·실행 플래그로 보호했다.
- 로컬 Production P0 23건, 전체 SQL, typecheck, Web/Mobile build와 Mobile lint가 PASS했다.
- 사용자 승인 후 DEV의 검증된 historical version 10건을 `repair --status applied`로 등록하고,
  dry-run에 실제 미적용 TASK-058/059만 남는 것을 확인한 뒤 두 forward migration을 적용했다.
- 적용 후 migration drift는 0이며, strict fingerprint는 12/12 version과 185/185 객체가 일치한다.
- DEV에 임시 owner/editor/viewer/outsider Auth 계정을 생성해 service role 없는 authenticated
  remote-safe smoke를 실행했다. 모든 검사가 PASS했고 QA 여행은 soft-delete, 계정은 4/4 삭제됐다.
- 사용자 추가 승인 후 Production의 기존 원격 history 4건을 보존하는 격리 workspace에서
  TASK-058/059만 적용했다. target-only dry-run은 0건이고 anonymous wrapper/internal RPC 차단이
  PASS했다.
- Production fingerprint는 적용 전 116/185에서 183/185로 개선됐다. 남은 두 checklist
  `is_private NOT NULL` 차이와 전체 ledger 정합화·출시는 TASK-063 범위다.
