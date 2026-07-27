# TASK-059 DEV Migration Ledger 감사

작성일: 2026-07-27
대상: DEV `ivgkqzwosbjukonlpfdw`
상태: **완료**

## 결론

DEV에는 `20260712000001`~`20260723000002`의 결과 객체가 존재했지만 migration history 10건이
등록되지 않았다. 누락 SQL은 재실행하지 않고 해당 version만 `repair --status applied`로 등록했다.
dry-run에서 실제 미적용인 TASK-058과 TASK-059만 확인한 뒤 순서대로 적용했다.

적용 후 DEV와 로컬 최종 schema는 12/12 version, 185/185 객체가 일치하며 migration drift는 0이다.
적용 전 67개 차이는 다음 두 forward migration으로 모두 해소됐다.

- TASK-058: 장소 사진 write helper, registry 함수, public/storage 정책 6개
- TASK-059: authority helper 신원 결속과 함수 EXECUTE allowlist

## Fingerprint 기준

`supabase/audit/task059-object-manifest.json`과
`scripts/audit-task059-schema-dump.mjs`가 function, table, PK/FK/UNIQUE constraint, index, policy,
trigger, RLS, function/table grant를 비교한다. 테이블 컬럼 순서는 의미 없는 차이로 정규화한다.
TASK-055의 퇴역 객체는 함수 본문이 아니라 revoke 결과를 판정한다.

`supabase db diff`는 이번 감사에서 ACL 차이를 보고하지 않았으므로 migration history repair 근거로
사용하지 않는다. `pg_dump` 기반 fingerprint와 SQL 권한 회귀 테스트를 기준으로 한다.

## 적용 전 DEV 판정

| Version | Task | 일치/전체 | 판정 및 조치 |
|---|---|---:|---|
| `20260712000001` | TASK-021 | 2/2 | 최종 정책 부재가 의도와 일치, history repair |
| `20260713000001` | TASK-025 | 2/2 | 최종 정책 부재가 의도와 일치, history repair |
| `20260714000001` | TASK-028 | 8/8 | 객체·권한 일치, history repair |
| `20260716000003` | TASK-044 | 3/10 | 함수 정의 일치, 7개 grant는 TASK-059 변경 대상, history repair |
| `20260717000001` | TASK-046 | 45/61 | 4개 helper 정의와 12개 grant만 TASK-059 변경 대상, history repair |
| `20260717000002` | TASK-049 | 4/5 | topic helper 정의·grant만 TASK-059 변경 대상, history repair |
| `20260718000001` | TASK-053 | 3/5 | 2개 grant만 TASK-059 변경 대상, history repair |
| `20260718000002` | TASK-054 | 5/7 | asset 함수·정책만 TASK-058 변경 대상, history repair |
| `20260723000001` | TASK-055 | 35/35 | 퇴역 runtime revoke 결과 일치, history repair |
| `20260723000002` | TASK-056 | 0/4 | 함수 정의는 일치하고 4개 grant만 TASK-059 변경 대상, history repair |
| `20260723000003` | TASK-058 | 0/6 | 실제 미적용, forward migration 적용 |
| `20260727000001` | TASK-059 | 11/40 | 신규 grant hardening, forward migration 적용 |

## DEV 적용 기록

실행 시각은 2026-07-27 08:37 KST이며 연결 project ref가
`ivgkqzwosbjukonlpfdw`임을 각 단계에서 확인했다.

1. DEV schema, data, migration list를 `/tmp`의 접근 제한된 파일로 백업했다.
2. 객체가 확인된 historical version 10건만 history에 applied로 repair했다.
3. `supabase db push --linked --dry-run`에서 TASK-058/059 두 건만 남는 것을 확인했다.
4. `supabase db push --linked --yes`로 TASK-058과 TASK-059를 적용했다.
5. 재실행한 dry-run은 `Remote database is up to date`를 반환했다.
6. `public,realtime,storage` dump strict fingerprint는 12/12 version, 185/185 객체 일치다.

| 증적 | SHA-256 |
|---|---|
| 적용 전 schema dump | `ed1dc3d1ad68a527ecef427f564a276350f9ec4ae02b73975b3e2d3fc3075cac` |
| 적용 전 data dump | `cdd2c11968d227c21608e87c9430d19a9fa76c2bc1891f64ae90f93a63964543` |
| 적용 전 migration list | `6f79767e789dfe30be681cd33b38541a3b76cd402566e31b19d1d83117391bb3` |
| 적용 후 schema dump | `eb211e76c2ccccc49c69535854daf5c27863ae249b16b3a9e7506a97a69c2c83` |
| 적용 후 migration list | `630afb474374ca15eb060afd1e278abe3850ccd7cee3334831fc5a3c800393f8` |
| 적용 후 fingerprint 결과 | `5507e7915d11b9b01cfb1947980c6ad0bf84b1449df891b31fa390b968bdbb4a` |

## 권한 결함과 수정

Supabase의 기본 함수 권한 때문에 `REVOKE ... FROM PUBLIC`만 사용한 함수에 `anon` 또는
`authenticated`의 명시적 EXECUTE가 남아 있었다. 특히 actor ID를 인자로 받는 internal command
함수의 Data API 노출은 권한 우회 위험이다.

`20260727000001_task059_authority_rpc_grant_hardening.sql`은 다음을 적용한다.

- internal command·batch·stale·trigger 함수는 `service_role`만 허용
- 제품 write/read RPC는 `authenticated`와 `service_role`만 허용
- 초대 요약만 로그인 전 `anon` 접근 유지
- trip/template authority helper와 Realtime topic helper를 `auth.uid()`에 결속

`task059_authority_rpc_grants.sql`은 역할별 EXECUTE와 타 사용자 ID 대입 차단을 검증한다.

## Production Target-only 적용

Production `runbcaegpefqnljsswhv`은 최초에는 읽기 전용으로 감사했으며, 이후 사용자 추가 승인에 따라
TASK-058/059만 target-only 방식으로 적용했다.

- 원격 history에는 로컬에 없는 version 4개만 존재한다:
  `20260403070821`, `20260423112332`, `20260427021704`, `20260427023948`
- 적용 전 동일 manifest 결과는 116/185 일치, 69개 불일치였다.
- 기존 원격 history 4건의 placeholder와 TASK-058/059만 포함한 격리 workspace의 dry-run에서 두
  target migration만 확인한 뒤 적용했다.
- 적용 후 target-only dry-run은 0건이며 history에 `20260723000003`과 `20260727000001`이 등록됐다.
- fingerprint는 11/12 version, 183/185 객체 일치다. TASK-058/059 대상 차이는 모두 해소됐다.
- Production anon key로 public write wrapper와 internal command RPC가 모두 `42501`로 차단됨을
  확인했다. 실제 사용자나 QA 계정·여행은 생성하지 않았다.

| Production 증적 | SHA-256 |
|---|---|
| 적용 전 schema dump | `1ffa1c0676ff42b62c2fb34e9b696c158a85ba44aeeed681f1d187b8afa0465b` |
| 적용 전 data dump | `c91dddbc77685d772e26aaec2bfd9b86e161e68cea1d205a81458723a949bcd6` |
| 적용 전 migration list | `d7c7eb8cdacb0817c8df9d1de6ff677dce208dd46041edaa32bdc5a6989f03fc` |
| 적용 후 schema dump | `385a89e4464f3931d3aafb007df24c17754723a34c06b217c6e24cd4f21d68ff` |
| 적용 후 migration list | `66aba3fb19f25a54316be43a5525b8199ea9cd8e22a1c91b5aeeef594de3bf18` |
| 적용 후 fingerprint 결과 | `7beafbdb40638840a094419a8a724bda1716a3dd0bbb360ad39cb131893bd727` |

`checklist_items.is_private`와 `checklist_template_items.is_private`의 `NOT NULL` 차이, 로컬 historical
version 미등록, 원격 전용 version 4건의 출처는 그대로 남아 있다. Production 전체 ledger repair와
출시 승인은 TASK-063에서 독립적으로 처리한다.

## Authenticated Remote-safe Smoke

2026-07-27 10:37 KST에 DEV Auth에 임시 owner/editor/viewer/outsider 계정을 생성했다. 계정
provisioning에만 DEV service role을 사용하고, smoke subprocess에는 anon key와 네 사용자
자격증명만 전달했다.

- owner 여행 bootstrap과 targeted editor/viewer 초대 수락 PASS
- editor write, duplicate operation 멱등성, revision 1 증가 PASS
- viewer write, outsider read, anonymous wrapper/internal RPC 차단 PASS
- editor role 하향과 revoke 직후 read/write 차단 PASS
- QA 여행 soft-delete cleanup PASS
- 임시 Auth 계정 Admin API 삭제 4/4 성공
- smoke report SHA-256:
  `3f6305ba1ecba44420bde693330e11b45d9d3cc2e4f8a3d1d8fbe3900f6a78c4`

이로써 DEV migration drift 0, strict fingerprint 12/12·185/185, authenticated smoke PASS의
TASK-059 완료 조건을 모두 충족했다. Production에는 사용자 승인 범위인 TASK-058/059만 적용했다.
