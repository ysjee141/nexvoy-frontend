# TASK-056 Production 배포·복구 Runbook

## 결론

이 문서는 TASK-056 migration의 안전한 배포와 복구 원칙을 정의한다. 전체 출시 검증과 증적 절차는
[TASK-057 최종 검증 Runbook](TASK-057-production-validation-runbook.md)을 따른다. DEV는
`ivgkqzwosbjukonlpfdw`, Production은 `runbcaegpefqnljsswhv`다. Legacy object는 삭제하지 않는다.

## 현재 Gate

코드와 Local DB Gate는 PASS다. DEV와 Production은 NO-GO다. DEV migration history에는 historical
version 9건과 TASK-056 version이 등록되지 않았다. 그러나 2026-07-23 schema dump에서 TASK-055/056의
핵심 함수·정책·권한은 양쪽 환경에 존재했다. 따라서 원본 SQL을 다시 실행하지 않고 전체 fingerprint와
history 정합화부터 수행한다.

## DEV Migration Ledger 정합화

2026-07-23 확인 기준 DEV history에 없는 version은 다음 10건이다.

```text
20260712000001  20260713000001  20260714000001
20260716000003  20260717000001  20260717000002
20260718000001  20260718000002  20260723000001
20260723000002
```

각 migration의 table, function, grant, trigger, policy를 DEV remote object와 대조한다. SQL을 수동 실행해
object가 이미 있을 수 있다. 핵심 object 존재만으로 통과시키지 않고 migration의 전체 statement를
대조한다.

전체 fingerprint가 일치한 version만 하나씩 history를 repair한다.

```bash
supabase link --project-ref ivgkqzwosbjukonlpfdw
supabase migration list
VERIFIED_VERSION="승인된_14자리_version"
supabase migration repair --linked --status applied "$VERIFIED_VERSION"
supabase migration list
supabase db push --linked --dry-run
```

부분 적용 또는 정의 차이가 있으면 원본 migration을 재실행하지 않는다. 별도 forward reconciliation
migration으로 목표 상태를 만든 뒤 원래 version의 history 처리 근거를 승인받는다. Production history는
DEV 결과를 추정하지 않고 독립적으로 감사한다.

## 배포 전 Backup

1. Release SHA, project ref, migration list, active client version을 기록한다.
2. Supabase managed DB backup 또는 snapshot을 생성한다.
3. Logical schema/data export를 보조 증적으로 저장한다.
4. DB backup에 Storage object byte가 포함되지 않으므로 `place-photos`를 별도 export한다.
5. Backup 위치와 checksum을 repository 밖 release ticket에 기록한다.

```bash
mkdir -p "backup/$PROJECT_REF/$RELEASE_SHA"
supabase db dump --linked --file "backup/$PROJECT_REF/$RELEASE_SHA/schema.sql"
supabase db dump --linked --data-only --use-copy \
  --file "backup/$PROJECT_REF/$RELEASE_SHA/data.sql"
supabase db dump --linked --role-only \
  --file "backup/$PROJECT_REF/$RELEASE_SHA/roles.sql"
supabase storage ls --linked -r ss:///place-photos \
  > "backup/$PROJECT_REF/$RELEASE_SHA/place-photos.manifest"
supabase storage cp --linked -r ss:///place-photos \
  "backup/$PROJECT_REF/$RELEASE_SHA/place-photos"
find "backup/$PROJECT_REF/$RELEASE_SHA" -type f ! -name SHA256SUMS \
  -exec shasum -a 256 {} \; | LC_ALL=C sort \
  > "backup/$PROJECT_REF/$RELEASE_SHA/SHA256SUMS"
```

## 배포 순서

1. DEV 10개 version의 전체 객체 fingerprint를 완료한다.
2. 일치하는 version만 history에 등록하고 dry-run 대상 0건을 확인한다.
3. TASK-055/056 원본 SQL을 다시 실행하지 않고 Local 전체 SQL/E2E와 DEV authenticated smoke를 실행한다.
4. Web과 내부 Mobile build에서 Web/Web, Web/Mobile, Mobile/Mobile 테스트를 실행한다.
5. DEV에서 연속 7일 동안 데이터·권한 incident 없이 지표 임계치를 통과한다.
6. Recovery project에서 DB와 Storage를 함께 복구한다.
7. Production 원격 전용 history 4건과 실제 schema drift 감사, pre-deploy backup을 완료한다.
8. Web, Mobile 내부, 5%, 25%, 100% 순서로 확대한다.

Local SQL smoke와 service-role Playwright를 DEV나 Production에 직접 실행하지 않는다. 원격 검증은 전용
authenticated 계정과 `QA-` fixture를 사용하는 안전한 smoke로 수행한다.

## 관측과 Alert

| 신호 | Event/Report | 초기 Alert |
|---|---|---|
| Online outbox age | `authority_flush_started.queue_age_ms` | p95 30초 초과가 15분 지속 |
| Command reject | `authority_batch_rejected` | 의도 차단 제외 0.1% 초과 |
| Retry pressure | `authority_batch_retryable` | 2% 초과가 15분 지속 |
| 사용자 충돌 | `authority_batch_conflict` | applied command의 1% 초과 |
| RPC latency | `authority_batch_applied.duration_ms` | p95 2초 초과가 15분 지속 |
| Invalidation gap | `authority_invalidation_gap` | received event의 0.5% 초과 |
| Bundle fallback | `authority_full_refresh` | received invalidation의 5% 초과 |
| Realtime capacity | Supabase Realtime Reports | quota 70% 지속 |
| Egress/DB/Storage | Supabase Usage | 월 예상 quota 70% 초과 |

초기에는 유료 Log Drain을 추가하지 않는다. 7일 보관으로 incident 조사가 불가능하거나 외부 감사가
중앙 로그를 요구하면 도입한다.

## 롤백

1. Rollout을 중단하고 필요하면 쓰기를 maintenance mode로 동결한다.
2. Client를 직전 안정 authority-only release로 전환한다.
3. TASK-055에서 legacy runtime을 제거했으므로 retired feature flag를 롤백 수단으로 사용하지 않는다.
4. `20260723000002` 동작을 되돌려야 하면 `20260717000001`의 이전 wrapper function 정의를 복원한다.
5. 이미 commit된 canonical row는 삭제하거나 역변환하지 않는다.
6. 데이터 손상은 별도 Recovery project에서 DB를 복구하고 검증한 뒤 cutover를 결정한다.
7. 같은 기준 시점의 `place-photos` object를 복구하고 asset metadata와 manifest를 비교한다.
8. 권한, duplicate, revision, asset, invitation 테스트를 다시 통과한 후에만 쓰기를 재개한다.

외부 MAU 100명, 유료 사용 시작, 월 canonical mutation 50,000건, 허용 RPO 24시간 미만 중 하나가
충족되면 PITR을 필수로 전환한다.

## Legacy 물리 삭제

TASK-056은 legacy table/function을 삭제하지 않는다. 최소 지원 client 강제, legacy API traffic 30일 0건,
DB+Storage 복구 성공, 별도 destructive migration 승인이 모두 기록될 때까지 삭제 Gate는 NO-GO다.
