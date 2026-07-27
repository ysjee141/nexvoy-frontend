# TASK-059 DEV Migration Ledger Runbook

## 목적과 경계

DEV `ivgkqzwosbjukonlpfdw`의 실제 객체와 migration history를 정합화한다. Production에는 이 절차를
실행하지 않는다. 원격 SQL 변경은 사용자 승인 후 DB operator가 수행한다.

## 1. Preflight

```bash
test "$(cat supabase/.temp/project-ref)" = "ivgkqzwosbjukonlpfdw"
git status --short
supabase migration list --linked
```

다음 조건이면 즉시 중단한다.

- project ref가 DEV가 아니다.
- 아래 10개 repair 대상 외에 설명되지 않은 history 차이가 있다.
- 최신 schema fingerprint가 감사 보고서와 다르다.
- 실행 승인·실행자·시각을 기록하지 않았다.

## 2. 변경 전 증적과 Backup

덤프에는 사용자 데이터가 포함될 수 있으므로 저장소에 커밋하지 않고 접근 제한된 경로에 보관한다.
Storage object byte는 이 dump에 포함되지 않지만 TASK-058/059는 object byte를 변경하지 않는다.

```bash
umask 077
supabase db dump --linked --schema public,realtime,storage \
  --file /tmp/task059-dev-schema-before.sql
supabase db dump --linked --data-only --use-copy --schema public,storage \
  --file /tmp/task059-dev-data-before.sql
supabase migration list --linked \
  > /tmp/task059-dev-migration-list-before.txt
```

로컬 기준과 DEV를 다시 비교한다.

```bash
supabase db reset --local
supabase db dump --local --schema public,realtime,storage \
  --file /tmp/task059-local-expected.sql
node scripts/audit-task059-schema-dump.mjs \
  --expected /tmp/task059-local-expected.sql \
  --actual /tmp/task059-dev-schema-before.sql \
  --output /tmp/task059-dev-fingerprint-before.json
```

## 3. History Repair

다음 명령은 SQL을 재실행하지 않고 검증된 historical version만 등록한다.

```bash
supabase migration repair --linked --status applied --yes \
  20260712000001 20260713000001 20260714000001 \
  20260716000003 20260717000001 20260717000002 \
  20260718000001 20260718000002 20260723000001 \
  20260723000002
```

repair 후 dry-run에는 아래 두 파일만 나와야 한다.

```bash
supabase db push --linked --dry-run
```

- `20260723000003_task058_place_photo_write_policy.sql`
- `20260727000001_task059_authority_rpc_grant_hardening.sql`

다른 파일이 보이면 push하지 않는다.

## 4. Forward Migration

```bash
supabase db push --linked --yes
```

TASK-058과 TASK-059는 각각 transaction으로 적용된다. 오류가 발생하면 반복 실행하지 말고 출력과
schema dump를 보존한다.

## 5. 사후 검증

```bash
supabase migration list --linked \
  > /tmp/task059-dev-migration-list-after.txt
supabase db push --linked --dry-run
supabase db dump --linked --schema public,realtime,storage \
  --file /tmp/task059-dev-schema-after.sql
node scripts/audit-task059-schema-dump.mjs \
  --expected /tmp/task059-local-expected.sql \
  --actual /tmp/task059-dev-schema-after.sql \
  --output /tmp/task059-dev-fingerprint-after.json \
  --strict
```

합격 기준은 migration dry-run 대상 0개와 fingerprint 12/12다.

## 6. Authenticated Remote-safe Smoke

service role은 사용하지 않는다. 기존 TASK-059 전용 owner/editor/viewer/outsider 계정을 환경변수로
주입한다. 이메일에는 `task059` 문자열이 포함되어야 한다.

```bash
TASK059_ALLOW_DEV_SMOKE=yes \
TASK059_DEV_SUPABASE_URL=https://ivgkqzwosbjukonlpfdw.supabase.co \
TASK059_DEV_SUPABASE_ANON_KEY="$DEV_ANON_KEY" \
TASK059_QA_OWNER_EMAIL="$QA_OWNER_EMAIL" \
TASK059_QA_OWNER_PASSWORD="$QA_OWNER_PASSWORD" \
TASK059_QA_EDITOR_EMAIL="$QA_EDITOR_EMAIL" \
TASK059_QA_EDITOR_PASSWORD="$QA_EDITOR_PASSWORD" \
TASK059_QA_VIEWER_EMAIL="$QA_VIEWER_EMAIL" \
TASK059_QA_VIEWER_PASSWORD="$QA_VIEWER_PASSWORD" \
TASK059_QA_OUTSIDER_EMAIL="$QA_OUTSIDER_EMAIL" \
TASK059_QA_OUTSIDER_PASSWORD="$QA_OUTSIDER_PASSWORD" \
TASK059_SMOKE_REPORT=/tmp/task059-dev-smoke.json \
pnpm test:task059:dev-smoke
```

PASS 기준:

- owner bootstrap, targeted invite/accept
- editor write와 duplicate operation 멱등성
- viewer write·outsider read·anonymous internal/wrapper 차단
- role 하향과 revoke 직후 차단
- revision 정확히 1 증가
- QA 여행 soft-delete cleanup

## 7. 실패와 복구

- **repair 후 push 전 실패:** history는 검증된 실제 객체를 기록하므로 되돌리지 않는다. dry-run 원인을
  해결한 뒤 재승인한다.
- **forward migration 실패:** 재실행하지 않는다. 변경 전/후 dump를 비교하고 transaction 상태를
  확인한다. 필요하면 변경 전 함수·policy·grant 정의만 복원한다.
- **smoke 실패:** migration을 임의 rollback하지 않는다. DEV를 NO-GO로 유지하고 결함을 수정한 새
  forward migration을 만든다.
- repair를 되돌려야 한다는 독립 감사 결론이 있을 때만 해당 version에
  `migration repair --status reverted`를 실행한다.

DB password, anon key, QA password, dump와 access token은 Git·PR·로그에 남기지 않는다.
