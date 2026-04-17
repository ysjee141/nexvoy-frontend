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
> **상세 절차**: `docs/develop-context/standard-dev-flow.md` 참조

- **LOCAL FIRST**: 모든 커밋은 로컬 브랜치에서만. 검증 완료 전 원격 push 금지
- **브랜치**: `develop` 기준 `feature/[issue-title]-[issue-number]` 생성
- **필수 빌드 검증**: `pnpm build` + `pnpm build:mobile` 성공 필수
- **PR**: Base=`develop`, 승인/머지는 사용자가 수행. 별도 요청 없이 머지 금지
- **GitHub 인증**: `.claude/settings.local.json`의 `GH_TOKEN` 환경변수 필수 (`ysjee141` 계정)

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
| 2026-04-17 | 토큰 최적화 | 전체 | SSOT 원칙 적용: 중복 규칙 참조화, 오케스트레이터 경량화(262→85줄), 에이전트 경량화 |
