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

## 하네스: OnVoy Development

**목표:** 1인 개발자를 위한 분석/구현/리뷰/QA 절차 -- 서브에이전트 없이 현재 세션이 직접 전 과정을 수행해, opus 서브에이전트 토큰 비용 없이 동일한 파이프라인 품질을 유지한다.

**스킬:**

| 스킬 | 용도 | 사용 Phase |
|------|------|-----------|
| onvoy-develop | 전체 파이프라인 오케스트레이터 (분석→구현→리뷰→QA→PR을 현재 세션이 직접 수행) | 전체 |
| analyze | 요구사항 분석 및 구현 계획 수립 | Phase 1 |
| ux-design | UX 플로우·와이어프레임·디자인 시스템(Clear Departure) 점검·a11y | Phase 1.7 |
| ui-develop | UI 컴포넌트 구현, Panda CSS 스타일링, 디자인 토큰, Framer Motion 인터랙션 | Phase 2a |
| frontend-develop | Next.js 페이지/라우팅, Zustand 상태, 데이터 페칭, Capacitor 플랫폼 분기 | Phase 2b |
| backend-develop | Supabase RLS·API Routes·Resend 패턴 | Phase 2c |
| code-review | 코드 리뷰, 아키텍처 검증, 디자인 시스템 감사 | Phase 3 |
| qa-verify | 빌드 검증, 통합 정합성 검사, 플랫폼 호환성 확인 | Phase 4 |

**실행 규칙:**
- 기능 개발, 버그 수정 요청 시 `onvoy-develop` 스킬로 처리하라 (서브에이전트를 스폰하지 않는다)
- `analyze`, `ux-design`, `code-review`, `qa-verify` 등은 독립적으로도 호출 가능
- 단순 질문, 파일 확인, 설정 변경은 스킬 없이 직접 응답
- 중간 산출물: `_workspace/` 디렉토리
- 서브에이전트는 사용자가 "독립적으로 검토해줘"처럼 명시적으로 요청한 예외적인 경우에만
  general-purpose로 1회 사용한다 — 기본 동작이 아니다

**파이프라인:**
```
[Phase 1: 분석] --> [Phase 1.5: 이슈/브랜치] --> [Phase 1.7: UX 설계]
      --> [Phase 2a: UI] --> [Phase 2b: Frontend]  (2c: Backend는 독립적으로 병행 가능)
      --> [Phase 3: 리뷰] --> [Phase 4: QA] --> [Phase 5: 워크스루] --> [Phase 6: PR]
```
모두 현재 세션이 순서대로 직접 수행한다. Phase 3/4에서 이슈 발견 시 해당 Phase로 돌아가 수정 후
재실행한다(최대 2회 루프).

**디렉토리 구조 및 변경 이력:** `docs/develop-context/harness-structure.md` 참조
