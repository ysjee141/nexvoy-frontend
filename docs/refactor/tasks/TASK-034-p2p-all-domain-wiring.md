# TASK-034: P2P All-domain Wiring

## 목적

P2P를 준비물 전용 wiring에서 전체 document-primary mutation fast path로 일반화한다. 모든 핵심 기능 변경은
동시 접속 peer에게 WebRTC data channel로 빠르게 전파되어야 한다.

## 범위

- repository-level P2P publish/apply hook
- 준비물/일정/템플릿 적용/멤버 snapshot 변경의 P2P 전파
- Web/Web, Web/Mobile, Mobile/Mobile connection lifecycle
- late join/peer discovery 정책
- P2P status UX Web/Mobile 정리
- fallback sync 상태 UX

제외:

- backup sync queue 구현
- full integration suite 작성

## 선행 조건

- `TASK-030-document-primary-repository-layer.md`
- `TASK-031-web-full-document-primary-transition.md`
- `TASK-032-mobile-full-document-primary-transition.md`
- `TASK-033-backup-sync-productization.md`

## 변경 대상

- `packages/core/src/sync/p2pUpdateProtocol.ts`
- `apps/web/lib/local-first/webP2PConnection.ts`
- `apps/mobile/lib/local-first/webP2PConnection.ts`
- `apps/web/lib/local-first/p2pUpdateBridge.ts`
- `apps/mobile/lib/local-first/p2pUpdateBridge.ts`
- Web/Mobile P2P status UI

## 구현 단계

1. document repository mutation output을 P2P publish hook으로 일반화한다.
2. remote update apply 후 active read model 구독을 갱신한다.
3. Mobile 화면 lifecycle에 connection open/close/reconnect를 연결한다.
4. peer discovery 또는 late join reconnect 정책을 구현한다.
5. Web/Mobile status UI를 동일한 상태 모델로 정리한다.
6. P2P 실패 시 backup sync 상태로 수렴하도록 UX를 정리한다.

## 데이터 호환성 고려사항

- P2P payload는 Yjs update만 사용하고 document content를 signaling metadata에 넣지 않는다.
- viewer는 P2P send가 불가능해야 한다.
- role revoke 후 기존 active P2P sender가 정리되어야 한다.

## 검증 방법

- Web/Web 전체 domain mutation P2P smoke.
- Web/Mobile 전체 domain mutation P2P smoke.
- Mobile/Mobile 전체 domain mutation P2P smoke.
- late join 시 reconnect 또는 명시 fallback 정책 동작 확인.
- tab close/background/foreground cleanup 확인.

## 롤백 방법

- P2P publish hook을 비활성화하고 backup sync만 사용한다.

## 완료 조건

- 모든 핵심 document mutation이 P2P fast path로 전파된다.
- Web/Mobile 동시 접속 협업이 제품 기능으로 동작한다.
- P2P 실패가 데이터 손실이나 local write 실패로 이어지지 않는다.
