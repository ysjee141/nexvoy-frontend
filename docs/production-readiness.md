# Closed Beta Production Readiness

## 결론

온여정(OnVoy) Closed Beta는 **Web production, Expo/EAS internal distribution, Supabase Local-first backend, monitoring, legal, rollback**이 모두 준비된 뒤 시작한다. 이 문서는 실제 배포 실행서가 아니라 go/no-go 판단 기준이다. 값이 들어간 secret은 문서에 기록하지 않고 `docs/runbooks/secret-inventory.md`의 위치/소유자 기준으로만 관리한다.

## Go/No-Go Gate

| Gate | Go 기준 | Evidence |
| --- | --- | --- |
| Product path | document-primary Web/Mobile smoke PASS | `docs/qa/local-first-integration-runbook.md` 결과 표 |
| Web | Vercel Preview와 Production env가 일치하고 `pnpm build` PASS | PR/배포 로그 |
| Mobile | Android Internal Testing 또는 iOS TestFlight 설치 smoke PASS | EAS build URL, 기기/OS 기록 |
| Supabase | migration list 확인, RLS/RPC smoke PASS, 배포 전 backup snapshot 생성 | Supabase dashboard/export 기록 |
| Monitoring | Sentry/GA/Firebase/Discord/Supabase/Vercel alert test PASS | alert test 로그 |
| Legal | 약관/개인정보 처리방침 URL, store privacy label 초안 준비 | URL, store console draft |
| Rollback | Web/Mobile/Supabase/Local-first rollback owner와 절차 확인 | `docs/runbooks/deployment-rollback.md` |

## Required Verification

| 명령/절차 | 목적 |
| --- | --- |
| `pnpm --filter @nexvoy/core test` | Local-first, sync, permission 순수 로직 |
| `pnpm typecheck` | shared packages + mobile 타입 정합성 |
| `pnpm build` | Vercel production build |
| `pnpm build:mobile` | Expo export/Metro bundle 정합성 |
| `pnpm --filter nexvoy-web test:e2e -- observability-safety.spec.ts` | 관측 payload 안전성 |
| `pnpm --filter nexvoy-web test:e2e -- local-first-product.spec.ts` | 로컬 Supabase 기반 Web 권한/reload E2E |
| `docs/qa/local-first-integration-runbook.md` | Web/Web, Web/Mobile, Mobile/Mobile, backup restore, offline reconnect |

## Web/Vercel Checklist

| 항목 | 기준 |
| --- | --- |
| Build | `vercel.json`의 `pnpm --filter nexvoy-web build`, output `apps/web/.next` 유지 |
| Env | `NEXT_PUBLIC_APP_URL`, Supabase, Kakao, Google Maps, GA/Sentry, Resend, Discord 설정 |
| Domain | production domain SSL, Kakao OAuth redirect, Supabase Auth redirect URL 일치 |
| Preview | PR preview에서 login, trip create, invite, document-primary smoke 확인 |
| API hardening | `/api/invite`, `/api/feedback`, `/api/places/photo/store` rate limiting은 Closed Beta risk item으로 추적 |

## Mobile/EAS Checklist

| 항목 | 기준 |
| --- | --- |
| App identity | `apps/mobile/app.json` name `온여정`, scheme `onvoy`, id `xyz.nexvoy.app` |
| Build profiles | `apps/mobile/eas.json`의 `development`, `preview`, `production` 사용 |
| Android | Play Console Internal Testing draft, package `xyz.nexvoy.app`, permission disclosure 작성 |
| iOS | TestFlight draft, bundle id `xyz.nexvoy.app`, background processing/privacy disclosure 작성 |
| Firebase | `google-services.json`/`GoogleService-Info.plist`는 local secret 파일로만 관리 |
| Maps | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`가 app config에 주입되는지 EAS build log에서 확인 |

## Supabase Checklist

| 항목 | 기준 |
| --- | --- |
| Migration inventory | `supabase/migrations/` 적용 목록과 운영 DB 목록 비교 |
| Legacy patch SQL | migration 밖 `supabase/fix_*.sql`, `consolidated_patch.sql` 적용 여부 별도 기록 |
| Backup | 운영 migration 전 Supabase backup snapshot 생성 |
| RLS/RPC smoke | document registry, members, keys, backup updates, signaling topic RPC 검증 |
| Edge Functions | `handle-kakao-oauth`, `ice-servers`, push/notification functions secret 설정 |

## Monitoring & Incident Readiness

| 채널 | 확인 |
| --- | --- |
| Sentry | Web/Mobile DSN, release/environment tag, critical alert route |
| GA4/Firebase | beta funnel, app open, auth, trip create, invite/share, local-first events |
| Discord | `/api/feedback` webhook delivery test |
| Supabase | DB CPU, connection count, auth error, storage usage 확인 |
| Vercel/EAS | deploy/build failure notification 수신자 지정 |

## Legal & Store Readiness

| 항목 | 기준 |
| --- | --- |
| Terms/Privacy | `ONVOY_TERMS_DOCUMENT`이 Web/Mobile signup/profile에서 접근 가능 |
| Public URL | store console에 넣을 약관/개인정보 URL 준비 |
| Data safety | Auth email, nickname, trip content, analytics, crash logs, push token, photos 수집 여부 정리 |
| Age rating | 만 14세 미만 이용 제한 정책 결정 |
| Third parties | Supabase, Vercel, Google, Firebase, Sentry, Resend, Discord 위탁/제3자 항목 확인 |

## Release Decision

Closed Beta를 시작하려면 다음을 모두 만족해야 한다.

1. 이 문서의 Go/No-Go Gate가 모두 Go다.
2. `docs/runbooks/closed-beta-runbook.md`의 daily operation owner가 지정됐다.
3. `docs/runbooks/deployment-rollback.md`의 rollback owner와 연락 경로가 지정됐다.
4. unresolved Critical/Major bug가 없다.
5. unresolved legal/store blocker가 없다.
