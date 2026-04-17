---
name: onvoy-develop
description: "OnVoy(온여정) 서비스의 개발 에이전트 팀을 조율하는 오케스트레이터. 기능 개발, 버그 수정, 코드 리뷰, QA 검증을 통합 관리한다. '기능 구현해줘', '버그 수정해줘', '개발해줘', '구현해줘', '만들어줘' 요청 시 사용. 후속 작업: '수정해줘', '보완해줘', '다시 해줘', '리뷰해줘', 'QA해줘', '피드백 반영', '이전 결과 개선', '코드 점검', '빌드 확인' 요청 시에도 반드시 이 스킬을 사용."
---

# OnVoy Development Orchestrator

1인 개발자를 위한 가상 개발 팀. 분석-구현-리뷰-QA 파이프라인과 피드백 루프를 관리한다.

## 필수 참조

- **워크플로우 (절대 규칙)**: `docs/develop-context/standard-dev-flow.md`
- **아키텍처/컨벤션**: `docs/develop-context/` 전체
- **GitHub 인증**: `.claude/settings.local.json`의 `GH_TOKEN` 환경변수로 `ysjee141` 계정 사용

## 에이전트 구성

| 에이전트 | subagent_type | 모델 | 출력 |
|---------|--------------|------|------|
| planner | planner | opus | `_workspace/01_planner_analysis.md` |
| developer | developer | opus | `_workspace/02_developer_changes.md` |
| reviewer | reviewer | opus | `_workspace/03_reviewer_feedback.md` |
| qa-engineer | qa-engineer | opus | `_workspace/04_qa_report.md` |

## 워크플로우

### Phase 0: 컨텍스트 확인

1. `_workspace/` 존재 여부로 실행 모드 결정:
   - **미존재** -> Phase 1로 진행
   - **존재 + 부분 수정** -> 해당 에이전트만 재호출
   - **존재 + 새 작업** -> `_workspace_{YYYYMMDD_HHMMSS}/`로 이동 후 Phase 1
2. 요청 유형별 분기:
   - **기능 개발** -> 전체 (Phase 1~6)
   - **버그 수정** -> Phase 1(간략) -> 2 -> 3 -> 4
   - **리뷰 요청** -> Phase 3만
   - **QA 요청** -> Phase 4만

### Phase 1: 분석 및 설계

Agent(planner)를 호출하여 요구사항 분석 및 구현 계획 수립.
복잡한 작업(파일 5개 이상 변경, DB 스키마 변경, 새 도메인)이면 `implementation_plan.md` 작성 후 **사용자 승인**.

### Phase 1.5: 이슈 등록 및 브랜치 생성

> 기능 개발/버그 수정 시 필수. 리뷰/QA만 요청한 경우 건너뜀.

1. `gh issue create`로 이슈 생성 (GH_TOKEN 필수)
2. `develop` 최신화 후 `feature/[issue-title]-[issue-number]` 브랜치 생성
3. 이후 모든 커밋은 feature 브랜치에서만

### Phase 2: 구현

Agent(developer)를 호출하여 계획 기반 코드 작성.

### Phase 3: 리뷰 루프 (최대 2회)

1. Agent(reviewer) 호출 -> `/code-review` 스킬로 체계적 리뷰
2. **PASS** -> Phase 4 | **NEEDS_FIX/CRITICAL** -> developer 재호출 -> reviewer 재검증

### Phase 4: QA 루프 (최대 2회)

1. Agent(qa-engineer) 호출 -> `/qa-verify` 스킬로 체계적 검증 + 빌드 실행
2. **PASS** -> Phase 5 | **ISSUES_FOUND** -> developer 재호출 -> qa-engineer 재검증

### Phase 5: Walkthrough

1. `walkthrough.md` 작성 (작업 요약, 변경 파일, 빌드/리뷰/QA 결과)
2. 사용자에게 보고 후 피드백 수집 -> 피드백 있으면 해당 Phase 재실행

### Phase 6: PR 생성 (사용자 승인 후)

1. 사전 병합 테스트: `git fetch origin develop && git merge origin/develop`
2. 원격 Push (이 시점에서 최초 push)
3. PR 생성: Base=`develop`, 본문에 `Resolves #[이슈번호]`
4. **PR 생성까지만** -- 승인/머지는 사용자가 직접

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| 에이전트 실패 | 1회 재시도. 재실패 시 부분 결과 보고 |
| 루프 2회 초과 | 미해결 이슈 목록과 함께 사용자에게 판단 요청 |
| 빌드 실패 | developer 재호출 -> qa-engineer 재검증. 빌드 성공 전 PR 금지 |
| merge 충돌 | 로컬에서 해결 후 재빌드. 해결 불가 시 사용자 알림 |
