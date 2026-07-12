# Walkthrough: TASK-020 Mobile Encrypted Snapshot Restore

## Summary

`TASK-008`은 Web 기준 snapshot download → 복호화 → hash 검증 → Yjs updates replay 순서의 restore를 구현했지만, 이 restore 파이프라인 전체가 Yjs/lib0(`isomorphic-webcrypto` 의존)에 묶여 있어 React Native 번들에서 재사용할 수 없었다. TASK-020은 Yjs에 의존하지 않는 부분(snapshot 복호화, hash 검증)만 분리한 Mobile 전용 restore 경로를 구현하고, `TASK-019`의 owner bootstrap/provisioning 완료 흐름에 자동 재시도를 연결했다. updates replay(Web/Yjs 기반 최신 콘텐츠 반영)는 이번 범위에서 제외했다.

## Artifacts

- `docs/refactor/tasks/TASK-020-mobile-encrypted-snapshot-restore.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/01b_ux_design.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/02c_backend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_report.md`

## Key Changes

- `packages/core/src/sync/backupPayloadCodec.ts`(신규): `restore.ts`와 `documentBootstrapService.ts`가 중복 구현하던 base64/JSON envelope 직렬화 로직을 SSOT로 승격. Yjs/lib0 import 없음.
- `packages/core/src/sync/mobileRestore.ts`(신규): Yjs 비의존 `decryptRestoreSnapshot` — snapshot 복호화 + hash 검증만 수행하고 `document_updates`는 다루지 않는다. 복호화된 평문을 JSON.parse 시도해 `mobile_marker`(TASK-019 bootstrap이 만든 marker payload) vs `opaque`(Web/Yjs 인코딩) snapshot을 판별한다.
- `packages/core/src/sync/restore.ts`: 신규 codec 모듈을 재사용하도록 리팩터링(public API/동작 불변, `restore.test.ts` 그대로 통과).
- `apps/mobile/lib/local-first/mobileSnapshotRestoreService.ts`(신규): `restoreMobileEncryptedSnapshot()` — snapshot 존재 확인 → 이 device의 DEK 확보 → 복호화/hash 검증 → 성공 시 device-scoped RSA row가 없으면 `bootstrapMobileDeviceDocumentKey`(TASK-019) 호출. 모든 실패는 raw error 없이 generic reason code(`hash_mismatch`/`decrypt_failed`/`unknown`/`no_snapshot`/`key_unavailable`)로만 반환.
- `apps/mobile/lib/local-first/keyProvisioningService.ts`: `runMobileKeyProvisioning`에 restore 재시도 트리거 2곳 연결(owner bootstrap 직후, 다른 멤버 요청을 이번 실행에서 completed 처리한 직후). 두 트리거가 steady-state에서 중복 발화하던 문제(리뷰 M1)를 트리거 2 조건을 `result.completed > 0`으로 좁혀 해결 — 실행당 최대 1회만 restore 시도.
- `apps/mobile/app/trip/[id].tsx`: `mobileRestoreStatus` state(기존 `keyProvisioningMessage`와 완전히 분리)와 `CollaboratorSheet`의 신규 "이 기기 데이터 상태" 블록(owner+editor 모두, `canEditContent` 기준 노출) — 진행/성공(mobile_marker)/부분 성공(opaque, 콘텐츠 미반영)/실패 4가지 tone을 raw error 없이 generic copy로 표시.

## Verification

- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm --filter @nexvoy/core test`(`restore.test.ts` 포함 회귀) 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-app lint` 성공, 신규 코드에 대한 경고 없음(기존 warning 6건은 무관한 기존 라인)
- `pnpm build` 성공 (Web)
- `pnpm build:mobile` 성공 (Web/iOS/Android 3개 플랫폼 번들, Hermes bytecode에 신규 모듈 심볼/카피 포함 확인)
- `backupPayloadCodec.ts`/`mobileRestore.ts`에 Yjs/lib0 import 없음(소스/번들 양쪽 grep 확인)
- reviewer 최종 APPROVE (1회 REQUEST_CHANGES → M1 수정 후 재리뷰 APPROVE)
- qa-engineer 최종 PASS

## Rollback

Mobile restore 재시도 트리거(`keyProvisioningService.ts`의 두 지점)를 비활성화하고 기존 `owner_device_key_unavailable` pending UX로 되돌린다. `restoreMobileEncryptedSnapshot`은 읽기 전용(복호화+검증)이며 `document_key_provisioning_requests`나 서버 상태를 갱신하지 않으므로, 트리거만 끄면 부작용 없이 이전 동작으로 복귀한다.

## Notes

- raw DEK/KEK/private key/document content/CRDT blob은 로그/analytics/push/UI에 노출하지 않는다. restore 실패는 generic reason code로만 UX에 전달된다.
- `document_updates` replay(Web에서 편집된 최신 콘텐츠를 Mobile에 반영)는 이번 범위 밖이다 — opaque(Web/Yjs) snapshot은 decrypt+hash 검증까지만 성공하고 콘텐츠는 반영되지 않으며, UX는 이를 "복구 완료"와 구분되는 별도 카피("여정 데이터 확인이 끝났어요. 최신 내용은 곧 이 기기에도 반영돼요.")로 안내한다.
- Web First 원칙과의 긴장 관계는 TASK-019와 동일한 근거(Yjs/webcrypto의 RN 미지원)로 정당화된다고 reviewer가 판단했으나, `docs/adrs/`에 이 예외를 명시하는 ADR 추가는 비블로킹 권고 사항으로 남겼다.
- 실기기/에뮬레이터/Preview APK 기반 검증(editor 기기 restore 실측, hash mismatch UX, offline 재시도 무오염, progress 깜빡임 육안 확인)은 이번 세션 환경 제약으로 수행하지 못했다 — 후속 수동 검증 필요.
- 다음 권장 작업은 별도로 지정될 예정이다(예: Web/Yjs 기반 updates replay를 Mobile에 지원하는 후속 task).

---

# Walkthrough: WebRTC 동작 확인 조사 (2026-07-12)

## Summary

"지금 WebRTC가 실제로 잘 동작하는지 눈으로 보고 싶다"는 요청에서 시작한 조사. 코드베이스 확인 결과, 두 기기가 실제 P2P 연결을 맺어 데이터를 주고받는 흐름은 아직 배선되어 있지 않다. ADR-002에서 결정한 "optional fast path"의 하부 부품(ICE 설정 발급, 피어 커넥션 팩토리, 시그널링 권한 검증)만 존재하고, 실제 시그널링 채널/데이터 채널/소비처(consumer)는 없다. 사용자가 나중에 검증 방식을 선택해 진행할 수 있도록 현황과 옵션을 정리한다.

## Findings — 구현됨 (스캐폴딩만 존재)

| 파일 | 역할 |
|------|------|
| `supabase/functions/ice-servers/index.ts` | Cloudflare TURN/STUN 자격증명 발급 Edge Function. 인증된 사용자에게 ICE 서버 정보 반환. TURN 키 없거나 Cloudflare 요청 실패 시 STUN-only로 폴백 |
| `apps/web/lib/local-first/webRtcProvider.ts` | 웹용 `RTCPeerConnection` 생성 팩토리. `connectionstatechange` 관찰, direct/relay 판별, 관측 이벤트(`p2p_connected` 등) 발행 |
| `apps/mobile/lib/local-first/webRtcProvider.native.ts` | 모바일용 동일 역할 (react-native-webrtc 기반, ADR-002 Option B 채택) |
| `packages/core/src/sync/signalingPermissions.ts` | 시그널링 룸 join 가능 여부 판단하는 순수 권한 로직 (문서 멤버십/역할/룸 시크릿 검증) |
| `packages/core/src/sync/iceServers.ts` | ICE 서버 설정 타입/유틸 (TTL 클램핑, 포트 53 필터링, TURN 존재 여부 판별 등) |

## Findings — 빠짐 (아직 없음)

- **실제 시그널링 채널**: SDP offer/answer를 두 기기 간 주고받는 WebSocket/Supabase Realtime 로직 없음
- **데이터 채널**: `createDataChannel` / `ondatachannel` 사용 코드가 코드베이스 전체에 전혀 없음
- **Provider의 소비처(consumer)**: `createWebRtcProvider` / `createMobileWebRtcProvider`를 실제로 호출하는 곳이 코드베이스 어디에도 없음 (정의만 있고 미사용)
- **UI 트리거**: P2P 연결을 시작하는 화면/버튼/서비스 로직 없음

관련 TASK 문서: `docs/refactor/tasks/TASK-009-mobile-webrtc-native-feasibility.md`, `docs/refactor/tasks/TASK-010-cloudflare-ice-config.md`. 최근 완료분은 TASK-020이며, 시그널링/데이터채널을 다루는 TASK는 아직 없음.

## Options considered (검증 방식 — 사용자 선택 대기 중)

1. **ICE 서버 발급만 테스트** — `supabase/functions/ice-servers`를 로컬(`supabase functions serve`) 또는 배포본에 curl로 요청해 Cloudflare TURN 자격증명이 실제 발급되는지 확인. 연결 자체는 확인 불가하지만 가장 빠름.
2. **단발성 수동 P2P 테스트 스크립트 작성** — 브라우저 두 탭(또는 web+mobile)에서 `createWebRtcProvider`를 직접 호출하고 SDP offer/answer를 콘솔에서 수동 교환하는 임시 테스트 코드를 작성해 실제 `connected` 상태까지 확인.
3. **실제 시그널링+데이터채널 기능부터 구현** — `onvoy-develop` 파이프라인으로 시그널링 채널과 데이터 채널을 포함한 실제 P2P 동기화 기능을 새 TASK로 설계/구현.
4. **현재 유닛 테스트만 실행** — `iceServers.test.ts`, `signalingPermissions.test.ts` 등 기존 로직 테스트만 돌려서 회귀 여부만 확인 (실제 동작 확인은 아님).

## Notes

- 사용자가 나중에 위 옵션 중 하나를 선택해 진행할 예정. 재개 시 이 섹션을 참고해 옵션을 다시 확인할 것.
- 관련 ADR: ADR-002 (모바일 WebRTC는 Option B — EAS Build + react-native-webrtc, optional fast path).

---

# Walkthrough: TASK-021 Web Signaling Channel and Data Channel Handshake

## Summary

위 조사에서 이어진 작업. `TASK-009`/`TASK-010`이 만든 WebRTC 부품(peer connection factory, ICE config
발급, signaling 권한 로직)은 있었지만 실제로 두 기기를 연결하는 배선이 전혀 없었다. `ADR-012`로
시그널링 전송 계층을 Supabase Realtime Broadcast(private channel + Realtime Authorization)로 결정하고,
`TASK-021`에서 Web-to-Web 연결을 실제로 배선했다. Mobile 배선과 Yjs update 실제 교환은 범위 밖이며,
데이터 채널은 연결 증명(ping/pong handshake)까지만 다룬다. 토큰 사용량을 고려해 서브에이전트 없이
메인 세션에서 직접 구현했고, 각 파일 단위로 커밋을 쪼개 중간에 세션이 끊겨도 재개 가능하도록 했다.

## Artifacts

- `docs/refactor/adrs/ADR-012-p2p-signaling-transport-supabase-realtime-broadcast.md`
- `docs/refactor/tasks/TASK-021-web-signaling-channel-and-data-channel-handshake.md`
- GitHub Issue [#299](https://github.com/ysjee141/nexvoy-frontend/issues/299)
- 브랜치: `feature/task-021-web-signaling-channel-and-data-channel-handshake-299`

## Key Changes

- `supabase/migrations/20260712000001_task021_signaling_realtime_authorization.sql`(신규):
  `realtime.messages` Authorization RLS. accepted 멤버는 수신 가능, accepted owner/editor만 송신
  가능(viewer는 read-only). 기존 `public.document_registry_hash()`를 재사용해 room topic을
  `signaling:<sha256-hex(documentId)>`로 파생 — 별도 해시 함수를 새로 만들지 않았다.
- `packages/core/src/sync/signalingChannel.ts`(신규): offer/answer/ice-candidate 메시지 타입, 방어적
  파싱, `deriveSignalingRoomTopic()`. `encryption.ts`의 `BackupCryptoProvider`와 동일한 패턴으로
  `SubtleCrypto`를 주입받아 core 패키지에 플랫폼 API를 넣지 않는다. `index.ts`/`package.json`
  exports·test 스크립트에 등록.
- `apps/web/lib/local-first/signalingChannel.ts`(신규): Supabase Realtime Broadcast private channel에
  join. `validateSignalingJoinPolicy()`는 client-side fail-fast guard로만 쓰고(`decision.allowed`가
  false면 채널 구독 자체를 하지 않음), 실제 접근 통제 경계는 Realtime Authorization RLS.
- `apps/web/lib/local-first/webRtcProvider.ts`: `createHandshakeDataChannel()`/
  `wireHandshakeDataChannel()` 추가 — `{type, ts}` 고정 스키마의 ping/pong 왕복과
  `p2p_data_channel_open` 관측 이벤트.
- `apps/web/lib/local-first/webP2PConnection.ts`(신규): `connectWebP2PPeer()` — signaling channel과
  webRtcProvider를 잇는 최초의 실제 소비처. SDP offer/answer·ICE candidate 교환, initiator/answerer에
  따른 데이터 채널 배선, signaling 거부 시 `WebP2PSignalingDeniedError`로 명시적 실패, viewer는
  `isInitiator`가 잘못 전달돼도 offer를 보낼 수 없도록 이중 방어(client no-op + server RLS).
- `packages/core/src/sync/iceServers.ts`: `P2PObservabilityEventName`에 `p2p_signaling_joined`/
  `p2p_data_channel_open` 추가.

## Verification

- `pnpm --filter @nexvoy/core test` 성공 (signalingChannel.test.ts 신규 포함)
- `pnpm --filter @nexvoy/core typecheck`, `@nexvoy/types`, `@nexvoy/design-tokens` typecheck 성공
- `pnpm --filter nexvoy-app typecheck` 성공, `pnpm --filter nexvoy-app lint` 성공(기존 warning 7건은
  이번 변경과 무관한 기존 라인)
- `pnpm build` 성공 (Web, Next.js TypeScript 체크 포함)
- `pnpm build:mobile` 성공 (Web/iOS/Android 3개 플랫폼 번들)
- 커밋을 7개 단위(문서, RLS migration, core 모듈, Web 어댑터, data channel 배선, provider 조립,
  빌드 검증)로 쪼개 진행 — 각 커밋 시점에 typecheck/test 통과를 확인해 중간에 세션이 끊겨도 안전하게
  재개 가능한 상태를 유지했다.

## Rollback

- signaling channel 조립 지점(`webP2PConnection.ts`)을 호출하는 곳이 없으므로 파일을 되돌리거나
  제거해도 기존 기능에 영향이 없다.
- `20260712000001_task021_signaling_realtime_authorization.sql`을 되돌려도(RLS policy 제거) 기존
  `document_members` 기반 REST/RPC 권한 검증에는 영향이 없다.
- 신규 코드는 모두 미사용 상태(진입점 없음)이므로 롤백 시 별도 데이터 정리가 필요 없다.

## Notes

- **실기기/실브라우저 검증 미수행**: 같은 문서의 accepted 상태 두 브라우저 세션으로 실제
  `RTCPeerConnection.connectionState === 'connected'` 도달과 ping/pong 왕복을 눈으로 확인하는 절차
  (TASK-021 검증 방법의 항목 7)는 이번 세션에서 수행하지 못했다. 로컬 Supabase 스택 기동(Realtime
  Authorization 포함)과 두 세션 수동 테스트가 필요하며, 자동화된 typecheck/test/build만으로는 실제
  네트워크 연결 성공을 보장하지 않는다.
- `connectWebP2PPeer()`를 호출하는 UI 진입점은 이번 TASK 범위에 없다. 수동 검증 시 임시 트리거
  코드나 최소 테스트 페이지가 필요하다.
- signaling broadcast payload와 데이터 채널 handshake payload에는 document content나 CRDT 데이터를
  담지 않는다(고정 스키마만 사용).
- Yjs update를 데이터 채널로 실제 교환하는 것과 Mobile 시그널링 배선은 명시적으로 범위 밖이며 후속
  TASK로 이관되어 있다.

---

# Walkthrough: TASK-022 Document Registry Bootstrap for Regular Trips

## Summary

TASK-021 수동 검증 준비 중 일반 로그인 사용자가 만든 trip이 `public.documents`와
`public.document_members`에 등록되지 않는 선결 문제를 확인했다. 초대 링크와 P2P signaling은
`document_id`가 `documents(id)`를 참조하므로, 일반 Web 계정 trip도 checklist read/write 진입 시 lazy하게
document registry를 보장하도록 TASK-022를 구현했다.

## Artifacts

- `docs/refactor/tasks/TASK-022-document-registry-bootstrap-for-regular-trips.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/01b_ux_design.md`
- `_workspace/02a_ui_components.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/02c_backend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- `packages/core/src/local-first/documentRegistryBootstrap.ts`(신규): owner 접근만 registry bootstrap을 허용하는 순수 판별 함수 추가.
- `packages/core/src/local-first/__tests__/documentRegistryBootstrap.test.ts`(신규): owner, non-owner, guest 판별 테스트 추가.
- `packages/core/src/supabase/backupRepository.ts`: `ensureDocumentBootstrapped()` 추가. `documents`는 `ignoreDuplicates: true`로 insert-only 보장 후 기존 `upsertOwnerMember()`를 재사용한다.
- `apps/web/lib/local-first/checklistDocumentWriter.ts`: checklist read/write 양쪽에서 owner 접근 시 document registry bootstrap을 시도한다. 실패는 catch로 격리해 기존 legacy row 기반 checklist 동작을 깨지 않는다.
- `docs/refactor/tasks/README.md`: TASK-022 상태를 완료로 갱신하고 다음 권장 순서를 TASK-023부터로 조정했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공. 최초 sandbox 실행은 `tsx` IPC pipe 권한 문제로 실패했고, 승인된 환경에서 동일 명령을 재실행해 통과 확인.
- `pnpm typecheck` 성공.
- `pnpm build` 성공. 최초 sandbox 실행은 `apps/web/.next` 쓰기 권한 문제로 실패했고, 승인된 환경에서 동일 명령을 재실행해 통과 확인.
- `pnpm build:mobile` 성공.
- 자체 코드 리뷰 결과 APPROVE, QA 결과 PASS.

## Rollback

`checklistDocumentWriter.ts`의 bootstrap 호출과 `SupabaseBackupRepository.ensureDocumentBootstrapped()`를 되돌리면 기존 checklist dual-write/legacy 흐름으로 복귀한다. DB schema 변경은 없으므로 migration rollback은 필요 없다.

## Notes

- 이번 작업은 Web local-first adapter 배선이다. Mobile은 TASK-019 owner bootstrap 경로를 유지한다.
- 실제 Supabase row 생성 E2E 수동 확인은 dual-write 모드와 로컬/개발 Supabase 인스턴스가 필요하다. 이번 세션에서는 코드 레벨 통합 정합성과 빌드 검증까지 완료했다.
- 다음 권장 작업은 TASK-023 Mobile signaling channel wiring이다.

---

# Walkthrough: TASK-023 Mobile Signaling Channel Wiring

## Summary

TASK-021에서 Web-to-Web으로만 증명했던 Supabase Realtime signaling channel과 WebRTC data-channel handshake를 Mobile까지 확장했다. Mobile은 Web과 같은 `@nexvoy/core/sync/signalingChannel` 메시지 타입과 `signaling:<sha256(documentId)>` room topic 규칙을 재사용한다. Yjs update 실제 교환, 사용자 UI, background/reconnect lifecycle은 후속 TASK-024~026 범위로 유지한다.

## Artifacts

- `docs/refactor/tasks/TASK-023-mobile-signaling-channel-wiring.md`
- GitHub Issue [#303](https://github.com/ysjee141/nexvoy-frontend/issues/303)
- 브랜치: `feature/task-023-mobile-signaling-channel-wiring-303`
- `_workspace/01_planner_analysis.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- `apps/mobile/lib/local-first/signalingChannel.ts`(신규): RN Supabase client로 private Realtime Broadcast channel에 join. `validateSignalingJoinPolicy()`는 Web과 동일하게 client-side fail-fast guard로만 사용하고, 접근 경계는 TASK-021 Realtime Authorization RLS에 둔다.
- `mobileSignalingDigestProvider`: `react-native-quick-crypto`의 `subtle.digest()`를 `SignalingRoomDigestProvider` 형태로 감싸 core의 `deriveSignalingRoomTopic()`을 그대로 재사용한다.
- `apps/mobile/lib/local-first/webRtcProvider.native.ts`: `createMobileHandshakeDataChannel()` / `wireMobileHandshakeDataChannel()` 추가. `{type, ts}` 고정 스키마의 ping/pong만 전송하며 document content나 CRDT update는 보내지 않는다.
- `apps/mobile/lib/local-first/webP2PConnection.ts`(신규): `connectMobileP2PPeer()`로 ICE config, mobile WebRTC provider, mobile signaling channel을 조립해 offer/answer/ICE candidate를 교환한다. signaling join 이후 peer connection 생성 실패 시 channel/provider cleanup을 수행한다.
- `packages/core/src/sync/__tests__/signalingChannel.test.ts`: RN-shaped digest provider도 Web/server와 같은 room topic을 산출하는지 검증을 추가했다.
- `docs/refactor/tasks/README.md`: TASK-023 상태를 완료로 갱신하고 다음 권장 순서를 TASK-024부터로 조정했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-app lint` 성공(기존 warning 7건 유지, 신규 warning 없음)
- `pnpm --filter nexvoy-app build` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공

## Rollback

신규 조립 지점(`webP2PConnection.ts`)은 아직 UI에서 호출하지 않으므로 파일 제거 또는 import 차단만으로 기존 기능 영향 없이 비활성화할 수 있다. DB schema 변경은 없고, TASK-021의 signaling RLS도 변경하지 않았다.

## Notes

- 실제 Web-Mobile, Mobile-Mobile 연결 수동 검증은 dev client와 두 세션/두 기기 환경이 필요해 이번 세션에서는 수행하지 못했다. 자동 검증은 room topic 계약, 타입/빌드 정합성, payload 제한을 확인하는 수준이다.
- Mobile background 전환 시 연결 유지/정리와 reconnect 정책은 TASK-026 범위로 유지한다.

---

# Walkthrough: TASK-024 P2P Data Channel Yjs Update Exchange

## Summary

TASK-021/023에서 데이터 채널 open과 ping/pong만 증명했던 P2P fast path를 Web-to-Web Yjs update 교환까지 확장했다. Local checklist mutation 후 encoded Yjs update를 active WebRTC data channel로 publish하고, remote peer는 chunked update를 재조립해 IndexedDB local document update에 적용한다. Mobile은 TASK-020의 Yjs/lib0 RN 번들 제약 때문에 이번 task에서 update payload 적용 범위에서 제외했다.

## Artifacts

- `docs/refactor/tasks/TASK-024-p2p-data-channel-yjs-update-exchange.md`
- GitHub Issue [#305](https://github.com/ysjee141/nexvoy-frontend/issues/305)
- 브랜치: `feature/task-024-p2p-data-channel-yjs-update-exchange-305`
- `implementation_plan.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- `packages/core/src/sync/p2pUpdateProtocol.ts`(신규): platform API 없는 Yjs update data-channel protocol. 단일 update와 chunked update, base64 payload, `P2PUpdateReassembler`를 제공한다.
- `packages/core/src/sync/__tests__/p2pUpdateProtocol.test.ts`(신규): single update, out-of-order chunk reassembly, invalid/tampered payload rejection 검증.
- `apps/web/lib/local-first/webRtcProvider.ts`: 기존 ping/pong data channel에 update protocol message parsing과 `sendP2PUpdateOverDataChannel()` 추가.
- `apps/web/lib/local-first/webP2PConnection.ts`: data channel attach 시 active update sender 등록, remote update reassembly/apply, connect 실패 cleanup, `sendUpdate()` 노출.
- `apps/web/lib/local-first/p2pUpdateBridge.ts`(신규): active sender registry, local update publish, remote update IndexedDB apply.
- `apps/web/lib/local-first/checklistDocumentWriter.ts`, `localFirstChecklistRepository.ts`: local mutation 저장 후 encoded Yjs update를 active P2P sender로 publish.
- `docs/refactor/tasks/README.md`: TASK-024 완료 및 다음 권장 순서를 TASK-025부터로 갱신.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm typecheck` 성공
- `pnpm --filter nexvoy-web build` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공
- `pnpm --filter nexvoy-app lint` 성공(기존 warning 7건 유지)

## Rollback

`p2pUpdateBridge` publish/apply wiring과 `webP2PConnection.ts`의 update callback/sender registration을 제거하면 TASK-021/023 수준의 signaling + ping/pong handshake로 되돌아간다. DB schema 변경은 없으며 기존 Supabase backup pull/push 경로에는 영향이 없다.

## Notes

- 실제 두 Web 세션에서 checklist update가 data channel로 반영되는 수동 검증은 accepted member 2세션과 dev harness/후속 UI가 필요해 이번 세션에서는 자동 검증까지만 수행했다.
- remote P2P update 적용은 IndexedDB 저장만 수행하고 Supabase backup upload를 직접 호출하지 않는다. 연결이 없거나 data channel send가 실패하면 기존 backup sync가 fallback이다.
- P2P update payload는 document content를 포함하므로 logs/analytics에는 원문을 남기지 않는다. 관측은 기존 연결/ICE 이벤트 수준으로 제한했다.
