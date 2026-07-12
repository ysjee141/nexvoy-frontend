---
name: ui-develop
description: "OnVoy UI 컴포넌트 구현 절차. Panda CSS 스타일링, 디자인 토큰, Framer Motion 인터랙션을 담당한다. onvoy-develop 오케스트레이터의 Phase 2a에서 사용하며, UI 컴포넌트/스타일링만 필요한 요청에도 직접 사용한다. 페이지/라우팅/상태 관리는 frontend-develop 스킬 영역이다."
---

# UI Develop

Panda CSS 기반 OnVoy 디자인 시스템(Clear Departure)을 컴포넌트로 구현하는 절차.

## 역할 경계

- 담당: `src/components/`, `src/styles/`, 디자인 토큰, Framer Motion 인터랙션
- 비담당: 페이지·라우팅·상태관리·API 호출 (`frontend-develop` 스킬 영역)

## 작업 전 필수 참조

- `docs/develop-context/design-guide.md` (Clear Departure 테마, 10% Rule)
- `docs/develop-context/conventions.md`
- `_workspace/01b_ux_design.md` (있으면)

## 핵심 규칙

- Panda CSS `css()`에 런타임 동적 값 금지 → 인라인 `style={}` 사용
- 10% Rule: 핵심 강조색은 전체 UI의 10% 이하
- 조건부 렌더링 시 `useRef` 대신 callback ref 사용

## 출력

`_workspace/02a_ui_components.md`
```
# UI 컴포넌트 구현 로그
## 신규/변경 컴포넌트 목록
## 디자인 토큰 적용 내역
## 인터랙션 구현
## 검증 포인트
```
