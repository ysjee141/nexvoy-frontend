# TASK-027: Mobile Yjs Runtime Adapter

## 목적

`TASK-024`는 Web-to-Web 범위에서 WebRTC data channel로 Yjs update를 교환한다. Mobile은 `TASK-020`에서
확인한 RN 번들 제약 때문에 Yjs update를 직접 apply하지 않고 범위에서 제외했다.

이 task는 Mobile도 Web과 같은 `Yjs update`를 canonical CRDT wire/storage format으로 사용하도록
Mobile 전용 Yjs runtime adapter를 도입한다. 목표는 Web/Mobile/Mobile 간에 동일한 update format을
적용해 P2P fast path와 Supabase backup/restore의 데이터 모델을 분기시키지 않는 것이다.

## 아키텍처 결정

권장안은 **Option 1: RN에서 Yjs update를 직접 적용할 수 있는 runtime adapter를 만든다**이다.

이유:

- Web과 Mobile이 하나의 CRDT format(`Yjs update`)을 공유해야 long-term 데이터 모델이 단순하다.
- 별도 Mobile update format을 만들면 Web Yjs update와 Mobile format 사이 변환 계층이 생기고, 충돌/merge
  의미론을 두 번 유지해야 한다.
- Mobile을 계속 backup pull/push 전용으로 남기면 P2P optional fast path가 플랫폼별로 달라지고,
  Web-Mobile 협업 경험이 구조적으로 제한된다.

단, Yjs를 화면/Repository에 직접 흩뿌리지 않는다. Mobile platform adapter 내부에 다음 경계를 둔다.

```text
packages/core: Yjs update format/types/helper 계약
apps/web/lib/local-first: Web IndexedDB + Yjs runtime adapter
apps/mobile/lib/local-first: Mobile Yjs runtime adapter + local persistence adapter
```

## 범위

- RN dev client에서 `yjs`/`lib0` import 및 `Y.applyUpdate()` 실행 가능성 재검증
- Metro/Expo 번들에서 막히는 dependency(`isomorphic-webcrypto`, Node/Web crypto polyfill 등) 식별
- 필요한 polyfill 또는 Metro alias를 앱 platform boundary에만 추가
- `apps/mobile/lib/local-first/mobileYjsTripDocument.ts`(신규): Web의 `yjsTripDocument` helper와 같은
  계약을 제공하는 Mobile adapter
- Mobile local store에 Yjs encoded update 저장/로드 경로 추가 또는 기존 Mobile bootstrap/restore 경로와
  연결할 adapter 설계
- `connectMobileP2PPeer()`에서 TASK-024의 P2P update protocol message를 수신해 Mobile Yjs document에
  apply하는 경로 추가
- Web-Mobile, Mobile-Mobile에서 같은 document update가 적용되는지 수동 검증

## 제외

- 별도 Mobile-only CRDT/update format 설계
- Yjs update를 서버에서 해석하거나 변환하는 Edge Function 추가
- Product UI 연결 상태 표시(`TASK-025`)
- background/reconnect lifecycle hardening(`TASK-026`)

## 선행 조건

- `TASK-020-mobile-encrypted-snapshot-restore.md`
- `TASK-023-mobile-signaling-channel-wiring.md`
- `TASK-024-p2p-data-channel-yjs-update-exchange.md`

## 변경 대상

- `apps/mobile/lib/local-first/mobileYjsTripDocument.ts`(신규)
- `apps/mobile/lib/local-first/webP2PConnection.ts`
- `apps/mobile/lib/local-first/webRtcProvider.native.ts`
- `apps/mobile/metro.config.js` 또는 Expo config/polyfill entry(필요 시)
- `packages/core/src/local-first/yjsTripDocument.ts` (계약 정리가 필요할 경우만)
- `docs/refactor/tasks/README.md`
- 필요 시 ADR: Mobile Yjs runtime adapter 결정

## 구현 단계

1. RN dev client에서 `yjs` import, `new Y.Doc()`, `Y.applyUpdate()`, `Y.encodeStateAsUpdate()`가 가능한지
   최소 PoC를 만든다.
2. 실패하는 dependency를 분류한다.
   - 순수 JS polyfill/Metro alias로 해결 가능한 문제
   - RN native module이 필요한 문제
   - 현 구조에서 해결 불가능해 ADR 재검토가 필요한 문제
3. 해결 가능하면 Mobile adapter boundary 안에 polyfill/alias를 추가한다. `packages/core`에는 RN/Expo API를
   넣지 않는다.
4. `mobileYjsTripDocument.ts`를 추가해 Web helper와 같은 입력/출력 계약을 제공한다.
5. Mobile local persistence에 encoded Yjs update를 저장/로드한다.
6. `connectMobileP2PPeer()`가 TASK-024의 update protocol message를 수신하면 reassemble 후 Mobile Yjs
   document에 apply한다.
7. Mobile에서 생성한 local update도 같은 P2P protocol로 publish한다.

## 데이터 호환성 고려사항

- `Yjs update`가 Web/Mobile 공통 canonical format이다.
- Mobile이 별도 JSON patch format을 쓰면 안 된다.
- document content가 signaling metadata, analytics, push payload, logs에 노출되면 안 된다.
- P2P로 받은 update가 backup queue에 중복 업로드되지 않도록 origin 구분을 유지한다.

## 검증 방법

- RN dev client에서 `Y.applyUpdate()`/`Y.encodeStateAsUpdate()` smoke test 통과
- Web에서 생성한 Yjs update를 Mobile에서 apply한 뒤 materialized checklist가 동일한지 확인
- Mobile에서 생성한 Yjs update를 Web에서 apply한 뒤 materialized checklist가 동일한지 확인
- Web-Mobile P2P update exchange 수동 검증
- Mobile-Mobile P2P update exchange 수동 검증
- `pnpm --filter @nexvoy/core test`, `pnpm typecheck`, `pnpm build`, `pnpm build:mobile` 성공
- Android dev client 설치/실행 및 Logcat에서 runtime import error 없음

## 롤백 방법

Mobile Yjs adapter wiring을 feature flag 또는 platform adapter export에서 제거하면 Mobile은 TASK-023
수준의 signaling/data-channel handshake와 Supabase backup/restore fallback으로 복귀한다. Web-to-Web
TASK-024 경로는 유지된다.

## 완료 조건

- Web과 Mobile이 동일 Yjs update format을 apply할 수 있다.
- Web-Mobile, Mobile-Mobile 모두 data channel update exchange가 동작한다.
- Mobile fallback은 Supabase backup/restore로 유지된다.
- 해결 과정에서 필요한 polyfill/alias/native dependency 결정이 ADR 또는 task 결과에 기록되어 있다.
