# ☁️ OnVoy Supabase 활용 가이드

OnVoy의 백엔드 인프라인 Supabase를 효과적으로 활용하기 위한 AI 지침입니다.

## 1. 📂 클라이언트 및 서버 설정

프로젝트는 `@supabase/ssr` 패키지를 사용하여 서버와 클라이언트 환경에 맞는 인스턴스를 생성합니다.

- **브라우저 환경**: `src/utils/supabase/client.ts`의 `createClient()`를 사용합니다.
- **서버 환경 (Action/Route)**: `src/utils/supabase/server.ts`의 `createClient()`를 사용합니다.
- **미들웨어**: `src/utils/supabase/middleware.ts`에서 세션 갱신 및 인증 체크를 수행합니다.

## 2. 🔐 인증 (Authentication)

- 모든 보호된 경로는 미들웨어에서 인증 여부를 확인합니다.
- 인증 관련 컴포넌트는 반드시 `src/utils/supabase/client.ts`를 사용하여 클라이언트 측에서 세션을 관리해야 합니다.

## 3. 📊 데이터베이스 인터페이스 (PostgreSQL)

- **RLS (Row Level Security)**: 모든 테이블에는 RLS 정책이 적용되어 있습니다. 데이터 쿼리 시 현재 로그인한 사용자의 ID(`auth.uid()`)를 기반으로 보안이 유지되므로 별도의 복잡한 필터링 로직 이전에 RLS가 작동함을 이해해야 합니다.
- **Types**: 데이터베이스 스키마 기반의 타입을 정의하여 타입 안정성을 확보하십시오.

## 4. 📝 RLS 정책 생성 지침

보안상의 이유로 AI가 새로운 테이블을 생성하거나 수동으로 쿼리할 때 다음 RLS 원칙을 준수해야 합니다:

1.  `ENABLE ROW LEVEL SECURITY;` 를 가장 먼저 실행합니다.
2.  사용자 본인의 데이터에만 접근할 수 있도록 정책을 설정합니다.
    - 예: `CREATE POLICY "Users can only see their own trips" ON trips FOR SELECT USING (user_id = auth.uid());`
3.  공유 기능이 필요한 경우, `shared_members` 테이블 등 관계형 체크를 통해 정책을 확장합니다.

## 5. 📁 Storage (파일 관리)

- 여행 사진, 프로필 이미지 등은 Supabase Storage를 사용합니다.
- 적절한 버킷 권한과 파일 경로(예: `user_id/trip_id/image.jpg`)를 준수하십시오.
