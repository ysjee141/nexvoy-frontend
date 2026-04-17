---
name: code-review
description: "OnVoy(온여정) 프로젝트의 코드 리뷰를 수행하는 스킬. 컨벤션 준수, 아키텍처 검증, 디자인 시스템 감사, 보안(RLS) 확인을 포함한다. '코드 리뷰해줘', '리뷰해줘', '코드 검수', '코드 점검', '코드 확인해줘' 요청 시 사용. 커밋, PR, 변경 사항에 대한 리뷰 요청에도 반드시 이 스킬을 사용."
---

# OnVoy Code Review

OnVoy 프로젝트의 코드 변경 사항을 체계적으로 리뷰하는 스킬.

## 리뷰 절차

### 1. 변경 범위 파악
- `git diff` 또는 지정된 파일 목록에서 변경 사항 수집
- 변경 유형 분류: 신규/수정/삭제, 프론트/백엔드/스타일/DB

### 2. 필수 검증 (CRITICAL)

**아키텍처 레이어 분리:**
- 컴포넌트(View)에서 직접 Supabase 쿼리 작성 여부 -> Service 레이어 경유 필수
- 비즈니스 로직이 `src/services`에 위치하는지 확인
- 싱글톤 패턴 준수 여부

**타입 안전성:**
- `any` 타입 사용 여부
- DB 스키마 기반 인터페이스 준수 여부
- TypeScript 제네릭 캐스팅으로 타입 우회 여부

**보안 (RLS):**
- 새 테이블 -> RLS Enable + Owner Policy + (필요 시) Shared Policy
- `auth.uid()` 기반 접근 제어 완전성
- Storage 경로 규칙: `trips/[user_id]/[trip_id]/[filename]`, `profiles/[user_id]/avatar_[timestamp].jpg`

**플랫폼 분기:**
- 웹/모바일 양쪽에 영향이 있는 변경인지 확인
- 영향 있으면 `Capacitor.isNativePlatform()` 분기 존재 여부
- 모바일 UI 변경 시 Safe Area 처리 확인

### 3. 스타일링 검증

**Panda CSS 준수:**
- `css()` 함수 사용 확인 (인라인 스타일, Tailwind 미사용)
- `styled-system`의 디자인 토큰 활용 여부

**브랜드 일관성 (Clear Departure 테마):**
- `docs/develop-context/design-guide.md` 기준으로 검증
- 과거 민트색(#2EC4B6) 발견 시 -> 즉시 교체 필요

### 4. 코드 품질

**명명 규칙:**
- Components: PascalCase (예: TripHeaderContainer.tsx)
- Functions/Variables: camelCase
- Constants: UPPER_SNAKE_CASE
- Interfaces/Types: PascalCase, I/T 접두사 미사용
- 절대 경로(`@/`) 사용

**Supabase 클라이언트 구분:**
- Server Components -> `src/utils/supabase/server.ts`
- Client Components -> `src/utils/supabase/client.ts`

### 5. 결과 작성

```markdown
# 코드 리뷰 결과

## 종합 판정: PASS | NEEDS_FIX | CRITICAL

## 필수 수정 (반드시 수정 필요)
- [파일:라인] 이슈 설명 + 수정 방향

## 권장 수정 (개선 권장)
- [파일:라인] 이슈 설명 + 수정 방향

## 디자인 시스템
- 브랜드 일관성: OK | 이슈 상세
- Safe Area: OK | 미처리 | N/A
- 10% Rule: OK | 위반

## 통과 항목
- 아키텍처 레이어: OK
- 타입 안전성: OK
- 보안(RLS): OK | N/A
- 플랫폼 분기: OK | N/A
```

상세 체크리스트가 필요하면 `references/checklist.md`를 읽어 항목별로 검증한다.
