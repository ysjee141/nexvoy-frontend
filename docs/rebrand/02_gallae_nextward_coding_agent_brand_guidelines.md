# 갈래 / Nextward Coding Agent 브랜드 가이드라인

> 정책 버전: 5.0
>
> 상위 문서: `docs/rebrand/01_gallae_nextward_brand_strategy.md`
>
> 현재 자산: `docs/brand/v12` 승인 canonical 반영본

## 1. 확정 상수

```yaml
brand:
  canonical_product_id: nextward
  ko:
    display_name: 갈래
    wordmark: 갈래
    campaign: 갈래? 갈래!
    product_description: 계획부터 기록까지, 함께 만드는 여행
  global:
    display_name: Nextward
    primary_tagline: Every journey shapes the next.
    product_description: Plan together. Travel your way.
creator:
  name: Oreonix
  asset_source: docs/brand/v12
  asset_revision: approved-user-vector-repair
```

## 2. 자산 계약

| 필요 상황 | 참조 자산 |
| --- | --- |
| 대표 로고 | `docs/brand/v12/logo-gallae-primary.svg` |
| 세로 락업 | `docs/brand/v12/logo-gallae-vertical.svg` |
| 가로 락업 | `docs/brand/v12/logo-gallae-horizontal.svg` |
| 경로 심벌 | `docs/brand/v12/route-symbol.svg` |
| 앱·스토어·PWA | `docs/brand/v12/app-icon.svg` |
| 밝은 배경 | `docs/brand/v12/app-icon-light.svg` |
| 코랄 캠페인 | `docs/brand/v12/app-icon-coral.svg` |
| 아웃라인 보조 | `docs/brand/v12/app-icon-outline.svg` |

워드마크를 일반 폰트나 CSS 텍스트로 대체하지 않는다. 제품 SVG에는 `<image>`, embedded bitmap, 외부 폰트와 스크립트를 추가하지 않는다.

## 3. 생성과 검증

```bash
node docs/brand/v12/apply-approved-assets.js
node docs/brand/v12/render-reference-board.js
node docs/brand/v12/render-assets.js
node docs/brand/v12/compare-reference-and-vector.js
```

canonical을 다시 만들 때는 승인 후보를 `apply-approved-assets.js`로 반영한다. 원본 보드 trace QA가 필요할 때만 다음 intermediate 흐름을 사용한다.

```bash
node docs/brand/v12/extract-reference-assets.js
node docs/brand/v12/prepare-trace-inputs.js
node docs/brand/v12/trace-reference-assets.js
```

`trace-reference-assets.js`는 반드시 VTracer CLI를 사용하고 `*-trace.svg`만 생성한다. 수동 path 추정, 새 AI 이미지 생성, 폰트 outline 임의 제작으로 승인 primary 자산을 대체하지 않는다. 작은 웨이포인트 hole과 직선 구간처럼 추적 과정에서 소실되거나 흔들리는 식별 요소는 승인 후보 단계에서 명시적으로 보정한다.

```bash
cargo install --git https://github.com/visioncortex/vtracer vtracer-cli --locked --bin vtracer
```

검증 명령:

```bash
rg -n '<image|data:image|font-family|@font-face|<script' docs/brand/v12/logo-gallae-primary.svg docs/brand/v12/logo-gallae-vertical.svg docs/brand/v12/logo-gallae-horizontal.svg docs/brand/v12/route-symbol.svg docs/brand/v12/app-icon.svg docs/brand/v12/app-icon-light.svg docs/brand/v12/app-icon-dark.svg docs/brand/v12/app-icon-coral.svg docs/brand/v12/app-icon-outline.svg docs/brand/v12/favicon.svg
cat docs/brand/v12/comparison-metrics.json
```

비교 보드에만 raster `<image>`가 허용된다. 제품 자산에서 검색 결과가 나오면 수정한다.

## 4. 색상 상수

```ts
export const brandColors = {
  deepNavy900: '#0D2340',
  coral500: '#FF6B5C',
  surface: '#FFFFFF',
  background: '#F7F8FC',
  warmBackground: '#FBF8F4',
  ink900: '#1D2433',
  ink500: '#667085',
  border: '#D9DEEA',
} as const
```

로고와 앱 아이콘은 Deep Navy·Coral·Surface를 중심으로 사용한다. 색상만으로 상태를 전달하지 않고 텍스트, 아이콘과 모양을 함께 제공한다.

## 5. UI 실행 규칙

- `ko`, `ko-KR`에서는 `갈래`, 그 외 locale에서는 `Nextward`를 사용한다.
- 제안형 카피를 우선한다: `같이 정해볼까요?`, `새 여행 만들기`, `다녀왔어요`.
- 업무 도구 용어인 `프로젝트`, `태스크`, `멤버`, `아카이브`를 여행자 화면의 기본 카피로 사용하지 않는다.
- 로고와 앱 아이콘의 경로를 화면 장식으로 반복하지 않는다.
- 카드·입력은 10–14px radius, 주요 touch target은 최소 44×44px로 설계한다.
- 본문과 버튼은 WCAG 2.1 AA 대비를 충족한다.

## 6. 변경 경계

브랜드 교체만으로 다음을 변경하지 않는다.

- database primary key와 사용자 생성 데이터
- OAuth client, bundle ID, application ID, package name
- production domain, API path, callback URL
- analytics event, storage bucket, message topic

사용자 노출 문자열과 외부 식별자를 분리해 migration 범위를 먼저 분류한다.
