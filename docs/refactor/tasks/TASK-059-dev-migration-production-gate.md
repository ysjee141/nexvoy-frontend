# TASK-059: DEV 객체·Migration History 정합화

- 상태: 대기
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

- Production migration
- 실제 사용자 데이터 cleanup
- legacy table·function 물리 삭제
