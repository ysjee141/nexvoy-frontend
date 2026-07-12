---
name: analyze
description: "OnVoy 요구사항 분석 및 구현 계획 수립 절차. onvoy-develop 오케스트레이터의 Phase 1에서 사용하며, '분석만 해줘' 같은 요청에도 직접 사용한다."
---

# Analyze

## 절차

1. **컨텍스트 로드**: `docs/develop-context/architecture.md`, `conventions.md`, `domain.md`, `rules.md`, `design-guide.md`
2. **요구사항 파악**: 기능 범위, 도메인 영향, 플랫폼(웹/모바일) 분기 여부 확인
3. **영향 범위 분석**: 변경·신규 파일 목록, DB 스키마 변경, API 변경, 컴포넌트 변경
4. **구현 단계 설계**: 단계별 의존성 파악, 병렬 가능 작업 식별
5. **위험 요소 및 검증 포인트 정의**: reviewer·qa가 검증할 체크포인트 명시

## 출력: `_workspace/01_planner_analysis.md`
```
# 분석 및 구현 계획
## 요구사항 요약
## 영향 범위
- 변경 파일 / 신규 파일 / 삭제 파일
- DB 스키마 변경 여부
- API 변경 여부
## 구현 단계 (의존성 순서)
## 플랫폼별 고려사항
## 위험 요소
## 검증 포인트 (reviewer/qa 전달용)
```

## ADR 작성 기준
아키텍처 결정이 포함된 경우 `docs/adrs/` 아래 ADR 파일 생성.
기존 ADR 형식: `docs/adrs/` 내 기존 파일 참조.
