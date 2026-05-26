---
name: backend-develop
description: "OnVoy(온여정) 프로젝트의 백엔드 구현(Supabase 스키마·RLS, Service 레이어, Next.js API Routes, Resend 이메일 발송, 인증)을 수행하는 스킬. 'DB 스키마 추가', '테이블 만들기', 'RLS 정책', 'API 라우트 추가', '이메일 발송', 'Resend', 'Service 추가', 'Edge Function', '백엔드 구현' 요청 시 반드시 이 스킬을 사용. 마이그레이션 작성이나 보안 정책 작업에도 사용."
---

# OnVoy Backend Development

OnVoy의 백엔드 도메인(Supabase·API Routes·Resend)을 구현하는 스킬. 보안과 데이터 무결성을 최우선으로 한다.

## 작업 절차

### 1. 컨텍스트 로딩
- `docs/develop-context/architecture.md` -- 레이어 구조, Service 패턴
- `docs/develop-context/conventions.md` -- Supabase 클라이언트 구분
- `docs/develop-context/rules.md` -- RLS 원칙, 마이그레이션 절차
- `docs/develop-context/domain.md` -- 도메인 관계
- planner 산출물 (`_workspace/01_planner_analysis.md`) -- 데이터 모델 변경
- ux-designer 산출물 (`_workspace/01b_ux_design.md`) -- 화면 요구 데이터

### 2. DB 스키마·RLS 작업

**원칙: 보안은 DB 레벨에서 강제한다. 애플리케이션 코드의 user_id 비교는 보조 수단.**

#### 마이그레이션 작성
- 새 파일로 추가 (기존 마이그레이션 파일 수정 금지)
- 파일명: `{timestamp}_{description}.sql` (예: `20260512_add_trip_companions.sql`)
- 롤백 SQL을 보고서에 함께 작성 (실제 down migration 파일이 없더라도)

#### RLS 정책 (필수)
모든 신규 테이블에 적용:

```sql
-- 1. RLS 활성화
alter table public.{table_name} enable row level security;

-- 2. Owner Policy (소유자 본인만 CRUD)
create policy "{table_name}_owner_all"
  on public.{table_name}
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. (필요 시) Shared Policy -- 공유 멤버 read
create policy "{table_name}_shared_read"
  on public.{table_name}
  for select
  using (
    auth.uid() in (
      select member_id from trip_members where trip_id = {table_name}.trip_id
    )
  );
```

#### RLS 점검 체크리스트
- [ ] `auth.uid() = user_id` 조건 누락 없음
- [ ] INSERT/UPDATE에 `with check` 절 포함
- [ ] 공유 데이터는 별도 Policy로 명시적 정의 (Owner Policy에 OR 조건 섞지 않기)
- [ ] Anonymous/Service Role 우회 가능성 검토

### 3. Service 레이어 구현

`src/services/{도메인}Service.ts`에 싱글톤 클래스로 작성.

```typescript
// 예시: TripService
export class TripService {
  private static instance: TripService;
  private constructor() {}
  static getInstance(): TripService {
    if (!TripService.instance) TripService.instance = new TripService();
    return TripService.instance;
  }

  async getById(tripId: string): Promise<Trip | null> {
    try {
      const supabase = createClient(); // server 또는 client 컨텍스트별 분기
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('[TripService.getById]', err);
      throw err; // 호출 측에서 사용자 친화적 메시지로 변환
    }
  }
}
```

**원칙:**
- Service 메서드는 반드시 try/catch
- DB 컬럼명·내부 구조를 외부로 누설하지 않음 (호출 측에 일반화된 에러 메시지)
- Server Component → `utils/supabase/server.ts`
- Client Component → `utils/supabase/client.ts`
- Route Handler → `utils/supabase/server.ts` (또는 Route 전용 client)

### 4. Next.js API Routes

`src/app/api/{경로}/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // 1. 입력 검증 (zod 또는 수동)
    // 2. 인증 확인 (Supabase 세션)
    // 3. 비즈니스 로직 (Service 호출)
    // 4. 응답
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[POST /api/xxx]', err);
    // 사용자 친화적 메시지 + 안전한 상태 코드
    return NextResponse.json(
      { ok: false, error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

**원칙:**
- **모든 라우트에 try/catch 필수** (조직 정책)
- 에러 메시지에 스택·DB 컬럼·내부 경로 노출 금지
- HTTP status 적절히 사용 (400 검증 실패, 401 미인증, 403 권한 없음, 404 없음, 500 서버 오류)
- `src/app/api/`는 `pnpm build:mobile`에서 임시 제거되므로 **모바일 빌드 호환성 확인**

### 5. Resend 이메일

상세 가이드는 `references/resend-integration.md` 참조.

**핵심:**
- API 키는 `process.env.RESEND_API_KEY` (절대 코드/응답/로그에 노출 금지)
- 발신자는 `process.env.RESEND_FROM_EMAIL`
- 템플릿은 React 컴포넌트로 작성 (`@react-email/components` 활용 가능)
- 발송 실패는 사용자 흐름을 막지 않음 (best-effort) -- 실패 시 로그만 남기고 정상 응답
- 개인정보(이름·연락처)는 로그에 출력 금지 (마스킹)

### 6. 인증·인가

- 모든 보호된 API Route는 시작 시 Supabase 세션 확인:
  ```typescript
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  ```
- `user.id`를 절대 클라이언트가 보낸 값으로 대체하지 않음 (세션에서만 추출)
- Storage 경로 검증: `trips/[user_id]/[trip_id]/[filename]` -- user_id가 현재 사용자와 일치하는지 확인

### 7. 결과 작성

`_workspace/02c_backend_changes.md`:

```markdown
# 백엔드 변경 로그

## DB 스키마
| 테이블 | 변경 | 마이그레이션 파일 |
|--------|------|------------------|

## RLS 정책
| 테이블 | Policy 이름 | 시나리오 | auth.uid() 사용 |
|--------|-----------|---------|----------------|

## Service 변경
| 클래스 | 메서드 | 반환 타입 | 호출 측 (frontend 영역) |
|--------|--------|----------|----------------------|

## API Routes
| 경로 | Method | 입력 검증 | 인증 | 에러 핸들링 |
|------|--------|----------|------|------------|

## Resend (있을 시)
- 발신자: ${RESEND_FROM_EMAIL}
- 템플릿: ...
- 트리거: ...
- best-effort 처리: yes/no

## 보안 점검
- [ ] RLS 정책 빈틈 없음
- [ ] API Route 모두 try/catch
- [ ] 크리덴셜 노출 없음
- [ ] 개인정보 로그 마스킹 적용
- [ ] 모바일 빌드 호환성 (`src/app/api/` 의존성 분석)

## frontend-developer 전달
- 노출 Service 시그니처
- API 계약 (요청/응답 shape, 에러 케이스, 상태 코드)
```

## 참고 자료
- `references/rls-patterns.md` -- RLS 정책 패턴 모음 (Owner, Shared, Public Read)
- `references/api-route-template.md` -- API Route 표준 템플릿 (검증·인증·응답)
- `references/resend-integration.md` -- Resend 통합 가이드 (보안 + best-effort)
