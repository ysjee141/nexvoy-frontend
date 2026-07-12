# TASK-024: P2P Data Channel Yjs Update Exchange

## 목적

`TASK-021`/`TASK-023`은 데이터 채널이 열린다는 것(ping/pong)만 증명했다. P2P optional fast path의
실제 목적은 Supabase backup pull/push보다 빠르게 여행 데이터를 동기화하는 것이다. 이 task는 데이터
채널로 실제 Yjs document update를 주고받아 P2P가 실질적인 동기화 가속 경로로 동작하게 한다.

## 범위

- 데이터 채널을 통한 Yjs update(Uint8Array) 전송/수신 프로토콜 정의(타입, 청킹 헤더)
- 로컬에서 발생한 Yjs update를 연결된 피어에게 전파
- 원격에서 받은 update를 로컬 Yjs 문서에 적용하고 IndexedDB(Web)/로컬 저장소에 반영
- WebRTC data channel의 메시지 크기 제한을 고려한 대용량 update 청킹/재조립
- Supabase backup 큐(dual-write)와의 정합성 — P2P로 받은 update가 backup 큐에 중복 업로드되지
  않도록 출처(origin) 구분
- Mobile은 Yjs/lib0(`isomorphic-webcrypto`)를 쓸 수 없다는 `TASK-020` 제약을 그대로 받아들여, Mobile
  쪽은 이번 task에서 update의 실제 내용을 파싱/적용하지 않고 opaque relay(중계만)로 제한할지, 아니면
  Web-to-Web으로 범위를 좁힐지 결정한다(기본값: Web-to-Web으로 한정하고 Mobile 확장은 별도 후속 task).

제외:

- Yjs update 전송 실패 시의 재시도/큐잉(연결이 끊기면 즉시 backup pull/push로 폴백하는 것으로 충분,
  P2P 자체의 재전송 큐는 만들지 않는다)
- awareness(커서/프레즌스) 동기화

## 선행 조건

- `TASK-021-web-signaling-channel-and-data-channel-handshake.md`
- `TASK-011-dual-write-and-mismatch-detector.md` (dual-write 출처 구분 패턴)
- `packages/core/src/local-first/yjsTripDocument.ts`, `tripDocument.ts` (기존 Yjs 문서 모델)
- `TASK-020-mobile-encrypted-snapshot-restore.md` (Mobile의 Yjs 미지원 제약)

## 변경 대상

- `packages/core/src/sync/signalingChannel.ts` 또는 신규 `packages/core/src/sync/p2pUpdateProtocol.ts`
  — update 메시지 타입(전체/청크), 청킹 헤더, 조립 유틸(플랫폼 API 미포함)
- `apps/web/lib/local-first/webP2PConnection.ts` — ping/pong 데이터 채널과 별도로(또는 같은 채널
  내 메시지 타입으로 구분) update 채널 배선
- `apps/web/lib/local-first/dualWriteChecklistRepository.ts` 또는 `checklistDocumentWriter.ts` —
  로컬 update 발생 시 P2P 채널로도 전파하는 지점, 원격 update 수신 시 로컬 문서에 적용하는 지점
- `docs/refactor/tasks/README.md`

## 구현 단계

1. update 메시지 프로토콜을 정의한다 — 단일 청크로 충분한 크기와 청킹이 필요한 크기의 기준을 정하고,
   청크 헤더(seq, total, updateId)를 설계한다.
2. 로컬 Yjs 문서에서 update가 발생하면(기존 dual-write가 감지하는 지점 재사용) 연결된 피어에게
   데이터 채널로 전송한다.
3. 원격에서 받은 update를 조립(청킹된 경우 재조립)한 뒤 로컬 Yjs 문서에 적용하고, 적용 결과를
   IndexedDB에 반영한다.
4. P2P로 받은 update가 다시 backup 큐로 업로드되어 중복 push되지 않도록 출처를 표시한다(로컬 origin
   vs P2P-received origin).
5. 연결이 없거나 끊긴 경우 이 경로는 완전히 우회되고 기존 backup pull/push만 동작해야 한다(회귀 없음).

## 데이터 호환성 고려사항

- Yjs update는 CRDT이므로 순서가 보장되지 않는 채널에서도 최종 일관성이 깨지지 않지만, 채널 자체는
  ordered reliable data channel(WebRTC 기본값)을 사용해 청크 재조립 복잡도를 낮춘다.
- P2P로 교환되는 데이터는 여전히 이 문서의 다른 task들과 동일하게 document content이므로, observability
  이벤트에는 절대 원문을 남기지 않는다(크기/청크 수 정도만 기록).
- Mobile 범위를 Web-to-Web으로 한정할 경우, Mobile 쪽 데이터 채널은 이 task에서 페이로드를 파싱하지
  않고 그대로 무시하거나 opaque하게 취급해야 하며, 이를 명시적으로 문서화한다.

## 검증 방법

- 두 Web 세션에서 한쪽이 체크리스트 항목을 추가/수정하면 다른 쪽에 P2P를 통해 실시간 반영되는지
  확인한다(Supabase round-trip보다 빠르게 반영되는지 체감 확인 포함).
- 대용량 update(청킹이 필요한 크기)가 정상적으로 재조립되는지 확인한다.
- 연결이 끊긴 상태에서도 기존 backup pull/push 기반 동기화가 정상 동작하는지 확인한다(회귀 테스트).
- P2P로 받은 update가 backup 큐에 중복 업로드되지 않는지 확인한다.
- `pnpm --filter @nexvoy/core test`, `pnpm typecheck`, `pnpm build` 성공

## 롤백 방법

- update 전파/적용 배선을 제거하면 데이터 채널은 `TASK-021` 수준(ping/pong 증명)으로 되돌아가고,
  기존 backup pull/push 동기화에는 영향이 없다.

## 완료 조건

- 실제 여행 데이터가 두 Web 세션 간 P2P 데이터 채널로 동기화된다.
- P2P 실패/미가용 시 기존 Supabase backup pull/push로 조용히 폴백한다(사용자 데이터 손실 없음).
- Mobile 범위(opaque relay vs 후속 task 이관)가 문서에 명시되어 있다.
