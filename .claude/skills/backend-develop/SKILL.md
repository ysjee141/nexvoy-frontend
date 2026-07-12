---
name: backend-develop
description: "OnVoy 백엔드 개발 절차. Supabase 스키마/RLS, Service 레이어, API Routes, Resend 이메일 패턴을 정의한다. onvoy-develop 오케스트레이터의 Phase 2c에서 사용하며, 백엔드(API/DB)만 필요한 요청에도 직접 사용한다."
---

# Backend Develop

## 역할 경계

- 담당: `src/services/`, `src/app/api/`, `supabase/migrations/`, Edge Functions
- 비담당: 페이지·컴포넌트 (`frontend-develop`/`ui-develop` 스킬 영역)

## 절차

**1. DB 스키마**
- `supabase/migrations/` 아래 타임스탬프 파일 생성
- 모든 신규 테이블에 `user_id uuid references auth.users` 필드 추가
- 패턴: `references/rls-patterns.md`

**2. RLS 정책**
- 모든 신규 테이블에 RLS 활성화 필수
- 정책 기준: `auth.uid()` — 서버 측 우회 금지
- 패턴: `references/rls-patterns.md`

**3. Service 레이어**
- `src/services/[domain]Service.ts` — 싱글턴 패턴
- 컴포넌트에서 Supabase 직접 호출 금지 (Service 경유 필수)
- 패턴: `references/api-route-template.md`

**4. API Routes**
- `src/app/api/[route]/route.ts`
- 인증: `createRouteHandlerClient` 사용, `session` 확인 필수
- 응답: `{ data } | { error: string }` 형태
- 패턴: `references/api-route-template.md`

**5. Resend 이메일**
- `src/services/emailService.ts` 경유
- React Email 템플릿: `src/emails/`
- 패턴: `references/resend-integration.md`

**6. 인증·인가**
- Supabase Auth 세션 기반
- 모바일: `Capacitor.isNativePlatform()` 분기 후 처리

## 핵심 규칙
- `any` 타입 사용 금지
- 마이그레이션 파일은 한 번 커밋 후 수정 금지 (새 파일로 변경)
- Storage 경로: `trips/[user_id]/[trip_id]/[filename]`, `profiles/[user_id]/avatar_[timestamp].jpg`
