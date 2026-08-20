# Archived: 갈래 / Nextward Brand System v7

> 상태: 이전 검토본, v8로 대체됨
>
> 앱 아이콘: `waypoint` 확정
>
> 현재 기준: `docs/brand/v8` 및 `docs/brand/BRAND.md`

v7은 보존과 비교 검토를 위해 남겨둔 이전 시안이다. 신규 로고·앱 아이콘·플랫폼 자산은 v7에서 파생하지 않는다.

v7은 `갈래` 전용 한글 워드마크와 한국·글로벌 시장에서 함께 사용하는 공통 경로 심벌을 하나의 시스템으로 정의한다. 경로의 끝에는 원형 웨이포인트를 배치해 목적지 도착과 다음 선택 지점을 동시에 표현한다.

## 핵심 결정

- 한국어 워드마크는 둥근 끝처리와 직선 골격을 가진 전용 벡터 레터링이다.
- `갈`의 하단 획은 오른쪽으로 이어지는 여행 경로를 표현한다.
- 공통 심벌은 시작, 두 번의 방향 전환과 오른쪽 종점으로 구성한다.
- 앱 아이콘 후보 중 3번 `waypoint`를 최종 선택했다.
- 앱 아이콘은 Journey Indigo 700 배경 위에 흰색 경로와 Departure Coral 500 웨이포인트를 사용한다.
- 제공된 SVG의 경로 좌표, 곡률, 획 굵기와 웨이포인트 비례를 유지한다. 단, 원본에서 누락된 `래`의 `ㅐ` 가로획은 사용자 확인에 따라 보완한다.
- 글로벌 `Nextward` 전용 워드마크는 아직 포함하지 않는다.

## 파일

| 파일 | 역할 |
| --- | --- |
| `app-icon.svg` | 플랫폼 파생용 마스크 없는 정사각 앱 아이콘 원본 |
| `app-icon-preview.svg` | 제공 원본의 `rx=180` 프레임을 보존한 표시용 아이콘 |
| `app-icon-monochrome.svg` | Android themed icon과 단색 파생용 원본 |
| `logo-symbol.svg` | 밝은 배경용 공통 경로 심벌 |
| `logo-symbol-reverse.svg` | Indigo 배경용 반전 심벌 |
| `logo-gallae-ko.svg` | 기본 한국어 워드마크 |
| `logo-gallae-ko-mono-dark.svg` | 밝은 배경 단색 워드마크 |
| `logo-gallae-ko-mono-light.svg` | 어두운 배경 단색 워드마크 |
| `logo-lockup-gallae-horizontal.svg` | 심벌과 한국어 워드마크 가로 조합 |
| `favicon.svg` | 16–64px 소형 전용 심벌 |
| `construction.svg` | 경로와 웨이포인트의 기하 기준 |
| `brand-system.svg`, `brand-system.png` | 전체 브랜드 시스템 보드 |
| `png/` | 검토와 배포 준비용 크기별 PNG |
| `render-system.js` | SVG와 PNG를 재생성하는 단일 원본 |
| `reference/` | 사용자가 제공한 워드마크와 아이콘 SVG의 원형·색상 참조본 |

## 재생성

```bash
node docs/brand/v7/render-system.js
```

생성 결과는 직접 수정하지 않는다. 형태나 색상을 바꿀 때는 `render-system.js`와 브랜드 문서를 함께 갱신한 뒤 전체 산출물을 다시 생성한다.

## 적용 경계

v7은 `docs/brand` 안의 승인 디자인 원본이다. 이번 작업에서는 앱·Web, 스토어, manifest, metadata와 `brand:apply`를 변경하지 않는다. 실제 제품 적용은 `docs/brand/APP-BRAND-ASSET-GUIDE.md`에 따라 별도 작업으로 수행한다.

## 원본과 색상 정규화

- 워드마크와 아이콘 형태는 사용자가 제공한 SVG 좌표를 기준으로 사용한다.
- `래`의 모음 `ㅐ`에는 원본에서 누락된 가로획 `x=430→475, y=135`를 동일한 28px round stroke로 추가한다.
- 제공 SVG의 원래 색상은 `reference/`에 보존한다.
- 활성 v7 산출물은 문서 기준에 따라 워드마크를 Journey Indigo 600, 아이콘 배경을 Journey Indigo 700, 웨이포인트를 Departure Coral 500으로 정규화한다.
- 제공 아이콘의 둥근 프레임은 `app-icon-preview.svg`에 보존한다. 실제 플랫폼 파생용 `app-icon.svg`는 OS 이중 마스킹을 막기 위해 배경을 사각형 전체로 확장한다.

## 알려진 제한

- `Nextward` 전용 워드마크와 글로벌 lockup은 후속 브랜드 자산 범위다.
- 플랫폼별 safe area와 Android adaptive layer는 실제 애플리케이션 적용 작업에서 별도로 생성·검증한다.
