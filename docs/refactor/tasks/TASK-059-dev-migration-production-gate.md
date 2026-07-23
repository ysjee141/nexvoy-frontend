# TASK-059: DEV Migration 정합화 및 원격 Gate

- 상태: 대기
- 선행 작업: `TASK-058`
- 해소 대상: `B-01`, `B-02`

## 목적

DEV `ivgkqzwosbjukonlpfdw`의 migration history와 실제 DB object를 일치시키고 TASK-056 migration을
정상 경로로 적용한다. history repair는 object 존재를 증명한 migration에만 사용한다.

## 범위

- 알려진 historical gap 9건의 function·policy·trigger·grant fingerprint
- 잘못 적용되거나 누락된 migration history 정정
- `supabase db push --dry-run` 결과 검토
- `20260723000002` 정상 적용과 history 기록
- service role 없는 authenticated remote-safe smoke
- 전·후 migration list, 실행자, 시간, SQL 결과 증적

## 완료 조건

- Local과 DEV migration drift가 0이다.
- 9개 gap은 object fingerprint와 repair 근거가 각각 존재한다.
- TASK-056 migration은 history repair가 아닌 정상 migration으로 적용된다.
- 권한·revision·멱등성 remote-safe smoke가 PASS한다.
- 실패 시 중단·복구 절차가 실행 기록과 함께 검증된다.

## 제외 범위

- Production migration
- 실제 사용자 데이터 cleanup
- legacy table·function 물리 삭제
