# 프로덕션 런치 준비 체크리스트

OnVoy를 프로덕션 환경에 배포하기 위해 해야 할 것과 챙겨야 할 것을 정리한 문서.

---

## 현재 상태 요약

| 영역 | 상태 | 비고 |
|------|------|------|
| 인프라 (Supabase, Vercel) | ✅ 완비 | 운영 인스턴스 존재 |
| CI/CD 파이프라인 | ✅ 완비 | E2E 자동화, OTA 배포 |
| 데이터 보안 (RLS) | ✅ 완비 | 전 테이블 적용 |
| 모니터링 (Sentry, GA) | ✅ 완비 | 운영 환경 조건부 활성화 |
| 모바일 앱 (Capacitor) | ⚠️ 서명 미완료 | 스토어 배포 불가 |
| API 보안 | ⚠️ Rate limiting 미구현 | |
| 테스트 커버리지 | ⚠️ E2E 부분, 단위 0% | |
| 배포/운영 문서 | ⚠️ 부재 | |

---

## 1. 보안 — 배포 전 필수

### 1-1. 환경변수 관리

- [ ] **`.env.local`이 `.gitignore`에 포함되어 있는지 확인** — 실제 API 키가 포함되어 있음
- [ ] **`.env.example` 또는 `.env.local.example` 파일 생성** — 필요한 변수 목록 문서화, 값은 더미로
- [ ] **CI/CD 시크릿 검토** — 현재 GitHub Actions에서 사용 중인 시크릿:
  - `E2E_SUPABASE_SERVICE_ROLE_KEY` — E2E 테스트용
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — OTA 배포용
  - 운영 배포 워크플로우 추가 시 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `KAKAO_CLIENT_SECRET`, `RESEND_API_KEY`, `DISCORD_WEBHOOK_URL`, `NEXT_PUBLIC_SENTRY_DSN` 시크릿 등록 필요
- [ ] **Google Maps API 키 제한 설정** — Google Cloud Console에서 허용 도메인/앱 제한 적용
- [ ] **Kakao OAuth 리다이렉트 URI 검토** — 운영 도메인만 허용하는지 확인

### 1-2. API Routes 보안

- [ ] **Rate Limiting 적용** — 다음 API에 우선 적용:
  - `/api/invite` — 초대 링크 생성 (어뷰징 가능)
  - `/api/feedback` — 피드백 제출
  - `/api/places/photo/store` — 사진 저장
  - Vercel의 `@upstash/ratelimit` 또는 Supabase Edge Function 활용 권장
- [ ] **모든 API Route에 세션 검증 확인** — 인증 없이 접근 가능한 엔드포인트가 없는지 확인
- [ ] **요청 입력 검증 강화** — request body, query parameter에 대해 zod 등으로 스키마 검증 추가

### 1-3. Supabase 보안

- [ ] **RLS 정책 운영 환경에서 재검증** — 로컬과 동일한 마이그레이션이 적용되어 있는지 확인
- [ ] **`anon` role 권한 최소화** — anon key로 접근 가능한 데이터 범위 검토
- [ ] **Service Role Key 노출 확인** — 서버사이드 코드 이외에서 사용되지 않는지 grep 확인
  ```bash
  grep -r "SUPABASE_SERVICE_ROLE_KEY" src/
  ```
- [ ] **Supabase Auth 설정 확인** — 운영 환경 OAuth 리다이렉트 URL 등록

---

## 2. 인프라 및 배포

### 2-1. 웹 배포 (Vercel)

- [ ] **도메인 설정** — 운영 도메인 연결 및 SSL 인증서 확인
- [ ] **환경변수 설정** — Vercel Dashboard에 모든 운영 환경변수 등록
  - `NEXT_PUBLIC_APP_ENV=production`
  - `NEXT_PUBLIC_APP_URL=https://app.nexvoy.xyz`
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
  - `NEXT_PUBLIC_KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `RESEND_API_KEY`
  - `DISCORD_WEBHOOK_URL`
- [ ] **`pnpm build` 성공 확인** — 로컬에서 프로덕션 빌드 에러 없음 검증
- [ ] **Vercel Preview 배포로 최종 확인** — PR 단계 preview URL에서 주요 기능 테스트

### 2-2. 데이터베이스 마이그레이션

- [ ] **운영 Supabase에 마이그레이션 적용 확인**
  ```bash
  supabase db push --linked  # 또는 supabase migration list로 현황 확인
  ```
- [ ] **`supabase/` 하위의 패치 SQL 파일 적용 여부 추적** — `fix_*.sql`, `consolidated_patch.sql` 등이 운영 DB에 적용되었는지 별도 기록 관리 필요 (현재 마이그레이션 파일로 관리되지 않고 있음)
- [ ] **마이그레이션 전/후 DB 스냅샷** — 첫 운영 배포 전 백업 스냅샷 생성
- [ ] **`place_photos` 버킷 생성 확인** — `20260527000002_place_photos_bucket.sql` 적용 여부

### 2-3. Supabase Storage

- [ ] **`place-photos` 버킷 접근 정책 확인** — 인증된 사용자만 업로드, 공개 읽기 여부 결정
- [ ] **Storage 용량 플랜 확인** — 무료 플랜 한도(1GB) 대비 예상 사용량 검토

---

## 3. 모바일 앱 배포

### 3-1. 공통

- [ ] **앱 버전 확정** — `package.json` `version` 필드, Android `versionCode`/`versionName`, iOS `CFBundleVersion`/`CFBundleShortVersionString` 일치 여부
- [ ] **번들 ID 확정** — 현재: `xyz.nexvoy.app` — 스토어 등록 후 변경 불가
- [ ] **`pnpm build:mobile` 성공 확인** — `out/index.html` 생성 및 파일 무결성 검증
- [ ] **Capacitor 설정 최종 확인** (`capacitor.config.ts`)
  - `appId`, `appName` 확인
  - OTA 자동 업데이트 정책 결정 (`autoUpdate: false` 유지 또는 변경)

### 3-2. Android

- [ ] **코드 서명 키스토어 생성** — `keytool`로 release keystore 생성 및 안전한 곳에 보관
- [ ] **`build.gradle` release 서명 설정** — keystore 경로 및 비밀번호 설정 (환경변수로 주입)
- [ ] **`minSdkVersion`/`targetSdkVersion` 확인** — 현재 Play Store 정책 충족 여부 (targetSdk ≥ 35)
- [ ] **릴리즈 APK/AAB 빌드 및 테스트** — `./gradlew bundleRelease`
- [ ] **Google Play Console 앱 등록** — 메타데이터, 스크린샷, 개인정보처리방침 URL 준비
- [ ] **내부 테스트 트랙 배포** — 팀원 계정으로 최종 기능 검증

### 3-3. iOS

- [ ] **Apple Developer 계정 등록** — 연 $99, 법인/개인 결정
- [ ] **Bundle ID 등록** (App Store Connect)
- [ ] **코드 서명 프로비저닝 프로파일 생성** — Distribution certificate + App Store provision
- [ ] **Xcode Build Settings 설정** — Team ID, Code Signing Identity
- [ ] **TestFlight 배포** — 내부 테스터 최종 검증
- [ ] **App Store Connect 메타데이터** — 앱 설명, 스크린샷, 카테고리, 연령 등급

---

## 4. 품질 및 테스트

### 4-1. E2E 테스트 커버리지 보완

현재 테스트가 없는 핵심 시나리오:

- [ ] **체크리스트 CRUD** — 항목 추가/수정/삭제, 완료 토글
- [ ] **여행 공유 플로우** — 초대 링크 생성 → 수락 → 공유 멤버 접근
- [ ] **오프라인 모드** — 네트워크 차단 후 캐시된 데이터 표시 확인
- [ ] **OTA 업데이트 흐름** — 업데이트 감지 및 적용 (모바일 시뮬레이터)
- [ ] **OAuth 로그인** — 실제 카카오/구글 OAuth 흐름 (현재 mock 처리)

### 4-2. 수동 검증 체크리스트

배포 전 실제 기기/브라우저에서 확인:

- [ ] 카카오 OAuth 로그인/로그아웃
- [ ] 구글 OAuth 로그인/로그아웃
- [ ] 여행 생성 → 플랜 추가 → 체크리스트 추가 전체 플로우
- [ ] 여행 공유 (초대 링크 전송 → 다른 계정으로 수락)
- [ ] 이미지 업로드 (장소 사진)
- [ ] 오프라인 상태에서 기존 데이터 열람
- [ ] 네트워크 복구 후 자동 동기화
- [ ] Android 기기에서 앱 설치 및 실행
- [ ] iOS 기기에서 앱 설치 및 실행 (TestFlight)
- [ ] 푸시 알림 수신 (테스트 알림 발송)

### 4-3. 성능

- [ ] **웹 Lighthouse 점수** — Performance 90+, Accessibility 90+ 목표
- [ ] **번들 크기 확인** — `pnpm build` 후 빌드 아웃풋 분석 (`@next/bundle-analyzer` 활용)
- [ ] **초기 로드 시간** — 3G 환경 기준 FCP 3초 이하 목표
- [ ] **Supabase 쿼리 성능** — N+1 문제 없는지 Supabase Dashboard에서 Slow Queries 확인

---

## 5. 모니터링 및 운영

### 5-1. 모니터링 설정 확인

- [ ] **Sentry 프로젝트 설정** — 운영 환경용 DSN, 알림 임계값 설정
  - 에러 발생 시 담당자 알림 설정
  - 샘플 레이트 10% → 초기 운영 시 25%로 올렸다가 안정화 후 조정
- [ ] **Google Analytics** — 주요 이벤트 추적 설정 (여행 생성, 공유, 체크리스트 완료 등)
- [ ] **Discord Webhook** — 피드백 채널 연결 확인

### 5-2. 알림 및 대응 계획

- [ ] **Sentry 에러 알림 채널 지정** — Slack 또는 이메일로 critical 에러 즉시 수신
- [ ] **Supabase 모니터링** — Database CPU, 연결 수, Storage 사용량 알림 설정
- [ ] **Vercel 배포 알림** — 배포 실패 시 알림 설정

### 5-3. 운영 문서 작성

- [ ] **배포 절차서** — 웹 배포, 모바일 OTA 배포, 네이티브 앱 스토어 배포 각각 절차 문서화
- [ ] **롤백 가이드** — 배포 후 문제 발생 시 롤백 방법 (Vercel 이전 배포로 되돌리기, OTA 이전 버전 지정)
- [ ] **트러블슈팅 가이드** — 자주 발생하는 이슈와 해결책 (Supabase 연결 실패, OAuth 에러 등)
- [ ] **DB 마이그레이션 관리 정책** — `supabase/` 패치 파일들의 관리 방식 명확화 (현재 산발적으로 존재)

---

## 6. 법적 요건

- [ ] **개인정보처리방침 페이지** — 수집 항목, 목적, 보유 기간, 제3자 제공 명시
  - 카카오/구글 OAuth 사용 시 OAuth 제공자 약관 준수 필요
  - Sentry에 PII 수집 사실 명시
- [ ] **서비스 이용약관** — 스토어 등록 시 필수
- [ ] **앱 스토어 개인정보 관련 항목 작성**
  - Google Play: 데이터 수집 설문
  - App Store: 개인정보 처리 레이블 (Privacy Nutrition Label)
- [ ] **만 14세 미만 이용 제한 여부 결정** — 정보통신망법 준수

---

## 7. 우선순위 로드맵

### 즉시 (지금)

1. `.env.local` `.gitignore` 포함 여부 재확인, `.env.local.example` 작성
2. API Rate Limiting 추가 (`/api/invite`, `/api/feedback`)
3. 운영 Supabase DB 마이그레이션 현황 추적 문서 작성

### 1주 이내

4. Vercel 운영 환경변수 전체 등록 및 `pnpm build` 성공 확인
5. E2E 테스트 체크리스트/공유 시나리오 추가
6. 수동 검증 체크리스트 전항목 통과
7. Sentry 알림 채널 설정

### 2-3주 이내

8. Google Maps, Kakao API 키 도메인 제한 설정
9. 개인정보처리방침 / 이용약관 페이지 작성
10. Android 서명 키스토어 생성 및 내부 테스트 APK 배포
11. iOS TestFlight 배포

### 스토어 출시 전

12. Google Play Console / App Store Connect 앱 등록
13. 스토어 검수 → 출시 승인

---

## 참고

- Supabase 운영 보안 가이드: https://supabase.com/docs/guides/platform/going-into-prod
- Next.js 배포 체크리스트: https://nextjs.org/docs/app/building-your-application/deploying
- Capacitor Android 서명: https://capacitorjs.com/docs/android/deploying-to-google-play
- Capacitor iOS 배포: https://capacitorjs.com/docs/ios/deploying-to-app-store
