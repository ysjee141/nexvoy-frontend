---
name: onvoy-develop
description: "OnVoy 기능 개발 오케스트레이터. 요청 유형에 따라 에이전트 파이프라인을 구성하고 조율한다."
model: opus
---

# OnVoy Develop

## 요청 유형별 파이프라인

| 요청 유형 | 실행 Phase |
|----------|-----------|
| 기능 개발 / 버그 수정 | 1 → 1.5 → 1.7 → 2 → 3 → 4 → 5 → 6 |
| 백엔드만 (API/DB) | 1 → 1.5 → 2c → 3 → 4 |
| UI만 | 1 → 1.7 → 2a → 2b → 3 → 4 |
| 분석만 | Phase 1만 |
| 리뷰만 | Phase 3만 |

## Phase 정의

**Phase 1 — 분석** (`planner` 에이전트)
- 요구사항·영향 범위·구현 계획 수립
- 출력: `_workspace/01_planner_analysis.md`

**Phase 1.5 — GitHub 이슈·브랜치**
- `docs/develop-context/standard-dev-flow.md` 절차에 따라 이슈 생성 및 브랜치 체크아웃

**Phase 1.7 — UX 설계** (`ux-designer` 에이전트)
- 화면 구조, 인터랙션, 디자인 시스템 점검
- 출력: `_workspace/01b_ux_design.md`

**Phase 2 — 구현** (병렬 가능)
- 2a: `ui-developer` → `_workspace/02a_ui_components.md`
- 2b: `frontend-developer` → `_workspace/02b_frontend_changes.md`
- 2c: `backend-developer` → `_workspace/02c_backend_changes.md`
- 2a/2c는 병렬 실행 가능; 2b는 2a 완료 후 실행

**Phase 3 — 리뷰** (`reviewer` 에이전트, 최대 2회 루프)
- APPROVE → Phase 4 진행
- REQUEST_CHANGES → 해당 에이전트 재호출 후 Phase 3 재실행
- 출력: `_workspace/03_review_result.md`

**Phase 4 — QA** (`qa-engineer` 에이전트, 최대 2회 루프)
- PASS → Phase 5 진행
- FAIL → 해당 에이전트 재호출 후 Phase 4 재실행
- 출력: `_workspace/04_qa_result.md`

**Phase 5 — 워크스루**
- `walkthrough.md` 업데이트

**Phase 6 — PR 생성**
- `docs/develop-context/standard-dev-flow.md` PR 절차 준수
- Base: `develop`, 머지는 사용자가 수행

## 전역 규칙
- 모든 에이전트: `model: opus`
- 중간 산출물: `_workspace/` 디렉토리
- 개발 워크플로우 절대 규칙: `docs/develop-context/standard-dev-flow.md` 참조
