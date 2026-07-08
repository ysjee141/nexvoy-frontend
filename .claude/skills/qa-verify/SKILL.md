---
name: qa-verify
description: "OnVoy QA 검증 절차. qa-engineer 에이전트가 사용한다. 빌드 검증과 통합 정합성을 확인한다."
---

# QA Verify

## 빌드 검증 (순서대로 실행)

```bash
pnpm typecheck        # 타입 오류 확인
pnpm build            # 웹 앱 빌드
pnpm build:mobile     # 모바일 빌드 (인프라 버그로 실패 시: 기록 후 Pass 처리)
```

## 통합 정합성 (양쪽 동시 읽기 원칙)

각 경계를 양쪽 동시에 읽어 타입·형태 불일치를 검출한다. 한쪽만 읽으면 불일치를 놓친다.

| 검증 항목 | 확인 방법 |
|----------|---------|
| Service ↔ 컴포넌트 | 반환 타입과 사용 측 타입 동시 비교 |
| Store ↔ 컴포넌트 selector | store 상태 형태와 selector 소비 형태 비교 |
| 라우팅 일관성 | `href`/`router.push` 경로와 실제 page 파일 경로 비교 |
| RLS 커버리지 | 신규 테이블 전체에 RLS 활성화 여부 |

## 추가 검증

- Storage 경로 규칙: `trips/[user_id]/[trip_id]/[filename]`, `profiles/[user_id]/avatar_[timestamp].jpg`
- 마이그레이션 파일 ↔ Service 레이어 ↔ RLS 정책 3자 일치 여부
- 세부 체크리스트: `references/integration-checklist.md`

## 출력: `_workspace/04_qa_result.md`
```
# QA 검증 결과
## 판정: PASS | FAIL
## 빌드 결과
## 통합 정합성 이슈
## 재작업 요청 (에이전트명 + 구체적 수정 사항)
## 플랫폼 호환성 메모
```
