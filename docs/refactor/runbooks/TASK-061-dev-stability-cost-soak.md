# TASK-061 DEV 안정성·비용 관측 Runbook

## 목적과 안전 기준

DEV `ivgkqzwosbjukonlpfdw`에서 동일 release SHA를 연속 7일 관측한다. 고객 계정과 Production을
사용하지 않으며 raw UUID, 이메일, 여행 내용, token과 secret은 증적에 저장하지 않는다. 임계치 초과나
P0 incident가 발생하면 기간을 중단하고 수정 SHA에서 1일차부터 다시 시작한다.

## 1. 관측 초기화

```bash
RELEASE_SHA=$(git rev-parse origin/refactoring/local-first-architecture)
START_DATE=$(date +%F)
pnpm task061:soak init \
  --evidence-dir _workspace/task061 \
  --start "$START_DATE" \
  --release-sha "$RELEASE_SHA"
```

`_workspace/task061/days/`에 7개 일별 템플릿이 생성된다. 이 경로는 Git에서 제외된다. 같은 기간을
덮어쓰려면 기존 증적을 별도 보관한 뒤에만 `--force`를 사용한다.

## 2. 매일 실행

1. owner/editor/viewer로 online edit, offline reconnect, collaborator edit, invitation, asset upload를
   각각 1회 이상 실행한다.
2. Web GA4와 Android Firebase에서 authority event를 release SHA·플랫폼별로 집계한다.
3. Supabase Usage에서 DB, Storage, egress, Realtime message의 사용량과 quota를 기록한다.
4. Android fatal crash와 unhandled rejection, 데이터 손실·권한·중복 row incident를 확인한다.
5. 일별 JSON의 `status`를 `complete`로 변경하고 마스킹된 원시 export 경로를 `evidence`에 기록한다.
6. 진행 중 판정을 실행한다.

```bash
pnpm task061:soak validate \
  --evidence-dir _workspace/task061 \
  --allow-incomplete
```

## 3. 이벤트 매핑과 임계치

| 일별 필드 | 원본 신호 | GO 기준 |
|---|---|---|
| `queueAgeMs` | `authority_flush_started.queue_age_ms` | p95 30초 이하 |
| `appliedCommands` | `authority_batch_applied.count` | 매일 1건 이상 |
| `rejectedCommands` | `authority_batch_rejected.count` | 의도 차단 제외 0.1% 이하 |
| `retryableCommands` | `authority_batch_retryable.count` | attempted 대비 2% 이하 |
| `conflictCommands` | `authority_batch_conflict.count` | applied 대비 1% 이하 |
| `rpcDurationMs` | `authority_batch_applied.duration_ms` | p95 2초 이하 |
| invalidation gap | `authority_invalidation_gap` | received 대비 0.5% 이하 |
| full refresh | `authority_full_refresh` | received 대비 5% 이하 |
| quota | Supabase Usage | 월 예상 70% 미만 |

권한 테스트에서 의도적으로 거부한 command만 `intendedRejectedCommands`에 포함한다. quota의
`projectionFactor`는 누적 traffic이면 `월 일수 / 관측 경과 일수`, DB·Storage 현재 크기면 `1`을
사용한다.

## 4. 최종 판정

```bash
pnpm task061:soak validate --evidence-dir _workspace/task061
```

`report.json`이 `GO`이고 7일 모두 PASS해야 완료한다. `NO-GO`면 실패 일자와 수정 Issue를 연결한다.
수동 재실행 성공만으로 실패를 삭제하지 않는다.
