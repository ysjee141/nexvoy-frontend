# TASK-057 Production 통합 테스트 케이스

## 결론

Production GO에는 **자동 테스트 P0 100%**, **수동 테스트 P0/P1 100%**, **필수 플랫폼 조합 100%**가
필요하다. 현재 자동화는 Core, 로컬 저장소, SQL, Web 기본 흐름과 동시 충돌을 검증한다. 초대, role/revoke,
계정 전환, 템플릿, asset 제품 E2E는 추가 구현이 필요하다. Mobile OS lifecycle과 플랫폼 간 동기화는 실제
기기 수동 테스트를 최종 기준으로 사용한다.

## 목차

- [테스트 원칙](#테스트-원칙)
- [환경과 테스트 데이터](#환경과-테스트-데이터)
- [현재 자동화 자산](#현재-자동화-자산)
- [추가할 자동 테스트](#추가할-자동-테스트)
- [필수 플랫폼 매트릭스](#필수-플랫폼-매트릭스)
- [수동 통합 테스트](#수동-통합-테스트)
- [비기능 테스트](#비기능-테스트)
- [결함 등급과 종료 기준](#결함-등급과-종료-기준)
- [증적 규칙](#증적-규칙)

## 테스트 원칙

| 원칙 | 적용 방법 |
|---|---|
| Canonical 기준 | 최종 판정은 Supabase normalized row와 resource revision으로 한다. 화면만 보고 통과시키지 않는다. |
| Local 우선 UX | offline mutation은 IndexedDB/SQLite와 outbox에 즉시 반영돼야 한다. |
| 계정 격리 | 모든 cache/outbox 검증은 계정 A/B 전환을 포함한다. |
| 권한 우선 | viewer, revoked, outsider의 차단은 기능 성공보다 우선한다. |
| Exactly-once | retry, timeout, 앱 종료 후에도 같은 `operation_id`가 row를 중복 생성하면 안 된다. |
| Realtime 보조 | Realtime 유실 시 foreground/reconnect revision 비교로 복구돼야 한다. |
| 안전한 자동화 | 현재 Playwright의 local-only guard를 우회하지 않는다. 원격 DEV에는 service role E2E를 실행하지 않는다. |
| 증적 기반 | 각 결과에 release SHA, project ref, build, 기기, 실행 시각과 원시 로그를 남긴다. |

### 우선순위

| 등급 | 의미 | 출시 조건 |
|---|---|---|
| P0 | 데이터 정합성, 권한, 계정 격리, 복구 | 100% PASS 필수 |
| P1 | 핵심 제품 기능과 지원 플랫폼 | 100% PASS 필수 |
| P2 | 비핵심 UX, 장기 비용 최적화 | 승인된 예외만 허용 |

## 환경과 테스트 데이터

### 환경 구분

| 환경 | 용도 | 허용 작업 | 금지 작업 |
|---|---|---|---|
| Local Supabase | destructive SQL, service role seed, Playwright | reset, 전체 SQL/E2E | Production secret 사용 |
| DEV `ivgkqzwosbjukonlpfdw` | 원격 migration, 실제 client smoke, 7일 관측 | 전용 계정의 제품 UI 테스트 | local-only guard 우회, 고객 데이터 사용 |
| 복구 프로젝트 | DB+Storage restore rehearsal | dump/object 복구와 비교 | DEV/Production endpoint로 전환 |
| Production `runbcaegpefqnljsswhv` | preflight와 제한 smoke | read-only 점검, 승인된 내부 계정 smoke | destructive seed, service role E2E |

### 테스트 계정

| 별칭 | 권한 | 목적 |
|---|---|---|
| A | owner | 여행/템플릿 생성과 권한 관리 |
| B | editor | 공동 편집과 offline command |
| C | viewer | 읽기 허용, 쓰기 차단 |
| D | outsider | row, Realtime, asset 접근 차단 |
| E | invite mismatch | 다른 이메일 대상 초대 수락 차단 |

- DEV/Production에서는 전용 테스트 이메일과 가명만 사용한다.
- 로그와 문서에는 실제 UUID, token, 초대 코드를 붙이지 않는다.
- 데이터 이름은 `QA-<release>-<case-id>` 형식을 사용한다.
- 삭제 검증이 끝난 데이터는 case 종료 후 cleanup한다. 복구 rehearsal fixture는 별도 보관한다.

### 클라이언트 표기

| 코드 | 클라이언트 |
|---|---|
| W1 | Desktop Chrome 일반 프로필 |
| W2 | Desktop Chrome 별도 프로필 또는 시크릿 창 |
| WM | Android Chrome 또는 iOS Safari |
| A1/A2 | 서로 다른 Android 실제 기기 Preview build |
| I1/I2 | 서로 다른 iOS 실제 기기 Preview/TestFlight build |

## 현재 자동화 자산

| ID | 검증 범위 | 파일/명령 | 상태 |
|---|---|---|---|
| AUT-001 | 전체 migration 신규 환경 적용 | `supabase db reset --local` | 있음 |
| AUT-002 | Core command, version, conflict, retry, protocol byte | `pnpm --filter @nexvoy/core test` | 있음 |
| AUT-003 | Web IndexedDB atomic outbox, ack, 계정 격리, 충돌 해결 | `pnpm --filter nexvoy-web test:authority` | 있음 |
| AUT-004 | Mobile SQLite atomic outbox, 계정 격리, crash recovery, 충돌 해결 | `pnpm --filter nexvoy-app test:authority` | 있음 |
| AUT-005 | authority/RLS/Realtime/invitation/asset/legacy/concurrency SQL | `supabase/tests/task046`~`task056` | 있음, Local 전용 |
| AUT-006 | Web 인증/보호 경로 | `apps/web/e2e/smoke.spec.ts` | 있음 |
| AUT-007 | 여행 생성과 준비물 기본 흐름 | `trips.spec.ts`, `checklist.spec.ts` | 있음 |
| AUT-008 | offline outbox, editor Realtime 수렴 | `server-authority-product.spec.ts` | 있음 |
| AUT-009 | 동일 entity 충돌과 서버 최신 선택 | `server-authority-product.spec.ts` | 있음 |
| AUT-010 | analytics/log 식별자 차단 | `observability-safety.spec.ts`, Core events test | 있음 |
| AUT-011 | Web/Mobile 타입·빌드 | `pnpm typecheck`, `pnpm build`, `pnpm build:mobile` | 있음 |

### 로컬 자동 Gate 명령

```bash
supabase db reset --local
pnpm --filter @nexvoy/core test
pnpm --filter nexvoy-web test:authority
pnpm --filter nexvoy-app test:authority
pnpm typecheck
pnpm --filter nexvoy-web exec tsc --noEmit
pnpm lint:mobile
pnpm build:packages
pnpm build
pnpm build:mobile
```

SQL smoke script는 pgTAP이 아니므로 `supabase test db`가 아니라 local Postgres에 실행한다.

```bash
docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < supabase/tests/task046_server_authority.sql
docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < supabase/tests/task049_realtime_authority_invalidation.sql
docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < supabase/tests/task053_membership_invitation.sql
docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < supabase/tests/task054_asset_objects.sql
docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < supabase/tests/task055_revoke_legacy_sync.sql
docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < supabase/tests/task056_production_gate.sql
```

## 자동화 테스트 목록

`NEW-A01`~`NEW-A13`은 TASK-058에서 구현했다. PR CI artifact까지 PASS해야 `G1`을 닫을 수 있다.

| ID | 우선순위 | 제안 위치 | 시나리오 | 핵심 검증 |
|---|---|---|---|---|
| NEW-A01 | P0 | `invitation-authority.spec.ts` | 이메일 초대 생성·수락 | B가 즉시 여행을 읽고 role이 일치함 |
| NEW-A02 | P0 | 같은 파일 | 링크·코드 초대 수락과 재사용 | max use, 만료, target mismatch 차단 |
| NEW-A03 | P0 | `authority-permission-revoke.spec.ts` | viewer 쓰기 | UI와 RPC 모두 terminal 차단 |
| NEW-A04 | P0 | 같은 파일 | editor→viewer 변경 | 활성 화면과 다음 command에 즉시 반영 |
| NEW-A05 | P0 | 같은 파일 | offline editor revoke 후 reconnect | stale outbox 거부, cache/outbox purge, 재시도 중단 |
| NEW-A06 | P0 | `account-isolation.spec.ts` | A 로그아웃→B 로그인→A 재로그인 | A/B cache와 목록 교차 노출 0건 |
| NEW-A07 | P0 | `template-authority.spec.ts` | 템플릿 CRUD·항목 교체·여행 적용 | template revision과 생성된 준비물 정합성 |
| NEW-A08 | P0 | `asset-authority.spec.ts` + SQL | owner/editor/viewer/revoked 장소 사진 접근 | write/delete·metadata RLS, public provider cache 분류, path 검증 |
| NEW-A09 | P0 | `server-authority-product.spec.ts` | local 변경 재적용 선택 | 새 expected version으로 exactly-once 수렴 |
| NEW-A10 | P0 | Core/store tests | flush 중 종료와 stale `sending` 복구 | 중복 row 없이 `retryable` 회수 |
| NEW-A11 | P0 | SQL | command/resource ID 변조와 outsider RPC | 모든 direct/RPC 우회 차단 |
| NEW-A12 | P0 | SQL | invitation/revoke와 Realtime topic race | revoke 이후 event/read/write 차단 |
| NEW-A13 | P0 | Core/Web/Mobile path contract test | 같은 place ID의 object path 생성 | 플랫폼마다 동일한 canonical hash와 `_w240`/`_w800` path |
| NEW-A14 | P1 | `trip-lifecycle.spec.ts` | 여행·일정·준비물 삭제/tombstone | 새 세션과 collaborator에서 삭제 수렴 |
| NEW-A15 | P1 | 같은 파일 | 서로 다른 entity 동시 편집 | 사용자 충돌 없이 양쪽 변경 보존 |
| NEW-A16 | P1 | `asset-authority.spec.ts` | thumbnail/원본 요청 분리 | 목록은 `_w240`, 상세만 원본 사용 |
| NEW-A17 | P1 | `observability-safety.spec.ts` | 모든 authority event | 허용 key만 포함, raw ID/content 0건 |
| NEW-A18 | P1 | 신규 remote-safe smoke | DEV authenticated 제품 smoke | service role 없이 생성·읽기·수정·cleanup |
| NEW-A19 | P2 | load script | 32 command batch와 collaborator fanout | latency, retry, payload 임계치 이내 |

### 자동화 구현 규칙

- Local Playwright만 service role seed를 사용한다. `assertLocalSupabaseUrl`을 제거하거나 우회하지 않는다.
- DEV 자동 smoke는 별도 도구로 작성하고 authenticated test account만 사용한다.
- DEV 도구는 `QA-<release>` prefix가 붙은 자체 데이터만 삭제한다.
- Production에는 service role 기반 자동 테스트를 실행하지 않는다.
- CI artifact에는 trace, screenshot, JUnit/HTML 결과를 남기되 token과 UUID를 마스킹한다.

## 필수 플랫폼 매트릭스

| 조합 | 동일 계정 | collaborator | offline/reconnect | conflict | 초대·권한 | 필수 여부 |
|---|---:|---:|---:|---:|---:|---|
| W1 ↔ W2 | O | O | O | O | O | 필수 |
| W1 ↔ WM | O | O | O | O | O | 필수 |
| W1 ↔ A1 | O | O | O | O | O | 필수 |
| W1 ↔ I1 | O | O | O | O | O | 필수 |
| A1 ↔ A2 | O | O | O | O | O | Android 출시 전 필수 |
| I1 ↔ I2 | O | O | O | O | O | iOS 출시 전 필수 |
| A1 ↔ I1 | O | O | O | O | O | 양 플랫폼 출시 전 필수 |

동일 OS 두 대를 확보할 수 없으면 해당 플랫폼 출시는 NO-GO로 유지하거나 출시 대상에서 명시적으로 제외한다.

## 수동 통합 테스트

### 인증·계정·기기

| ID | 우선순위 | 절차 | 합격 기준 |
|---|---|---|---|
| MAN-A01 | P1 | 이메일 로그인→새로고침/앱 재시작→로그아웃 | 세션 유지와 로그아웃 후 보호 경로 차단 |
| MAN-A02 | P1 | 지원하는 Google/Kakao OAuth를 Web/Mobile에서 실행 | redirect/deep link 성공, 중복 계정 없음 |
| MAN-A03 | P0 | A로 데이터 생성→로그아웃→B 로그인 | A 여행/cache/outbox가 B UI에 0건 |
| MAN-A04 | P0 | B 로그아웃→A 재로그인 | A local cache가 복구되고 server revision과 수렴 |
| MAN-A05 | P0 | A가 새 브라우저 프로필과 새 Mobile 설치에서 로그인 | canonical 여행·템플릿이 local 데이터 없이 복구 |
| MAN-A06 | P1 | 회원 탈퇴 후 Web/Mobile 재로그인과 local DB 확인 | 인증 차단, 해당 계정 local namespace 제거 |

### 여행·일정·준비물·템플릿

| ID | 우선순위 | 절차 | 합격 기준 |
|---|---|---|---|
| MAN-D01 | P0 | A가 여행 생성, W2/A1/I1에서 열기 | destination/date/count와 revision 동일 |
| MAN-D02 | P1 | 여행 정보 수정 후 다른 클라이언트 foreground | 새 값 수렴, 중복 여행 0건 |
| MAN-D03 | P0 | 일정 생성·수정·삭제와 URL/사진 연결 | 순서·시간대·주소·URL·사진 ref 정합성 |
| MAN-D04 | P0 | 준비물 목록/항목 생성·수정·삭제 | category, quantity, privacy, sort 정합성 |
| MAN-D05 | P0 | B가 개인 준비물 생성, A/C/D에서 조회 | 허용 사용자만 볼 수 있고 bundle/change fetch도 동일 |
| MAN-D06 | P0 | assignee set과 A/B 개별 check를 동시에 변경 | assignee는 충돌 정책, user check는 사용자별 보존 |
| MAN-D07 | P1 | 템플릿 생성·항목 교체·공유·여행 적용 | template과 생성 준비물에 누락·중복 없음 |
| MAN-D08 | P0 | 여행/템플릿 삭제 후 새 세션과 collaborator 접속 | tombstone/삭제가 모든 클라이언트에 수렴 |

### 초대·권한·회수

| ID | 우선순위 | 절차 | 합격 기준 |
|---|---|---|---|
| MAN-C01 | P0 | A가 B 이메일을 editor로 초대, B pending UI에서 수락 | 수락 직후 별도 key 준비 없이 여행 읽기 |
| MAN-C02 | P0 | 링크로 B 참여 | 1회/max use와 만료 정책 준수 |
| MAN-C03 | P0 | 코드로 B 참여 | 잘못된 코드·만료 코드 차단, 정상 코드는 즉시 참여 |
| MAN-C04 | P0 | E가 B 대상 이메일 초대를 수락 시도 | target mismatch 차단, membership 생성 안 됨 |
| MAN-C05 | P0 | C viewer가 여행/일정/준비물 수정 시도 | UI 비활성화와 server terminal 차단 모두 확인 |
| MAN-C06 | P0 | A가 B editor를 viewer로 변경 | 열린 B 화면의 다음 write 차단, read 유지 |
| MAN-C07 | P0 | A가 온라인 B를 revoke | B read/write/Realtime/asset 차단, cache/outbox purge |
| MAN-C08 | P0 | B offline 변경→A revoke→B reconnect | stale command 미적용, 반복 retry 없음 |
| MAN-C09 | P0 | D가 trip ID, Realtime topic, asset path로 직접 접근 | row/event/object 노출 0건 |

### Offline·Realtime·충돌·복구

| ID | 우선순위 | 절차 | 합격 기준 |
|---|---|---|---|
| MAN-S01 | P0 | offline에서 여행/일정/준비물/템플릿 변경 | UI 즉시 반영, durable outbox 생성 |
| MAN-S02 | P0 | offline 변경 후 앱/브라우저 강제 종료→재시작 | local projection과 outbox 보존 |
| MAN-S03 | P0 | 네트워크 복구 | exactly-once canonical 적용, 상태 `동기화 완료` |
| MAN-S04 | P1 | Realtime 수신을 끊고 다른 기기 변경→foreground | revision check/full refresh로 수렴 |
| MAN-S05 | P0 | A/B가 서로 다른 일정을 동시에 수정 | conflict UI 없이 두 변경 보존 |
| MAN-S06 | P0 | A/B가 같은 일정을 동시에 수정 | 한쪽 conflict, 자동 overwrite 없음 |
| MAN-S07 | P0 | conflict에서 `서버 최신 내용 사용` | outbox 제거, 모든 클라이언트 canonical 수렴 |
| MAN-S08 | P0 | conflict에서 `이 기기 변경 다시 적용` | 새 version으로 1회 적용, 재충돌 시 modal 유지 |
| MAN-S09 | P1 | 느린/불안정 네트워크에서 반복 save | backoff 동작, UI 멈춤·무한 요청 없음 |
| MAN-S10 | P0 | flush 직후 프로세스 종료→foreground | stale sending 회수, 중복 row 0건 |

### Asset·알림·외부 연동

| ID | 우선순위 | 절차 | 합격 기준 |
|---|---|---|---|
| MAN-X01 | P0 | owner/editor가 사진 업로드 | binary가 command/RPC body를 통과하지 않고 Storage 직접 저장 |
| MAN-X02 | P1 | 목록과 상세에서 같은 사진 확인 | 목록은 thumbnail, 상세는 필요한 크기만 요청 |
| MAN-X03 | P0 | viewer/revoked/D가 upload/delete와 metadata 조회 시도 | write와 trip metadata 차단; public 장소 사진 byte는 공개 분류 유지 |
| MAN-X04 | P1 | 업로드 취소·사진 교체·여행 삭제 후 cleanup | retention 전 사용 object 유지, orphan만 삭제 |
| MAN-X05 | P1 | 일정 알림 생성·수정·삭제, 앱 재시작 | OS 알림 예약/취소와 일정 상태 일치 |
| MAN-X06 | P1 | 초대 이메일 전송과 링크 열기 | DEV 발신 설정, redirect, 만료 UI 정상 |
| MAN-X07 | P2 | 지도·장소 사진·시간대·환율 API 오류 주입 | 핵심 저장은 유지되고 사용자 오류가 명확함 |
| MAN-X08 | P0 | Web과 Mobile에서 같은 장소 사진 저장 | 동일 canonical path를 사용하고 중복 orphan을 만들지 않음 |
| MAN-X09 | P1 | cleanup 무인증·dry-run·실행·재실행 | 무인증 차단, dry-run 무삭제, retention 대상만 삭제, 멱등 성공 |

### Mobile lifecycle·배포형 실행

| ID | 우선순위 | 절차 | 합격 기준 |
|---|---|---|---|
| MAN-M01 | P0 | Preview build를 Metro 없이 실행 | 시작 crash와 localhost 의존 없음 |
| MAN-M02 | P0 | foreground→background→강제 종료→재실행 | local DB 정상 open, pending 복구 |
| MAN-M03 | P0 | airplane mode on/off 반복 | reconnect마다 중복 flush 없이 수렴 |
| MAN-M04 | P1 | 앱 업데이트 설치 | SQLite v2 migration과 기존 cache/outbox 보존 |
| MAN-M05 | P1 | 직전 authority-only build로 허용된 downgrade | DB open 실패·canonical 손실 없음 |
| MAN-M06 | P1 | Android Logcat/iOS device log 관찰 | fatal crash, unhandled rejection, 무한 retry 없음 |

## 비기능 테스트

| ID | 영역 | 방법 | 합격 기준 |
|---|---|---|---|
| NFT-01 | 성능 | 500 entity 여행의 상세 진입과 full refresh 측정 | 지원 기기에서 UX timeout 없음, RPC p95 2초 이하 |
| NFT-02 | 비용 | 7일 payload, full refresh, Realtime, egress 집계 | 비용 baseline과 quota 70% 미만 |
| NFT-03 | 접근성 | Web keyboard/screen reader, Mobile VoiceOver/TalkBack | conflict·초대·오류 UI 조작 가능 |
| NFT-04 | 보안 | RLS/RPC/Storage direct 접근, token 로그 검사 | 우회 0건, secret/UUID/content analytics 0건 |
| NFT-05 | 복구 | DB+Storage 격리 복구 | row/object 정합성 100%, 합의 RTO/RPO 충족 |
| NFT-06 | 호환성 | 지원 브라우저/OS와 최소 Mobile 버전 | crash·데이터 포맷 불일치 0건 |

## 결함 등급과 종료 기준

| 등급 | 예시 | 조치 |
|---|---|---|
| P0 | 데이터 손실, 계정 간 노출, RLS 우회, 복구 실패 | 즉시 중단, GO 취소, 원인 제거 후 전체 Gate 재실행 |
| P1 | 핵심 CRUD/초대/offline 불가, 반복 crash | release candidate 폐기, 수정 후 영향 매트릭스 재실행 |
| P2 | 우회 가능한 비핵심 UX, 경미한 시각 문제 | owner·만료일·영향을 기록한 예외 승인 필요 |
| P3 | 문구·개발 편의 개선 | backlog 허용 |

종료 조건:

- 필수 자동 테스트와 수동 P0/P1이 모두 PASS다.
- 모든 필수 플랫폼 조합이 PASS다.
- flaky test는 재실행 성공으로 닫지 않는다. 원인을 수정하거나 명시적으로 격리한다.
- 실패 case는 defect ID와 연결하고 수정 SHA에서 다시 실행한다.

## 증적 규칙

각 case는 다음 값을 남긴다.

| 필드 | 예시 |
|---|---|
| Case ID | `MAN-S08` |
| 결과 | `PASS`, `FAIL`, `BLOCKED` |
| 실행 시각 | ISO 8601 + `Asia/Seoul` |
| 환경 | DEV project ref 또는 Local commit |
| Release | Git SHA, Web deploy ID, Mobile build ID |
| 클라이언트 | `W1/A1`, 기기 모델, OS, 앱 버전 |
| 계정 별칭 | A/B/C/D/E만 기록 |
| 데이터 fixture | `QA-<release>-<case-id>` |
| 증적 | CI URL, screenshot/video, HAR/network, Logcat, SQL 결과 |
| 결함 | Issue 번호와 재검증 SHA |
| 실행자/검토자 | 실명 담당자 두 명 |

token, service-role key, 실제 UUID, 초대 코드, 고객 이메일과 여행 내용은 증적에서 마스킹한다.
