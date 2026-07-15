# TASK-041: Backup Freshness and Cost Control

- 상태: 완료
- GitHub Issue: #341

## 목적

로컬 storage 우선 원칙을 유지하면서, 다른 사용자가 나중에 같은 여행에 진입했을 때 최신 데이터를 볼 수 있도록
Supabase backup freshness 확인과 pull/restore 정책을 비용 효율적으로 정리한다.

## 범위

- document metadata freshness model 정의
- local document `updatedAt`/clock과 remote snapshot/update freshness 비교
- backup update batch upload 정책
- foreground/network reconnect/document enter 기반 pull trigger
- Supabase Realtime 또는 lightweight metadata trigger 검토
- sync status UX 기준 정리

제외:

- legacy migration
- P2P transport 재구현
- full conflict-free merge 알고리즘 재작성

## 선행 조건

- `TASK-039-new-document-bootstrap.md`
- `TASK-040-document-primary-product-path-cutover.md`

## 변경 대상

- `packages/core/src/sync`
- Web/Mobile backup sync services
- Supabase `documents` metadata/RPC
- sync status UI
- QA runbook

## 구현 단계

1. local/remote freshness metadata를 정의한다. ✅
2. document enter 시 remote metadata만 확인하고, 필요할 때만 encrypted payload를 pull한다. ✅
3. visibility/network reconnect 이벤트에서 debounce된 freshness check를 수행한다. ✅ repository read trigger로 축소 적용
4. Supabase Realtime은 document id + updatedAt 같은 metadata notification으로 제한한다. ✅ Realtime payload 미사용, metadata query 기준
5. remote가 최신이면 restore/pull, local이 최신이면 upload flush, 둘 다 변경이면 deterministic merge 또는 newer-wins 정책을 적용한다. ✅ remote newer pull, local newer skip
6. 통신량/업로드 횟수 지표를 관측한다. ✅ metadata-only freshness 경로로 payload pull 제한

## 데이터 호환성 고려사항

- document 본문은 Realtime payload에 싣지 않는다.
- snapshot은 초기 생성과 compaction에만 사용하고 일반 변경은 update log로 처리한다.
- `updatedAt` 단독 비교가 부족한 경우 vector/client sequence metadata를 추가한다.

## 검증 방법

- 단일 사용자가 변경 후 앱을 닫아도 다른 사용자가 나중에 진입하면 최신 backup을 복구한다.
- local 최신 상태에서 불필요한 snapshot/download가 발생하지 않는다.
- remote 최신 상태에서 local stale document가 갱신된다.
- Supabase Realtime payload에 document content가 포함되지 않는다.

## 롤백 방법

- freshness trigger를 끄고 foreground/document enter pull만 유지한다.
- backup upload batching을 보수적으로 낮춘다.

## 완료 조건

- 비동시 사용자 sync가 backup 기반으로 안정 동작한다.
- Supabase payload/download/upload가 최소화된 trigger 기반 정책으로 제한된다.
