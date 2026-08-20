# Archived: 갈래 Brand System v9

> 상태: 이전 재해석 시안, v10으로 대체됨
>
> 상위 전략: `docs/rebrand/01_gallae_nextward_brand_strategy.md`
>
> 운영 규칙: `docs/brand/BRAND.md`

v9는 두 가지 시각 단서를 곡선형 레터링으로 재해석했던 이전 시안이다.

현재 제공 레퍼런스와 일치하는 기준은 `docs/brand/v10`이다. 신규 작업에서는 v9를 사용하지 않는다.

- 워드마크: 둥근 끝처리와 반듯한 골격을 가진 전용 `갈래?` 레터링
- 앱 아이콘: 흰색 여행 경로와 Coral 웨이포인트를 Indigo 바탕에 배치한 축약 심벌

첨부 이미지는 구조와 분위기를 참고한 레퍼런스다. 특정 서체나 픽셀을 복제하지 않으며, 제품 배포에는 이 디렉터리의 벡터 원본만 사용한다.

## Canonical Files

| 파일 | 용도 |
| --- | --- |
| `logo-gallae-question.svg` | 밝은 배경용 기본 워드마크 + Coral 경로 락업 |
| `logo-gallae-question-plain.svg` | 경로를 제외한 `갈래?` 워드마크 |
| `logo-gallae-question-mono-dark.svg` | 밝은 배경용 단색 워드마크 |
| `logo-gallae-question-mono-light.svg` | 어두운 배경용 반전 워드마크 |
| `app-icon.svg` | 앱 아이콘 마스터, OS 마스크 전 정사각형 |
| `app-icon-preview.svg` | 둥근 OS 마스크를 가정한 문서용 미리보기 |
| `app-icon-monochrome.svg` | Android themed icon·알림 등 단색 입력 |
| `favicon.svg` | 작은 크기용 앱 아이콘 심벌 |
| `construction.svg` | 워드마크 구조와 제작 규칙 |
| `brand-system.svg` | 전체 브랜드 시스템 보드 |
| `render-system.js` | SVG에서 PNG 파생본을 재생성하는 결정론적 스크립트 |

## Naming Decision

제품의 공식 한국어 표시는 `갈래`다. 물음표는 질문과 초대의 감정을 더하는 시각 워드마크의 일부로만 사용한다.

- 일반 UI 텍스트: `갈래`
- 공식 워드마크: `갈래?`
- 캠페인 카피: `갈래? 갈래!`
- 앱 아이콘: 글자를 넣지 않은 경로·웨이포인트 심벌

`갈래?`를 일반 폰트로 조판하거나 CSS 텍스트로 대체하지 않는다. 파일명, 비율, 획 굵기와 자간을 임의로 변경하지 않는다.

## Color Mapping

| 역할 | 토큰 | 값 |
| --- | --- | --- |
| 워드마크·앱 배경 | Journey Indigo 700 | `#3342B3` |
| UI 기본 강조 | Journey Indigo 600 | `#4052D2` |
| 경로·웨이포인트 | Departure Coral 500 | `#F8725A` |
| 경로·반전 워드마크 | Surface | `#FFFFFF` |
| 단색 워드마크 | Ink 900 | `#1D2433` |

PNG 파생본은 다음 명령으로 생성한다.

```bash
node docs/brand/v8/render-system.js
```

이 스크립트는 앱·Web 제품 경로를 변경하지 않는다. 실제 플랫폼 적용은 `docs/brand/APP-BRAND-ASSET-GUIDE.md`의 마이그레이션 절차를 따른다.
