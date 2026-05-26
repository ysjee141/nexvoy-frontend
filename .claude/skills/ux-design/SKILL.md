---
name: ux-design
description: "OnVoy(온여정) 프로젝트의 UX 플로우 설계, 화면 와이어프레임 작성, 디자인 시스템(Clear Departure 테마) 점검, 접근성·반응형 가이드를 수행하는 스킬. 'UX 설계', '화면 설계', '와이어프레임', '모크업', '디자인 검토', '디자인 시스템 점검', '플로우 설계', '인터랙션 설계', 'a11y 확인', '접근성 검토' 요청 시 반드시 이 스킬을 사용. 신규 화면이나 컴포넌트 추가 시에도 사용."
---

# OnVoy UX/UI Design

OnVoy의 UX/UI 설계와 디자인 시스템 일관성을 보장하는 스킬. 코드는 작성하지 않으며, 와이어프레임·플로우·스펙 문서로 산출물을 표현한다.

## 설계 절차

### 1. 컨텍스트 로딩
- `docs/develop-context/design-guide.md` -- Clear Departure 테마, 10% Rule, 컬러·타이포·Radius·Shadow 토큰 (필수)
- `docs/develop-context/domain.md` -- Trip/Plan/Checklist/Template/User 도메인
- `src/components/` -- 기존 컴포넌트 패턴 탐색 (재사용 우선)
- planner 분석 (`_workspace/01_planner_analysis.md`) -- 요구사항·영향 범위

### 2. 사용자 여정 정의

다음 형식으로 작성:
```
사용자 → [진입점] → [화면 1] → [트리거] → [화면 2] → [완료/이탈]
```

각 단계에서:
- 사용자가 무엇을 보는가
- 무엇을 입력/선택하는가
- 시스템이 어떤 피드백을 주는가
- 에러/대안 경로는 무엇인가

### 3. 와이어프레임 작성

ASCII/마크다운 기반으로 화면 구조를 표현한다. 시각적 정밀도보다 **구조와 우선순위** 표현이 목적이다.

```
┌─────────────────────────────┐
│ ← [헤더 타이틀]      [액션] │  ← 상단 헤더 (15px bold, brand.ink)
├─────────────────────────────┤
│ [검색 입력]                 │  ← 8px radius, brand.hairline
│                             │
│ ┌─────────────────────────┐ │  ← 카드 (12px radius, shadow.sm)
│ │ 제목 (15px bold)        │ │
│ │ 부가정보 (13px, muted)  │ │
│ │              [Primary]  │ │  ← Cobalt Blue 포인트 (10% Rule)
│ └─────────────────────────┘ │
│                             │
└─────────────────────────────┘
  ↑ Safe Area Bottom (모바일)
```

각 영역마다 다음을 명시:
- 사용 토큰 (색상/타이포/Radius)
- 인터랙션 (탭/스와이프/길게 누르기)
- 데이터 출처 (어떤 도메인 모델에서 오는가)

### 4. 디자인 시스템 점검

`docs/develop-context/design-guide.md`와 대조한다. 자세한 체크리스트는 `references/design-system-checklist.md` 참조.

핵심 점검 항목:
- **10% Rule**: Cobalt Blue가 사용자 행동·진행 상태에만 사용되는가
- **Border Radius**: 컨테이너 16px / 카드 12px / 버튼·입력 8px
- **타이포그래피**: 타이틀·체크리스트 항목 15px (`title-sub`) 통일
- **여백**: 기존 대비 1.5배 이상 확보 (Whitespace)
- **신규 토큰**: 임의 hex 색상 도입 금지. 부득이하면 사유 + 기존 토큰 확장 대안 제시

### 5. 인터랙션·모션 명세

| 트리거 | 동작 | 시각적 피드백 | 모션 (Framer Motion) |
|--------|------|-------------|---------------------|
| 탭 (Tap) | 페이지 이동 | hover/active 상태 | spring duration ~0.2s |
| 스와이프 좌 | 액션 노출 | 우측에서 슬라이드 | translateX, ease-out |
| 길게 누르기 | 컨텍스트 메뉴 | 확대 + 진동 | scale 1.05 |

체크리스트의 우측 액션은 항시 노출 금지 -- **스와이프로만** 노출 (시각적 노이즈 최소화)

### 6. 접근성·반응형

`references/a11y-checklist.md` 참조. 핵심:
- **터치 타깃 ≥ 44x44px** (모바일)
- **포커스 인디케이터** 명확 (키보드 내비)
- **콘트라스트** WCAG AA 이상 (`brand.ink` on white, `brand.muted` on white)
- **Safe Area**: 상단(notch)·하단(home indicator) 처리 명시
- **반응형 브레이크포인트**: 모바일 우선 → 태블릿 → 데스크탑

### 7. 결과 작성

`_workspace/01b_ux_design.md`에 다음 형식으로:

```markdown
# UX/UI 설계 문서

## 사용자 여정
(플로우 다이어그램)

## 화면 구조
### {화면명}
(ASCII 와이어프레임 + 영역별 설명)

## 인터랙션 명세
(인터랙션 테이블)

## 디자인 시스템 적용
### 사용 토큰
- 색상: brand.ink, brand.muted, primary-blue 등
- Radius: 16/12/8 어디에 어떻게
- Shadow: shadow.sm / shadow.md / shadow.primary

### 10% Rule 준수
- Cobalt Blue 적용 영역: ...

### 신규 토큰 필요 여부
- 없음 | 또는 (사유 + 대안 1개)

## 접근성·반응형
- a11y: ...
- Safe Area: top/bottom 처리
- 반응형: 브레이크포인트별 차이

## 구현 가이드
### ui-developer 전달 사항
- 컴포넌트 구조 (Atom/Molecule/Organism)
- props 인터페이스 제안
- 인터랙션·모션 spec

### frontend-developer 전달 사항
- 화면 흐름 (라우팅)
- 상태 전이 (Zustand 또는 컴포넌트 상태)
- 데이터 출처 (Service 메서드)
```

## 참고 자료
- `references/design-system-checklist.md` -- Clear Departure 테마 체크리스트
- `references/a11y-checklist.md` -- 접근성·반응형 체크리스트
- `references/wireframe-patterns.md` -- ASCII 와이어프레임 패턴 모음
