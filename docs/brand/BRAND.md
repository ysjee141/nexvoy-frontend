# 갈래 / Nextward 브랜드 가이드

> 정책 버전: 5.0
>
> 현재 자산: `docs/brand/v12` 승인 canonical 반영본
>
> 상위 전략: `docs/rebrand/01_gallae_nextward_brand_strategy.md`

갈래는 여행의 방향을 혼자 정답처럼 제시하지 않고, 함께 고르고 이어가는 서비스다.

## 이름

| 구분 | 공식 표기 | 사용 |
| --- | --- | --- |
| 한국 | `갈래` | `ko`, `ko-KR` 화면과 고객 커뮤니케이션 |
| 글로벌 | `Nextward` | 한국어 이외 locale 화면과 고객 커뮤니케이션 |
| 시각 워드마크 | `갈래` | v12 승인 clean vector 로고 |
| 내부 canonical ID | `nextward` | 신규 내부 설정과 식별자 |
| 제작자 | `Oreonix` | 제품명과 분리한 제작자 표기 |

`Gallae`, `GAL-LAE`, `Next Ward`, `NextWard`, `온여정`, `OnVoy`는 신규 사용자 노출 브랜드명으로 사용하지 않는다. URL, package name, bundle ID, API path와 외부 식별자는 별도 migration 없이 변경하지 않는다.

## 메시지

| 용도 | 문구 |
| --- | --- |
| 한국 제품 설명 | `계획부터 기록까지, 함께 만드는 여행` |
| 캠페인 | `갈래? 갈래!` |
| 장기 비전 | `다녀온 여행에서 다음 여행을 발견하다` |
| Global tagline | `Every journey shapes the next.` |
| Global product | `Plan together. Travel your way.` |

물음표는 캠페인과 일반 문장에 사용한다. primary logo의 글자 자체에는 추가하지 않는다.

## 로고 시스템

### Primary logo

`갈래` 워드마크와 아래 경로, 오른쪽 웨이포인트를 하나의 로고로 취급한다. 글자는 둥근 끝을 갖지만 골격은 반듯하게 유지하며, 경로는 장식선이 아니라 선택이 목적지로 이어지는 흐름을 뜻한다. 상단 wordmark path는 승인 raster와 정합성이 높은 원본 vector path를 보존하고, 누락됐던 하단 glyph는 직선·둥근 연결부 기준으로 보정했다.

### Lockup

- `logo-gallae-primary.svg`: 대표 노출용
- `logo-gallae-vertical.svg`: 세로형 브랜드 락업
- `logo-gallae-horizontal.svg`: 가로형 브랜드 락업
- `route-symbol.svg`: 워드마크를 제외한 경로 심벌

락업을 일반 폰트나 CSS 텍스트로 재조판하지 않는다. 자간, 획 두께, 경로와 웨이포인트의 상대 위치를 임의로 바꾸지 않는다.

### App icon

canonical app icon은 Deep Navy 바탕에 흰색 `갈래` 워드마크와 Coral 경로를 놓은 형태다. 보드에 포함된 다음 파생본은 배경과 노출 환경에 따라 사용한다.

- `app-icon-light.svg`
- `app-icon-dark.svg`
- `app-icon-coral.svg`
- `app-icon-outline.svg`

앱 아이콘에 별도의 지도 핀, 비행기, 캐리어 심벌을 추가하지 않는다. 웨이포인트는 이미 로고와 앱 아이콘의 공통 목적지 신호다.

## 공식 자산

| 파일 | 목적 |
| --- | --- |
| `v12/logo-gallae-primary.svg` | 승인 primary clean true-vector logo |
| `v12/logo-gallae.svg` | primary logo 편의 alias |
| `v12/logo-gallae-vertical.svg` | 승인 primary artwork 기반 vertical lockup |
| `v12/logo-gallae-horizontal.svg` | 승인 primary artwork 기반 horizontal lockup |
| `v12/route-symbol.svg` | 승인 primary에서 분리한 route + waypoint symbol |
| `v12/app-icon.svg` | 승인 canonical app icon |
| `v12/app-icon-*.svg` | app icon variants |
| `v12/reference/brand-system-reference.png` | 제공된 전체 raster 보드 |
| `v12/reference/approved-primary-logo-reference.png` | 승인 primary logo raster 기준 |
| `v12/reference/approved-app-icon-reference.png` | 승인 app icon raster 기준 |
| `v12/brand-system.svg/png` | 원본과 동일한 문서용 브랜드 시스템 보드 |
| `v12/*-comparison.svg/png` | raster와 clean vector 비교 보드 |

v12 제품 SVG에는 `<image>`, embedded bitmap, 외부 폰트와 스크립트를 포함하지 않는다. `brand-system.svg`는 원본 보드 보존을 위한 문서용 wrapper이며, 비교 보드와 함께 제품 배포 자산에서 제외한다.

## 컬러 시스템

| 역할 | 토큰 | 값 |
| --- | --- | --- |
| UI 워드마크·기본 아이콘 토큰 | `deep-navy-900` | `#0D2340` |
| UI 경로·웨이포인트·초대 토큰 | `coral-500` | `#FF6B5C` |
| 밝은 표면 | `surface` | `#FFFFFF` |
| 제품 배경 | `background` | `#F7F8FC` |
| 따뜻한 보드 표면 | `background-warm` | `#FBF8F4` |
| 기본 텍스트 | `ink-900` | `#1D2433` |
| 보조 텍스트 | `ink-500` | `#667085` |
| 구분선 | `border` | `#D9DEEA` |

로고와 앱 아이콘은 Deep Navy, Coral, Surface를 중심으로 사용한다. Teal이나 임의의 보조 색상을 로고에 추가하지 않는다.

### 승인 raster artwork 색상

제공된 primary logo와 app icon raster는 서로 다른 원본 이미지에서 추출됐기 때문에 실제 artwork fill이 UI 토큰과 다르다. canonical SVG는 원본 정합성을 위해 다음 값을 보존한다.

| 자산 | Navy 계열 | Coral 계열 |
| --- | --- | --- |
| Primary logo | `#051F46` | `#FD5644` |
| App icon | `#192F82` | `#DE6653` |

UI 컴포넌트에는 위 artwork 색상을 임의로 확장하지 않고 `DESIGN.md`의 UI 토큰을 사용한다.

## 형태와 이미지

- 반듯한 글자 골격과 둥근 끝을 함께 사용한다.
- 둥근 모서리는 여행의 부담을 낮추되, 정보 구조를 흐리게 만들 정도로 과장하지 않는다.
- 사진은 실제 장소, 동행자와 준비 행동이 보이는 이미지를 우선한다.
- 사진 위에서는 단색 로고와 충분한 보호 여백을 사용한다.
- 장식용 gradient, blob, 과한 shadow와 유리 효과를 추가하지 않는다.

## 보이스

- 권장: `같이 정해볼까요?`, `새 여행 만들기`, `다녀왔어요`
- 지양: `프로젝트 생성`, `멤버 추가`, `방문 완료 처리`

정보는 분명하게, 말투는 제안형으로 유지한다. 구현되지 않은 AI 추천이나 커뮤니티 기능을 현재 제공 기능처럼 말하지 않는다.
