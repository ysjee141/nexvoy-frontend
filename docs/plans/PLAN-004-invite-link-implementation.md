# 초대 링크를 통한 즉시 참여 기능 구현 계획

사용자가 이메일 입력 없이도 링크 공유만으로 동행자를 초대하고, 초대받은 사람이 여정 내용을 확인 후 즉시 참여할 수 있는 기능을 구현합니다.

## User Review Required

> [!IMPORTANT]
> - **보안**: 초대 링크는 누구나 접근 가능하므로, 유출 시 의도치 않은 사용자가 참여할 수 있습니다. (기존 '동행자 제거' 기능으로 사후 관리 가능)
> - **권한**: 링크를 통해 참여하는 사용자의 기본 권한은 '편집자(Editor)'로 설정할 예정입니다. 변경이 필요하시면 말씀해 주세요.

## Proposed Changes

### 1. Database (Supabase)

#### [NEW] `supabase/add_join_trip_via_token_rpc.sql`
- 특정 초대 토큰을 사용하여 안전하게 여정에 참여할 수 있도록 하는 RPC(Stored Procedure)를 추가합니다.

```sql
-- 초대 토큰으로 여정에 참여하는 함수
CREATE OR REPLACE FUNCTION public.join_trip_via_token(token_val text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- 함수 생성자 권한으로 실행 (RLS 우회 가능)
AS $$
DECLARE
    target_trip_id uuid;
    current_user_email text;
BEGIN
    -- 1. 토큰으로 trip_id 조회
    SELECT trip_id INTO target_trip_id FROM public.trip_shares WHERE share_token = token_val;
    IF target_trip_id IS NULL THEN
        RAISE EXCEPTION '유효하지 않은 초대 링크입니다.';
    END IF;

    -- 2. 현재 로그인한 사용자의 이메일 가져오기
    current_user_email := auth.jwt() ->> 'email';

    -- 3. 이미 멤버인지 확인
    IF EXISTS (SELECT 1 FROM public.trip_members WHERE trip_id = target_trip_id AND user_id = auth.uid()) THEN
        RETURN target_trip_id;
    END IF;

    -- 4. 멤버로 추가 (이미 'pending'인 데이터가 있다면 업데이트, 없으면 인서트)
    INSERT INTO public.trip_members (trip_id, user_id, invited_email, role, status)
    VALUES (target_trip_id, auth.uid(), current_user_email, 'editor', 'accepted')
    ON CONFLICT (trip_id, invited_email) 
    DO UPDATE SET user_id = auth.uid(), status = 'accepted';

    RETURN target_trip_id;
END;
$$;
```

---

### 2. Frontend Utilities

#### [MODIFY] [collaboration.ts](file:///Users/ysjee141/mySources/travel-pack/src/utils/collaboration.ts)
- `joinTripViaToken(token: string)` 메서드 추가 (RPC 호출)
- 토큰을 통해 여정의 기본 정보를 가져오는 `getTripSummaryByToken(token: string)` 메서드 추가

---

### 3. New Pages & Routes

#### [NEW] `src/app/join/[token]/page.tsx`
- 초대받은 사람이 처음 도달하는 랜딩 페이지입니다.
- **기능**:
    - 여정 제목, 참여자 수, 방장 닉네임 요약 정보 표시
    - '여정 참여하기' 버튼
    - 비로그인 사용자의 경우 '로그인 후 참여하기' 안내 및 로그인 페이지 유도

---

### 4. UI Components

#### [MODIFY] [CollaboratorModal.tsx](file:///Users/ysjee141/mySources/travel-pack/src/components/trips/CollaboratorModal.tsx)
- 상단에 '초대 링크 보내기' 섹션 추가
- 링크 복사 버튼 및 성공 메시지 구현

---

## Open Questions

- **링크 만료**: 초대 링크에 유효 기간(예: 3일)을 설정할까요, 아니면 무제한으로 할까요? (기본적으로 `trip_shares`에 `expires_at` 컬럼이 있어 활용 가능합니다.)
- **중복 참여**: 이미 참여 중인 사용자가 링크를 클릭했을 때 "이미 참여 중입니다"라고 안내하고 바로 여정 페이지로 이동시킬까요?

## Verification Plan

### Automated Tests
- `join_trip_via_token` RPC 함수가 올바르게 작동하는지 SQL 에디터에서 테스트
- 권한 없는 사용자가 토큰 없이 접근할 때 차단되는지 확인

### Manual Verification
1. 여행 소유자 계정으로 초대 링크 생성 및 복사
2. 시크릿 창(또는 다른 브라우저)에서 초대 링크 접속
3. 로그인 후 '참여하기' 클릭 -> 여정 상세 페이지로 리다이렉트 확인
4. 방장 계정에서 참여자가 올바르게 추가되었는지 확인
5. 방장 계정에서 참여자 강제 퇴장 기능 작동 여부 확인
