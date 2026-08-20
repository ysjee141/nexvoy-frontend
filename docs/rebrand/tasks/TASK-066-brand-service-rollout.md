# TASK-066: 갈래 canonical 브랜드 서비스 적용

- 상태: 구현 완료 / E2E 환경 검증 대기
- 기준 브랜치: `refactoring/local-first-architecture`
- 구현 브랜치: `codex/task-066-brand-service-rollout`
- 선행 작업: canonical 브랜드 에셋 PR #392 (기준 브랜치 반영 완료)
- 영향 범위: Web, Mobile, 공통 디자인 토큰, 앱 메타데이터, 사용자 노출 카피

## 목적

현재 서비스 런타임은 레거시 `온여정 / OnVoy` 브랜드와 v6 자산, Cobalt Blue 토큰을 사용한다. 승인된 `갈래 / Nextward` 브랜드 시스템을 실제 Web과 Mobile 서비스에 적용하여 다음 항목을 하나의 기준으로 통일한다.

- 사용자 노출 브랜드명과 소개 문구
- canonical 로고와 앱 아이콘
- Web favicon, PWA, Apple Touch icon과 앱 메타데이터
- Mobile launcher, adaptive icon, notification icon, splash와 스토어 자산
- UI 공통 색상 토큰과 브랜드 문서의 색상 규칙

서비스의 제품 기능, 데이터 모델, 권한, 외부 식별자는 이번 작업의 대상이 아니다.

## 선행 조건

1. 기준 브랜치에 반영된 PR #392의 `docs/brand/v12` canonical 에셋과 브랜드 문서를 사용한다.
2. 구현 브랜치는 기준 브랜치에서 분기한다. canonical 에셋 PR 브랜치를 직접 기반으로 삼지 않는다.
3. 구현 시작 전에 `DESIGN.md`, `docs/brand/BRAND.md`, `docs/brand/APP-BRAND-ASSET-GUIDE.md`를 최신 기준으로 읽는다.
4. 기존 v6 배포 자산은 롤백 및 이력 보존을 위해 삭제하지 않는다.

## 기준 자산

제품에 배포하는 자산은 `docs/brand/v12`의 canonical 파일만 사용한다.

| 목적 | canonical 자산 |
| --- | --- |
| Web과 Mobile 대표 로고 | `docs/brand/v12/logo-gallae-primary.svg` |
| 세로 lockup | `docs/brand/v12/logo-gallae-vertical.svg` |
| 가로 lockup | `docs/brand/v12/logo-gallae-horizontal.svg` |
| 경로 심벌 | `docs/brand/v12/route-symbol.svg` |
| 기본 앱 아이콘 | `docs/brand/v12/app-icon.svg` |
| 어두운 배경 앱 아이콘 | `docs/brand/v12/app-icon-dark.svg` |
| 밝은 배경 앱 아이콘 | `docs/brand/v12/app-icon-light.svg` |
| 코랄 캠페인 아이콘 | `docs/brand/v12/app-icon-coral.svg` |
| 아웃라인 아이콘 | `docs/brand/v12/app-icon-outline.svg` |
| Web favicon | `docs/brand/v12/favicon.svg` |

`brand-system.png`, `brand-system.svg`, reference PNG와 comparison board는 문서·QA용이다. 제품 런타임에 raster wrapper를 직접 연결하지 않는다.

## 색상 규칙

UI와 artwork의 색상을 같은 토큰으로 억지로 통합하지 않는다.

| 구분 | 값 | 사용 |
| --- | --- | --- |
| `deep-navy-900` | `#0D2340` | UI primary action, text, selected state |
| `coral-500` | `#FF6B5C` | UI route, waypoint, invitation, departure |
| logo navy | `#051F46` | canonical primary logo artwork |
| logo coral | `#FD5644` | canonical primary route artwork |
| app blue | `#192F82` | canonical app icon background |
| app coral | `#DE6653` | canonical app icon waypoint |

상태 표현은 색상만으로 전달하지 않는다. 텍스트, 아이콘, 모양과 함께 제공한다. 성공·오류·경고 의미를 Coral 하나로 대체하지 않으며, 기존 semantic status token의 의미를 보존한다.

## 범위

### 공통 디자인 토큰

- `packages/design-tokens/src/index.ts`의 UI 색상과 background, border, shadow 값을 `DESIGN.md` 기준으로 갱신한다.
- `apps/web/panda.config.ts`가 공통 토큰을 재노출하는 구조를 유지한다.
- Mobile은 같은 `@nexvoy/design-tokens` 값을 사용하며, 플랫폼별로 필요한 투명도·disabled 파생값만 별도 정의한다.
- 임의의 `#2563EB`, `#2EC4B6`와 하드코딩된 레거시 brand color를 신규 UI에 남기지 않는다.

### Web 적용

- `apps/web/app/layout.tsx`의 metadata title, description, Open Graph와 사용자 노출 이름을 갱신한다.
- `apps/web/app/manifest.ts`의 `name`, `short_name`, `theme_color`, icon 경로를 갱신한다.
- `apps/web/app/icon.svg`, `apps/web/app/favicon.ico`, `apps/web/app/apple-icon.png`를 canonical 에셋에서 생성한다.
- `apps/web/public/icons/*`, `apps/web/public/logo.png`와 관련 PWA 자산을 v12 파생본으로 교체한다.
- `Navbar`, 인증 화면, 홈, 공유 화면, 프로필, 알림과 이메일·공유 카피에서 사용자 노출 `온여정 / OnVoy`를 `갈래` 기준으로 교체한다.
- Web CSS의 직접 색상과 레거시 주석을 공통 토큰으로 이동한다.
- 기존 Next.js route, API path, analytics event, storage path는 변경하지 않는다.

### Mobile 적용

- `apps/mobile/app.json`의 표시 이름, icon, splash, adaptive icon, monochrome icon, notification icon과 색상 설정을 v12 기준으로 갱신한다.
- `apps/mobile/assets/branding/source`에 canonical SVG에서 파생하는 생성 원본을 둔다.
- `apps/mobile/assets/branding`과 `store`의 PNG 자산을 플랫폼 요구 크기로 재생성한다.
- 로그인, 회원가입, callback, 여행 상세, 초대, 알림 카피에서 사용자 노출 `온여정 / OnVoy`를 `갈래` 기준으로 교체한다.
- `scheme`, `bundleIdentifier`, Android `package`, EAS project ID, OAuth callback과 notification topic은 변경하지 않는다.
- Android adaptive mask와 notification monochrome은 워드마크 전체가 아닌 플랫폼 전용 보조 심벌을 사용한다.

### 생성 파이프라인

- canonical 생성은 `node docs/brand/v12/apply-approved-assets.js`를 기준으로 한다.
- 플랫폼 자산 생성은 기존 `scripts/apply-brand-assets.cjs`를 v12 canonical 입력에 맞게 교체하거나 v12 전용 파이프라인으로 분리한다.
- 생성된 제품 SVG에는 `<image>`, embedded bitmap, external font, `<text>`, script를 포함하지 않는다.
- PNG는 SVG에서 재생성하며, 수동으로 수정한 PNG를 canonical source로 사용하지 않는다.

## 제외 범위

- 화면 구조나 기능 흐름의 전면 리디자인
- 데이터베이스, RLS, API, Supabase RPC와 local-first 동기화 변경
- bundle ID, package name, scheme, production domain과 OAuth client 변경
- App Store Connect, Google Play Console 업로드
- v6 레거시 디렉터리 삭제 또는 과거 배포 자산의 강제 제거

## 구현 단계

### 1. 자산과 사용처 inventory

- `apps/web`, `apps/mobile`, `packages`의 브랜드명·색상·이미지 경로를 검색한다.
- 사용자 노출 문자열, 기술 식별자, 레거시 문서 문자열을 분류한다.
- 각 플랫폼의 기존 생성 스크립트와 산출물 경로를 확정한다.

### 2. 공통 토큰과 생성 파이프라인 교체

- 공통 UI 토큰을 `DESIGN.md` 기준으로 갱신한다.
- v12 canonical SVG에서 Web/Mobile 파생본을 생성한다.
- 생성 전후 SVG, PNG 크기와 alpha를 자동 검증한다.

### 3. Web 브랜드 적용

- metadata, manifest, favicon, Apple Touch icon, PWA icon을 교체한다.
- 공통 layout, Navbar, 인증 화면과 주요 사용자 노출 카피를 교체한다.
- 홈·여행·체크리스트·초대 화면의 토큰 참조를 점검한다.

### 4. Mobile 브랜드 적용

- Expo config와 launcher/splash/notification 자산을 교체한다.
- 인증·홈·프로필·여행·초대 화면의 사용자 노출 카피를 교체한다.
- Android adaptive mask, monochrome, notification과 iOS icon/splash의 실제 export를 확인한다.

### 5. 통합 검증

- Web production build와 Playwright E2E를 실행한다.
- Mobile typecheck, lint, authority tests, Expo export와 가능한 native debug build를 실행한다.
- 주요 Web/Mobile 화면의 before/after screenshot을 비교한다.
- 변경하지 않아야 하는 외부 식별자와 API 경로를 diff로 확인한다.

## 예상 변경 파일

| 영역 | 예상 경로 |
| --- | --- |
| 공통 토큰 | `packages/design-tokens/src/index.ts` |
| Web token mapping | `apps/web/panda.config.ts`, `apps/web/app/globals.css` |
| Web metadata | `apps/web/app/layout.tsx`, `apps/web/app/manifest.ts` |
| Web assets | `apps/web/app/icon.svg`, `apps/web/app/favicon.ico`, `apps/web/app/apple-icon.png`, `apps/web/public/` |
| Mobile config | `apps/mobile/app.json` |
| Mobile assets | `apps/mobile/assets/branding/` |
| Generation | `scripts/apply-brand-assets.cjs` 또는 v12 전용 script |
| User-facing copy | `apps/web/app/`, `apps/web/components/`, `apps/mobile/app/`, notification/email modules |

실제 변경 파일은 inventory 단계에서 확정하며, 기능과 무관한 대규모 UI 정리는 같은 PR에 포함하지 않는다.

## 검증 명령

```bash
pnpm build:packages
pnpm typecheck
pnpm lint:mobile
pnpm --filter nexvoy-app test:authority
pnpm build:web
pnpm test:e2e
pnpm test:production:p0
```

에셋 검증:

```bash
node docs/brand/v12/apply-approved-assets.js
node docs/brand/v12/render-assets.js
rg -n '<image|data:image|font-family|@font-face|<script|<text' \
  docs/brand/v12/logo-gallae-primary.svg \
  docs/brand/v12/logo-gallae-vertical.svg \
  docs/brand/v12/logo-gallae-horizontal.svg \
  docs/brand/v12/logo-gallae.svg \
  docs/brand/v12/route-symbol.svg \
  docs/brand/v12/app-icon.svg \
  docs/brand/v12/app-icon-dark.svg \
  docs/brand/v12/app-icon-light.svg \
  docs/brand/v12/app-icon-coral.svg \
  docs/brand/v12/app-icon-outline.svg \
  docs/brand/v12/favicon.svg \
  apps/mobile/assets/branding/source/*.svg \
  apps/web/app/icon.svg
```

## 위험 요소와 대응

| 위험 | 대응 |
| --- | --- |
| 브랜드명 교체가 기술 식별자까지 변경됨 | 표시 문자열과 scheme/package/API를 별도 목록으로 검증 |
| Android mask에서 아이콘이 잘림 | adaptive foreground 안전 영역과 실기기 launcher 검증 |
| Splash와 favicon에서 artwork가 과도하게 작아짐 | 플랫폼별 canvas와 minimum size를 별도로 렌더링 |
| UI token 교체로 semantic status가 변질됨 | Deep Navy/Coral과 success/error 의미를 분리 |
| PWA cache가 이전 아이콘을 유지함 | manifest, cache version, fresh install을 함께 확인 |
| 외부 공유·알림 문구가 레거시 이름으로 남음 | 사용자 노출 문자열 inventory를 Web/Mobile 외부 모듈까지 확장 |

## 롤백

- 애플리케이션 코드와 에셋 변경은 단일 PR 단위로 revert한다.
- v6 자산은 삭제하지 않고 롤백 기준으로 유지한다.
- bundle ID, package name, scheme과 외부 callback은 변경하지 않으므로 별도 복구 작업이 필요하지 않다.
- 앱 업데이트 후 캐시된 PWA icon이 남으면 manifest/cache version을 이전 release 기준으로 복원한다.

## 구현 결과

구현은 기준 브랜치 `refactoring/local-first-architecture` 최신 커밋에서 분기한
`codex/task-066-brand-service-rollout`에서 작업했으며, 변경을 다음과 같이 기능 단위 커밋으로
나누었다.

- `a449b38 docs(TASK-066): record rollout analysis`: inventory와 적용 계획 기록
- `6b47f62 feat(TASK-066): apply canonical brand asset pipeline`: v12 canonical 기반 Web/Mobile 파생 자산 생성 파이프라인과 공통 토큰 적용
- `04d8443 feat(TASK-066): apply gallae web branding`: Web 메타데이터, 자산 경로와 사용자 노출 카피 적용
- `8b1a87f feat(TASK-066): apply gallae mobile branding`: Mobile 인증·알림 카피와 Expo 표시명·브랜드 자산 적용
- `467859a refactor(TASK-066): align legacy web blue accents`: 남은 사용자 화면의 직접 Blue accent를 Deep Navy 기준으로 정렬

canonical 원본은 `docs/brand/v12`에 유지하고, 제품 런타임은 해당 SVG에서 생성한 플랫폼별 자산을
사용한다. 기존 `scheme`, bundle/package identifier, API path와 외부 식별자는 유지했다.

## 검증 결과

- PASS: `pnpm build:packages`
- PASS: `pnpm --filter nexvoy-web exec panda codegen`
- PASS: Web TypeScript, `pnpm build`
- PASS: Mobile TypeScript, lint, authority tests 18건, `pnpm build:mobile`
- PASS: 제품 SVG vector-only scan (`<image>`, embedded bitmap, external font, `<text>`, script 없음)
- BLOCKED: `pnpm test:e2e`
  - Playwright Chromium 실행 파일이 설치되지 않은 환경
  - E2E helper가 요구하는 local Supabase 대신 `.env.local`의 remote Supabase를 사용 중
  - 따라서 이번 결과는 애플리케이션 실패가 아니라 E2E 실행 환경 미충족으로 분류한다.

실제 Android/iOS 런처와 소형 아이콘의 시각 확인, local Supabase 기반 E2E 재실행은 PR의 후속
검증 항목으로 남긴다.

## 완료 조건

- [x] PR #392 canonical 브랜드 에셋이 기준 브랜치에 반영됨
- [x] Web과 Mobile의 표시명이 `갈래` 기준으로 통일됨
- [x] Web favicon, manifest, Apple Touch icon과 Mobile launcher/splash/notification이 v12 자산을 사용함
- [x] UI 토큰이 Deep Navy/Coral 기준으로 통일되고 레거시 Cobalt/Mint 신규 사용이 없음
- [x] 제품 SVG에 raster wrapper, 외부 폰트, script, text가 없음
- [ ] Web E2E 통과: local Supabase와 Playwright browser 설치 후 재검증 필요
- [x] Web production build 통과
- [x] Mobile typecheck, lint, authority tests와 Expo export가 통과함
- [ ] Android adaptive/monochrome와 iOS icon/splash의 실제 소형 기기 식별성 확인
- [x] bundle ID, package name, scheme, API path, OAuth callback과 analytics event가 변경되지 않음
- [x] 롤백 절차와 적용된 배포 자산 목록이 기록됨
