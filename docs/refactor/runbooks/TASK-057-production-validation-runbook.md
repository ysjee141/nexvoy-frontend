# TASK-057 최종 검증·증적·출시 Runbook

## 결론

이 Runbook은 Web·Android 초기 출시를 대상으로 Local → DEV → 복구 프로젝트 → Production 순서로
실행한다. 각 단계는 이전 Gate의 서명된 증적이 있어야 시작한다. Production migration과 최종 GO는
한 사람이 단독 승인하지 않는다. 명령 실행 전 항상 project ref와 release SHA를 소리 내어 교차
확인한다. iOS 실기기와 App Store 출시는 TASK-064에서 별도 실행한다.

## 목차

- [대상 환경](#대상-환경)
- [안전 원칙](#안전-원칙)
- [0단계: 실행 기록 생성](#0단계-실행-기록-생성)
- [1단계: 로컬 Gate](#1단계-로컬-gate)
- [2단계: DEV migration ledger 정합화](#2단계-dev-migration-ledger-정합화)
- [3단계: DEV history 정합화와 원격 안전 검증](#3단계-dev-history-정합화와-원격-안전-검증)
- [4단계: Web·Android 실기기 통합 테스트](#4단계-webandroid-실기기-통합-테스트)
- [5단계: 7일 관측](#5단계-7일-관측)
- [6단계: DB와 Storage 복구 Rehearsal](#6단계-db와-storage-복구-rehearsal)
- [7단계: Production Preflight](#7단계-production-preflight)
- [8단계: 단계적 출시](#8단계-단계적-출시)
- [중단과 롤백](#중단과-롤백)
- [증적 템플릿](#증적-템플릿)

## 대상 환경

| 환경 | Project ref | 용도 |
|---|---|---|
| DEV | `ivgkqzwosbjukonlpfdw` | migration, 실기기 테스트, 7일 관측 |
| Production | `runbcaegpefqnljsswhv` | 승인된 migration과 단계적 출시 |
| Recovery | 실행 시 기록 | DB+Storage 복구 rehearsal 전용 |

## 안전 원칙

1. `supabase link` 후 모든 변경 명령 전에 `supabase projects list`와 `supabase migration list`를 확인한다.
2. DEV와 Production backup은 repository 밖의 암호화된 저장소에 보관한다.
3. service-role key를 shell history, CI log, 문서, screenshot에 남기지 않는다.
4. 현재 Playwright는 Local 전용이다. `assertLocalSupabaseUrl`을 우회해 DEV/Production에 실행하지 않는다.
5. 고객 데이터로 테스트하지 않는다. DEV와 Production smoke는 전용 내부 계정과 `QA-` fixture만 사용한다.
6. migration ledger repair는 schema를 바꾸지 않는다. 실제 object가 없으면 applied로 표시하지 않는다.
7. Production에서 destructive SQL, reset, seed, local SQL smoke script를 실행하지 않는다.
8. legacy runtime으로 롤백하지 않는다. TASK-055 이후 authority-only client만 지원한다.

## 0단계: 실행 기록 생성

Release ticket에 다음 정보를 먼저 기록한다.

| 필드 | 필수 값 |
|---|---|
| Release SHA | `git rev-parse HEAD` 결과 |
| PR/Tag | PR URL과 release tag |
| Web 배포 | Preview/Production deployment ID |
| Mobile 배포 | Android build ID와 version/build number, iOS 비차단 회귀 결과 |
| 환경 | project ref, Supabase region |
| 담당자 | Release manager, DB operator, QA, Web, Android, on-call |
| 기준 문서 | TASK-057 계획·테스트·Runbook commit |
| 시작 시각 | ISO 8601, `Asia/Seoul` |

Release manager는 [통합 테스트 케이스](../test-plans/TASK-057-production-integration-test-cases.md)의
결과표를 복제하고 모든 필수 case를 담당자에게 배정한다.

## 1단계: 로컬 Gate

### 1.1 기준 브랜치와 변경 확인

```bash
git fetch origin refactoring/local-first-architecture
git merge-base --is-ancestor origin/refactoring/local-first-architecture HEAD
git status --short
git diff --check origin/refactoring/local-first-architecture...HEAD
```

### 1.2 migration과 테스트

```bash
supabase db reset --local
pnpm --filter @nexvoy/core test
pnpm --filter nexvoy-web test:authority
pnpm --filter nexvoy-app test:authority
pnpm typecheck
pnpm --filter nexvoy-web exec tsc --noEmit
pnpm lint:mobile
pnpm build:packages
pnpm build
pnpm build:mobile
```

SQL script는 Local container에서 `ON_ERROR_STOP=1`로 실행한다. 실행 목록은 테스트 케이스 문서의
`AUT-005`를 따른다.

### 1.3 Playwright

Local Supabase 환경 값을 현재 process에 명시한다. `.env.test.local`이 원격 DEV를 가리켜도 process 환경이
우선해야 한다.

```bash
eval "$(supabase status -o env)"
NEXT_PUBLIC_SUPABASE_URL="$API_URL" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
NEXT_PUBLIC_APP_URL="http://localhost:3001" \
pnpm --filter nexvoy-web exec playwright test --reporter=html
```

합격 기준:

- 모든 명령 exit code가 0이다.
- skip, flaky retry, `test.only`가 없다.
- HTML report와 CI URL을 release ticket에 첨부한다.
- P0 자동화 공백인 `NEW-A01`~`NEW-A13`이 구현되기 전에는 G1을 GO로 서명하지 않는다.

## 2단계: DEV migration ledger 정합화

### 2.1 연결과 전 상태 기록

```bash
supabase link --project-ref ivgkqzwosbjukonlpfdw
supabase migration list
supabase db push --linked --dry-run --include-all
```

현재 알려진 historical gap:

| Version | 주요 object | 확인 항목 |
|---|---|---|
| `20260712000001` | signaling Realtime authorization | policy와 helper function |
| `20260713000001` | legacy trip member compatibility | function/policy 정의 |
| `20260714000001` | rotating signaling topic | topic table, function, policy |
| `20260716000003` | targeted invitation | invitation function, grant, policy |
| `20260717000001` | relational authority | authority tables, RPC, trigger, restrictive RLS |
| `20260717000002` | Realtime invalidation | state trigger, Broadcast policy |
| `20260718000001` | keyless membership | invitation/role/revoke function |
| `20260718000002` | asset registry | asset table, function, Storage policy |
| `20260723000001` | legacy revoke | revoked function/grant 상태 |
| `20260723000002` | entity version rebase | helper, command wrapper, grant |

2026-07-23 read-only schema dump에서 TASK-055/056의 핵심 결과는 DEV와 Production 모두 확인됐다.

- TASK-055: `revoke_document_member`, legacy grant 회수, signaling policy 제거, authority invalidation policy
- TASK-056: 두 stale-batch helper와 이를 호출하는 trip/template command wrapper

이 확인은 SQL 전체 fingerprint를 대체하지 않는다. migration history에는 두 version이 모두 등록되지 않았다.

추가로 양쪽 schema dump에서 `trip_authority_stale_batch_is_rebasable`,
`template_authority_stale_batch_is_rebasable`, command wrapper와 일부 internal authority function에
명시적인 `anon` 실행 grant가 확인됐다. 내부 함수의 `auth.uid()` 검사가 익명 쓰기를 차단하더라도
`SECURITY DEFINER` 함수의 목표 노출 범위와 다르므로 B-02는 실패 상태다.

### 2.2 Object fingerprint

각 migration SQL을 읽고 생성·교체하는 object 목록을 먼저 만든다. Supabase SQL Editor의 read-only query로
정의를 저장한다.

```sql
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'realtime')
  and p.proname like any (array['%authority%', '%invitation%', '%asset%', '%signaling%'])
order by 1, 2, 3;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage', 'realtime')
order by schemaname, tablename, policyname;

select event_object_schema, event_object_table, trigger_name, action_timing, event_manipulation,
       action_statement
from information_schema.triggers
where event_object_schema in ('public', 'realtime')
order by event_object_schema, event_object_table, trigger_name;

select routine_schema, routine_name, grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
order by routine_name, grantee;
```

검토자는 migration 파일과 remote definition이 의미상 동일한지 확인한다. 공백이나 `CREATE OR REPLACE`
형식 차이가 아니라 실제 권한·동작 차이를 판정한다.

### 2.3 History repair

전체 fingerprint가 일치한 version만 하나씩 repair한다. `$VERIFIED_VERSION`에는 검토자 승인이 끝난
version 하나만 넣는다.

```bash
VERIFIED_VERSION="승인된_14자리_version"
supabase migration repair --linked --status applied "$VERIFIED_VERSION"
supabase migration list
supabase db push --linked --dry-run
```

TASK-055/056을 포함해 이미 수동 실행된 SQL을 다시 실행하지 않는다. 일부 statement가 다르면 그 version을
repair하지 않고 차이를 분류한다. 필요한 변경은 새 version의 forward reconciliation migration으로
작성하고, 원래 version history 처리에는 별도 승인을 남긴다.

Grant hardening migration은 최소한 다음을 검증한다.

- `anon`: stale-batch helper, internal apply function, write wrapper 실행 불가
- `authenticated`: `apply_trip_commands`, `apply_template_commands`만 실행 가능
- 내부 helper/apply function: API role 직접 실행 불가
- 익명 호출 차단과 authenticated owner/editor 성공을 SQL 회귀 테스트로 고정

## 3단계: DEV history 정합화와 원격 안전 검증

### 3.1 정합화 전

- DB managed backup 또는 지원되는 snapshot을 생성한다.
- `place-photos` object manifest를 별도로 저장한다.
- 10개 version의 fingerprint와 repair 근거를 두 사람이 확인한다.
- `db push --dry-run` 결과에 미검증 migration이 남아 있으면 중단한다.

### 3.2 History 확인

```bash
supabase migration list
supabase db push --linked --dry-run
```

최종 dry-run에는 적용 대상이 없어야 한다. 새 reconciliation migration이 필요한 경우에는 별도 PR,
backup, dry-run 승인을 거쳐 적용하며 이 Runbook의 history repair와 섞지 않는다.

### 3.3 원격 안전 검증

- 전용 A/B/C/D 계정으로 제품 UI를 사용한다.
- authenticated session으로 여행 생성, editor 수정, viewer 차단, outsider 차단을 확인한다.
- service-role seed와 Local SQL script를 DEV에 실행하지 않는다.
- `NEW-A18` remote-safe smoke가 구현됐다면 자체 `QA-<release>` 데이터만 생성·정리한다.
- function definition, grant, restrictive RLS, Realtime trigger를 read-only query로 다시 저장한다.

중단 조건:

- 예상하지 않은 migration/object 변경
- owner create 또는 accepted member read 실패
- viewer/revoked/outsider write 성공
- 반복 4xx/5xx, retry storm, revision 불일치

## 4단계: Web·Android 실기기 통합 테스트

1. Android Preview/Internal build를 생성한다.
2. Android 실제 기기 두 대에 설치하고 Metro 없이 실행한다.
3. [필수 플랫폼 매트릭스](../test-plans/TASK-057-production-integration-test-cases.md#필수-플랫폼-매트릭스)를
   모두 실행한다.
4. 각 조합에서 `MAN-A`, `MAN-D`, `MAN-C`, `MAN-S`, `MAN-X`, `MAN-M`의 P0/P1을 실행한다.
5. Android는 Logcat, Web은 network/HAR와 console을 수집한다.
6. 같은 place ID로 Web과 Mobile이 만든 Storage path가 byte 단위로 같은지 확인한다. 현재 구현처럼
   Web의 SHA-256과 Mobile의 별도 hash가 다르면 `B-11` 실패로 판정하고 공통 Core 함수로 수정한다.
7. 목록에서는 `_w240`, 상세에서만 `_w800`이 요청되는지 network log로 확인한다.
8. Android Google/Kakao OAuth, invitation deep link, 실제 초대 이메일, push·일정 알림을 확인한다.

Mobile 설치·Logcat 절차는 `docs/develop-context/mobile-app-verification-lifecycle.md`를 따른다.
iOS typecheck, export, simulator launch는 공통 회귀 검사로 기록하되 실기기 기능 검증은 TASK-064에서
실행한다.

합격 기준:

- P0/P1 100% PASS
- unhandled rejection, fatal crash, 무한 retry 0건
- 계정·권한·데이터 정합성 incident 0건
- 실패를 단순 재실행 성공으로 닫지 않고 defect와 수정 SHA를 연결

### 4.1 Asset cleanup 검증

`/api/assets/cleanup`은 `x-cron-secret`이 일치하는 외부 scheduler 전용 endpoint다. DEV에서 먼저
`dryRun`으로 후보를 확인하고, retention 대상 fixture만 실제 삭제한다. 명령 출력에 secret을 남기지 않는다.

```bash
curl --fail-with-body --silent --show-error \
  --request POST "$WEB_BASE_URL/api/assets/cleanup" \
  --header "x-cron-secret: $ASSET_CLEANUP_SECRET" \
  --header 'content-type: application/json' \
  --data '{"dryRun":true,"retentionDays":7}'
```

- secret 없음은 `503`, 틀린 secret은 `401`이어야 한다.
- dry-run은 object와 metadata를 변경하지 않아야 한다.
- 실제 실행은 참조가 끊기고 retention이 지난 object만 삭제해야 한다.
- 같은 요청을 재실행해도 오류나 추가 삭제가 없어야 한다.
- Production scheduler는 실패 응답과 삭제 건수 이상치를 on-call에 알린다.

## 5단계: 7일 관측

### 일별 기록

| 신호 | 수집 위치 | 임계치 |
|---|---|---|
| outbox age | `authority_flush_started.queue_age_ms` | p95 30초 이하 |
| rejected | `authority_batch_rejected` | 의도 차단 제외 0.1% 이하 |
| retryable | `authority_batch_retryable` | 2% 이하 |
| conflict | `authority_batch_conflict` | applied 대비 1% 이하 |
| RPC latency | `authority_batch_applied.duration_ms` | p95 2초 이하 |
| invalidation gap | `authority_invalidation_gap` | received 대비 0.5% 이하 |
| full refresh | `authority_full_refresh` | received 대비 5% 이하 |
| Realtime/egress | Supabase Usage/Realtime Reports | 월 예상 quota 70% 미만 |

매일 최소 한 번 online edit, offline reconnect, collaborator edit, invitation, asset upload를 발생시킨다.
임계치가 초과되거나 P0 incident가 발생하면 관측 기간을 중단한다. 수정 release로 G1부터 다시 시작하고
7일 기간도 처음부터 다시 계산한다.

## 6단계: DB와 Storage 복구 Rehearsal

### 6.1 백업

Managed DB backup을 기준 복구 수단으로 사용한다. CLI logical export는 보조 증적이며 managed backup을
대체하지 않는다. Storage object bytes는 DB backup에 포함되지 않으므로 별도로 export한다.

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

### 6.2 복구

- DEV/Production과 분리된 project ref를 확인한다.
- managed backup 또는 승인된 SQL import 절차로 DB를 복구한다.
- `place-photos` object를 같은 path로 복구한다.
- application env를 Recovery project로 지정한 별도 build에서만 smoke한다.

### 6.3 정합성 확인

```sql
select 'trips' as entity, count(*) from public.trips
union all select 'plans', count(*) from public.plans
union all select 'checklists', count(*) from public.checklists
union all select 'checklist_items', count(*) from public.checklist_items
union all select 'templates', count(*) from public.checklist_templates
union all select 'members', count(*) from public.document_members
union all select 'operations', count(*) from public.applied_operations
union all select 'assets', count(*) from public.trip_asset_objects;

select count(*) as storage_objects
from storage.objects
where bucket_id = 'place-photos';
```

- 원본과 Recovery의 table count, sample resource revision, membership, operation receipt를 비교한다.
- `trip_asset_objects`의 active path와 Storage manifest가 일치하는지 확인한다.
- Web·Android에서 A/B/C/D 권한 smoke와 여행·일정·준비물·asset read를 실행한다.
- 시작부터 앱 read/write 성공까지의 RTO와 허용 가능한 데이터 기준 시점 RPO를 기록한다.

## 7단계: Production Preflight

1. Production으로 다시 link하고 project ref를 두 사람이 확인한다.
2. DEV와 독립적으로 migration history와 object fingerprint를 감사한다.
3. 원격 history에만 있는 `20260403070821`, `20260423112332`, `20260427021704`,
   `20260427023948`의 출처와 실제 객체를 보존·분류한다.
4. Production 전용 `app_versions`, `delete_user()`, `profiles.kakao_id`, push 함수·정책 등 `public`
   schema 차이가 의도된 운영 차이인지 누락된 migration인지 판정한다.
5. 원격 전용 version을 삭제하거나 local version 전체를 일괄 repair하지 않는다.
6. 승인된 정합화 이후 `db push --dry-run` 결과를 release ticket에 저장한다.
7. managed DB backup, logical export, Storage manifest/object export를 만든다.
8. Web·Android env, OAuth redirect, 이메일 발신, Android push, Maps, analytics, alert를 검증한다.
9. `ASSET_CLEANUP_SECRET`을 secret store에 등록하고 scheduler의 인증 header, 주기, timeout, 실패 alert를 검증한다.
10. 약관·개인정보 처리방침 URL과 Google Play privacy/data safety 정보를 검토한다.
11. 최소 Android 버전, 강제 업데이트, Web rollback, on-call 담당자를 승인한다.
12. 최종 GO 회의에서 Release manager와 DB operator가 각각 서명한다.

Production preflight에서는 고객 row를 수정하는 테스트를 하지 않는다. 승인된 내부 계정 smoke는 migration과
client 배포 후 내부 rollout 단계에서 수행한다.

## 8단계: 단계적 출시

| 단계 | 실행 | Hold 중 확인 | 중단 조건 |
|---|---|---|---|
| 내부 | 운영·QA 계정에 Web·Android 제공 | P0 smoke, error/retry/latency | P0/P1 결함 또는 임계치 초과 |
| 5% | 제한 사용자 확대 | 데이터/권한 incident, support 문의 | incident 1건이라도 발생 |
| 25% | 대상 확대 | queue/Realtime/egress 추세 | 15분 이상 임계치 초과 |
| 100% | 전체 공개 | 지속 monitoring과 일일 점검 | rollback 기준 충족 |

각 단계는 최소 한 영업일을 유지한다. 25%는 최소 두 영업일을 유지한다. Hold 종료 시 Release manager와
on-call 담당자가 다음 단계 GO를 기록한다. 100%는 Android 지원 대상만 의미하며 iOS rollout은
TASK-064에서 별도 실행한다.

## 중단과 롤백

### 즉시 중단 조건

- 데이터 손실·변질 또는 duplicate canonical row
- 계정 간 데이터/asset 노출
- viewer/revoked/outsider 권한 우회
- migration drift, DB corruption, 복구 실패
- crash loop, retry storm, 인증 전면 장애

### 절차

1. rollout 확대를 중단하고 필요하면 쓰기를 maintenance mode로 동결한다.
2. incident 시작 시각, release SHA, 영향 계정 범위를 기록한다.
3. Web은 직전 안정 authority-only deployment로 전환한다.
4. Mobile은 store rollout을 중단하고 최소 버전/강제 업데이트 정책으로 안정 build를 유지한다.
5. TASK-056 wrapper 문제라면 `20260717000001`의 이전 function 정의를 복원한다.
6. committed canonical row를 임의 삭제하거나 legacy runtime을 다시 활성화하지 않는다.
7. 데이터 손상 시 원본 Production에 덮어쓰지 않고 Recovery project에서 복구·검증한 뒤 cutover를 결정한다.
8. P0 incident review와 G1~영향 Gate 재실행 전에는 rollout을 재개하지 않는다.

## 증적 템플릿

```markdown
# Production 검증 실행 기록

## 기본 정보
- Gate/Case ID:
- 결과: PASS | FAIL | BLOCKED
- 실행 시각:
- 실행자:
- 검토자:
- Release SHA / Web deploy / Mobile build:
- 환경 / Project ref:
- 클라이언트 / 기기 / OS:

## 선행 조건
- [ ] 이전 Gate PASS
- [ ] project ref 교차 확인
- [ ] backup 또는 cleanup 준비

## 실행 내용
1.
2.
3.

## 기대 결과

## 실제 결과

## 증적
- CI/배포 로그:
- Screenshot/Video:
- Network/HAR/Logcat:
- SQL/대시보드 export:

## 결함과 후속 조치
- Issue:
- 수정 SHA:
- 재검증 결과:

## 승인
- 실행자:
- 검토자:
- Release manager:
```

증적에는 token, secret, 실제 UUID, 이메일, 초대 코드, 고객 콘텐츠를 포함하지 않는다.
