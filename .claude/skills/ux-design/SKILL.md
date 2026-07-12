---
name: ux-design
description: "OnVoy UX 설계 절차. onvoy-develop 오케스트레이터의 Phase 1.7에서 사용하며, UX 설계만 필요한 요청에도 직접 사용한다. 화면 구조, 인터랙션, 디자인 시스템 점검, 접근성을 다룬다. 코드는 작성하지 않는다."
---

# UX Design

## 역할 경계

- 담당: UX 플로우, 와이어프레임, 디자인 시스템 점검, a11y·반응형 가이드
- 비담당: 코드 구현 일체 (구현은 `ui-develop`/`frontend-develop` 스킬 영역)

## 절차

1. **컨텍스트 로드**: `docs/develop-context/design-guide.md`, `domain.md`, `_workspace/01_planner_analysis.md`
2. **사용자 여정 정의**: 진입점 → 핵심 액션 → 완료 상태 흐름 작성
3. **화면 구조 설계**: ASCII 와이어프레임 작성 (각 영역에 디자인 토큰 명시)
4. **인터랙션 명세**: 상태 전환, 로딩/에러/빈 상태, 애니메이션 방향
5. **디자인 시스템 점검**: `references/design-system-checklist.md` 적용
6. **접근성 검토**: `references/a11y-checklist.md` 적용

## 디자인 규칙 요약

| 항목 | 규칙 |
|-----|------|
| 테마 | Clear Departure — 여백·선명도 중심 |
| 10% Rule | 핵심 강조색은 전체 UI의 10% 이하 |
| 레거시 금지 | `#2EC4B6` 사용 불가 |
| 보더 반경 | container 16px / card 12px / button·input 8px |
| 여백 | 기존 spacing의 최소 1.5× 이상 유지 |

## 와이어프레임 작성 형식
```
┌─────────────────────────────┐
│ [token: surface.primary]    │
│  헤더 텍스트                 │
├─────────────────────────────┤
│ [token: surface.secondary]  │
│  콘텐츠 영역                 │
└─────────────────────────────┘
```
각 영역에 적용 토큰을 `[token: ...]` 형태로 표기한다.

## 출력: `_workspace/01b_ux_design.md`
```
# UX/UI 설계 문서
## 사용자 여정
## 화면 구조 (와이어프레임)
## 인터랙션 명세
## 디자인 시스템 적용 (토큰 목록 / 신규 토큰 여부)
## 접근성·반응형
## ui-developer / frontend-developer 전달 사항
```
