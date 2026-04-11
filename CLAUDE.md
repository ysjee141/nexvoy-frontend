# OnVoy (온여정)

여행 플랜 및 준비물을 관리하는 웹/모바일 하이브리드 서비스.

## 필수 참조 문서
- `docs/develop-context/` -- 아키텍처, 컨벤션, 도메인, 규칙, 디자인 가이드
- `docs/adrs/` -- 아키텍처 결정 기록
- `docs/develop-context/standard-dev-flow.md` -- 표준 개발 워크플로우 (절대 규칙)

> **모든 작업 전 `docs/develop-context/` 문서를 반드시 읽고 규칙을 준수하라.**

---

## 절대 규칙: 표준 개발 워크플로우

> 아래 규칙을 위반하면 작업 실패로 간주한다. 모든 에이전트와 작업에 예외 없이 적용된다.

### 1. 분석 및 이슈 등록
- 작업 전 `docs/develop-context/` 문서를 반드시 읽어 컨텍스트를 파악한다
- 복잡한 작업 시 `implementation_plan.md`를 작성하여 **사용자 승인**을 받는다
- `gh` CLI를 사용하여 **Issue**를 생성한다 (`.claude/settings.local.json`의 `GH_TOKEN` 환경변수 필수)

### 2. 로컬 우선 개발 (LOCAL FIRST)
- `develop` 브랜치를 최신화 후 이를 기준으로 feature 브랜치를 생성한다
  - `git checkout develop && git pull origin develop`
  - `develop`이 없으면 `main`에서 생성하고 최신화
  - `git checkout -b feature/[issue-title]-[issue-number]`
- **모든 작업과 커밋은 로컬 브랜치에서만 진행한다**
- **원격 푸시 금지**: 작업 완료 + 로컬 검증이 끝나기 전까지 push하지 않는다
- 작업 중 주기적으로 `git fetch origin develop && git merge origin/develop`으로 충돌을 예방한다

### 3. 필수 검증 (Mandatory Verification)
- **빌드 검증**: `pnpm build` 및 `pnpm build:mobile` 실행하여 빌드 성공 확인
- 빌드 에러 발생 시 **반드시 해결 후** 다음 단계로 진행한다
- **사전 병합 테스트**: PR 생성 전 로컬에서 `git merge develop`을 시도하여 충돌 없음을 확인한다
- `walkthrough.md`를 통해 작업 내용과 결과를 사용자에게 보고한다

### 4. PR 생성 규칙
- **Base Branch**: `develop` (main 직접 PR 금지)
- PR 본문에 `Resolves #NN` 또는 `Close #NN`으로 이슈 자동 연동
- **PR 생성까지만 수행** -- 승인 및 머지는 사용자가 직접 진행한다
- 별도 요청 없이 절대 머지하지 않는다
- **GitHub 인증**: `gh` CLI / `git push` 시 `.claude/settings.local.json`의 `GH_TOKEN` 환경변수 필수 (`ysjee141` 계정)

### 5. 배포 (Release)
- 배포 시점에 `develop -> main` Release PR을 생성한다
- 최종 머지는 사용자가 진행한다

---

## 하네스: OnVoy Development Team

**목표:** 1인 개발자를 위한 가상 개발 팀 -- 분석/구현/리뷰/QA 파이프라인과 피드백 루프로 최고 품질 코드 생산

**에이전트 팀:**

| 에이전트 | 역할 |
|---------|------|
| planner | 요구사항 분석, 영향 범위 파악, 구현 계획 수립 |
| developer | 기능 구현, 버그 수정, 컨벤션 준수 코딩 |
| reviewer | 코드 리뷰, 아키텍처 검증, 디자인 시스템 감사 |
| qa-engineer | 빌드 검증, 통합 정합성 검사, 플랫폼 호환성 확인 |

**스킬:**

| 스킬 | 용도 | 사용 에이전트 |
|------|------|-------------|
| onvoy-develop | 개발 팀 오케스트레이터 (전체 파이프라인 조율) | 리더 (메인) |
| analyze | 요구사항 분석 및 구현 계획 수립 | planner |
| code-review | 코드 리뷰 및 UX 감사 | reviewer |
| qa-verify | 빌드 및 통합 정합성 검증 | qa-engineer |

**실행 규칙:**
- 기능 개발, 버그 수정 요청 시 `onvoy-develop` 스킬을 통해 에이전트로 처리하라
- `code-review`, `qa-verify`, `analyze` 스킬은 독립적으로도 호출 가능
- 단순 질문, 파일 확인, 설정 변경은 에이전트 없이 직접 응답
- 모든 에이전트는 `model: "opus"` 사용
- 중간 산출물: `_workspace/` 디렉토리

**파이프라인 및 피드백 루프:**
```
[planner] --> [developer] <--> [reviewer] --> [qa-engineer] <--> [developer]
                            피드백 루프 1                    피드백 루프 2
                                          --> [사용자 피드백] --> 해당 Phase 재실행
                                                              피드백 루프 3
```

**디렉토리 구조:**
```
.claude/
├── agents/
│   ├── planner.md
│   ├── developer.md
│   ├── reviewer.md
│   └── qa-engineer.md
└── skills/
    ├── onvoy-develop/
    │   └── SKILL.md
    ├── analyze/
    │   └── SKILL.md
    ├── code-review/
    │   ├── SKILL.md
    │   └── references/
    │       └── checklist.md
    └── qa-verify/
        ├── SKILL.md
        └── references/
            └── integration-checklist.md
```

**변경 이력:**

| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-10 | 초기 구성 | 전체 | 1인 개발자를 위한 가상 개발 팀 하네스 구축 |
| 2026-04-10 | 절대 규칙 추가 | CLAUDE.md, developer, orchestrator | standard-dev-flow.md 기반 워크플로우 통합 |
| 2026-04-10 | 참조 경로 수정 | CLAUDE.md, orchestrator | standard-dev-flow.md를 docs/develop-context/로 이동 |
