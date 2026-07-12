---
name: frontend-develop
description: "OnVoy Next.js 페이지/라우팅, Zustand 상태 관리, 데이터 페칭, Capacitor 플랫폼 분기 절차. onvoy-develop 오케스트레이터의 Phase 2b에서 사용하며, 페이지/상태/데이터 페칭만 필요한 요청에도 직접 사용한다. UI 컴포넌트 구현은 ui-develop 스킬 영역이다."
---

# Frontend Develop

Next.js 앱 라우터, Zustand 상태, 데이터 페칭, Capacitor 플랫폼 분기를 다루는 절차.

## 역할 경계

- 담당: `src/app/` 페이지, `src/stores/`, 데이터 훅, Capacitor 플랫폼 분기
- 비담당: UI 컴포넌트·스타일(`ui-develop`), API Routes·DB(`backend-develop`)

## 작업 전 필수 참조

- `docs/develop-context/architecture.md`, `conventions.md`
- `_workspace/01_planner_analysis.md`, `01b_ux_design.md`, `02a_ui_components.md`, `02c_backend_changes.md`
  (존재하는 것만 읽는다)

## 핵심 규칙

- 모달 A→B 전환 시 `useModalBackButton` 60ms 지연 필요
- URL 파라미터 크로스탭 통신 금지 → 각 탭 직접 렌더링
- Capacitor 플랫폼 분기: `Capacitor.isNativePlatform()` 확인 후 처리

## 출력

`_workspace/02b_frontend_changes.md`
```
# 프론트엔드 변경 로그
## 페이지/라우팅 변경
## 상태 관리 변경
## 데이터 페칭 변경
## 플랫폼 분기 처리
## 검증 포인트
```
