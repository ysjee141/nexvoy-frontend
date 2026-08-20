# 갈래 Brand System v12

v12는 사용자 제공 raster 보드와 별도 제공한 primary logo·app icon raster를 기준으로 확정한 canonical 브랜드 시스템이다. 문서용 reference와 제품용 clean vector를 분리하며, 승인 후보에서 파생 에셋을 재생성할 수 있다.

## 원칙

- `brand-system.png`는 제공된 전체 보드를 픽셀 그대로 보존한다.
- `brand-system.svg`는 문서용 self-contained reference wrapper다. 제품 로고로 사용하지 않는다.
- `reference/approved-*`는 최종 primary logo와 app icon의 직접 raster 기준이다.
- VTracer trace는 원본 비교와 QA intermediate다. canonical SVG는 승인 후보의 path 보정 결과를 적용한다.
- raster와 완전히 같은 벡터라고 주장하지 않는다. 구조 정합성, 작은 크기 식별성, vector-only 여부를 함께 검수한다.

## 자산

| 경로 | 용도 |
| --- | --- |
| `reference/brand-system-reference.png` | 사용자 제공 전체 raster 보드 |
| `reference/approved-primary-logo-reference.png` | 승인 primary logo raster 기준 |
| `reference/approved-app-icon-reference.png` | 승인 app icon raster 기준 |
| `brand-system.png` | 원본과 동일한 문서용 보드 |
| `brand-system.svg` | 원본 raster를 포함한 self-contained reference SVG |
| `logo-gallae-primary.svg` | 승인 primary clean true-vector logo |
| `logo-gallae-vertical.svg` | primary artwork 기반 vertical lockup |
| `logo-gallae-horizontal.svg` | primary artwork 기반 horizontal lockup |
| `route-symbol.svg` | primary에서 분리한 route + waypoint symbol |
| `app-icon.svg` | 승인 canonical app icon |
| `app-icon-*.svg` | light, dark, coral, outline app icon variants |
| `png/primary-1024x571.png` | primary logo export 미리보기 |
| `png/vertical-520x360.png` | vertical lockup export 미리보기 |
| `png/horizontal-780x400.png` | horizontal lockup export 미리보기 |
| `png/symbol-950x270.png` | route symbol export 미리보기 |
| `png/*-446x446.png` | app icon variants export 미리보기 |
| `*-comparison.png` | reference와 vector의 3분할 오버레이 검수본 |
| `comparison-metrics.json` | board·logo·app icon의 픽셀 비교 지표 |

## 승인 자산 반영

후보 검수가 끝난 뒤 canonical과 파생본을 갱신한다.

```bash
node docs/brand/v12/apply-approved-assets.js
node docs/brand/v12/render-reference-board.js
node docs/brand/v12/render-assets.js
node docs/brand/v12/compare-reference-and-vector.js
```

## 원본 보드 trace QA

보드 기반 추적을 다시 확인해야 할 때만 다음 명령을 실행한다. trace 결과는 `*-trace.svg` intermediate로 생성되며 canonical 자산을 덮어쓰지 않는다.

```bash
node docs/brand/v12/extract-reference-assets.js
node docs/brand/v12/prepare-trace-inputs.js
node docs/brand/v12/trace-reference-assets.js
```

VTracer CLI:

```bash
cargo install --git https://github.com/visioncortex/vtracer vtracer-cli --locked --bin vtracer
```

제품용 SVG에는 `<image>`, embedded bitmap, 외부 폰트와 스크립트를 포함하지 않는다. 단, `brand-system.svg`와 `*-comparison.svg`는 문서·검수용 wrapper이므로 raster image를 포함할 수 있다.
