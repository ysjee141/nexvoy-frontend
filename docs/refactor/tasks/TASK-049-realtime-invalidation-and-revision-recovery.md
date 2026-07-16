# TASK-049: Realtime Invalidation and Revision Recovery

- 상태: 대기

## 목적

Supabase Realtime을 document 본문 전송이나 P2P signaling이 아니라 작은 invalidation transport로 사용한다.
event 유실, 중복, 순서 역전이 있어도 server revision 비교로 최신 canonical row를 복구한다.

## 범위

- private resource channel과 Realtime authorization
- DB command transaction 이후 Broadcast trigger
- 최소 invalidation payload 계약
- shared invalidation 계약과 Web subscription adapter
- active detail/invitation inbox lifecycle
- revision gap 감지와 full bundle fallback
- message 수, payload bytes, reconnect 지표

제외:

- 영구 `trip_changes` delta log
- WebRTC signaling/data channel
- product 화면 전체 cutover

## 선행 조건

- `TASK-046-relational-authority-and-command-rpc.md`
- `TASK-047-shared-offline-sync-core.md`

## 변경 대상

- `supabase/migrations`
- `supabase/tests`
- `packages/core/src/sync`
- `apps/web/lib/data`

## 구현 단계

1. `trip:{id}`/`template:{id}` private topic과 membership 기반 `realtime.messages` RLS를 정의한다.
2. command commit 후 `resource_id`, resource revision, changed entity type/ID만 broadcast한다.
3. payload에 제목, 메모, 위치, 준비물명, key, token 같은 본문/비밀을 넣지 않는다.
4. Web adapter가 local revision보다 큰 event만 invalidation으로 처리한다.
5. revision이 연속이 아니거나 changed entity fetch가 불명확하면 canonical full bundle을 가져온다.
6. foreground, reconnect, detail enter에서도 server revision을 확인해 missed event를 복구한다.
7. subscription은 활성 상세와 invitation inbox에만 유지하고 화면 종료 시 해제한다.
8. 중복/out-of-order/lost event, revoke 중 channel access를 자동 검증한다.

## 통신량 기준

- 일반 invalidation payload는 1KB 미만을 목표로 한다.
- 전체 row/document를 Broadcast하지 않는다.
- Initial 단계에서 full refresh가 병목이 될 때만 Growth task로 delta cursor를 제안한다.

## 검증 방법

- event 하나를 의도적으로 유실해 reconnect revision check가 최신 bundle을 복구하는지 확인한다.
- duplicate/out-of-order event가 cache revision을 되돌리지 않는지 확인한다.
- 비멤버와 revoked user가 private topic send/receive를 할 수 없는지 SQL 테스트한다.
- 두 Web session에서 변경 entity만 refresh되는지 확인한다.

## 롤백 방법

- Broadcast trigger/subscription을 비활성화한다.
- detail enter/foreground revision check와 explicit refresh만 유지한다.

## 완료 조건

- 활성 collaborator가 server commit을 빠르게 인지한다.
- Realtime이 유실돼도 최종 정합성이 revision check로 보장된다.
- P2P 없이 작은 payload로 Web 실시간 협업 UX가 동작하고 Mobile이 재사용할 계약이 마련된다.
