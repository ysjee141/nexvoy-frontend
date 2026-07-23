# TASK-058: Production P0 통합 테스트 자동화

- 상태: 구현 완료, PR CI 검증 대기
- Issue: [#374](https://github.com/ysjee141/nexvoy-frontend/issues/374)
- 선행 작업: `TASK-057`
- 해소 대상: `B-03`, `B-11` 계약 부분

## 목적

사람의 반복 확인에 의존하는 핵심 데이터·권한 회귀를 로컬 Supabase 기반 자동 테스트로 고정한다.
원격 DEV나 Production에서는 service role seed와 파괴적 cleanup을 실행하지 않는다.

## 범위

- 이메일·링크·코드 초대와 수락
- owner/editor/viewer/revoked 권한 전이
- 동일 브라우저 계정 전환과 IndexedDB 격리
- 템플릿 생성·수정·복사·삭제
- asset upload/download 권한과 metadata 정합성
- Web/Mobile이 같은 place ID에 동일 canonical hash와 object path를 사용하는 공통 Core 계약
- tombstone, 중복 command, 재시작·재시도·충돌 회귀
- CI에서 Core, SQL, Web E2E를 한 release SHA로 실행

세부 케이스와 우선순위는
[Production 통합 테스트 케이스](../test-plans/TASK-057-production-integration-test-cases.md)를 따른다.

## 완료 조건

- `NEW-A01`~`NEW-A13`이 구현되고 모두 PASS한다.
- 모든 P0 테스트가 실패 원인을 식별할 수 있는 assertion과 artifact를 남긴다.
- local-only 보호 장치 우회가 없고 원격 project ref를 넣으면 즉시 중단된다.
- 전체 자동 Gate 명령과 CI URL을 release 증적에 기록한다.

## 구현 결과

| 범위 | 자동 검증 |
|---|---|
| `NEW-A01`~`A02` | 이메일·링크·코드 초대, 대상 불일치, 만료, 재사용 |
| `NEW-A03`~`A05` | viewer 차단, role 하향 실시간 반영, revoke 후 outbox/cache purge |
| `NEW-A06` | 동일 브라우저 A→B→A 계정 전환과 IndexedDB 격리 |
| `NEW-A07` | 템플릿 생성·수정·항목 교체·여행 적용 |
| `NEW-A08` | owner/editor Storage write, viewer/outsider/revoked 차단, metadata RLS, canonical path |
| `NEW-A09` | 동일 entity 충돌 후 local 재적용과 revision 3 수렴 |
| `NEW-A10` | Web IndexedDB/Mobile SQLite stale `sending` 회수와 중복 ACK 멱등성 |
| `NEW-A11`~`A12` | cross-trip ID 변조, outsider RPC, invitation/revoke/Realtime 경계 SQL |
| `NEW-A13` | Web/Mobile 공통 SHA-256 hash와 `_w240`/`_w800` object path |

로컬 전체 Gate는 다음 한 명령으로 실행한다.

```bash
supabase start
pnpm test:production:p0
```

명령은 Supabase URL이 `localhost` 또는 `127.0.0.1`이 아니면 즉시 중단한다. CI도 원격 secret 대신
고정 버전의 로컬 Supabase를 사용하고 Playwright HTML, trace, JUnit, 통합 로그를 SHA별 artifact로
보존한다.

## Asset 분류

`place-photos`는 사용자 비공개 미디어가 아니라 Google 장소 사진을 캐시하는 public bucket이다.
object byte 자체는 공개하되 업로드·수정·삭제와 `trip_asset_objects` metadata는 trip authority를
따른다. `20260723000003_task058_place_photo_write_policy.sql`은 owner/editor, 활성 plan, 사용자
폴더, trip/plan/hash/width path를 함께 검증하고 revoke 후 metadata 접근도 제거한다. 비공개 사용자
미디어를 추가할 때는 별도 private bucket과 인증 delivery endpoint를 사용해야 한다.

신규 migration은 로컬 reset에서 검증했으며 DEV/Production 적용은 이 작업에서 수행하지 않는다.
TASK-059의 fingerprint·history 절차에서 forward migration으로 적용한다.

## 로컬 검증 결과

- `pnpm test:production:p0`: PASS
  - Core, Web IndexedDB, Mobile SQLite authority 테스트
  - TASK-046/049/053/054/055/056/058 SQL 테스트
  - Playwright 23건
- `pnpm typecheck`, `pnpm build:packages`, `pnpm build`: PASS
- `pnpm lint:mobile`, `pnpm build:mobile`: PASS

PR CI가 같은 release SHA에서 통과하면 TASK-058을 완료 처리한다.

## 제외 범위

- 원격 migration 적용
- 실기기·7일 관측·복구·Production 출시
