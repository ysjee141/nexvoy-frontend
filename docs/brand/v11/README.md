# 갈래 Brand System v11

> 상태: 이전 보드 재구성 실험, 신규 작업에는 사용하지 않음
>
> 현재 기준: `docs/brand/v12`

이번 v11은 사용자 제공 raster 보드를 `reference/brand-system-reference.png`로 등록하고, 이를 새 primary reference로 삼은 버전이다.

## 핵심 결정

- 워드마크: `갈래`
- primary logo: 한글 워드마크와 아래 경로, 오른쪽 웨이포인트의 조합
- lockup: vertical, horizontal, symbol-only
- canonical app icon: Deep Navy 바탕의 흰색 `갈래`와 Coral 경로
- 핵심 컬러: Deep Navy `#0D2340`, Coral `#FF6B5C`

## 자산

| 파일 | 용도 |
| --- | --- |
| `reference/brand-system-reference.png` | 제공된 전체 브랜드 시스템 raster 원본 |
| `reference/*-reference.png` | 원본 보드에서 분리한 raster reference |
| `logo-gallae-primary.svg` | primary true-vector 로고 |
| `logo-gallae-vertical.svg` | 세로 락업 true-vector |
| `logo-gallae-horizontal.svg` | 가로 락업 true-vector |
| `route-symbol.svg` | 경로 + 웨이포인트 심벌 |
| `app-icon.svg` | canonical dark app icon |
| `app-icon-*.svg` | 밝은 배경·딥 네이비·코랄·아웃라인 파생본 |
| `brand-system.svg/png` | v6 형식의 브랜드 시스템 보드 |
| `*-comparison.svg/png` | raster reference와 true-vector 오버레이 비교 |
| `extract-reference-assets.js` | 전체 보드에서 reference crop 재생성 |
| `trace-reference-assets.js` | VTracer spline path 기반 SVG 재생성 |
| `render-brand-system.js` | PNG 파생본과 브랜드 시스템 보드 생성 |
| `compare-reference-and-vector.js` | reference와 vector 비교 및 metric 생성 |

## 재생성

```bash
node docs/brand/v11/extract-reference-assets.js
node docs/brand/v11/trace-reference-assets.js
node docs/brand/v11/render-brand-system.js
node docs/brand/v11/compare-reference-and-vector.js
```

VTracer CLI가 필요하다.

```bash
cargo install --git https://github.com/visioncortex/vtracer vtracer-cli --locked --bin vtracer
```

제품에 사용하는 SVG에는 `<image>`, embedded bitmap, 외부 폰트와 스크립트를 포함하지 않는다. 비교 보드와 PNG는 검수용 파생본이다.
