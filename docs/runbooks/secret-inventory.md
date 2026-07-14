# Secret Inventory

## 결론

이 문서는 secret **값을 기록하지 않는다**. Closed Beta 운영자는 각 secret의 이름, 설정 위치, 사용처, rotation trigger만 관리한다. 실제 값은 Vercel, EAS, Supabase, Google/Firebase/Kakao/Discord/Resend console에만 둔다.

## Web Runtime

| 이름 | 위치 | 사용처 | Rotation trigger |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Vercel env | Web callback/share URL | domain 변경 |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env | Supabase client/Edge Function URL | Supabase project 변경 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env | Browser Supabase client | Supabase key rotation |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Vercel env | Places/Maps UI and API routes | Google key 노출 또는 제한 변경 |
| `NEXT_PUBLIC_KAKAO_CLIENT_ID` | Vercel env | Kakao OAuth start | Kakao app 변경 |
| `NEXT_PUBLIC_GA_ID` | Vercel env | GA4 tracking | GA property 변경 |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel env | Web error reporting | Sentry project 변경 |

## Web Server/API

| 이름 | 위치 | 사용처 | Rotation trigger |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env, Supabase Functions | server-only privileged operations | 노출 의심, team member offboarding |
| `KAKAO_CLIENT_SECRET` | Vercel env/Supabase Function secret | Kakao OAuth token exchange | Kakao secret rotation |
| `RESEND_API_KEY` | Vercel env | `/api/invite` email delivery | Resend key rotation |
| `DISCORD_WEBHOOK_URL` | Vercel env | `/api/feedback` delivery | channel 변경 또는 URL 노출 |
| `GOOGLE_PLACES_API_KEY` | Vercel env optional | Places photo server API | Google key 노출 또는 quota abuse |

## Mobile/EAS

| 이름 | 위치 | 사용처 | Rotation trigger |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | EAS env | Mobile Supabase client | Supabase project 변경 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | EAS env | Mobile Supabase client | Supabase key rotation |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | EAS env | `app.config.js` native Maps config | Google key 노출 또는 restriction 변경 |
| `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | EAS env optional | Mobile place search | Google key split/rotation |
| `EXPO_PUBLIC_APP_URL` | EAS env | Web callback/share fallback | domain 변경 |
| `EXPO_PUBLIC_WEB_API_URL` | EAS env | Mobile share/feedback Web API base | API domain 변경 |
| `EXPO_PUBLIC_ONVOY_ENABLE_LEGACY_SECURESTORE_KEY_MATERIAL_FALLBACK` | EAS env | Android/iOS key provisioning fallback | emergency only, disable after incident |
| `google-services.json` | local/EAS secret file | Android Firebase | Firebase app rotation |
| `GoogleService-Info.plist` | local/EAS secret file | iOS Firebase | Firebase app rotation |

## Supabase Edge Functions

| 이름 | 위치 | 사용처 |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase function secret | Function Supabase client |
| `SUPABASE_ANON_KEY` | Supabase function secret | User-scoped Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase function secret | privileged server operations |
| `KAKAO_CLIENT_ID` | Supabase function secret | Kakao OAuth |
| `KAKAO_CLIENT_SECRET` | Supabase function secret | Kakao OAuth |
| `CLOUDFLARE_TURN_ID` | Supabase function secret | ICE server credential issue |
| `CLOUDFLARE_TURN_TOKEN` | Supabase function secret | ICE server credential issue |

## Handling Rules

- `.env.local`, Firebase config files, keystores, provisioning profiles, service role keys are never committed.
- `.env.test.local` must point to local Supabase only for E2E.
- Public-prefixed variables are still treated as configurable deployment data, not source constants.
- Rotate any secret after console access changes, accidental log exposure, suspicious quota usage, or vendor incident.
