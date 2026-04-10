---
name: qa-verify
description: "OnVoy(온여정) 프로젝트의 빌드 검증, 통합 정합성 검사, 크로스 플랫폼 호환성 확인을 수행하는 QA 스킬. 'QA해줘', '검증해줘', '빌드 확인', '테스트해줘', '품질 검사', '통합 확인', '배포 전 점검' 요청 시 사용. 코드 변경 후 품질 보증이 필요한 모든 경우에 반드시 이 스킬을 사용."
---

# OnVoy QA Verification

OnVoy 프로젝트의 변경 사항을 빌드, 통합 정합성, 플랫폼 호환성 관점에서 검증하는 스킬.

## 검증 절차

### 1. 빌드 검증

**웹 빌드:**
```bash
pnpm build
```
- TypeScript 컴파일 에러 없음
- Panda CSS 빌드 정상
- Next.js 정적/동적 라우트 생성 정상

**모바일 빌드 (변경이 모바일에 영향 있을 때):**
```bash
pnpm build:mobile && npx cap sync
```
- 정적 내보내기(`out/`) 성공
- Capacitor 네이티브 자산 동기화 정상

### 2. 통합 정합성 -- "양쪽 동시 읽기" 원칙

경계면 검증은 반드시 생산자와 소비자 코드를 **동시에** 비교한다.

**Service <-> 컴포넌트 연결:**
1. `src/services/` 에서 Service 메서드의 반환 타입 추출
2. 해당 Service를 호출하는 `src/components/` 컴포넌트의 사용 타입 확인
3. 양쪽 shape 일치 여부 검증
4. 옵셔널 필드 null/undefined 처리 일관성 확인

**Store <-> 컴포넌트 연결:**
1. `src/store/` Zustand store의 상태 shape 확인
2. 컴포넌트에서 구독하는 selector의 반환 타입 확인
3. persist 미들웨어 사용 시 직렬화 호환성 확인

**라우팅 정합성:**
1. `src/app/` 하위 page.tsx 경로에서 URL 패턴 추출
2. 코드 내 모든 `href`, `router.push()`, `redirect()` 값 수집
3. 모든 링크가 실제 존재하는 페이지 경로와 매칭되는지 확인
4. route group `(group)`이 URL에서 제거되는 것을 고려

**Supabase 연동:**
1. Service에서 호출하는 테이블/함수 확인
2. RLS 정책이 해당 CRUD 시나리오를 커버하는지 확인
3. auth.uid() 기반 접근 제어 빈틈 없는지 확인
4. Storage 경로 규칙 준수: `trips/[user_id]/[trip_id]/[filename]`, `profiles/[user_id]/avatar_[timestamp].jpg`

### 3. 플랫폼 호환성

**웹/모바일 분기 검증:**
- 새로운 네트워크 요청: CapacitorHttp 사용 여부 확인
- 새로운 UI: Safe Area 처리 확인 (top/bottom)
- 알림/푸시: 플랫폼별 처리 확인
- 공유 기능: Web Share API / Native Share 분기 확인

### 4. 피드백 루프 분석

매 검증 후:
1. 발견된 이슈를 분류 (빌드/통합/플랫폼)
2. 이전 QA 보고서가 `_workspace/`에 있으면 읽고 반복 패턴 대조
3. 반복 패턴 발견 시 근본 원인 분석 + 프로세스 개선 제안
4. 예: "Safe Area 누락 반복 -> reviewer 체크리스트에 항목 추가 권장"

### 5. 결과 작성

```markdown
# QA 검증 보고서

## 빌드: PASS | FAIL
### 웹 빌드: PASS | FAIL
### 모바일 빌드: PASS | FAIL | N/A

## 통합 정합성: PASS | ISSUES_FOUND
### Service <-> 컴포넌트: OK | 이슈
### Store <-> 컴포넌트: OK | 이슈
### 라우팅: OK | 이슈
### Supabase 연동: OK | 이슈

## 발견된 이슈
- [CRITICAL] 파일:라인 + 설명 + 수정 방향
- [WARNING] 파일:라인 + 설명 + 수정 방향

## 피드백 루프
### 반복 패턴 (이전 검증과 비교)
### 프로세스 개선 제안
```

상세 통합 정합성 체크리스트는 `references/integration-checklist.md`를 읽어 항목별로 검증한다.
