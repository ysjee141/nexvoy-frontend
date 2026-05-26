---
name: onvoy-develop
description: "OnVoy(온여정) 서비스의 개발 에이전트 팀(planner, ux-designer, ui-developer, frontend-developer, backend-developer, reviewer, qa-engineer)을 조율하는 오케스트레이터. 기능 개발, 버그 수정, UI/UX 설계, 백엔드 구현, 코드 리뷰, QA 검증을 통합 관리한다. '기능 구현해줘', '버그 수정해줘', '개발해줘', '구현해줘', '만들어줘', '화면 만들어줘', 'API 추가해줘', '이메일 발송 추가' 요청 시 사용. 후속 작업: '수정해줘', '보완해줘', '다시 해줘', '리뷰해줘', 'QA해줘', '디자인 점검', '피드백 반영', '이전 결과 개선', '코드 점검', '빌드 확인' 요청 시에도 반드시 이 스킬을 사용."
---

# OnVoy Development Orchestrator

1인 개발자를 위한 7인 가상 개발 팀. 분석-설계-구현-리뷰-QA 파이프라인과 피드백 루프를 관리한다.

## 필수 참조

- **워크플로우 (절대 규칙)**: `docs/develop-context/standard-dev-flow.md`
- **아키텍처/컨벤션**: `docs/develop-context/` 전체
- **GitHub 인증**: `.claude/settings.local.json`의 `GH_TOKEN` 환경변수로 `ysjee141` 계정 사용

## 에이전트 구성

| 에이전트 | subagent_type | 모델 | 출력 |
|---------|--------------|------|------|
| planner | planner | opus | `_workspace/01_planner_analysis.md` |
| ux-designer | ux-designer | opus | `_workspace/01b_ux_design.md` |
| backend-developer | backend-developer | opus | `_workspace/02c_backend_changes.md` |
| ui-developer | ui-developer | opus | `_workspace/02a_ui_components.md` |
| frontend-developer | frontend-developer | opus | `_workspace/02b_frontend_changes.md` |
| reviewer | reviewer | opus | `_workspace/03_reviewer_feedback.md` |
| qa-engineer | qa-engineer | opus | `_workspace/04_qa_report.md` |

## 실행 모드

기본은 **하이브리드** — Phase별로 서브 에이전트와 부분 병렬 호출을 섞는다. 팀 통신이 필요한 단계는 없으며, 산출물 파일 기반으로 단계 간 데이터를 전달한다.

## 워크플로우

### Phase 0: 컨텍스트 확인

1. `_workspace/` 존재 여부로 실행 모드 결정:
   - **미존재** → Phase 1로 진행
   - **존재 + 부분 수정 요청** → 해당 에이전트만 재호출
   - **존재 + 새 작업** → `_workspace_{YYYYMMDD_HHMMSS}/`로 이동 후 Phase 1
2. 요청 유형별 분기:

   | 요청 유형 | 실행 Phase |
   |----------|----------|
   | **신규 기능 (UI + API 모두)** | 1 → 1.5 → 1.7 → 2c → (2a ∥ 2b) → 3 → 4 → 5 → 6 |
   | **UI/스타일 변경만** | 1(간략) → 1.7 → 2a → 2b(필요 시) → 3 → 4 |
   | **API/DB/이메일만** | 1 → 1.5 → 2c → 3 → 4 |
   | **버그 수정** | 1(간략) → 영향 도메인 dev만 호출 → 3 → 4 |
   | **디자인 점검만** | 1.7만 (코드 변경 없음) |
   | **리뷰 요청만** | 3만 |
   | **QA 요청만** | 4만 |

### Phase 1: 분석 및 설계 (planner)

Agent(`planner`, model: `opus`)를 호출하여 요구사항 분석 및 구현 계획 수립.
복잡한 작업(파일 5개 이상 변경, DB 스키마 변경, 새 도메인)이면 `_workspace/01_planner_analysis.md` 작성 후 **사용자 승인**.

### Phase 1.5: 이슈 등록 및 브랜치 생성

> 기능 개발/버그 수정 시 필수. 리뷰/QA/디자인 점검만 요청한 경우 건너뜀.

1. `gh issue create`로 이슈 생성 (GH_TOKEN 필수)
2. `develop` 최신화 후 `feature/[issue-title]-[issue-number]` 브랜치 생성
3. 이후 모든 커밋은 feature 브랜치에서만

### Phase 1.7: UX/UI 설계 (ux-designer)

> UI 영향이 있는 모든 작업에서 실행. 백엔드만 변경되는 작업은 생략.

Agent(`ux-designer`, model: `opus`)를 호출하여 `/ux-design` 스킬로 화면 구조·플로우·디자인 시스템 적용을 설계.
신규 디자인 토큰 추가나 design-guide 위반 사항이 있으면 **사용자 승인** 필수.

### Phase 2: 구현

구현은 도메인별로 분리된 3개 에이전트가 담당한다. 의존성에 따라 부분 병렬 실행한다.

**Phase 2c: 백엔드 (backend-developer)** -- 먼저 실행
- DB 스키마·RLS·Service·API Route·Resend가 필요한 경우
- Agent(`backend-developer`, model: `opus`) + `/backend-develop` 스킬
- 출력의 "Service 시그니처 / API 계약"이 다음 단계의 입력

**Phase 2a: UI 컴포넌트 (ui-developer)** -- 백엔드와 무관하게 시작 가능
- Panda CSS 컴포넌트, 디자인 토큰, Framer Motion 인터랙션
- Agent(`ui-developer`, model: `opus`)
- ux-designer의 와이어프레임·인터랙션 명세 소비

**Phase 2b: 프론트엔드 통합 (frontend-developer)** -- 2c, 2a 완료 후 실행
- 페이지·라우팅·Zustand·Service 호출·Capacitor 분기
- Agent(`frontend-developer`, model: `opus`)
- 2c의 Service 계약 + 2a의 컴포넌트 props 소비

**병렬화 규칙:**
- 2c와 2a는 동시 시작 가능 (서로 의존하지 않음)
- 2b는 2c와 2a가 모두 완료된 후 시작 (양쪽을 소비)
- 단순 작업은 일부 에이전트만 호출 (예: UI 폴리싱이면 2a만)

### Phase 3: 리뷰 루프 (reviewer, 최대 2회)

1. Agent(`reviewer`, model: `opus`) 호출 → `/code-review` 스킬로 체계적 리뷰
2. 리뷰 대상: 변경된 모든 영역 (UI/Frontend/Backend 통합 리뷰)
3. **PASS** → Phase 4 | **NEEDS_FIX/CRITICAL** → 해당 영역의 developer 재호출 → reviewer 재검증

### Phase 4: QA 루프 (qa-engineer, 최대 2회)

1. Agent(`qa-engineer`, model: `opus`) 호출 → `/qa-verify` 스킬로 빌드 + 통합 정합성 검증
2. 빌드 검증: `pnpm build` (필수) + `pnpm build:mobile` (모바일 영향 시 필수)
3. 통합 정합성: backend Service ↔ frontend 호출 측, ui-developer props ↔ frontend 소비 측 양방향 비교
4. **PASS** → Phase 5 | **ISSUES_FOUND** → 해당 영역의 developer 재호출 → qa-engineer 재검증

### Phase 5: Walkthrough

1. `walkthrough.md` 작성 (작업 요약, 변경 파일, UX 결정, 빌드/리뷰/QA 결과)
2. 사용자에게 보고 후 피드백 수집 → 피드백 있으면 해당 Phase 재실행
   - 디자인 피드백 → Phase 1.7
   - UI 컴포넌트 피드백 → Phase 2a
   - 페이지/상태 피드백 → Phase 2b
   - API/RLS 피드백 → Phase 2c

### Phase 6: PR 생성 (사용자 승인 후)

1. 사전 병합 테스트: `git fetch origin develop && git merge origin/develop`
2. 원격 Push (이 시점에서 최초 push)
3. PR 생성: Base=`develop`, 본문에 `Resolves #[이슈번호]`
4. **PR 생성까지만** -- 승인/머지는 사용자가 직접

## 데이터 흐름

```
planner → 01_planner_analysis.md
   │
   ├──→ ux-designer → 01b_ux_design.md
   │       │
   │       ├──→ ui-developer (2a) ──┐
   │       │                         │
   │       └──→ frontend-developer ──┤
   │                                 │
   └──→ backend-developer → 02c ─────┤
                                     ↓
                                  reviewer → 03
                                     ↓
                                qa-engineer → 04
                                     ↓
                                walkthrough.md
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| 에이전트 실패 | 1회 재시도. 재실패 시 부분 결과 보고 |
| 루프 2회 초과 | 미해결 이슈 목록과 함께 사용자에게 판단 요청 |
| 빌드 실패 | 영향 영역의 developer 재호출 → qa-engineer 재검증. 빌드 성공 전 PR 금지 |
| 모바일 빌드 실패 (build:mobile) | API Route 의존성 확인 → backend-developer + frontend-developer 협조 |
| merge 충돌 | 로컬에서 해결 후 재빌드. 해결 불가 시 사용자 알림 |
| 신규 디자인 토큰 필요 | ux-designer 보고서에 대안 1개와 함께 명시 → 사용자 승인 후 진행 |
| RLS 빈틈 발견 | qa-engineer가 CRITICAL로 마킹 → backend-developer 우선 수정 |
| Resend 발송 실패 | best-effort 처리 (사용자 흐름 차단 금지). 로그만 남기고 응답은 정상 |

## 테스트 시나리오

**정상 흐름 (신규 기능):**
1. "여행 멤버 초대 기능 추가" 요청
2. planner → 데이터 모델 파악 → ux-designer → 초대 화면·이메일 플로우 설계
3. backend-developer → `trip_invites` 테이블 + RLS + API + Resend 통합 → ui-developer 초대 카드 컴포넌트 + frontend-developer 초대 페이지 병렬
4. reviewer → 통합 리뷰 → qa-engineer → 빌드 + 정합성 검증
5. walkthrough → 사용자 승인 → PR

**에러 흐름 (RLS 빈틈):**
1. qa-engineer가 `trip_invites` 테이블에 INSERT Policy 누락 발견 → CRITICAL
2. backend-developer 재호출 → 마이그레이션 추가 → reviewer 재검증
3. PASS 후 qa-engineer 재검증 → PR

**부분 재실행 (UI 폴리싱):**
1. 기존 `_workspace/` 존재 + "초대 카드 디자인만 좀 더 미니멀하게" 요청
2. Phase 1.7만 실행 → ux-designer가 기존 와이어프레임 업데이트
3. Phase 2a만 실행 → ui-developer가 컴포넌트 수정
4. Phase 3, 4 통합 검증
