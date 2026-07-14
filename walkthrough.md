# Walkthrough: TASK-034 P2P All-domain Wiring

## Summary

TASK-034는 P2P fast path를 체크리스트 화면 전용 연결에서 Trip document 전체 lifecycle 연결로 승격했다. Web은 Trip detail 상위에서 한 번만 P2P connection을 유지하고, Mobile은 reconnect/backoff/timeout 처리를 보강했다.

## Artifacts

- `docs/refactor/tasks/TASK-034-p2p-all-domain-wiring.md`
- GitHub Issue [#326](https://github.com/ysjee141/nexvoy-frontend/issues/326)
- PR [#327](https://github.com/ysjee141/nexvoy-frontend/pull/327)
- 브랜치: `feature/task-034-p2p-all-domain-wiring-326`
- `apps/web/lib/local-first/webP2PDocumentConnection.ts`
- `_workspace/01_planner_analysis.md`
- `_workspace/implementation_plan.md`

## Key Changes

- Web P2P hook을 document-level `useWebP2PDocumentConnection()`으로 일반화했다.
- 기존 `useWebP2PChecklistConnection()`은 compatibility re-export로 유지했다.
- `TripLayoutClient`에서 일정/준비물/지도 탭 전체에 걸쳐 P2P connection을 유지한다.
- `ChecklistClient`는 자체 P2P 연결을 만들지 않고 상위 status를 표시한다.
- `TripClient`는 remote P2P update apply 후 IndexedDB broadcast로 일정 read model을 refresh한다.
- Mobile Trip screen에 reconnect backoff, handshake timeout, connection state failure handling을 추가했다.
- P2P fallback 문구를 backup sync 기준으로 정리했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm --filter nexvoy-web build` 성공
- `pnpm --filter nexvoy-app lint` 성공
- `pnpm build:mobile` 성공

## Notes

- 신규 Supabase migration/API Route는 없다.
- P2P payload는 기존 Yjs update protocol을 유지한다.
- late join에서 놓친 update는 TASK-033 encrypted backup sync fallback이 담당한다.
- `pnpm build:mobile` 중 `react-native-webrtc`의 `event-target-shim` exports fallback 경고가 출력됐지만 export는 성공했다.

---

# Walkthrough: TASK-033 Backup Sync Productization

## Summary

TASK-033은 Web/Mobile document-primary mutation 결과를 Supabase encrypted backup update 경로에 연결했다. P2P가 없거나 앱/브라우저가 종료되어도 owner/editor 변경분은 로컬 pending queue에 남고, 다음 foreground/startup에서 document key가 준비되면 암호화된 update로 업로드된다.

## Artifacts

- `docs/refactor/tasks/TASK-033-backup-sync-productization.md`
- GitHub Issue [#324](https://github.com/ysjee141/nexvoy-frontend/issues/324)
- PR [#325](https://github.com/ysjee141/nexvoy-frontend/pull/325)
- 브랜치: `feature/task-033-backup-sync-productization-324`
- `packages/core/src/sync/backupQueue.ts`
- `apps/web/lib/local-first/backupSyncService.ts`
- `apps/mobile/lib/local-first/mobileBackupSyncService.ts`
- `apps/mobile/lib/local-first/mobileBackupQueueStore.ts`
- `_workspace/01_planner_analysis.md`
- `_workspace/implementation_plan.md`

## Key Changes

- core에 pending backup update 암호화 helper와 safe failure reason mapping을 추가했다.
- Web IndexedDB에 `backupQueues` store를 추가하고 Trip mutation 후 pending update를 durable하게 저장한다.
- Mobile AsyncStorage backup queue를 추가하고 Trip mutation 후 pending update를 durable하게 저장한다.
- Web/Mobile document-primary publisher에서 owner/editor 변경만 backup enqueue 대상으로 연결했다.
- Web visibility 복귀, Mobile foreground/provisioning 경로에서 pending queue flush를 실행한다.
- 실패 관측은 `local_first_backup_failed`에 generic reason code와 pending count만 남긴다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-web build` 성공
- `pnpm typecheck` 성공
- `pnpm build:mobile` 성공

## Notes

- 신규 Supabase migration/API Route는 없다.
- 이번 slice는 durable encrypted update upload/retry 제품 경로에 집중했다. full snapshot compaction worker와 remote pull/replay UX는 후속 통합 검증에서 이어서 보강한다.
- `pnpm build:mobile` 중 `react-native-webrtc`의 `event-target-shim` exports fallback 경고가 출력됐지만 export는 성공했다.

---

# Walkthrough: TASK-032 Mobile Full Document-primary Transition

## Summary

TASK-032는 Mobile의 trip detail, 준비물, 일정, 템플릿, collaborator member snapshot을 document-primary repository 경로로 전환했다. Mobile AsyncStorage 기반 Trip/Template document store를 추가했고, owner/editor 화면에서는 `connectMobileP2PPeer()`를 screen lifecycle과 AppState foreground/background에 연결했다.

## Artifacts

- `docs/refactor/tasks/TASK-032-mobile-full-document-primary-transition.md`
- GitHub Issue [#322](https://github.com/ysjee141/nexvoy-frontend/issues/322)
- 브랜치: `feature/task-032-mobile-full-document-primary-transition-322`
- `apps/mobile/lib/local-first/mobileDocumentStores.ts`
- `apps/mobile/lib/local-first/documentPrimaryRepositories.ts`
- `apps/mobile/lib/local-first/documentPrimaryAdapters.ts`
- `_workspace/01_planner_analysis.md`
- `_workspace/implementation_plan.md`

## Key Changes

- Mobile AsyncStorage Yjs update 저장소를 `LocalDocumentStore` contract로 감싸 Trip/Template document repository에 주입했다.
- Trip legacy row bundle과 checklist template rows를 최초 진입 시 document로 hydrate하는 Mobile bridge를 추가했다.
- Mobile trip detail의 trip/plans/checklist/member read path와 일정/준비물 mutations를 document-primary repository로 전환했다.
- Mobile template list/create/edit/delete/share management를 Template document repository 경유로 전환했다.
- collaborator role 변경/revoke 후 Trip document member snapshot을 upsert/revoke하도록 연결했다.
- trip screen에서 Mobile P2P connection을 자동 시도하고, background cleanup/foreground reconnect 및 상태 표시를 추가했다.

## Verification

- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm --filter nexvoy-app lint` 성공
- `pnpm build:mobile` 성공

## Notes

- 신규 Supabase migration/API Route는 없다.
- `pnpm build:mobile` 중 `react-native-webrtc`의 `event-target-shim` exports fallback 경고가 출력됐지만 export는 성공했다.
- Android preview APK 설치/Logcat smoke는 이번 세션에서 실행하지 못했다. TASK-035 full integration/mobile smoke에서 이어서 검증한다.

---

# Walkthrough: TASK-031 Web Full Document-primary Transition

## Summary

TASK-031은 Web의 일정, 준비물, 템플릿, 동행자/권한 UI를 document-primary repository 경로로 전환했다.
legacy Supabase row는 최초 hydrate/read-only fallback과 registry authority 작업에만 남겼다.

## Artifacts

- `docs/refactor/tasks/TASK-031-web-full-document-primary-transition.md`
- `apps/web/lib/local-first/webDocumentStores.ts`
- `apps/web/lib/local-first/documentPrimaryRepositories.ts`
- `apps/web/lib/local-first/documentPrimaryChecklistRepository.ts`
- `_workspace/01_planner_analysis.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- Web IndexedDB Yjs update 저장소를 `LocalDocumentStore` contract로 감싸 Trip/Template document repository에 주입했다.
- Trip legacy row bundle과 checklist template row/share/item을 최초 진입 시 document로 hydrate하는 bridge를 추가했다.
- 일정 목록/생성/수정/삭제/방문 상태/이미지 URL 복구를 Plan repository mutation으로 연결했다.
- 준비물 CRUD/toggle/template apply를 document-primary checklist repository 경유로 연결했다.
- 템플릿 목록/생성/수정/삭제/적용을 Template document repository로 전환했다.
- 동행자 registry 조회/role 변경/revoke 후 Trip document member snapshot을 upsert/revoke하도록 연결했다.
- mutation actor role을 호출부에서 주입해 viewer write 차단 정책이 유지되도록 했다.

## Verification

- `pnpm --filter nexvoy-web exec tsc --noEmit` 성공
- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공

## Notes

- 신규 Supabase migration/API Route는 없다.
- Mobile 화면 전환은 TASK-032 범위로 유지했다.
- Template share registry write는 기존 Supabase helper를 유지한다. document share snapshot productization은 후속 정리 대상이다.

---

# Walkthrough: TASK-030 Document-primary Repository Layer

## Summary

TASK-030은 Web/Mobile 화면 전환 전에 공유할 document-primary repository layer를 `@nexvoy/core`에 추가했다.
기존 legacy repository contract는 유지하면서, Trip/Plan/Checklist/Template/Member용 document-primary
contract와 순수 mutation writer를 병렬로 제공한다.

## Artifacts

- `docs/refactor/tasks/TASK-030-document-primary-repository-layer.md`
- `packages/core/src/local-first/templateDocument.ts`
- `packages/core/src/local-first/documentMutationWriter.ts`
- `packages/core/src/repositories/documentPrimaryRepository.ts`
- `packages/core/src/local-first/__tests__/templateDocument.test.ts`
- `packages/core/src/repositories/__tests__/documentPrimaryRepository.test.ts`
- `implementation_plan.md`
- `_workspace/01_planner_analysis.md`

## Key Changes

- `TemplateDocumentV1` boundary를 추가하고 Yjs update round-trip helper를 구현했다.
- `DocumentMutationResult`, `DocumentMutationPublisher`, `LocalDocumentStore` contract를 추가해 P2P publish와 backup enqueue 경계를 repository level로 고정했다.
- Trip document mutation writer를 추가했다: trip update/delete, plan create/update/delete/url, checklist/checklist item create/update/delete/toggle/template apply, member upsert/revoke.
- Template document mutation writer를 추가했다: template update/delete, item replace, share upsert/remove.
- `createDocumentPrimaryRepositoryBundle()`을 추가해 Web/Mobile adapter가 store/runtime만 주입하면 같은 repository contract를 사용할 수 있게 했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter @nexvoy/core typecheck` 성공

## SQL / Query Files

이번 TASK-030에서 새 Supabase migration/query 파일은 만들지 않았다. 실행해야 할 SQL 파일은 없다.

## Next

- `TASK-031-web-full-document-primary-transition.md`: Web 준비물/일정/템플릿/동행자 UI를 document-primary repository로 전환
- `TASK-032-mobile-full-document-primary-transition.md`: Mobile 동일 전환

---

# Walkthrough: TASK-029 Full Local-first Product Scope ADR

## Summary

TASK-029는 checklist pilot 이후의 작업 축을 전체 제품 document-primary 전환으로 확정했다. ADR-013에서
Web/Mobile의 준비물, 일정, 템플릿, 동행자 초대/수락/거부, 권한 변경, backup restore/sync, P2P fast path를
모두 Local-first 완료 범위로 정의했다.

## Artifacts

- `docs/refactor/tasks/TASK-029-full-local-first-product-scope-adr.md`
- `docs/refactor/adrs/ADR-013-full-local-first-product-scope.md`
- `docs/refactor/progress.md`
- `docs/refactor/TECHNICAL-SPEC.md`
- `_workspace/01_planner_analysis.md`

## Key Decisions

- `TripDocumentV1`은 trip-scoped 데이터의 root document로 유지한다.
- 개인/공유/공개 템플릿은 trip collaborator 범위와 다르므로 별도 `TemplateDocumentV1` boundary로 분리한다.
- 템플릿 적용은 Template document snapshot을 읽어 `TripDocumentV1` checklist item mutation으로 복사한다.
- Supabase row table은 장기 dual-write 대상이 아니라 migration source와 read-only rollback fallback으로 축소한다.
- 통합테스트와 Closed Beta는 일부 기능이 아니라 전체 핵심 기능이 document-primary 제품 경로에 올라간 뒤 진행한다.

## Verification

- `git diff --check` 성공
- 문서 변경만 수행했고 코드/DB migration/API 변경은 없다.

## Next

- `TASK-030-document-primary-repository-layer.md`: checklist/plans/templates/members 공통 document-primary repository 계약 도입

---

# Walkthrough: TASK-028 Rotating Room Secret Hardening

## Summary

TASK-028은 P2P signaling room topic을 deterministic `sha256(documentId)`에서 server-issued opaque topic으로 전환했다. 클라이언트는 `issue_document_signaling_room_topic` RPC로 active topic을 받은 뒤 Supabase Realtime private channel에 join하며, Realtime Authorization RLS는 active server-issued topic만 허용한다.

## Artifacts

- `docs/refactor/tasks/TASK-028-rotating-room-secret-hardening.md`
- `implementation_plan.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/02c_backend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- `supabase/migrations/20260714000001_task028_rotating_signaling_room_topics.sql`(신규): `document_signaling_room_topics` table, topic issuing RPC, active topic permission helpers, Realtime Authorization policy 교체.
- `packages/core/src/sync/signalingChannel.ts`: rotating topic derivation helper와 topic format validator 추가. legacy deterministic helper는 rollback/test compatibility를 위해 유지.
- `apps/web/lib/local-first/signalingChannel.ts`: deterministic topic derivation 대신 server-issued topic fetch 후 Realtime channel join.
- `apps/mobile/lib/local-first/signalingChannel.ts`: Web과 동일하게 RPC-issued topic을 사용하도록 변경.
- `docs/refactor/tasks/README.md`, `TASK-028`: TASK-028 완료 상태와 구현 결과 반영.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm --filter nexvoy-app lint` 성공. 기존 Mobile 파일 warning 7건은 이번 변경과 무관하다.
- `pnpm build:mobile` 성공

## Rollback

이번 PR을 되돌리면 TASK-025/026의 deterministic topic policy와 client derivation으로 복귀한다. 신규 topic table은 document content와 독립적이므로, rollback 시 사용 중지만으로 충분하다.

## Notes

- topic 원문은 RPC 응답과 Realtime join에만 사용하고 observability/UI/log에는 남기지 않는다.
- 만료 2분 이내에는 새 topic을 발급하고 기존 unexpired topic은 자연 만료까지 유지해 old/new overlap window를 제공한다.
- P2P late join/peer discovery 개선은 별도 후속 작업이다.

---

# Walkthrough: TASK-026 P2P Connection Lifecycle Hardening

## Summary

TASK-026은 Web 준비물 P2P fast path의 실사용 생명주기를 보강했다. 연결 실패/끊김/timeout 시 bounded exponential backoff로 재연결을 시도하고, 최대 재시도 초과 시 기존 방식 동기화 상태로 수렴한다. 브라우저 탭 종료/새로고침 및 React cleanup에서는 signaling channel, data channel, peer connection, retry timer를 정리한다.

Rotating room secret hardening은 signaling topic derivation, Supabase Realtime Authorization RLS, server-issued secret, Web/Mobile adapter migration이 함께 필요한 별도 migration이므로 TASK-028로 분리했다.

## Artifacts

- `docs/refactor/tasks/TASK-026-p2p-connection-lifecycle-hardening.md`
- `docs/refactor/tasks/TASK-028-rotating-room-secret-hardening.md`
- `implementation_plan.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- `packages/core/src/sync/p2pLifecycle.ts`(신규): platform-independent reconnect policy helper. max attempts, initial/max delay, multiplier normalization 및 delay 계산을 제공한다.
- `apps/web/lib/local-first/webP2PChecklistConnection.ts`: Web checklist P2P 연결에 reconnect/backoff, connection timeout 재시도, page lifecycle cleanup, reconnect observability event를 추가했다.
- `apps/web/lib/local-first/webP2PConnection.ts`: connection `close()`를 idempotent하게 만들어 중복 cleanup에서 부작용 없이 종료되도록 했다.
- `apps/mobile/lib/local-first/webP2PConnection.ts`: Mobile offer retry timer cleanup과 idempotent close를 보강하고, 연결 상태 조회 hook을 추가했다.
- `apps/mobile/lib/local-first/p2pLifecycle.native.ts`(신규): AppState background 진입 시 active P2P connection cleanup, foreground 복귀 시 reconnect callback을 호출할 수 있는 lifecycle binding을 추가했다.
- `packages/core/src/sync/iceServers.ts`, `packages/core/src/observability/events.ts`: `p2p_reconnect_scheduled`, `p2p_reconnect_attempted`, `p2p_reconnect_exhausted`, `p2p_lifecycle_cleanup` 이벤트를 추가했다.
- `docs/refactor/tasks/README.md`: TASK-026 완료 상태와 TASK-028 후속 작업을 반영했다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm --filter nexvoy-app lint` 성공. 기존 Mobile 파일 warning 7건은 이번 변경과 무관하다.
- `pnpm build:mobile` 성공

## Rollback

`useWebP2PChecklistConnection()`의 reconnect/lifecycle handling을 TASK-025 수준으로 되돌리고, 신규 `p2pLifecycle` helper와 Mobile lifecycle hook point를 제거하면 된다. 이번 PR은 signaling topic/RLS를 변경하지 않으므로 데이터 migration rollback은 필요 없다.

## Notes

- Rotating room secret은 TASK-028로 분리했다. 현재 PR은 deterministic signaling topic + Realtime Authorization RLS 모델을 유지한다.
- Mobile lifecycle hook은 아직 화면 자동 연결에 직접 wiring하지 않았다. Mobile P2P adapter 사용 지점이 생길 때 close/reconnect callback을 연결하는 boundary다.
- 일정 add/delete P2P는 아직 범위 밖이다.

---

# Walkthrough: TASK-025 P2P Connection Status UI

## Summary

TASK-025는 Web 준비물 화면에서 P2P fast path를 자동으로 시도하고, 사용자에게 연결 상태를 기술 용어 없이 표시하도록 배선했다. `NEXT_PUBLIC_LOCAL_FIRST_CHECKLIST_SPIKE=1` 또는 `NEXT_PUBLIC_LOCAL_FIRST_CHECKLIST_DUAL_WRITE=1` 모드에서 accepted owner/editor 계정은 준비물 화면 진입 시 P2P 연결을 시도한다. 실패하거나 대상이 아니면 기존 방식으로 동기화 중이라는 generic 상태로 수렴한다.

## Artifacts

- `docs/refactor/tasks/TASK-025-p2p-connection-status-ui.md`
- `implementation_plan.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/01b_ux_design.md`
- `_workspace/02a_ui_components.md`
- `_workspace/02b_frontend_changes.md`
- `_workspace/03_review_result.md`
- `_workspace/04_qa_result.md`

## Key Changes

- `apps/web/components/trips/P2PConnectionStatusBadge.tsx`(신규): 연결 중/연결됨/fallback 상태를 compact badge로 표시. `role="status"`/`aria-live="polite"` 적용.
- `apps/web/lib/local-first/webP2PChecklistConnection.ts`(신규): 준비물 화면 전용 P2P connection hook. owner/editor accepted 사용자만 연결 대상이며 writable member id 정렬로 initiator를 결정한다.
- `apps/web/app/trips/checklist/ChecklistClient.tsx`: local-first checklist spike/dual-write 모드에서 P2P 연결을 자동 시도하고, IndexedDB document update subscription을 dual-write에도 적용한다.
- `packages/core/src/repositories/dualWriteChecklistRepository.ts`: dual-write `getChecklist()`를 local document 우선으로 변경하고, 실패 시 mismatch report 후 legacy read로 fallback한다. 이 변경으로 P2P로 받은 Yjs update가 준비물 화면 read path에 반영된다.
- `docs/refactor/tasks/README.md`: TASK-025 완료 상태와 다음 권장 순서를 TASK-026으로 갱신.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공. 최초 실행은 hook type narrowing 오류로 실패했고 타입 가드 수정 후 통과.
- `pnpm build:mobile` 성공
- `pnpm --filter nexvoy-app lint` 성공. 기존 warning 7건은 이번 변경과 무관한 기존 Mobile 파일 경고.

## Rollback

준비물 화면의 `useWebP2PChecklistConnection()` 호출과 `P2PConnectionStatusBadge` 렌더링을 제거하면 UI/자동 연결 시도는 사라진다. P2P core/data-channel 구현과 Mobile TASK-027 adapter는 영향받지 않는다. dual-write read path 변경을 되돌리면 dual-write 화면은 다시 legacy read 기준으로 돌아가며, P2P remote update 실시간 화면 반영은 제한된다.

## Notes

- 같은 Supabase userId로 두 브라우저를 열면 현재 signaling 구현이 동일 `senderId` 메시지를 무시하므로 Web-to-Web P2P 연결 검증이 어렵다. 실검증은 서로 다른 accepted owner/editor 계정 2개로 수행해야 한다.
- viewer는 signaling answer를 보낼 수 없으므로 이번 자동 연결 대상에서 제외했다.
- reconnect/background/tab-close hardening은 TASK-026 범위다.
- 일정 add/delete P2P는 아직 범위 밖이다.

---

# Walkthrough: TASK-027 Mobile Yjs Runtime Adapter

## Summary

TASK-024에서 Web-to-Web으로만 교환하던 Yjs update fast path를 Mobile platform boundary까지 확장했다. Mobile은 별도 JSON/patch format을 만들지 않고 `@nexvoy/core/local-first/yjsTripDocument`의 canonical Yjs update helper를 `apps/mobile/lib/local-first/mobileYjsTripDocument.ts` 안에서만 감싼다. RN/Expo 의존성은 Mobile adapter에만 두고, `packages/core`에는 platform API를 추가하지 않았다.

## Artifacts

- `docs/refactor/tasks/TASK-027-mobile-yjs-runtime-adapter.md`
- `implementation_plan.md`
- `_workspace/01_planner_analysis.md`
- `_workspace/02b_frontend_changes.md`

## Key Changes

- `apps/mobile/lib/local-first/mobileYjsTripDocument.ts`(신규): Mobile Yjs runtime adapter. Web helper와 같은 create/read/write/apply/encode 계약을 제공하고 encoded Yjs update를 AsyncStorage에 저장/로드한다.
- `apps/mobile/lib/local-first/p2pUpdateBridge.ts`(신규): document별 active sender registry와 remote update apply bridge. P2P 실패는 optional fast path 특성대로 backup/restore fallback을 깨지 않는다.
- `apps/mobile/lib/local-first/webRtcProvider.native.ts`: 기존 ping/pong handshake 위에 TASK-024 `yjs-update`/`yjs-update-chunk` protocol parse/send를 추가했다.
- `apps/mobile/lib/local-first/webP2PConnection.ts`: `P2PUpdateReassembler`로 data channel update를 재조립한 뒤 Mobile Yjs store에 apply한다. sender unregister와 reassembler cleanup을 error/close 경로에 모두 배치했다.
- `apps/mobile/lib/local-first/documentBootstrapService.ts`: Mobile owner bootstrap snapshot plaintext를 JSON marker에서 Yjs encoded update로 변경하고, bootstrap 직후 local Yjs store에도 저장한다.
- `apps/mobile/lib/local-first/mobileSnapshotRestoreService.ts`: decrypt/hash 검증을 통과한 opaque snapshot plaintext를 Mobile Yjs store에 apply한다. raw error는 기존 generic restore failure 경로로만 매핑된다.
- `apps/mobile/package.json`: Metro dependency graph가 transitive workspace dependency에 기대지 않도록 `yjs`를 Mobile app dependency로 명시했다.
- `apps/mobile/metro.config.js`, `apps/mobile/lib/local-first/yjsWebcryptoShim.js`: `lib0`의 RN webcrypto import(`isomorphic-webcrypto/src/react-native`)를 기존 `react-native-quick-crypto` 기반 shim으로 해석해 native build dependency를 추가하지 않고 Metro export를 통과시켰다.

## Verification

- `pnpm --filter @nexvoy/core test` 성공
- `pnpm --filter nexvoy-app typecheck` 성공
- `pnpm typecheck` 성공
- `pnpm build` 성공
- `pnpm build:mobile` 성공. 최초 실행은 `lib0`가 `isomorphic-webcrypto/src/react-native`를 찾지 못해 실패했고, Metro exact alias + quick-crypto shim 추가 후 Web/iOS/Android export가 모두 통과했다.

## Rollback

`connectMobileP2PPeer()`의 update wiring과 `p2pUpdateBridge.ts` registration을 제거하면 Mobile은 TASK-023 수준의 signaling/data-channel handshake로 되돌아간다. `mobileYjsTripDocument.ts` persistence는 앱 내부 AsyncStorage key만 사용하므로 서버 데이터 정리는 필요 없다. Web-to-Web TASK-024 경로는 영향받지 않는다.

## Notes

- 실제 Web-Mobile/Mobile-Mobile data-channel 교환과 Android dev client Logcat 검증은 실기기/에뮬레이터가 필요하다. 이번 세션의 자동 검증은 Metro export build와 TypeScript/build 검증으로 수행했다.
- Mobile checklist 화면의 기존 Supabase row write path를 document-primary Yjs writer로 전환하는 작업은 이번 범위가 아니다. 이번 task는 runtime adapter, restore, P2P apply/publish boundary를 마련한다.

---

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
