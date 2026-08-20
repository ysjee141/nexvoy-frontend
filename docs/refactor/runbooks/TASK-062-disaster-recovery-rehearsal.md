# TASK-062 DB·Storage 복구 Rehearsal Runbook

## 실행 상태

초기 Web·Android 출시에 대해서는 **DEFERRED**다. 지금 Recovery 프로젝트를 만들거나 아래 복원 절차를
실행하지 않는다. Supabase Pro 전환 시 managed DB backup을 실제 복구 원본으로 확인하고, Storage
object byte의 별도 보관 정책을 결정한 뒤 본 Runbook을 다시 사용한다.

초기 운영 기간에는 DB·Storage 복구가 보장되지 않는 위험을 명시적으로 수용한다. 로컬 IndexedDB와
SQLite cache/outbox는 공식 복구 원본으로 간주하지 않는다.

## 목적과 중단 조건

DEV `ivgkqzwosbjukonlpfdw`의 DB와 `place-photos`를 별도 Supabase Recovery 프로젝트에 복원한다.
Production `runbcaegpefqnljsswhv`과 DEV 원본에는 import, reset, restore를 실행하지 않는다. Recovery
project ref가 없거나 source와 같으면 즉시 중단한다.

## 1. Recovery project 확인

```bash
SOURCE_REF=ivgkqzwosbjukonlpfdw
RECOVERY_REF=replace_with_recovery_project_ref
pnpm task062:recovery preflight \
  --source-ref "$SOURCE_REF" \
  --recovery-ref "$RECOVERY_REF"
```

도구는 source를 DEV로 고정하고 DEV·Production을 Recovery 대상으로 거부하며, 현재 Supabase CLI
linked ref도 DEV와 일치해야 통과한다.

## 2. 동일 기준 시점 백업

백업 위치는 repository 밖의 암호화된 저장소를 사용한다. 쓰기 중지 시각, 마지막 revision과 시작 시각을
기록한 뒤 managed DB backup을 만든다. 다음 logical export와 Storage export는 보조 증적이다.

```bash
BACKUP_DIR=/absolute/encrypted/path/task062
supabase db dump --linked --file "$BACKUP_DIR/schema.sql"
supabase db dump --linked --data-only --use-copy --file "$BACKUP_DIR/data.sql"
supabase db dump --linked --role-only --file "$BACKUP_DIR/roles.sql"
supabase storage ls --linked -r ss:///place-photos > "$BACKUP_DIR/place-photos.manifest"
supabase storage cp --linked -r ss:///place-photos "$BACKUP_DIR/place-photos"

pnpm task062:recovery backup-manifest \
  --source-ref "$SOURCE_REF" \
  --recovery-ref "$RECOVERY_REF" \
  --release-sha "$(git rev-parse HEAD)" \
  --backup-dir "$BACKUP_DIR"
```

manifest에는 파일 경로·크기·SHA-256만 기록한다. SQL, object byte와 service key는 Git에 넣지 않는다.

## 3. 격리 복원

1. Recovery project의 project ref를 다시 확인한다.
2. 승인된 Supabase restore 또는 logical import로 schema, role, data를 복원한다.
3. `place-photos` object를 원래 object path로 업로드한다.
4. 복원 종료 시각을 기록하고 Recovery 전용 Web/Android env를 만든다.

자동 destructive restore script는 제공하지 않는다. Operator가 콘솔과 대상 ref를 교차 확인한 뒤
Runbook의 승인 기록과 함께 실행한다.

## 4. 원본·복구 digest 비교

각 capture는 전체 row와 Storage descriptor를 메모리에서 정렬·hash하고 count와 digest만 출력한다.

```bash
export TASK062_SUPABASE_URL="https://$SOURCE_REF.supabase.co"
export TASK062_SERVICE_ROLE_KEY="replace_with_dev_service_role_key"
pnpm task062:recovery capture \
  --source-ref "$SOURCE_REF" --recovery-ref "$RECOVERY_REF" \
  --project-ref "$SOURCE_REF" --role source \
  --release-sha "$(git rev-parse HEAD)" \
  --output _workspace/task062/source.json

export TASK062_SUPABASE_URL="https://$RECOVERY_REF.supabase.co"
export TASK062_SERVICE_ROLE_KEY="replace_with_recovery_service_role_key"
pnpm task062:recovery capture \
  --source-ref "$SOURCE_REF" --recovery-ref "$RECOVERY_REF" \
  --project-ref "$RECOVERY_REF" --role recovery \
  --release-sha "$(git rev-parse HEAD)" \
  --output _workspace/task062/recovery.json

unset TASK062_SERVICE_ROLE_KEY
pnpm task062:recovery compare \
  --source-ref "$SOURCE_REF" --recovery-ref "$RECOVERY_REF" \
  --source _workspace/task062/source.json \
  --recovery _workspace/task062/recovery.json \
  --output _workspace/task062/report.json
```

모든 canonical table과 `place-photos` count·digest가 일치해야 `GO`다.

## 5. 제품 smoke와 RTO/RPO

- Recovery 전용 Web과 Android에서 owner/editor/viewer 읽기·수정을 확인한다.
- 여행·일정·준비물·템플릿·초대와 장소 사진을 확인한다.
- 수정 결과가 Web/Android에서 같은 revision으로 수렴해야 한다.
- 백업 기준 시각부터 마지막 보존 데이터까지를 RPO, 복구 시작부터 앱 read/write 성공까지를 RTO로
  기록한다.
- 누락 object, dangling metadata, 계정 간 노출이 0건이어야 완료한다.
