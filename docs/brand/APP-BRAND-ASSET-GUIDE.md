# 갈래 앱 브랜드 자산 적용 가이드

> 현재 원본: `docs/brand/v12`
>
> 운영 규칙: `docs/brand/BRAND.md`
>
> 상태: 승인 canonical 반영, clean true-vector 및 오버레이 검수 완료

## 입력 원본

```text
v12/reference/brand-system-reference.png
v12/reference/approved-primary-logo-reference.png
v12/reference/approved-app-icon-reference.png
```

보드 crop은 다음 명령으로 재생성한다.

```bash
node docs/brand/v12/extract-reference-assets.js
```

원본 보드 trace QA가 필요할 때만 VTracer intermediate를 재생성한다.

```bash
node docs/brand/v12/prepare-trace-inputs.js
node docs/brand/v12/trace-reference-assets.js
```

승인된 후보를 canonical로 반영하고 파생본을 생성한다.

```bash
node docs/brand/v12/apply-approved-assets.js
```

브랜드 시스템 보드와 PNG 검토본은 다음 명령으로 생성한다.

```bash
node docs/brand/v12/render-reference-board.js
node docs/brand/v12/render-assets.js
node docs/brand/v12/compare-reference-and-vector.js
```

## 출력 계약

| 대상 | 입력 자산 | 요구 사항 |
| --- | --- | --- |
| 화면 대표 로고 | `v12/logo-gallae-primary.svg` | raster wrapper와 UI 폰트 조판을 사용하지 않음 |
| 세로 lockup | `v12/logo-gallae-vertical.svg` | 좁은 영역에서만 사용 |
| 가로 lockup | `v12/logo-gallae-horizontal.svg` | 헤더·스토어 설명 영역에서 사용 |
| 심벌 | `v12/route-symbol.svg` | 워드마크를 넣을 수 없는 보조 영역 |
| iOS App Store | `v12/app-icon.svg` | 446px canonical SVG에서 1024px 이상으로 export, 실제 플랫폼 검수 필요 |
| Android launcher | `v12/app-icon.svg` | OS mask 전 원본으로 사용 |
| 밝은 배경 앱 아이콘 | `v12/app-icon-light.svg` | 밝은 surface와 명확한 대비 확인 |
| 코랄 캠페인 아이콘 | `v12/app-icon-coral.svg` | 마케팅·프로모션 전용 |
| 아웃라인 아이콘 | `v12/app-icon-outline.svg` | 밝은 배경의 제한된 보조 노출 |
| Web favicon | `v12/favicon.svg` | 16·32px에서 워드마크가 무너지지 않는지 확인 |
| Splash | `v12/logo-gallae-primary.svg` | 아이콘을 확대해 대신 사용하지 않음 |

플랫폼별 monochrome, adaptive foreground와 maskable 파생본은 `app-icon.svg`에서 별도 생성한다. OS mask를 SVG에 한 번 더 강제로 넣지 않는다.

## 공통 규칙

- clean true-vector SVG는 승인 후보를 기준으로 하며, 원본 보드 trace는 VTracer QA intermediate로만 사용한다.
- 제품 SVG에는 `<image>`, embedded bitmap, 외부 폰트와 스크립트를 넣지 않는다.
- `brand-system.svg`, reference PNG와 comparison board는 문서·QA용이며 제품 런타임에 직접 배포하지 않는다.
- UI 토큰은 Deep Navy `#0D2340`와 Coral `#FF6B5C`를 사용한다. canonical artwork는 원본 정합성을 위해 primary `#051F46/#FD5644`, app icon `#192F82/#DE6653`를 보존한다.
- 워드마크의 글자 형태, 경로 곡률, 웨이포인트 위치와 비율을 유지한다.
- logo와 app icon을 한 자산 안에서 중복 조합하지 않는다.
- SVG의 `role`, `title`, `desc` 또는 화면 컨텍스트의 accessible name을 제공한다.

## 검증

- `rg -n '<image|data:image|font-family|@font-face|<script' docs/brand/v12/logo-gallae-primary.svg docs/brand/v12/logo-gallae-vertical.svg docs/brand/v12/logo-gallae-horizontal.svg docs/brand/v12/route-symbol.svg docs/brand/v12/app-icon.svg docs/brand/v12/app-icon-light.svg docs/brand/v12/app-icon-dark.svg docs/brand/v12/app-icon-coral.svg docs/brand/v12/app-icon-outline.svg docs/brand/v12/favicon.svg`로 제품 SVG를 검사한다.
- 승인 raster와 primary logo, canonical app icon을 v12 comparison board에서 함께 확인한다.
- app icon을 1024, 512, 446, 192, 64, 32, 16px로 렌더링해 글자와 경로의 식별성을 확인한다.
- 실제 iOS·Android mask, splash, favicon과 PWA manifest는 제품 적용 작업에서 별도로 검증한다.

이번 정리는 제품의 bundle ID, package name, URL, OAuth client, API path와 analytics event를 변경하지 않는다.
