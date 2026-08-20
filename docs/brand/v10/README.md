# 갈래 Brand System v10

> 상태: 이전 reference, 신규 작업에는 사용하지 않음
>
> 현재 기준: `docs/brand/v11`
>
> v10은 이전에 제공된 raster reference를 보존하는 아카이브다.
>
> 상위 전략: `docs/rebrand/01_gallae_nextward_brand_strategy.md`
>
> 운영 규칙: `docs/brand/BRAND.md`

v10은 사용자가 제공한 워드마크와 앱 아이콘을 시각적으로 그대로 보존하는 기준이다. v8과 v9처럼 형태를 새로 해석하거나 기하학적으로 재구성하지 않는다.

## Canonical Assets

| 파일 | 용도 |
| --- | --- |
| `reference/logo-gallae-reference.png` | 제공된 primary 워드마크 원본 |
| `reference/app-icon-reference.png` | 제공된 앱 아이콘 원본 |
| `logo-gallae-question.svg` | 기존 호환용 동일 렌더링 래퍼 |
| `logo-gallae-reference-wrapper.svg` | 제공 워드마크를 동일하게 포함한 SVG 래퍼, 비교용 |
| `app-icon.svg` | 제공 앱 아이콘을 동일하게 포함한 SVG 래퍼, 비교용 |
| `logo-gallae-reference-vector.svg` | 실제 path·circle·gradient 기반 워드마크 |
| `app-icon-reference-vector.svg` | 실제 path·circle·gradient 기반 앱 아이콘 |
| `logo-gallae-question-mono-dark.svg` | 현재는 동일 레퍼런스 보존용 별칭 |
| `logo-gallae-question-mono-light.svg` | 현재는 동일 레퍼런스 보존용 별칭 |
| `app-icon-preview.svg` | 현재는 동일 레퍼런스 보존용 별칭 |
| `brand-system.svg` | 레퍼런스 고정 브랜드 보드 |
| `brand-system.png` | 브랜드 보드 검토용 PNG |
| `logo-gallae-reference-comparison.png` | 워드마크 PNG·벡터·오버레이 비교 보드 |
| `app-icon-reference-comparison.png` | 앱 아이콘 PNG·벡터·오버레이 비교 보드 |
| `render-reference-assets.js` | 원본에서 SVG·PNG를 결정론적으로 생성 |
| `compare-reference-and-vector.js` | 래퍼와 실제 벡터의 동일 크기 비교 생성 |
| `trace-reference-assets.js` | VTracer spline 추적으로 true-vector SVG 재생성 |

`logo-gallae-question.svg`와 `app-icon.svg`는 기준 비교용 래퍼다. 실제 제품에 사용할 수 있는 true-vector asset은 `logo-gallae-reference-vector.svg`와 `app-icon-reference-vector.svg`다. 두 벡터는 이미지 태그, embedded bitmap, 외부 폰트 없이 path·circle·gradient·rect만 사용한다.

true-vector 자산은 VTracer의 `spline` 모드와 `cutout` 계층으로 제공 레퍼런스의 색상 영역과 곡선을 추적한다. 워드마크는 `color-precision 5 / max-colors 10`, 앱 아이콘은 `max-colors 8` 설정을 사용한다. 재생성 전에는 [VTracer CLI](https://github.com/visioncortex/vtracer)를 설치한다.

## Regeneration

```bash
node docs/brand/v10/render-reference-assets.js
node docs/brand/v10/trace-reference-assets.js
node docs/brand/v10/compare-reference-and-vector.js
```

VTracer 설치:

```bash
cargo install --git https://github.com/visioncortex/vtracer vtracer-cli --locked --bin vtracer
```

현재 제품 런타임의 앱·Web 설정은 변경하지 않는다. 실제 적용 시에도 이 원본을 사용하고, 기존 v6·v7·v8·v9 자산과 혼용하지 않는다.
