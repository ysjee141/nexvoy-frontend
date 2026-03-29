-- 1. Enable pg_net extension (if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Function to trigger the Edge Function
CREATE OR REPLACE FUNCTION public.handle_new_plan_notification()
RETURNS TRIGGER AS $$
DECLARE
    target_tokens TEXT[];
    trip_name TEXT;
    payload JSONB;
BEGIN
    -- Get trip destination for the message
    SELECT destination INTO trip_name FROM public.trips WHERE id = NEW.trip_id;

    -- 1. Find all members of the trip except the one who created the plan
    -- 2. Join with user_devices to get their FCM tokens
    SELECT array_agg(d.fcm_token)
    INTO target_tokens
    FROM public.trip_members m
    JOIN public.user_devices d ON m.user_id = d.user_id
    WHERE m.trip_id = NEW.trip_id
      AND m.status = 'accepted'
      AND m.user_id != auth.uid(); -- Don't notify the sender

    -- If no tokens found, exit
    IF target_tokens IS NULL OR array_length(target_tokens, 1) = 0 THEN
        RETURN NEW;
    END IF;

    -- Prepare the payload for the Edge Function
    payload := jsonb_build_object(
        'tokens', target_tokens,
        'title', '새로운 일정이 추가되었습니다!',
        'body', '[' || trip_name || '] 여행에 "' || NEW.title || '" 일정이 등록되었습니다.',
        'data', jsonb_build_object('tripId', NEW.trip_id::text)
    );

    -- Call the Supabase Edge Function via HTTP POST
    -- Note: Replace 'YOUR_PROJECT_REF' with your actual project reference
    -- Note: Ensure service_role key or similar is authorized if needed
    PERFORM
      net.http_post(
        url := 'https://runbcaegpefqnljsswhv.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE((current_setting('request.headers', true)::jsonb)->>'authorization', '') -- Or hardcode service_role key
        ),
        body := payload
      );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the Trigger
DROP TRIGGER IF EXISTS on_plan_created ON public.plans;
CREATE TRIGGER on_plan_created
    AFTER INSERT ON public.plans
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_plan_notification();
