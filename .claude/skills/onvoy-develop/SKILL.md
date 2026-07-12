---
name: onvoy-develop
description: "OnVoy 기능 개발 절차 전체(분석→구현→리뷰→QA→워크스루→PR)를 현재 세션이 직접 수행하는 오케스트레이터. 서브에이전트를 스폰하지 않는다. 기능 개발/버그 수정 요청 시 이 스킬로 처리하라. '분석만', '리뷰만', '백엔드만', 'UI만' 같은 부분 요청도 아래 표로 라우팅한다."
---

# OnVoy Develop

## 실행 원칙: 서브에이전트 없음

이 스킬은 Agent 도구로 서브에이전트를 스폰하지 않는다. 이전에는 각 Phase를 opus 서브에이전트
(planner, ux-designer, ui-developer, frontend-developer, backend-developer, reviewer,
qa-engineer)에게 위임했지만, 서브에이전트 1회 호출이 수만~10만 토큰 이상을 소모해(예: 분석 단계
1회 호출에 약 12.6만 토큰) 토큰 예산이 제한적인 경우 부담이 크다. 대신 아래 각 Phase를 **현재
세션이 직접** 수행하고, Phase별 세부 절차는 해당 전문 스킬(Skill 도구)을 불러와 그대로 따른다.

| Phase | 스킬 |
|-------|------|
| 1 (분석) | `analyze` |
| 1.7 (UX 설계) | `ux-design` |
| 2a (UI 컴포넌트) | `ui-develop` |
| 2b (페이지/상태/데이터 페칭) | `frontend-develop` |
| 2c (Supabase/API/이메일) | `backend-develop` |
| 3 (리뷰) | `code-review` |
| 4 (QA) | `qa-verify` |

## 컨텍스트 확인 (시작 전)

`_workspace/` 아래 이전 산출물이 있으면 곧바로 Phase 1부터 재실행하지 말고 먼저 판단한다:

- 사용자가 "이어서", "수정", "보완"을 요청 → 이전 산출물을 읽고 해당 Phase만 다시 수행
- 사용자가 새 기능/이슈를 요청 → 기존 `_workspace/`를 `_workspace_prev/`로 옮기고 Phase 1부터 새로
  시작
- `_workspace/`가 없으면 → 초기 실행

## 요청 유형별 파이프라인

| 요청 유형 | 실행 Phase |
|----------|-----------|
| 기능 개발 / 버그 수정 | 1 → 1.5 → 1.7 → 2 → 3 → 4 → 5 → 6 |
| 백엔드만 (API/DB) | 1 → 1.5 → 2c → 3 → 4 |
| UI만 | 1 → 1.7 → 2a → 2b → 3 → 4 |
| 분석만 | Phase 1만 |
| 리뷰만 | Phase 3만 |

## Phase 정의

**Phase 1 — 분석**
`analyze` 스킬을 불러와 그 절차대로 요구사항·영향 범위·구현 계획을 직접 작성한다.
출력: `_workspace/01_planner_analysis.md`

**Phase 1.5 — GitHub 이슈·브랜치**
`docs/develop-context/standard-dev-flow.md` 절차에 따라 이슈 생성과 브랜치 체크아웃을 직접
실행한다(Bash로 `gh issue create`, `git checkout -b`).

**Phase 1.7 — UX 설계**
`ux-design` 스킬을 불러와 화면 구조·인터랙션·디자인 시스템 점검·a11y를 직접 작성한다. 이 단계의
산출물은 문서이며 코드는 쓰지 않는다.
출력: `_workspace/01b_ux_design.md`

**Phase 2 — 구현**
- 2a: `ui-develop` 스킬 → `_workspace/02a_ui_components.md`
- 2b: `frontend-develop` 스킬 → `_workspace/02b_frontend_changes.md` (2a 완료 후 진행)
- 2c: `backend-develop` 스킬 → `_workspace/02c_backend_changes.md`

세 영역 모두 같은 세션이 순서대로 구현한다. 서브에이전트가 없으므로 실제 병렬 실행은 아니지만,
"2a→2b 순서, 2c는 2a/2b와 독립적"이라는 의존 관계는 그대로 유지한다 — 2c를 먼저 끝내고 2a/2b로
넘어가도 무방하다.

**Phase 3 — 리뷰**
`code-review` 스킬의 체크리스트로 스스로 검토한다. 최대 2회 루프.
- APPROVE → Phase 4로 진행
- REQUEST_CHANGES → 해당 Phase(2a/2b/2c)로 돌아가 수정 후 Phase 3 재실행
출력: `_workspace/03_review_result.md`

**Phase 4 — QA**
`qa-verify` 스킬로 빌드/통합 정합성을 검증한다. 최대 2회 루프.
- PASS → Phase 5로 진행
- FAIL → 해당 Phase로 돌아가 수정 후 Phase 4 재실행
출력: `_workspace/04_qa_result.md`

**Phase 5 — 워크스루**
`walkthrough.md`를 업데이트해 작업 내용과 결과를 사용자에게 보고한다.

**Phase 6 — PR 생성**
`docs/develop-context/standard-dev-flow.md`의 PR 절차를 따른다. Base는 작업 브랜치가 갈라져 나온
상위 브랜치(예: `develop`, 또는 refactor 트랙이면 해당 트래킹 브랜치), 머지는 사용자가 수행한다.

## 자기 검증의 한계

구현과 리뷰/QA를 같은 세션이 수행하므로, 서로 다른 관점이 교차 검증하던 이전 구조의 이점(독립적
시각, blind spot 보완)이 줄어든다. 이를 보완하려면:

- Phase 3/4에 들어갈 때 구현 직후 바로 이어서 훑지 말고, 변경된 diff를 처음 보는 사람처럼 체크리스트를
  순서대로 다시 적용한다.
- Critical/Major 이슈는 발견 즉시 수정하고, 왜 그 위반이 생겼는지 원인을 남긴다.
- 사용자가 "독립적으로 검토해줘"처럼 명시적으로 요청하면, 그때는 Agent 도구로 `code-review`/
  `qa-verify` 절차를 general-purpose 서브에이전트에 1회 위임해 진짜 독립적인 시각을 받을 수 있다
  (예외적 선택지이며 기본 동작이 아니다).

## 전역 규칙

- 중간 산출물: `_workspace/` 디렉토리
- 절대 규칙: `docs/develop-context/standard-dev-flow.md`
