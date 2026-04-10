---
name: analyze
description: "OnVoy(온여정) 프로젝트의 요구사항 분석, 코드 영향 범위 파악, 구현 계획 수립을 수행하는 분석 스킬. '분석해줘', '설계해줘', '계획 세워줘', '영향 범위 파악', 'ADR 작성', '어떻게 구현할지 알려줘' 요청 시 사용. 기능 개발 전 사전 분석이나 구현 전략 논의에 반드시 이 스킬을 사용."
---

# OnVoy Analysis & Planning

OnVoy 프로젝트의 요구사항을 분석하고 구현 계획을 수립하는 스킬.

## 분석 절차

### 1. 컨텍스트 로딩
- `docs/develop-context/` 문서 전체를 읽는다:
  - `architecture.md` -- 기술 스택, 레이어 구조, Capacitor 설정
  - `conventions.md` -- 코딩 규칙, 스타일링, 타입 안전성
  - `domain.md` -- Trip/Plan/Checklist/Template/User 도메인 관계
  - `rules.md` -- 개발 워크플로우, RLS 원칙, 디자인 DNA
  - `design-guide.md` -- Clear Departure 테마, 10% Rule
- 관련 ADR이 있으면 `docs/adrs/` 참조

### 2. 요구사항 분석
- 사용자 요청을 기술적 명세로 변환
- 영향받는 도메인 식별 (Trip, Plan, Checklist, Template, User)
- 프론트엔드/백엔드/DB 변경 범위 파악
- 기존 코드에서 유사 패턴 탐색 -- Glob, Grep으로 관련 파일 확인

### 3. 코드베이스 탐색
- `src/services/` -- 관련 Service 클래스 확인
- `src/components/` -- 관련 UI 컴포넌트 확인
- `src/app/` -- 영향받는 페이지/라우트 확인
- `src/store/` -- 관련 Zustand 스토어 확인
- 기존 패턴을 파악하여 일관성을 유지하는 계획을 수립한다

### 4. 구현 계획 작성

`_workspace/01_planner_analysis.md`에 다음 형식으로 작성:

```markdown
# 분석 및 구현 계획

## 요구사항 요약
(사용자 요청의 핵심을 1~3줄로)

## 영향 범위
### 변경 대상 파일
| 파일 | 변경 유형 | 설명 |
|------|----------|------|

### 새로 생성할 파일
| 파일 | 설명 |
|------|------|

### 데이터 모델 변경 (있는 경우)
| 테이블 | 변경 | RLS 필요 여부 |
|--------|------|-------------|

## 구현 단계
1. (구체적 파일/함수 명시)
2. ...

## 플랫폼별 고려사항
- 웹: (영향/처리 방안)
- 모바일: (영향/처리 방안 -- Safe Area, CapacitorHttp 등)

## 위험 요소
- (기술적 위험, 호환성 문제, 성능 우려 등)

## 검증 포인트 (reviewer/qa 전달용)
- (핵심 리뷰 포인트)
- (QA 테스트 시나리오)
```

### 5. ADR 작성 (아키텍처 결정이 필요한 경우)

기존 ADR 형식(`docs/adrs/`)을 따른다:
```markdown
# ADR-NNN: 제목
## 상태: 제안됨 (Proposed)
## 날짜: YYYY-MM-DD
## 문제 정의
## 의사결정
## 기대 효과
## 위험 요소 및 고려사항
## 추후 과제
```

ADR 번호는 기존 ADR 중 가장 높은 번호 + 1을 사용한다.
