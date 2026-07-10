# 하네스 디렉토리 구조와 변경 이력

> `CLAUDE.md`의 "하네스: OnVoy Development Team" 섹션에서 이전됨. 하네스(에이전트/스킬 구성) 유지보수 시에만 참조하면 되는 자료라 상시 로드 대상에서 분리했다.

## 디렉토리 구조

```
.claude/
├── agents/
│   ├── planner.md
│   ├── ux-designer.md
│   ├── ui-developer.md
│   ├── frontend-developer.md
│   ├── backend-developer.md
│   ├── reviewer.md
│   └── qa-engineer.md
└── skills/
    ├── onvoy-develop/SKILL.md
    ├── analyze/SKILL.md
    ├── ux-design/
    │   ├── SKILL.md
    │   └── references/
    │       ├── design-system-checklist.md
    │       └── a11y-checklist.md
    ├── backend-develop/
    │   ├── SKILL.md
    │   └── references/
    │       ├── rls-patterns.md
    │       ├── api-route-template.md
    │       └── resend-integration.md
    ├── code-review/
    │   ├── SKILL.md
    │   └── references/checklist.md
    └── qa-verify/
        ├── SKILL.md
        └── references/integration-checklist.md
```

## 변경 이력

| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-10 | 초기 구성 | 전체 | 1인 개발자를 위한 가상 개발 팀 하네스 구축 |
| 2026-04-10 | 절대 규칙 추가 | CLAUDE.md, developer, orchestrator | standard-dev-flow.md 기반 워크플로우 통합 |
| 2026-04-10 | 참조 경로 수정 | CLAUDE.md, orchestrator | standard-dev-flow.md를 docs/develop-context/로 이동 |
| 2026-04-17 | 토큰 최적화 | 전체 | SSOT 원칙 적용: 중복 규칙 참조화, 오케스트레이터 경량화(262→85줄), 에이전트 경량화 |
| 2026-05-12 | 팀 확장 4→7명 | agents/{ux-designer,ui-developer,frontend-developer,backend-developer}.md, skills/{ux-design,backend-develop}, onvoy-develop, CLAUDE.md | UX/UI 전문 영역 분리, developer를 frontend/backend로 분할하여 Supabase·Resend·디자인 시스템 도메인을 명확화. 기존 developer.md 제거. |
| 2026-07-10 | 문서 분리 (doctor 점검) | CLAUDE.md, docs/develop-context/harness-structure.md | 상시 로드되는 CLAUDE.md에서 유지보수 시에만 필요한 디렉토리 구조/변경 이력을 분리해 세션당 상주 컨텍스트 절감 |
