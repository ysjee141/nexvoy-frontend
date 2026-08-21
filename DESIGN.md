---
version: 5
name: 갈래 / Nextward
description: 함께 고른 여행의 방향을 경로와 목적지로 이어주는 제품 디자인 시스템.

brand:
  koreanName: 갈래
  globalName: Nextward
  wordmark: 갈래
  productId: nextward
  assetSource: docs/brand/v12
  assetRevision: approved-user-vector-repair
  primaryLogo: docs/brand/v12/logo-gallae-primary.svg
  appIcon: docs/brand/v12/app-icon.svg

colors:
  journey-indigo-700: '#3342B3'
  journey-indigo-600: '#4052D2'
  departure-coral-500: '#F8725A'
  logo-indigo: '#3342B3'
  logo-coral: '#F8725A'
  app-indigo: '#3342B3'
  app-coral: '#F8725A'
  surface: '#FFFFFF'
  background: '#F8FAFF'
  background-warm: '#FFFDF8'
  ink-900: '#1D2433'
  ink-500: '#667085'
  border: '#E2E8F0'

typography:
  fontFamily: 'Pretendard, "Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  display-xl: { fontSize: 32px, fontWeight: 700, lineHeight: 1.2 }
  display-lg: { fontSize: 28px, fontWeight: 700, lineHeight: 1.25 }
  title-lg: { fontSize: 22px, fontWeight: 700, lineHeight: 1.35 }
  title-md: { fontSize: 18px, fontWeight: 600, lineHeight: 1.4 }
  body-md: { fontSize: 16px, fontWeight: 400, lineHeight: 1.5 }
  body-sm: { fontSize: 14px, fontWeight: 400, lineHeight: 1.45 }
  caption: { fontSize: 12px, fontWeight: 500, lineHeight: 1.4 }

radii:
  xs: 6px
  sm: 10px
  md: 14px
  lg: 20px
  full: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px
---

## Overview

갈래는 여행의 방향을 함께 고르고, 선택을 일정과 목적지로 이어주는 제품이다. 핵심 감정은 `설렘`, `초대`, `함께함`, `이어짐`이다.

## Brand Assets

- Primary logo: `docs/brand/v12/logo-gallae-primary.svg`
- Vertical lockup: `docs/brand/v12/logo-gallae-vertical.svg`
- Horizontal lockup: `docs/brand/v12/logo-gallae-horizontal.svg`
- Route symbol: `docs/brand/v12/route-symbol.svg`
- Canonical app icon: `docs/brand/v12/app-icon.svg`
- Brand board: `docs/brand/v12/brand-system.png`
- Approved raster references: `docs/brand/v12/reference/approved-primary-logo-reference.png`, `docs/brand/v12/reference/approved-app-icon-reference.png`

로고는 반드시 v12 승인 clean true-vector asset을 사용한다. `갈래`를 UI 폰트로 다시 입력하거나, 앱 아이콘에 새 심벌을 덧붙이지 않는다. `brand-system.svg`는 문서 reference wrapper이므로 제품 UI에 사용하지 않는다.

## Color Use

Journey Indigo는 방향성과 안정감, Departure Coral은 경로·웨이포인트·초대를 나타낸다.

- Primary action: `#4052D2`, hover/strong brand surface: `#3342B3`, 텍스트는 `#FFFFFF`
- Route and waypoint: `#F8725A`
- Page background: `#F8FAFF`
- Warm editorial surface: `#FFFDF8`
- Primary text: `#1D2433`
- Secondary text: `#667085`
- Border: `#E2E8F0`

UI 토큰과 raster artwork의 색상은 같은 Journey Indigo/Departure Coral 팔레트를 사용한다. 제공 raster는 원본 구조 검수용으로 보존하고, 제품 SVG는 승인 팔레트로 정규화한다. 상태는 색상만으로 구분하지 않는다.

## Shape Language

`반듯한 골격 + 둥근 끝 + 이어지는 경로`를 기본 형태 언어로 사용한다.

- 글자와 아이콘의 끝은 부드럽게 처리하되 정보 구조는 선명하게 유지한다.
- 카드와 입력은 10–14px radius를 기본으로 한다.
- shadow보다 surface 대비와 1px border를 우선한다.
- 장식용 blob, 과한 gradient, 유리 효과와 복잡한 경로 그래픽을 사용하지 않는다.
- 페이지 섹션은 넓은 흐름으로 구성하고 카드를 카드 안에 중첩하지 않는다.

## Typography

```css
font-family: Pretendard, "Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

로고는 서체가 아닌 path asset이고, UI 본문은 시스템 가독성을 우선한다.

## Components

### Primary Button

Journey Indigo 600 배경, 흰색 텍스트, 최소 48px 높이, 10px radius. 라벨은 `새 여행 만들기`, `동행자 초대`처럼 행동을 분명히 한다.

### Secondary Button

Surface 배경, Ink 텍스트, 1px border, primary와 같은 높이와 radius를 사용한다.

### Trip Card

여행명, 장소 또는 기간, 동행자 수와 진행 상태를 먼저 보여준다. 상태는 색상 점 하나에 의존하지 않는다.

### Place Row

장소명은 title, 주소와 일정은 body-sm muted, 방문 상태는 텍스트와 아이콘을 함께 제공한다.

### Invitation Surface

Coral은 초대와 제안의 순간에만 사용한다. `같이 정해볼까요?`처럼 부담 없는 문장으로 시작한다.

## Layout and Accessibility

- 모든 주요 touch target은 최소 44×44px로 유지한다.
- 모바일은 한 손 조작과 하단 우선 CTA를 고려한다.
- 데스크톱 콘텐츠 최대 폭은 1200–1280px로 제한한다.
- 본문·버튼은 WCAG 2.1 AA 대비를 충족한다.
- SVG에는 accessible name을 제공한다.
- 16px favicon과 아이콘은 세부 묘사보다 워드마크와 경로의 식별성을 우선한다.

## Voice

명령보다 제안, 시스템 용어보다 여행자의 언어를 사용한다.

| 권장 | 지양 |
| --- | --- |
| 새 여행 만들기 | 프로젝트 생성 |
| 동행자 초대 | 멤버 추가 |
| 다녀왔어요 | 방문 완료 처리 |
| 아직 정하지 않아도 괜찮아요 | 미완료 항목이 존재합니다 |

한국어 화면에는 `갈래`, 글로벌 화면에는 `Nextward`를 사용한다. 구현되지 않은 기능을 현재 제공 기능처럼 표현하지 않는다.
