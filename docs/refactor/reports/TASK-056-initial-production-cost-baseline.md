# TASK-056 초기 Production 비용 기준

## 결론

현재 authority 아키텍처는 초기 Production 규모에 적합하다. 정규화된 row를 canonical 데이터로 사용하고,
client는 entity command를 전송하며, Realtime은 invalidation만 전달한다. Asset은 DB와 RPC payload를 통과하지
않는다. 승인된 월 활성 사용자 1,000명 모델은 Supabase Pro 기본 제공량보다 충분히 작다. 단, 이 문서는
용량 모델이며 DEV 7일 실측을 대체하지 않는다.

## 초기 사용량 모델

| 입력 | 가정 |
|---|---:|
| 월 활성 사용자 | 1,000명 |
| Domain mutation | 사용자당 월 20건, 총 20,000건 |
| Invalidation 평균 수신자 | 3명 |
| Full bundle refresh | 사용자당 월 5회 |
| 대표 bundle 크기 | 200KB |
| 저장 사진 | 사용자당 10개, 원본·thumbnail 합계 평균 500KB |

자동 protocol 테스트는 대표 command를 2KiB 이하, invalidation을 1KiB 이하로 제한한다. 이 가정의 상한은
command ingress 약 40MB, Realtime 전달 약 60MB, full bundle egress 약 1GB, Storage 약 5GB다. 사진 조회가
가장 큰 변동 요인이다. 사진 egress는 DB traffic에서 추정하지 않고 cached/uncached egress report로 확인한다.

## 요금제 적합성

2026-07-23 기준 Supabase Pro는 월 25달러부터 시작하며 100,000 MAU, DB 8GB, uncached egress 250GB,
cached egress 250GB, file storage 100GB, Realtime message 500만 건, peak connection 500개를 제공한다.
가격과 제공량은 변경될 수 있으므로 출시 전 [공식 요금 페이지](https://supabase.com/pricing)를 다시 확인한다.
Egress는 Database, Auth, Storage, Functions, Realtime을 통합 집계하며 cached와 uncached quota를 분리한다.
자세한 기준은 [Egress 문서](https://supabase.com/docs/guides/platform/manage-your-usage/egress)를 따른다.

현재 모델은 주요 Storage와 egress quota의 10% 미만이며 MAU와 Realtime message quota보다 충분히 작다.
초기 단계에서 custom sync gateway, 영구 delta log, 유료 Log Drain, read replica를 도입할 근거가 없다.

## 비용 통제 원칙

- 1초 debounce와 최대 32 command batch, `operation_id` idempotency를 유지한다.
- Invalidation에는 bundle, memo, title, asset byte를 넣지 않는다.
- `B-11`에서 Web/Mobile canonical hash를 통일한 뒤 목록은 `_w240` thumbnail과 immutable path를 사용한다.
- 월 예상 사용량 70%에서 alert를 발생시키고 승인 전까지 Pro spend cap을 유지한다.
- GA4/Firebase 집계 event와 Supabase Usage/Realtime report를 함께 본다.
- Realtime report에서 connection, event, payload size, error, lag를 확인한다.
  [Realtime Reports](https://supabase.com/docs/guides/realtime/reports)
- Realtime message·peak connection 제공량과 초과 요금은
  [Realtime Pricing](https://supabase.com/docs/guides/realtime/pricing)에서 출시 직전에 다시 확인한다.
- DB와 Storage를 분리 export한다. Managed DB backup은 Storage object byte를 포함하지 않는다.

## 성장 단계 재평가 조건

다음 조건이 두 billing period 연속 발생하면 아키텍처 또는 요금제를 재평가한다.

- DB, Storage, egress, message, peak connection이 quota의 70%를 넘는다.
- Full bundle fallback이 invalidation의 5%를 넘거나 월 egress 25GB를 만든다.
- Query/index tuning 이후에도 RPC p95가 2초를 넘는다.
- 일반적인 여행이 2MB 또는 active entity 500개를 넘는다.
- Collaborator fanout 또는 mutation 빈도가 초기 모델의 5배를 넘는다.

성장 단계에서는 targeted change retention과 query/index tuning을 먼저 적용한다. Managed Supabase 경로가
실측 비용 또는 신뢰성의 병목임이 확인된 뒤에만 sync gateway나 전문 collaboration transport를 검토한다.

## 실측 완료 조건

이 모델을 Production 비용 기준으로 확정하려면 TASK-057의 7일 관측을 완료해야 한다. Command, Realtime,
full bundle, image cached/uncached egress를 분리하고 사용자 수와 mutation 수로 정규화한 결과를 남긴다.
