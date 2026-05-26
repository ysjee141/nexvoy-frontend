# Next.js API Route 표준 템플릿

## 원칙
- 모든 라우트에 try/catch 필수 (조직 정책)
- 인증/검증/처리/응답 4단계 흐름
- 에러 메시지는 사용자 친화적 + 내부 구조 노출 금지
- `src/app/api/`는 `pnpm build:mobile`에서 제거되므로 모바일 클라이언트는 직접 Supabase 또는 CapacitorHttp 사용

## GET 템플릿 (조회)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { TripService } from '@/services/TripService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 파라미터 검증
    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { ok: false, error: '잘못된 요청입니다.' },
        { status: 400 }
      );
    }

    // 2. 인증
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 3. 비즈니스 로직 (RLS가 권한 검증을 강제)
    const trip = await TripService.getInstance().getById(id);
    if (!trip) {
      return NextResponse.json(
        { ok: false, error: '여행을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 4. 응답
    return NextResponse.json({ ok: true, data: trip });
  } catch (err) {
    console.error('[GET /api/trips/[id]]', err);
    return NextResponse.json(
      { ok: false, error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

## POST 템플릿 (생성)

```typescript
export async function POST(req: NextRequest) {
  try {
    // 1. 입력 검증
    const body = await req.json();
    const validation = TripCreateSchema.safeParse(body); // zod
    if (!validation.success) {
      return NextResponse.json(
        { ok: false, error: '입력값을 확인해주세요.' },
        { status: 400 }
      );
    }

    // 2. 인증
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 3. 처리 (user.id를 서버에서 결정 -- 클라이언트가 보낸 값 신뢰 금지)
    const trip = await TripService.getInstance().create({
      ...validation.data,
      user_id: user.id, // 세션에서만 추출
    });

    return NextResponse.json({ ok: true, data: trip }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/trips]', err);
    return NextResponse.json(
      { ok: false, error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

## 응답 형식 컨벤션

성공:
```json
{ "ok": true, "data": { ... } }
```

실패:
```json
{ "ok": false, "error": "사용자 친화적 메시지" }
```

`error` 필드에는 절대 다음 정보 포함 금지:
- 스택 트레이스
- DB 컬럼명·테이블명
- 내부 파일 경로
- 환경변수 값
- 개인정보 (이메일·전화번호 등)

## 상태 코드 가이드

| 코드 | 의미 | 사용 시점 |
|------|------|----------|
| 200 | OK | 조회/수정 성공 |
| 201 | Created | 생성 성공 |
| 204 | No Content | 삭제 성공 (응답 본문 없음) |
| 400 | Bad Request | 입력 검증 실패 |
| 401 | Unauthorized | 인증 안 됨 |
| 403 | Forbidden | 인증은 되지만 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 409 | Conflict | 중복 등 |
| 500 | Internal Server Error | 그 외 |
