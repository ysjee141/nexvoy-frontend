# OnVoy Production 출시 준비

## 결론

현재 OnVoy는 **Web·Android Production NO-GO**다. Authority-only 제품 코드와 로컬 자동 Gate는
통과했지만 Android 실기기, 7일 관측, DB와 Storage 복구, 운영·법무·출시 책임 증적이 남아 있다.
최종 판정은 [TASK-057 마스터 계획](refactor/reports/TASK-057-production-final-validation-plan.md)의
`G0`~`G7`을 따른다.

## 출시 플랫폼

- 초기 Production 지원 범위는 Web과 Android다.
- iOS는 지원·출시 대상에서 제외하고 `TASK-064`에서 실기기·TestFlight/App Store Gate를 별도 수행한다.
- 공통 변경의 iOS typecheck, export, simulator launch는 비차단 회귀 검사로 계속 수행한다.
- Android 100% rollout은 iOS Production GO를 의미하지 않는다.

## 기준 문서

| 목적 | 문서 |
|---|---|
| 현재 Go/No-Go | [TASK-056 Production 출시 판정](refactor/reports/TASK-056-production-go-no-go.md) |
| 전체 실행 계획 | [TASK-057 Production 최종 검증 계획](refactor/reports/TASK-057-production-final-validation-plan.md) |
| 테스트 케이스 | [TASK-057 Production 통합 테스트](refactor/test-plans/TASK-057-production-integration-test-cases.md) |
| 실행·증적·출시 | [TASK-057 Runbook](refactor/runbooks/TASK-057-production-validation-runbook.md) |
| 비용 기준 | [TASK-056 초기 Production 비용](refactor/reports/TASK-056-initial-production-cost-baseline.md) |

실제 실행은 `TASK-058` 자동화, `TASK-059` DEV migration, `TASK-060` Web·Android 실기기,
`TASK-061` 관측, `TASK-062` 복구, `TASK-063` Web·Android Production 출시 순서로 진행한다.
iOS는 Android 안정화 이후 `TASK-064`에서 진행한다.

## 목표 아키텍처

- Supabase normalized row가 committed data의 최종 권위다.
- Web IndexedDB와 Mobile SQLite는 account-scoped cache와 durable outbox를 제공한다.
- Remote write는 authenticated batch RPC를 사용한다.
- Realtime은 작은 revision invalidation만 전달한다.
- Asset은 Storage/CDN으로 직접 전달하고 command에는 metadata만 포함한다.
- WebRTC/P2P, Yjs, document key, encrypted backup은 Production 제품 경로에 없다.

## 출시 Gate

| Gate | GO 기준 | 현재 상태 |
|---|---|---|
| G0 문서·책임 | 문서 버전과 Release/DB/QA/Web/Android/on-call 담당자 지정 | NO-GO |
| G1 로컬 자동화 | P0 자동화, 전체 test/typecheck/build PASS | PASS |
| G2 DEV schema | migration history drift 0, strict fingerprint와 authenticated smoke | PASS |
| G3 DEV 제품 | Web/Web·Web/Android·Android/Android P0/P1 100% PASS | NO-GO |
| G4 관측 | 연속 7일 무사고와 지표 임계치 충족 | NO-GO |
| G5 복구 | DB+Storage 격리 복구와 RTO/RPO 검증 | NO-GO |
| G6 Production preflight | 독립 history 감사, backup, 환경·법무·alert 승인 | NO-GO |
| G7 Rollout | 내부→5%→25%→100% 단계별 Hold 통과 | NO-GO |

## Web/Vercel 준비

| 항목 | GO 기준 | 증적 |
|---|---|---|
| Build | `pnpm build` PASS, warning 검토 | CI/build log |
| Environment | Production env inventory와 owner 확인 | 값이 아닌 key·소유자 목록 |
| Domain | SSL, canonical URL, redirect URL 일치 | 브라우저와 provider 설정 |
| OAuth | Supabase, Google, Kakao callback 검증 | 전용 계정 로그인 영상 |
| API | invite, feedback, photo, timezone, exchange의 auth/rate limit/error 처리 | API smoke와 log |
| Browser | 지원 Chrome/Safari와 mobile browser 핵심 smoke | 플랫폼 결과표 |
| Rollback | 직전 authority-only Vercel deployment 전환 가능 | rehearsal 기록 |

## Android/EAS 준비

| 항목 | GO 기준 | 증적 |
|---|---|---|
| App identity | 이름 `온여정`, scheme `onvoy`, package `xyz.nexvoy.app` | build metadata |
| Build | Android Production profile 성공 | EAS build URL |
| Preview | Metro 없이 Android 실제 기기 실행 | 설치 영상과 Logcat |
| Environment | Supabase, Maps, Firebase가 build time에 정확히 주입 | secret 없는 build 검토 기록 |
| Deep link | OAuth와 invitation link가 Android 앱으로 연결 | Android 영상 |
| Upgrade | SQLite schema와 cache/outbox 보존 | upgrade case 결과 |
| Store | Google Play Internal, Data safety, 권한 설명, 심사 metadata 준비 | Console draft |
| 최소 버전 | 직전 안정 authority-only build 이상을 강제 | 정책과 적용 화면 |

## iOS 비차단 회귀

| 항목 | Android 출시 중 기준 | iOS 출시 기준 |
|---|---|---|
| Typecheck·export | 공통 변경마다 PASS | 필수 |
| Simulator launch | release archive 실행 유지 | 사전 Gate |
| 실기기·OAuth·push | TASK-060/063 제외 | TASK-064 필수 |
| TestFlight/App Store | 준비 의무 없음 | TASK-064 필수 |

## Supabase 준비

| 항목 | GO 기준 | 증적 |
|---|---|---|
| Project | DEV/Production ref 교차 확인 | Release ticket |
| Migration | 객체 적용과 history 등록을 분리 감사, local/remote history 일치, dry-run 대상 0건 | schema diff와 전·후 migration list |
| RLS/RPC | owner/editor/viewer/revoked/outsider 정책 PASS | SQL과 제품 smoke |
| Realtime | private invalidation과 gap recovery PASS | Supabase report와 client log |
| Storage | 플랫폼 공통 path, RLS, thumbnail, orphan cleanup scheduler PASS | object manifest, scheduler와 network log |
| Backup | Managed DB backup과 별도 Storage export | 위치·시각·checksum |
| Recovery | 격리 프로젝트 복구와 앱 smoke PASS | RTO/RPO 보고서 |
| Capacity | Usage/Realtime/egress 월 예상 70% 미만 | 7일 관측 보고서 |

## 외부 연동과 운영 관측

| 영역 | GO 기준 |
|---|---|
| 이메일 | Resend 발신 domain, invitation delivery, bounce/error 확인 |
| Push/알림 | Android token, 일정 알림 예약·취소, 권한 거부 UX 확인 |
| 지도/장소 | Google Maps/Places key 제한과 quota, 오류 fallback 확인 |
| Analytics | GA4/Firebase event 수신, raw ID·콘텐츠·secret 0건 |
| Crash | Web/Android release/environment tag와 critical alert 수신 확인 |
| Feedback | Discord 또는 지원 채널 delivery와 개인정보 마스킹 확인 |
| Supabase | DB CPU, connection, Auth error, Storage, Realtime alert owner 지정 |
| Vercel/EAS | deploy/build failure 알림 수신자 지정 |

## 보안·개인정보·법무

| 항목 | GO 기준 |
|---|---|
| 약관/개인정보 | Web/Android와 Google Play에서 접근 가능한 Production URL |
| 수집 항목 | 이메일, 닉네임, 여행 내용, 사진, push token, analytics, crash log 명시 |
| 제3자/위탁 | Supabase, Vercel, Google, Firebase, Resend, Discord 등 반영 |
| 탈퇴/삭제 | 계정 탈퇴, canonical row 처리, local namespace 삭제 정책 검증 |
| 연령 정책 | 만 14세 미만 처리와 store age rating 결정 |
| Secret | 값은 문서·git·log에 없고 위치·owner·rotation만 관리 |
| 권한 검토 | RLS/RPC/Storage policy와 service role 사용 경계 검토 |
| Incident | 신고, triage, 사용자 통지, rollback 책임과 연락망 준비 |

## 운영 준비

- Support 문의 접수와 P0/P1 escalation 경로를 정한다.
- Release manager와 on-call 담당자가 단계별 GO/NO-GO 회의 시간을 정한다.
- 데이터 incident 발생 시 쓰기 동결, 영향 범위 확인, backup 보호, 사용자 통지 순서를 rehearsal한다.
- 월별 비용·quota와 주간 sync 품질 지표 검토 owner를 지정한다.
- PITR 도입 조건과 legacy 물리 삭제 조건을 별도 Gate로 유지한다.

## 즉시 NO-GO 조건

1. 데이터 손실·변질 또는 duplicate canonical row가 발생한다.
2. 계정 간 cache, row, Realtime, asset이 노출된다.
3. viewer, revoked, outsider가 허용되지 않은 작업을 수행한다.
4. migration history drift, 원격 전용 version 미분류 또는 미승인 object 변경이 있다.
5. DB와 Storage 복구가 같은 기준 시점으로 완료되지 않는다.
6. 미해결 P0/P1 결함이 있다.
7. Rollback과 on-call 담당자가 지정되지 않았다.
8. 약관·개인정보·store 필수 항목이 승인되지 않았다.

## 최종 승인

Release manager, DB operator, QA, Web, Android, Security/Privacy, on-call 담당자가 각 Gate의 증적을
확인한다. Production migration 실행자와 최종 GO 승인자는 분리한다. 모든 Gate가 GO일 때만 Android
100% rollout을 승인한다. iOS 승인은 TASK-064에서 별도로 수행한다.
