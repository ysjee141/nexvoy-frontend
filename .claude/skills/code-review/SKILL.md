---
name: code-review
description: "OnVoy 코드 리뷰 절차. onvoy-develop 오케스트레이터의 Phase 3에서 사용하며, '리뷰만 해줘' 같은 요청에도 직접 사용한다. 아키텍처·타입·보안·플랫폼·스타일 순으로 검토한다."
---

# Code Review

## 검토 우선순위

**Critical (즉시 수정)**
- 컴포넌트에서 Supabase 직접 호출 (Service 레이어 경유 필수)
- 신규 테이블에 RLS 미활성화 또는 `auth.uid()` 미사용 정책
- `any` 타입 사용
- 레거시 민트 컬러 `#2EC4B6` 사용 (Clear Departure 테마 위반)

**Major (머지 전 수정)**
- `docs/develop-context/architecture.md` 레이어 위반
- 인증 확인 없는 API Route
- Capacitor 플랫폼 분기 누락 (`Capacitor.isNativePlatform()`)
- Panda CSS `css()`에 런타임 동적 값 사용

**Minor (권고)**
- 네이밍 컨벤션 불일치 (`docs/develop-context/conventions.md`)
- 불필요한 `useEffect` / 과도한 re-render
- 디자인 토큰 미사용 (하드코딩 색상·크기)

## 절차

1. `_workspace/01_planner_analysis.md` ~ `02c_backend_changes.md` 전체 읽기
2. 변경된 파일 순서: DB 마이그레이션 → Service → API Routes → 컴포넌트 → 페이지
3. 위 우선순위 체크리스트 적용
4. 세부 체크리스트: `references/checklist.md`

## 출력: `_workspace/03_review_result.md`
```
# 코드 리뷰 결과
## 판정: APPROVE | REQUEST_CHANGES
## Critical 이슈
## Major 이슈
## Minor 이슈
## 재작업 요청 (영역: ui/frontend/backend + 구체적 수정 사항)
```
