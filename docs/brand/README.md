# 갈래 브랜드 문서

`docs/brand`는 제품과 개발자가 함께 참조하는 현재 브랜드 운영 문서와 자산을 보관한다.

## 현재 기준

| 항목 | 상태 |
| --- | --- |
| 한국 공식 표시명 | `갈래` |
| 글로벌 공식 표시명 | `Nextward` |
| primary logo | v12 승인 canonical 반영 |
| canonical app icon | v12 승인 canonical 반영 |
| 핵심 컬러 | Journey Indigo 700 `#3342B3`, Indigo 600 `#4052D2`, Departure Coral `#F8725A` |
| 제품 런타임 적용 | 별도 마이그레이션 필요 |

## 문서 구조

| 경로 | 역할 |
| --- | --- |
| [`BRAND.md`](BRAND.md) | 이름, 로고, 앱 아이콘, 컬러와 사용 규칙 |
| [`APP-BRAND-ASSET-GUIDE.md`](APP-BRAND-ASSET-GUIDE.md) | 앱·Web·스토어 파생과 검증 계약 |
| [`../rebrand/01_gallae_nextward_brand_strategy.md`](../rebrand/01_gallae_nextward_brand_strategy.md) | 브랜드 전략과 디자인 방향 |
| [`../rebrand/02_gallae_nextward_coding_agent_brand_guidelines.md`](../rebrand/02_gallae_nextward_coding_agent_brand_guidelines.md) | Coding Agent 실행 규칙 |
| [`v12/`](v12/README.md) | 현재 raster reference, 승인 clean vector와 브랜드 시스템 |
| [`v11/`](v11/README.md) | 이전 보드 재구성 실험 |
| [`v10/`](v10/README.md) | 이전 레퍼런스와 추적 이력 |
| [`v6/`](v6/README.md) | 폐기된 온여정 / OnVoy 레거시 |

## 자산 재생성

```bash
node docs/brand/v12/apply-approved-assets.js
node docs/brand/v12/render-reference-board.js
node docs/brand/v12/render-assets.js
node docs/brand/v12/compare-reference-and-vector.js
```

원본 보드 trace QA가 필요할 때는 `extract-reference-assets.js`, `prepare-trace-inputs.js`, `trace-reference-assets.js`를 실행한다. trace 결과는 canonical 자산을 덮어쓰지 않는다.

true-vector를 재생성하려면 VTracer CLI가 필요하다.

```bash
cargo install --git https://github.com/visioncortex/vtracer vtracer-cli --locked --bin vtracer
```

현재 루트 `pnpm brand:apply`는 레거시 파이프라인을 사용하므로 v12 canonical 적용 명령으로 간주하지 않는다.
