-- 여행 초대 알림을 위한 트리거 및 함수
CREATE OR REPLACE FUNCTION public.handle_trip_invitation_notification()
RETURNS TRIGGER AS $$
DECLARE
    target_tokens TEXT[];
    inviter_name TEXT;
    trip_title TEXT;
    payload JSONB;
BEGIN
    -- 1. 초대한 사람의 닉네임 가져오기 (trips 테이블의 소유자)
    -- 주의: 초대 액션을 수행한 사람이 반드시 소유자라고 가정 (현재 RLS 정책상 초대 권한은 소유자에게 있음)
    SELECT p.nickname INTO inviter_name 
    FROM public.trips t
    JOIN public.profiles p ON t.user_id = p.id
    WHERE t.id = NEW.trip_id;

    -- 2. 여행 목적지 가져오기
    SELECT destination INTO trip_title FROM public.trips WHERE id = NEW.trip_id;

    -- 3. 초대받은 이메일과 일치하는 사용자의 FCM 토큰 가져오기
    -- (이미 가입된 유저일 경우에만 알림 발송 가능)
    SELECT array_agg(d.fcm_token)
    INTO target_tokens
    FROM public.profiles p
    JOIN public.user_devices d ON p.id = d.user_id
    WHERE p.email = NEW.invited_email;

    -- 토큰이 없으면 종료
    IF target_tokens IS NULL OR array_length(target_tokens, 1) = 0 THEN
        RETURN NEW;
    END IF;

    -- 4. 페이로드 준비
    payload := jsonb_build_object(
        'tokens', target_tokens,
        'title', '새로운 여행 초대!',
        'body', inviter_name || '님이 "' || trip_title || '" 여행에 초대했습니다.',
        'data', jsonb_build_object(
            'tripId', NEW.trip_id::text,
            'type', 'invitation'
        )
    );

    -- 5. Edge Function 호출
    PERFORM
      net.http_post(
        url := 'https://runbcaegpefqnljsswhv.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE((current_setting('request.headers', true)::jsonb)->>'authorization', '')
        ),
        body := payload
      );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성
DROP TRIGGER IF EXISTS on_trip_invitation ON public.trip_members;
CREATE TRIGGER on_trip_invitation
    AFTER INSERT ON public.trip_members
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION public.handle_trip_invitation_notification();
