---
name: onvoy-develop
description: "OnVoy(온여정) 서비스의 개발 에이전트 팀을 조율하는 오케스트레이터. 기능 개발, 버그 수정, 코드 리뷰, QA 검증을 통합 관리한다. '기능 구현해줘', '버그 수정해줘', '개발해줘', '구현해줘', '만들어줘' 요청 시 사용. 후속 작업: '수정해줘', '보완해줘', '다시 해줘', '리뷰해줘', 'QA해줘', '피드백 반영', '이전 결과 개선', '코드 점검', '빌드 확인' 요청 시에도 반드시 이 스킬을 사용."
---

# OnVoy Development Orchestrator

OnVoy 프로젝트의 개발 에이전트를 조율하여 고품질 코드를 생산하는 통합 스킬.
1인 개발자를 위한 가상 개발 팀으로서, 분석-구현-리뷰-QA의 전체 파이프라인과 피드백 루프를 관리한다.

## 절대 규칙 (위반 시 작업 실패)

이 오케스트레이터는 `.agents/workflows/standard-dev-flow.md`의 표준 워크플로우를 반드시 준수한다:

1. **분석 -> 이슈 -> 계획 승인 -> 구현 -> 검증 -> Walkthrough -> PR** 순서를 따른다
2. **LOCAL FIRST**: 모든 커밋은 로컬 브랜치에서만. 검증 완료 전 원격 push 금지
3. **브랜치**: `develop` 기준 `feature/[issue-title]-[issue-number]` 생성
4. **필수 빌드 검증**: `pnpm build` + `pnpm build:mobile` 성공 필수
5. **사전 병합 테스트**: PR 전 로컬에서 `git merge develop` 충돌 확인
6. **PR 생성까지만**: Base=`develop`, 본문에 `Resolves #NN`. 승인/머지는 사용자가 수행
7. **`develop`/`main` 직접 커밋 금지**

## 실행 모드: 서브 에이전트

## 에이전트 구성

| 에이전트 | subagent_type | 역할 | 모델 | 출력 |
|---------|--------------|------|------|------|
| planner | planner | 요구사항 분석, 구현 계획 수립 | opus | `_workspace/01_planner_analysis.md` |
| developer | developer | 기능 구현, 버그 수정 | opus | `_workspace/02_developer_changes.md` |
| reviewer | reviewer | 코드 리뷰, UX 감사 | opus | `_workspace/03_reviewer_feedback.md` |
| qa-engineer | qa-engineer | 빌드 검증, 통합 정합성 | opus | `_workspace/04_qa_report.md` |

## 워크플로우

### Phase 0: 컨텍스트 확인

1. `_workspace/` 디렉토리 존재 여부 확인
2. 실행 모드 결정:
   - **`_workspace/` 미존재** -> 초기 실행. Phase 1로 진행
   - **`_workspace/` 존재 + 부분 수정 요청** -> 부분 재실행. 해당 에이전트만 재호출
   - **`_workspace/` 존재 + 새 작업** -> 기존을 `_workspace_{YYYYMMDD_HHMMSS}/`로 이동 후 Phase 1 진행
3. 사용자 요청 유형 판별:
   - **기능 개발** -> 전체 파이프라인 (Phase 1~5)
   - **버그 수정** -> Phase 1(간략) -> Phase 2 -> Phase 3 -> Phase 4
   - **리뷰 요청** -> Phase 3만 실행
   - **QA 요청** -> Phase 4만 실행

### Phase 1: 분석 및 설계

Agent(planner) 호출:
```
Agent(
  description: "요구사항 분석 및 구현 계획 수립",
  subagent_type: "planner",
  model: "opus",
  prompt: """
    OnVoy 프로젝트의 분석 전문가로서 다음 작업을 수행하라:
    1. docs/develop-context/ 문서를 모두 읽어 프로젝트 컨텍스트를 파악
    2. 사용자 요청을 분석하고 영향 범위 파악
    3. _workspace/01_planner_analysis.md에 구현 계획 작성
    
    사용자 요청: {user_request}
  """
)
```

리더는 분석 결과를 확인하고 사용자에게 요약 보고한다.
복잡한 작업(파일 5개 이상 변경, DB 스키마 변경, 새 도메인 추가)이면 `implementation_plan.md`를 작성하여 **사용자 승인**을 받는다.

### Phase 1.5: 이슈 등록 및 브랜치 생성 (절대 규칙)

> 이 단계는 기능 개발/버그 수정 시 반드시 수행한다. 리뷰/QA만 요청한 경우는 건너뛴다.

1. **GitHub Issue 생성**: GitHub MCP를 사용하여 이슈 생성 (planner 분석 결과 기반)
2. **develop 브랜치 최신화**:
   ```bash
   git checkout develop && git pull origin develop
   ```
   - `develop`이 없으면: `git checkout -b develop origin/main`
3. **feature 브랜치 생성**:
   ```bash
   git checkout -b feature/[issue-title]-[issue-number]
   ```
4. 이후 모든 커밋은 이 feature 브랜치에서만 진행한다

### Phase 2: 구현

Agent(developer) 호출:
```
Agent(
  description: "구현 계획 기반 코드 작성",
  subagent_type: "developer",
  model: "opus",
  prompt: """
    OnVoy 프로젝트의 개발자로서 다음 작업을 수행하라:
    1. docs/develop-context/ 문서를 읽어 컨벤션 숙지
    2. _workspace/01_planner_analysis.md의 구현 계획을 읽기
    3. 계획에 따라 코드 구현
    4. _workspace/02_developer_changes.md에 변경 로그 작성
    
    {복잡도에 따라 단계별 지시 추가}
  """
)
```

### Phase 3: 리뷰 루프 (생성-검증 피드백)

**최대 2회 반복:**

1. Agent(reviewer) 호출:
   ```
   Agent(
     description: "코드 리뷰 및 UX 감사",
     subagent_type: "reviewer",
     model: "opus",
     prompt: """
       OnVoy 프로젝트의 리뷰어로서:
       1. docs/develop-context/ 문서를 읽어 검증 기준 숙지
       2. _workspace/02_developer_changes.md에서 변경 파일 목록 확인
       3. 변경된 코드를 읽고 Skill 도구로 /code-review를 호출하여 체계적 리뷰 수행
       4. _workspace/03_reviewer_feedback.md에 리뷰 결과 작성
     """
   )
   ```

2. 리더가 리뷰 결과를 확인:
   - **PASS** -> Phase 4로 진행
   - **NEEDS_FIX / CRITICAL** -> developer를 재호출하여 피드백 반영:
     ```
     Agent(developer, prompt: "_workspace/03_reviewer_feedback.md를 읽고 지적 사항 수정")
     ```
     -> reviewer를 재호출하여 수정 확인

### Phase 4: QA 검증 루프 (생성-검증 피드백)

**최대 2회 반복:**

1. Agent(qa-engineer) 호출:
   ```
   Agent(
     description: "빌드 검증 및 통합 정합성 검사",
     subagent_type: "qa-engineer",
     model: "opus",
     prompt: """
       OnVoy 프로젝트의 QA 엔지니어로서:
       1. _workspace/02_developer_changes.md에서 변경 파일 목록 확인
       2. Skill 도구로 /qa-verify를 호출하여 체계적 검증 수행
       3. 빌드 실행: pnpm build (모바일 영향 시 pnpm build:mobile && npx cap sync)
       4. 통합 정합성: 변경된 Service/컴포넌트/Store의 경계면 교차 비교
       5. _workspace/04_qa_report.md에 검증 결과 작성
     """
   )
   ```

2. 리더가 QA 결과를 확인:
   - **PASS** -> Phase 5로 진행
   - **ISSUES_FOUND** -> developer를 재호출하여 이슈 수정
     -> qa-engineer를 재호출하여 재검증

### Phase 5: Walkthrough 및 피드백 수집

1. `_workspace/` 중간 산출물 보존 (삭제하지 않음)
2. **walkthrough.md 작성**: 작업 내용과 검증 결과를 정리하여 사용자에게 보고
   ```markdown
   # Walkthrough
   ## 작업 요약
   ## 변경된 파일
   ## 빌드 검증 결과
   ## 리뷰 결과 (수정 횟수 포함)
   ## QA 결과
   ## 남은 사항 (있으면)
   ```
3. **피드백 요청**: "결과에서 개선할 부분이나 추가 요청이 있나요?"
4. 피드백이 있으면 해당 Phase로 돌아가 반영

### Phase 6: PR 생성 (사용자 승인 후)

> 사용자가 Phase 5의 Walkthrough를 확인하고 승인한 후에만 진행한다.

1. **사전 병합 테스트**:
   ```bash
   git fetch origin develop && git merge origin/develop
   ```
   - 충돌 발생 시 해결 후 재빌드
2. **원격 Push** (이 시점에서 최초로 push):
   ```bash
   git push -u origin feature/[issue-title]-[issue-number]
   ```
3. **PR 생성**: Base=`develop`
   - 본문에 `Resolves #[이슈번호]` 포함
   - 변경 내용 요약 + 테스트 체크리스트
4. **PR 생성까지만 수행** -- 승인/머지는 사용자가 직접 진행한다

## 데이터 흐름

```
사용자 요청
    |
[Phase 0: 컨텍스트 확인]
    |
[Phase 1: planner] --> 01_planner_analysis.md + implementation_plan.md(복잡 시)
    | (사용자 승인)
[Phase 1.5: 이슈 등록 + feature 브랜치 생성]
    |
[Phase 2: developer] --> 로컬 코드 변경 + 02_developer_changes.md
    |
[Phase 3: reviewer] --> 03_reviewer_feedback.md
    | (NEEDS_FIX? --> developer 재호출 --> reviewer 재검증, 최대 2회)
    |
[Phase 4: qa-engineer] --> 빌드 검증(pnpm build + build:mobile) + 04_qa_report.md
    | (ISSUES_FOUND? --> developer 재호출 --> qa-engineer 재검증, 최대 2회)
    |
[Phase 5: walkthrough.md + 피드백 수집]
    | (사용자 승인)
[Phase 6: 사전 병합 테스트 --> push --> PR 생성 (Base=develop)]
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| planner 실패 | 1회 재시도. 재실패 시 사용자에게 요청 명확화 요청 |
| developer 실패 | 에러 분석 후 1회 재시도. 재실패 시 부분 결과 보고 |
| reviewer 실패 | 리뷰 없이 QA로 진행, 보고서에 "리뷰 미완" 명시 |
| qa-engineer 실패 | 1회 재시도. 재실패 시 빌드 성공 여부만 수동 확인 |
| 리뷰 루프 2회 초과 | 미해결 이슈 목록과 함께 사용자에게 판단 요청 |
| QA 루프 2회 초과 | 미해결 이슈 목록과 함께 사용자에게 판단 요청 |
| 빌드 실패 | developer 재호출하여 에러 수정 후 qa-engineer 재검증. 빌드 성공 전 PR 진행 금지 |
| merge 충돌 | 로컬에서 충돌 해결 후 재빌드. 해결 불가 시 사용자에게 알림 |

## 테스트 시나리오

### 정상 흐름: 새 기능 개발
1. 사용자: "체크리스트에 카테고리별 필터링 기능 추가해줘"
2. Phase 1: planner가 Checklist 도메인 분석 + 구현 계획
3. Phase 1.5: GitHub Issue #42 생성, `feature/checklist-filter-42` 브랜치 생성
4. Phase 2: developer가 로컬 브랜치에서 구현
5. Phase 3: reviewer 리뷰 -> PASS
6. Phase 4: qa-engineer `pnpm build` + `pnpm build:mobile` + 통합 검증 -> PASS
7. Phase 5: walkthrough.md 작성 + 사용자 승인
8. Phase 6: push + PR 생성 (Base=develop, `Resolves #42`)

### 피드백 루프 흐름
1. Phase 3: reviewer가 "Safe Area 미처리" + "과거 민트색 발견" -> NEEDS_FIX
2. developer 재호출 -> Safe Area 패딩 추가 + 컬러 교체
3. reviewer 재호출 -> PASS
4. Phase 4 진행

### 에러 흐름
1. Phase 4: qa-engineer가 `pnpm build` 실패 발견
2. developer 재호출 -> 빌드 에러 수정
3. qa-engineer 재호출 -> `pnpm build` PASS + `pnpm build:mobile` PASS
4. Phase 5로 진행 (빌드 성공 전에는 절대 PR 생성하지 않음)
