# Data Architecture Refactor Progress

작성일: 2026-08-01
기준 브랜치: `refactoring/local-first-architecture`  
현재 목표: **Supabase normalized row authority + account-scoped local cache + durable outbox + Realtime invalidation으로 Web/Mobile 전체 기능을 전환하고 Initial Production gate를 통과한다.**

## 2026-08-05 TASK-062 초기 출시 비차단 전환

- 초기 운영 규모와 비용 우선순위를 재평가해 TASK-062 격리 복구 rehearsal을 보류했다.
- 초기 Web·Android 출시는 TASK-061 7일 관측 통과 후 TASK-063으로 진행한다.
- 초기 운영 기간에는 DB·Storage 복구 미보장 위험을 명시적으로 수용한다.
- Supabase Pro 전환 시 managed DB backup을 실제 복구 원본으로 확인하고 TASK-062를 재개한다.
- Storage object byte는 DB backup과 별개이므로 Pro 전환 시 자산 중요도와 별도 보관 필요성을
  재평가한다.

## 2026-08-01 TASK-060 완료 및 TASK-061/062 착수

- Android 실제 기기에서 Web/Web, Web/Android, Android/Android의 여행·일정·준비물·템플릿·초대,
  권한, asset과 offline/reconnect Gate를 통과했다.
- PR #381의 Mobile 수신 초대 수락·거절과 오프라인 준비물 저장을 실제 기기에서 재검증했다.
- TASK-060을 `PASS`, 마스터 계획 `G3`를 `GO`로 변경했다.
- TASK-061 Issue #382와 TASK-062 Issue #383을 등록했다.
- 7일 일별 증적·임계치 validator와 DEV→Recovery checksum/digest 비교 도구를 준비한다.
- `G4` 7일 관측과 `G6` Production preflight가 남아 Web·Android Production은 `NO-GO`다. `G5`는
  2026-08-05 결정으로 초기 출시 비차단 보류 상태다.

## 2026-07-29 Android 우선 출시 결정

- 초기 Production 지원 범위를 Web·Android로 확정했다.
- TASK-060은 Web/Web, Web/Android, Android/Android 실제 기기 Gate만 출시 차단 조건으로 사용한다.
- TASK-061의 7일 안정성·비용 관측과 TASK-062 복구 smoke도 Web·Android release candidate를
  기준으로 수행한다.
- TASK-063은 Web·Android Production preflight와 Android 내부→5%→25%→100% rollout을 담당한다.
- iOS typecheck, export, simulator launch는 비차단 회귀 검사로 유지한다.
- iOS 실기기, OAuth·push·lifecycle, TestFlight/App Store 검증과 출시는 TASK-064로 이관했다.

## 2026-07-28 TASK-060 Simulator PREPASS

- Android preview APK와 iOS simulator release archive를 로컬 EAS로 빌드했다.
- Android 두 대에서 동일 owner의 여행 생성, 일정·장소 사진 저장, 새 설치 복구를 확인했다.
- DEV canonical revision 3, UUID v4 plan ID, 240/800 asset metadata와 사진 URL 수렴을 확인했다.
- React Native의 비표준 fallback ID가 PostgreSQL UUID command를 거부하던 결함을 공통 secure UUID
  생성기로 수정했다.
- plan command가 canonical row가 되기 전에 Storage upload가 실행되던 race를 명시적 outbox flush로
  수정했다.
- iOS release app은 두 simulator에서 설치·실행됐으나 기능·권한 전체 매트릭스는 미실행이다.
- Android 실제 기기가 없어 TASK-060은 진행 중이며 Android Production 판정은 `NO-GO`를 유지한다.
- iOS 실기기 미검증은 TASK-064 후속 범위이며 Android 출시 차단 항목에서 제외한다.

## 2026-07-27 TASK-059 완료

- 12개 migration version의 185개 function/table/constraint/index/policy/trigger/RLS/grant fingerprint를
  재현 가능한 manifest와 Node 도구로 고정했다.
- DEV history 미등록 10건의 객체를 확인했으며, 67개 최종 차이는 TASK-058 asset policy와 TASK-059
  identity/grant hardening으로 모두 설명된다.
- authority internal 함수의 accidental Data API EXECUTE를 service role로 제한하고 공개 제품 RPC를
  authenticated allowlist로 재구성했다.
- authority helper와 Realtime topic helper는 전달된 user ID가 `auth.uid()`와 다르면 false를 반환한다.
- service role 없는 DEV 스모크에 owner/editor/viewer/outsider, 초대, 멱등성, role/revoke, revision,
  anonymous 차단과 cleanup을 포함했다.
- `pnpm test:production:p0`의 Playwright 23건, 전체 SQL, typecheck, package/Web/Mobile build,
  Mobile lint를 통과했다.
- Production은 처음에는 읽기 전용으로 감사한 뒤 사용자 추가 승인에 따라 기존 원격 history를
  보존하는 target-only 방식으로 TASK-058/059를 적용했다.
- 사용자 승인 후 DEV historical history 10건을 객체 재실행 없이 repair하고, dry-run에 남은
  TASK-058/059만 forward migration으로 적용했다.
- DEV 적용 후 migration drift는 0이고 `public,realtime,storage` strict fingerprint는 12/12 version,
  185/185 객체가 일치한다.
- DEV 임시 Auth 계정 네 개로 service-role 없는 authenticated remote-safe smoke를 실행해 초대,
  editor write·멱등성, viewer/outsider/anonymous 차단, role 하향·revoke와 revision을 검증했다.
- QA 여행은 soft-delete됐고 임시 Auth 계정은 4/4 삭제됐다. 다음 단계는 TASK-060 Web·Mobile
  실기기 통합 검증이다.
- Production target-only dry-run은 0건이고 fingerprint는 183/185다. 남은 두 checklist
  nullability 차이, historical ledger gap, 원격 전용 history 4건과 rollout은 TASK-063 입력으로
  유지한다.

## 2026-07-23 TASK-058 완료

- `NEW-A01`~`NEW-A13`을 초대, 권한 전이/revoke, 계정 격리, 템플릿, asset, 충돌 재적용,
  stale sending, SQL 우회 차단, Web/Mobile path 계약 자동 테스트로 구현했다.
- role 변경 Realtime invalidation이 활성 일정 화면의 `userRole` state를 갱신하지 않던 결함을 수정했다.
- 기존 E2E의 legacy direct trip fixture를 authority command seed로 교체했다.
- 장소 사진 hash를 Core SHA-256 구현으로 통일하고 Web/React Native Node crypto 차이를 제거했다.
- Storage write는 owner/editor, 활성 plan, canonical path를 확인하며 revoke 후 asset metadata 접근을
  차단한다. 장소 사진 byte는 public provider cache 분류를 유지한다.
- `pnpm test:production:p0` 단일 명령으로 Core, Web/Mobile store, SQL 7개, 전체 Playwright를
  로컬 Supabase에서 실행하도록 CI를 구성했다.
- PR [#375](https://github.com/ysjee141/nexvoy-frontend/pull/375)의 Quality, E2E, Vercel 검증이
  동일 release SHA에서 모두 PASS했다.
- 신규 forward migration의 DEV/Production 적용과 history 관리는 TASK-059에서 수행한다.

## 2026-07-23 TASK-057 Migration 판정 정정

- Issue #372에서 SQL 객체 적용과 `supabase_migrations.schema_migrations` history 등록을 분리했다.
- DEV는 historical version 9건과 TASK-056이 history에 없지만 TASK-055/056 핵심 객체는 확인됐다.
- Production도 TASK-055/056 핵심 객체가 확인됐으나 로컬 version 대부분이 미등록이고 원격 전용
  version 4건과 `public` schema 차이가 존재한다.
- 양쪽 환경의 일부 `SECURITY DEFINER` authority helper·wrapper에 예상 밖 `anon` 실행 grant가 확인돼
  TASK-059 grant hardening과 익명 호출 회귀 테스트로 분리했다.
- TASK-055/056 원본 SQL 재실행을 금지하고 전체 fingerprint가 일치하는 version만 하나씩 repair한다.
- TASK-059는 신규 원격 적용이 아니라 DEV object/history 정합화와 Production 감사 입력 작성으로 정정했다.

## 2026-07-23 TASK-057 Production 최종 검증 문서화 완료

- TASK-056의 남은 차단 항목을 `G0`~`G7`과 `B-01`~`B-11`로 재구성했다.
- 현재 자동화와 초대·role/revoke·계정 격리·템플릿·asset의 P0 자동화 공백을 구분했다.
- Web/Web, Web/Mobile, Mobile/Mobile과 동일 계정 새 기기의 필수 플랫폼 매트릭스를 정의했다.
- 인증, 전체 도메인 CRUD, 초대·권한, offline·Realtime·충돌, asset, Mobile lifecycle의 수동 케이스와
  정량 합격 기준을 작성했다.
- Local 전용 service-role E2E와 DEV authenticated smoke의 실행 경계를 분리했다.
- DEV migration ledger, 7일 관측, DB+Storage 복구, Production preflight, 단계적 rollout과 증적 Runbook을 작성했다.
- TASK-056 비용·Go/No-Go·rollout 문서와 `docs/production-readiness.md`를 현재 authority-only 기준의 한글 문서로 정리했다.
- asset cleanup scheduler·secret, Web/Mobile path 일치, thumbnail network 확인을 별도 차단 항목으로 승격했다.
- 실행 범위를 `TASK-058` 자동화, `TASK-059` DEV migration, `TASK-060` 실기기, `TASK-061` 관측,
  `TASK-062` 복구, `TASK-063` Production 출시로 분리했다.
- 현재 상태는 코드 Gate PASS, DEV/Production NO-GO다. 다음 단계는 `TASK-058`이다.

## 2026-07-17 아키텍처 재결정

`PRODUCT-DATA-TRANSPORT-COST-EVALUATION.md`의 권장 결정을 승인하고 `ADR-015`를 채택했다.

- Supabase normalized row를 committed data의 최종 권위로 둔다.
- Web IndexedDB와 Mobile SQLite는 빠른 조회, optimistic edit, offline outbox를 담당한다.
- remote write는 authenticated batch RPC, live update는 작은 Realtime invalidation을 사용한다.
- WebRTC/P2P, Yjs, app-layer E2EE, encrypted document backup은 목표 구조에서 제거한다.
- 현재 V1 document/backup은 자동 migration하지 않고 신규 경로 검증 후 reset한다.
- 최종 검증 기준은 Closed Beta 전용이 아니라 Initial Production 데이터 정합성과 비용 gate다.

신규 실행 계획은 `TASK-046`~`TASK-056`이다. 아래 TASK-001~045 내용은 이전 Local-first 시도의 구현
이력으로 유지하며 신규 설계 지침으로 사용하지 않는다.

## 2026-07-23 TASK-055 구현 완료

- Web/Mobile/Core에서 Yjs, WebRTC/P2P, signaling, app-layer encryption, document update backup,
  device/document key provisioning 런타임과 dependency를 제거했다.
- Web과 Mobile 제품 경로는 authority-only repository, 계정별 cache/outbox, canonical RPC,
  Realtime revision recovery만 사용한다.
- 웹의 별도 downloaded-trip bundle/offline mode를 제거하고 일반 제품 화면이 authority cache와
  outbox를 온라인/오프라인에서 동일하게 사용하도록 단일화했다.
- V1 local storage reset은 현재 Web authority IndexedDB/Mobile SQLite를 건드리지 않고 명시된
  legacy namespace만 멱등적으로 삭제한다.
- Supabase migration은 legacy API-role 접근을 revoke하되 object/data는 rollback window 동안
  보존한다. DEV V1 reset은 project-ID guarded maintenance script로 분리했다.
- 현재 명세와 rollout/rollback 순서를 `TECHNICAL-SPEC.md`와 TASK-055 runbook에 반영했다.
- 다음 작업은 Web/Mobile/다중 계정 정합성과 비용, Production 물리 cleanup을 판정하는
  `TASK-056` Production gate다.

## 2026-07-23 TASK-056 구현 완료 / 운영 gate 대기

- entity version 기반 stale rebase로 서로 다른 entity 동시 편집은 수렴시키고 동일 entity는
  사용자 선택이 필요한 충돌로 분리했다.
- Web/Mobile 충돌 해결 UI와 IndexedDB/SQLite 재기준화 transaction을 구현하고 자동 검증했다.
- queue age, payload bytes, RPC latency, conflict/retry/reject, revision gap, full refresh를
  식별자 없는 GA4/Firebase event로 연결했다.
- 여행/템플릿 SQL gate, Web 실제 동시 충돌 E2E, protocol budget test를 통과했다.
- Initial Production 비용 baseline과 rollout/rollback/DB+Storage restore runbook을 작성했다.
- 코드 gate는 PASS다. DEV migration ledger repair, 실기기 matrix, 7일 관찰, restore rehearsal이
  남아 DEV/Production과 legacy 물리 삭제는 NO-GO다.

## 2026-07-17 TASK-046~049 완료

- 정규화 행에 version/tombstone metadata를 추가하고 `apply_trip_commands` / `apply_template_commands`를 authority write 경계로 만들었다.
- 신규 authority state가 없는 기존 행은 신규 summary/bundle에서 제외한다.
- Core가 command, canonical ack, conflict, outbox, retry, revision reconciliation을 플랫폼 독립 계약으로 제공한다.
- Web은 별도 `onvoy-server-authority` IndexedDB에서 account-scoped cache와 outbox를 원자적으로 관리한다.
- Realtime은 private resource topic에 1KB 미만 invalidation만 보낸다. 연속 revision은 entity RPC, gap/reconnect는 full bundle로 복구한다.
- 이번 단계는 기반 구현이다. 현재 Web 제품 화면은 TASK-050에서 이 repository와 sync session으로 전환한다.

## 2026-07-17 TASK-050 구현 완료

- Web 여행, 일정, 준비물, 템플릿과 프로필 파생 조회를 server-authority repository로 전환했다.
- IndexedDB canonical cache와 optimistic projection을 분리하고 local mutation과 outbox append를 원자 처리한다.
- online/foreground/retry flush와 Realtime revision invalidation으로 다른 Web 계정의 화면을 canonical row에 수렴시킨다.
- 제품 경로에서 Yjs update, WebRTC signaling, document key, encrypted backup 호출을 제거했다.
- 상세 화면은 오프라인 저장, 저장 대기, 동기화 완료, 충돌, 저장 오류를 구분해 표시한다.
- 기능 플래그로 document-primary 경로를 롤백 경로로 유지한다. 실제 legacy runtime 삭제는 TASK-055 범위다.
- 단위 테스트, typecheck, Web/Mobile build와 Playwright discovery는 통과했다. 다중 사용자 E2E 실제 실행은 로컬 Supabase 환경이 필요하다.

## 2026-07-17 TASK-051 구현 완료

- Mobile에 account/resource-scoped SQLite v1 schema와 WAL 기반 transaction adapter를 추가했다.
- optimistic resource 갱신과 outbox append, canonical ack/rebase, retry/conflict, guest promotion을 원자 처리한다.
- 로그인, foreground, network reconnect, retry timer, OS background opportunity에서 공통 authority coordinator를 flush한다.
- 로그아웃은 account cache를 보존하고 계정 전환은 namespace로 격리한다. withdrawal/revoke는 account/resource를 purge한다.
- private Realtime invalidation과 revision gap recovery adapter를 준비했다. 상세 화면 구독과 제품 repository 전환은 TASK-052 범위다.
- authority 단위 테스트, 전체 typecheck, Web build, 전 플랫폼 Expo export와 Android development build가 통과했다.

## 2026-07-17 TASK-052 구현 완료

- Web 제품 repository의 platform-independent 명령/조회 로직을 Core로 옮기고 Web과 Mobile이 같은 계약을 사용하도록 통합했다.
- Mobile 여행, 일정, 준비물, 템플릿과 프로필 파생 조회를 SQLite cache와 durable outbox 기반 repository로 전환했다.
- 목록 foreground/reconnect refresh와 상세 Realtime invalidation/revision recovery를 화면 lifecycle에 연결했다.
- 신규 resource의 server ack 전 초대·이미지 업로드를 제한하고 offline/pending/synced/conflict/error 상태를 표시한다.
- authority mode에서 legacy document key, encrypted backup, WebRTC/P2P runtime 실행을 차단했다.
- Core/Mobile 단위 테스트, 전체 typecheck, lint, Web build, 전 플랫폼 Expo export와 Android native build를 검증했다.
- 실제 기기의 비행기 모드, 계정 전환, Web/Mobile 교차 동기화는 TASK-052 smoke runbook으로 최종 확인한다.

2026-07-16 초대 흐름 재점검:

- 이메일 초대와 기존 로그인 후 Accept UI가 서로 다른 registry를 사용하고 있음을 확인했다.
- 초대 수락 membership은 성공하지만 owner/editor key delivery가 자동 실행되지 않아 restore가 pending에 머문다.
- `TASK-044`에서 targeted invitation authority를 통합하고 `TASK-045`에서 join UX와 key delivery를 제품화한다.
- 두 task의 Web/Mobile 다중 사용자 검증 완료 전 Closed Beta 초대 기능은 준비되지 않은 것으로 판정한다.

2026-07-16 TASK-044 완료:

- targeted invitation에 정규화된 대상 이메일과 최소 표시 metadata를 추가했다.
- Web 메일 API가 세션과 document editor 권한을 검증하고 서버에서 token/code/link를 생성한다.
- 홈 pending 초대와 협업자 관리가 legacy `trip_members` 대신 document registry RPC를 사용한다.
- targeted token/code 수락은 로그인 계정 이메일이 일치할 때만 허용한다.
- wrapped key 자동 전달과 참여 준비 UX는 계획대로 `TASK-045`에서 완료한다.

2026-07-16 TASK-045 구현 완료:

- key를 보유한 Web owner/editor가 pending provisioning request를 foreground와 visibility trigger에서 자동 처리한다.
- Web join을 Panda CSS 상태 화면으로 교체하고 membership 완료와 데이터 준비 상태를 분리했다.
- Web/Mobile 모두 active key 확인 후 encrypted snapshot restore와 local 저장이 성공해야 상세로 이동한다.
- 홈 pending 수락과 local document 없는 상세 재진입도 join 준비 화면으로 수렴한다.
- TASK-044 migration이 적용된 DEV에서 Web-Web/Web-Mobile 다중 사용자 수동 검증이 남아 있다.

## 0. 목표 정정

이번 refactor의 최종 목표는 "준비물 Web-to-Web P2P 검증"이 아니다. 목표는 OnVoy 핵심 기능 전체를 Web/Mobile 양쪽에서 Local-first 기반으로 전환하는 것이다.

2026-07-15 전략 변경:

- 기존 Supabase row 데이터는 Closed Beta 제품 경로에서 무시한다.
- 신규 여행/템플릿만 document-primary 데이터로 간주한다.
- 기존 데이터에 대한 사용 불가 메시지는 제공하지 않는다.
- 기존 데이터 변환은 Closed Beta 필수 조건이 아니라 별도 migration tool 작업으로 분리한다.
- 기준 ADR: `docs/refactor/adrs/ADR-014-closed-beta-baseline-reset.md`

대상 기능:

- 준비물
- 일정
- 템플릿
- 동행자 초대 / 수락 / 거부
- 권한/멤버 역할 변경
- Web/Mobile cross-device restore/sync for new document-primary data
- 동시 접속 중 WebRTC P2P fast path
- 동시 접속하지 않은 기기간 Supabase encrypted backup 기반 sync/restore

통합테스트와 Closed Beta는 일부 기능으로 진행하지 않는다. **모든 핵심 기능이 Local-first 제품 경로에 올라간 뒤** 진행한다.

## 1. 현재 상태 요약

현재까지 TASK-001~037을 통해 Local-first 기반 부품과 full document-primary 전환 시도가 구현되었다. 하지만 기존 데이터 보존 전제 때문에 전환기 edge case가 커졌고, Closed Beta 기준선은 ADR-014에 따라 신규 document-primary 데이터로 재설정한다.

| 영역 | 현재 상태 | 판정 |
|------|----------|------|
| TripDocumentV1 모델 | trips/plans/checklists/members/assets/tombstones 기반 있음. templates는 ADR-013에 따라 별도 `TemplateDocumentV1` boundary | 기반 완료, templates 후속 |
| legacy row -> document 변환 | trip/plans/checklists/members와 template 변환 기반 있음. `/dev/legacy-migration` 수동 도구로 snapshot/key bootstrap 가능 | Closed Beta 필수 경로에서는 제외, 후속 수동 복구 경로 확보 |
| Web 준비물 | local-first/dual-write/P2P 화면 연결됨 | 부분 완료 |
| Mobile 준비물 | Yjs runtime/apply adapter는 있으나 화면 write path는 legacy 중심 | 미완료 |
| Web 일정 | document model에는 포함되나 화면 CRUD는 legacy Supabase 중심 | 미완료 |
| Mobile 일정 | legacy Supabase 중심 | 미완료 |
| 템플릿 | 기존 row 기반 기능 유지, document-primary 전환 없음 | 미완료 |
| 초대/수락/거부 | permission registry/RPC/key provisioning 기반은 있음. product 전체가 document-primary와 결합되지는 않음 | 부분 완료 |
| WebRTC P2P | Web 준비물 Web-to-Web 제품 경로까지 연결. Mobile은 adapter 수준 | 부분 완료 |
| Backup/restore | schema/crypto/key provisioning/restore helper 있음. 모든 기능의 sync 경로로 통합되지 않음 | 부분 완료 |
| 통합테스트 | legacy Web E2E와 core tests 중심. full Local-first E2E 없음 | 미완료 |
| Closed Beta | 신규 document-primary 기준선 안정화 전까지 불가 | 미완료 |

정확한 현재 판정:

> Local-first 전체 제품 완성도는 "foundation + document-primary cutover 재정렬" 단계다. 이제 핵심 과제는 legacy 호환이 아니라 신규 데이터 기준의 생성/동기화/복구 안정화다.

## 2. 아키텍처 방향 결정

속도를 우선한다면 기존 Supabase row 통신 방식과 자동 migration/hydrate를 계속 유지하는 것보다, **신규 document-primary 기준선 + legacy migration tool 후속 분리**가 더 단순하다.

권장 방향:

1. `TripDocumentV1`을 제품 기능의 primary data source로 승격한다.
2. 신규 여행/템플릿은 생성 즉시 local document + encrypted snapshot + owner key를 bootstrap한다.
3. 화면 CRUD는 Web/Mobile 모두 document repository를 사용한다.
4. Supabase row 테이블은 Closed Beta 제품 경로에서 제외하고 후속 migration source로만 유지한다.
5. 동기화는 두 계층으로 분리한다.
   - 동시 접속: WebRTC P2P로 Yjs update 전파
   - 비동시 접속: Supabase encrypted backup snapshot/update로 restore/sync
6. 통합테스트는 legacy row 동작이 아니라 document-primary 제품 경로를 기준으로 작성한다.

이 방향의 장점:

- dual-write mismatch 관리 범위가 줄어든다.
- Web/Mobile의 데이터 모델을 하나로 맞출 수 있다.
- P2P와 backup sync가 같은 Yjs update format을 공유한다.
- Closed Beta에서 "일부 기능만 Local-first"라는 혼선을 피할 수 있다.

위험:

- legacy Supabase row 기반 기능을 제품 경로에서 제거하며 신규 document bootstrap을 엄격히 보장해야 한다.
- 기존 화면이 row shape에 깊게 의존한다.
- 기존 데이터는 migration tool 전까지 제품 경로에서 보이지 않는다.

따라서 빠르게 가되, 기능 단위로 document-primary 전환 PR을 쪼개는 방식이 필요하다.

## 3. 기능별 구현 현황과 남은 작업

### 3.1 준비물

현재 구현:

- Web checklist local-first repository
- Web checklist dual-write repository
- IndexedDB persistence
- Web-to-Web P2P update 송수신
- P2P 연결 상태 UI
- signaling/ICE/lifecycle/topic hardening

남은 작업:

- Mobile checklist 화면을 document repository로 전환
- Web checklist를 dual-write가 아니라 document-primary로 승격
- checklist template apply 로직을 document mutation으로 전환
- offline write queue와 backup update upload를 제품 경로에 연결
- Web/Mobile checklist cross-device restore 검증
- checklist E2E를 legacy DB assertion이 아니라 document/restore/P2P 기준으로 재작성

완료 조건:

- Web/Mobile 모두 준비물 CRUD/check/toggle/assignee/template apply가 Local-first document에 기록된다.
- 동시 접속 기기는 P2P로 반영된다.
- 비동시 접속 기기는 backup sync/restore로 반영된다.
- legacy row 없이도 준비물 UX가 동작한다.

### 3.2 일정

현재 구현:

- `TripDocumentV1`에 `plans`, `planOrder`, `planUrls` 모델 존재
- legacy row -> document 변환 및 materialize 기반 존재
- Web/Mobile 일정 화면은 대부분 legacy Supabase CRUD 중심

남은 작업:

- Plan repository를 document-primary로 구현
- Web 일정 CRUD를 Plan repository로 전환
- Mobile 일정 CRUD를 Plan repository로 전환
- plan URLs, 장소 사진 reference, 방문 여부, 알림 metadata를 document mutation으로 반영
- 일정 정렬/order conflict policy 확정
- P2P update 적용 시 일정 화면 refresh/subscription 연결
- backup restore 후 일정 read model materialization 검증

완료 조건:

- Web/Mobile 일정 추가/수정/삭제/방문체크/URL/메모/비용 변경이 Local-first document에 기록된다.
- Web-to-Web, Web-to-Mobile, Mobile-to-Mobile에서 일정 변경이 P2P 또는 backup sync로 반영된다.

### 3.3 템플릿

현재 구현:

- 기존 Supabase row 기반 템플릿 기능 유지
- Local-first document와 템플릿 도메인의 결합은 미완성

결정:

- 개인/공개/공유 템플릿은 ADR-013에 따라 별도 `TemplateDocumentV1` boundary로 분리한다.
- trip checklist에 템플릿을 적용할 때는 템플릿 snapshot을 읽어 TripDocumentV1 checklist item mutation으로 복사한다.

남은 작업:

- Template document model/Repository 정의
- Web template list/detail/create/edit/delete 전환
- Mobile template list/detail/apply 전환
- 공개 템플릿 read path와 개인 템플릿 write 권한/RLS 정리
- 템플릿 적용 시 checklist document mutation으로 연결

완료 조건:

- Web/Mobile 템플릿 생성/수정/삭제/적용이 Local-first repository 경유로 동작한다.
- 템플릿 적용 결과가 준비물 document에 반영되고 P2P/backup sync 대상이 된다.

### 3.4 동행자 초대 / 수락 / 거부 / 권한

현재 구현:

- `document_members`
- invitation/share RPC
- key provisioning
- owner/editor/viewer permission helper
- Web/Mobile join fallback
- signaling RLS와 viewer send 차단

남은 작업:

- 초대/수락/거부 결과를 TripDocumentV1 members snapshot에도 반영
- Web/Mobile collaborator UI가 document permission registry와 document snapshot을 일관되게 읽도록 정리
- role 변경/revoke가 local document, backup key provisioning, P2P 권한에 즉시 반영되도록 연결
- revoked member의 local cache/key/access 정리 정책 구현
- 초대 수락 후 Mobile restore/key provisioning 완료까지 UX 확정

완료 조건:

- Web/Mobile에서 초대 생성, 수락, 거부, role 변경, revoke가 동일한 document permission model로 동작한다.
- 권한 변경 후 P2P send/backup upload/read restore 권한이 일관되게 제한된다.

### 3.5 WebRTC/P2P

현재 구현:

- Web/Mobile signaling adapter
- server-issued signaling topic + active topic RLS
- ICE config 발급
- Web/Mobile data channel handshake
- Yjs update chunk protocol
- Web checklist product wiring
- Mobile runtime adapter

남은 작업:

- Mobile 화면에서 `connectMobileP2PPeer()` 실제 호출
- Web/Mobile/Mobile peer lifecycle을 화면 생명주기에 연결
- 모든 document-primary mutation이 P2P publish를 호출하도록 repository 레벨로 통합
- late join/peer discovery 정책 구현
- P2P status UI를 Web/Mobile 공통 UX로 정리
- P2P 실패 시 backup sync fallback 상태를 사용자에게 정확히 표현

완료 조건:

- 준비물/일정/멤버/템플릿 적용 결과가 Web/Web, Web/Mobile, Mobile/Mobile에서 동시 접속 시 P2P로 반영된다.
- peer가 없거나 연결 실패 시 local write와 backup sync가 유지된다.

### 3.6 Backup / Restore / Offline Sync

현재 구현:

- encrypted backup schema/RLS
- snapshot/update codec
- Web/Mobile crypto/key provisioning 기반
- Mobile snapshot restore helper
- guest promotion 기반

남은 작업:

- 모든 document-primary mutation 후 backup update enqueue/upload 연결
- 앱 시작/foreground/네트워크 복구 시 backup pull/restore 연결
- Web/Mobile conflict resolution policy 검증
- offline write 후 앱 종료, 이후 다른 기기 진입 시 데이터 도착 보장
- restore freshness UX 구현
- background sync와 foreground sync의 역할 분리

완료 조건:

- A가 오프라인/비동시 상태에서 변경 후 종료해도, upload 가능한 시점에 backup이 올라가고 B가 restore/pull로 받는다.
- P2P 없이도 모든 핵심 기능이 eventually sync 된다.

## 4. 새 작업 계획 제안

기존 TASK-001~028 이후에는 "P2P 부품 추가"가 아니라 "전체 제품 document-primary 전환"으로 작업 축을 바꿔야 한다.

### TASK-029: Full Local-first Product Scope ADR

목적:

- TripDocumentV1은 trip-scoped 데이터 root로 유지하고, 템플릿은 `TemplateDocumentV1`로 분리한다고 결정
- legacy row는 migration source/read-only fallback으로 축소한다고 결정
- TASK-030~036 document-primary 전환 순서 확정

산출물:

- `docs/refactor/adrs/ADR-013-full-local-first-product-scope.md`
- 전체 task map
- migration/rollback 전략

### TASK-030: Document-primary Repository Layer

목적:

- `TripRepository`, `PlanRepository`, `ChecklistRepository`, `TemplateRepository`, `MemberRepository`를 document-primary로 정리
- Web/Mobile에서 공유 가능한 core repository contract 확정

상태:

- 완료. `@nexvoy/core`에 `TemplateDocumentV1`, document mutation writer, `DocumentPrimaryRepositoryBundle`,
  Trip/Plan/Checklist/Template/Member repository contract를 추가했다.
- 이번 작업은 schema 변경이 없으므로 실행해야 할 SQL/query 파일이 없다.

### TASK-031: Web Full Document-primary 전환

범위:

- Web 준비물 dual-write 제거 또는 feature flag 뒤 document-primary 승격
- Web 일정 CRUD 전환
- Web 템플릿 적용 전환
- Web 동행자 UI read/write 정리

상태:

- 완료. PR #321에서 Web의 일정/준비물/템플릿/동행자 경로를 document-primary repository로 전환했다.

### TASK-032: Mobile Full Document-primary 전환

범위:

- Mobile 준비물 CRUD 전환
- Mobile 일정 CRUD 전환
- Mobile 템플릿 적용 전환
- Mobile collaborator/key provisioning UX 정리
- Mobile P2P 화면 생명주기 연결

상태:

- 완료. Issue #322에서 Mobile AsyncStorage 기반 Trip/Template document store, Mobile repository factory, trip detail/template 화면 document-primary 전환, Mobile P2P screen lifecycle/status 연결을 구현했다.
- 검증: `pnpm --filter nexvoy-app typecheck`, `pnpm --filter nexvoy-app lint`, `pnpm build:mobile` 통과.

### TASK-033: Backup Sync Productization

범위:

- mutation -> backup update queue
- startup/foreground/network restore
- offline write durability
- cross-device eventual sync

상태:

- 완료. Issue #324에서 Web IndexedDB/Mobile AsyncStorage pending backup queue를 추가하고, Web/Mobile document-primary mutation publisher를 encrypted backup update enqueue/upload 경로에 연결했다.
- Web visibility 복귀와 Mobile foreground/provisioning 경로에서 pending queue flush를 실행한다.
- 검증: `pnpm --filter @nexvoy/core test`, `pnpm --filter @nexvoy/core typecheck`, `pnpm --filter nexvoy-app typecheck`, `pnpm --filter nexvoy-web build`, `pnpm typecheck`, `pnpm build:mobile` 통과.
- 후속 보강: full snapshot compaction worker와 remote pull/replay UX는 TASK-034/035의 cross-device 통합 검증에서 이어서 다룬다.

### TASK-034: P2P All-domain Wiring

범위:

- document mutation publish를 repository 레벨로 통합
- Web/Web, Web/Mobile, Mobile/Mobile P2P
- late join/peer discovery
- status UX

상태:

- 완료. Issue #326에서 Web P2P connection을 Trip document-level lifecycle로 승격하고, Mobile reconnect/backoff/timeout/status 처리를 보강했다.
- Web 일정 탭도 remote P2P update apply 후 IndexedDB broadcast를 통해 read model을 refresh한다.
- 검증: `pnpm --filter @nexvoy/core test`, `pnpm typecheck`, `pnpm --filter nexvoy-web build`, `pnpm --filter nexvoy-app lint`, `pnpm build:mobile` 통과.
- 후속 보강: Web/Mobile/Mobile 실기기 다중 피어 smoke와 late join E2E 자동화는 TASK-035에서 진행한다.

### TASK-035: Full Integration Test Suite

범위:

- Web document-primary 권한/reload E2E 작성 완료
- observability payload safety E2E 작성 완료
- 로컬 Supabase URL 및 `*.onvoy.local` 테스트 유저 guard 추가
- Web/Web, Web/Mobile, Mobile/Mobile P2P와 backup restore는 `docs/qa/local-first-integration-runbook.md`로 smoke 절차 고정
- Issue #328

### TASK-036: Closed Beta Readiness

범위:

- `docs/production-readiness.md` Closed Beta go/no-go gate 갱신
- `docs/runbooks/secret-inventory.md` 추가
- `docs/runbooks/deployment-rollback.md` 추가
- `docs/runbooks/closed-beta-runbook.md` 추가
- Expo/EAS, Vercel, Supabase, monitoring, legal/store, Local-first rollback 기준 정리
- Issue #330

## 5. 통합테스트 전략

사용자 목표에 맞춰 통합테스트는 일부 기능 선행 테스트가 아니라 **전체 기능 구현 이후** 수행한다.

다만 구현 중 회귀를 막기 위한 unit/smoke test는 계속 작성한다.

최종 통합테스트 범위:

1. Web owner creates trip.
2. Web owner adds plans/checklist/templates.
3. Owner invites editor/viewer.
4. Editor accepts on Web.
5. Editor accepts/restores on Mobile.
6. Web/Web simultaneous edits sync through P2P.
7. Web/Mobile simultaneous edits sync through P2P.
8. Mobile/Mobile simultaneous edits sync through P2P.
9. Offline edit then app/browser close syncs through backup on next network opportunity.
10. Role downgrade/revoke blocks write/P2P/backup upload.
11. Template create/apply/delete works on Web/Mobile.
12. App foreground/background and tab close do not leak P2P connections.
13. Backup restore does not expose document content in logs/analytics/signaling.

필요 인프라:

- multi-user Playwright fixtures
- local Supabase migration reset path
- Mobile preview/development APK test runbook
- Logcat assertions for native crash/WebRTC errors
- test data cleanup utilities
- observability payload snapshot checks

## 6. Closed Beta 기준

Closed Beta는 일부 기능 검증이 아니라 완성 제품 검증으로 진행한다.

Closed Beta 진입 조건:

- Web/Mobile에서 준비물, 일정, 템플릿, 동행자 초대/수락/거부가 Local-first document-primary로 동작
- Web/Web, Web/Mobile, Mobile/Mobile 동시 편집이 P2P 또는 fallback sync로 동작
- 비동시 접속 cross-device sync가 backup/restore로 동작
- 권한 변경과 key provisioning이 Web/Mobile에서 일관됨
- full integration suite 통과
- Android preview/internal test와 iOS TestFlight smoke 통과
- 운영 Supabase migration/RLS 검증 완료
- monitoring/alerting/privacy/terms/beta runbook 준비

현재 Closed Beta 판정:

> 아직 진입 불가. foundation은 충분히 쌓였지만, 제품 전체 기능의 document-primary 전환과 Mobile product wiring, backup sync productization, full integration suite가 남아 있다.

## 7. 빠른 구현을 위한 우선순위

가장 빠르게 완성 제품으로 가려면 다음 순서가 적절하다.

1. Full scope ADR로 document boundary와 legacy migration 전략 확정.
2. document-primary repository를 core contract로 고정.
3. Web 전체 기능을 document-primary로 먼저 전환.
4. Mobile 전체 기능을 같은 repository contract로 전환.
5. backup sync를 모든 mutation에 연결.
6. P2P publish/apply를 repository 레벨로 일반화.
7. full integration suite 작성.
8. Closed Beta readiness 진행.

핵심 원칙:

- 더 이상 준비물만 기준으로 완료를 판단하지 않는다.
- legacy Supabase row는 primary가 아니라 migration source/fallback으로 축소한다.
- Web과 Mobile이 같은 document model과 repository contract를 써야 한다.
- P2P는 모든 기능의 유일한 sync가 아니라 fast path다.
- Closed Beta는 완성 제품 기준으로만 진행한다.
