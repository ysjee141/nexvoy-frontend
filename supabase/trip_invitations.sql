-- 1. Create table for invitation links
CREATE TABLE IF NOT EXISTS public.trip_invitation_links (
    id uuid default gen_random_uuid() primary key,
    trip_id uuid references public.trips(id) on delete cascade not null,
    token text unique not null,
    expires_at timestamp with time zone not null,
    created_by uuid references public.profiles(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.trip_invitation_links ENABLE ROW LEVEL SECURITY;

-- Allow owners/editors to create and view links
CREATE POLICY "Users can manage invitation links for their trips" ON public.trip_invitation_links
  FOR ALL USING (
    trip_id IN (
      SELECT id FROM public.trips WHERE user_id = auth.uid()
      UNION
      SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid() AND (role = 'owner' OR role = 'editor')
    )
  );

-- Allow anyone to view a link by token
CREATE POLICY "Anyone can select invitation link by token" ON public.trip_invitation_links
  FOR SELECT USING (true);


-- 2. RPC to generate invitation link
CREATE OR REPLACE FUNCTION public.generate_invitation_link(p_trip_id uuid)
RETURNS text AS $$
DECLARE
    new_token text;
BEGIN
    -- Check if user has permission (owner or editor)
    IF NOT EXISTS (
        SELECT 1 FROM public.trips WHERE id = p_trip_id AND user_id = auth.uid()
        UNION
        SELECT 1 FROM public.trip_members WHERE trip_id = p_trip_id AND user_id = auth.uid() AND (role = 'owner' OR role = 'editor')
    ) THEN
        RAISE EXCEPTION '권한이 없습니다.';
    END IF;

    -- Generate a simple random token
    new_token := encode(gen_random_bytes(16), 'hex');

    INSERT INTO public.trip_invitation_links (trip_id, token, expires_at, created_by)
    VALUES (p_trip_id, new_token, now() + interval '6 hours', auth.uid());

    RETURN new_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. RPC to get trip summary by token
CREATE OR REPLACE FUNCTION public.get_trip_summary_by_token(p_token text)
RETURNS jsonb AS $$
DECLARE
    link_record RECORD;
    trip_summary jsonb;
BEGIN
    SELECT * INTO link_record FROM public.trip_invitation_links WHERE token = p_token;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '유효하지 않은 링크입니다.';
    END IF;

    IF link_record.expires_at < now() THEN
        RAISE EXCEPTION '만료된 링크입니다.';
    END IF;

    -- Get trip details
    SELECT jsonb_build_object(
        'trip_id', t.id,
        'destination', t.destination,
        'start_date', t.start_date,
        'end_date', t.end_date,
        'owner_nickname', p.nickname,
        'member_count', (SELECT count(*) FROM public.trip_members WHERE trip_id = t.id AND status = 'accepted') + 1 -- owner + accepted members
    ) INTO trip_summary
    FROM public.trips t
    JOIN public.profiles p ON t.user_id = p.id
    WHERE t.id = link_record.trip_id;

    RETURN trip_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. RPC to join trip via token
CREATE OR REPLACE FUNCTION public.join_trip_via_token(p_token text)
RETURNS uuid AS $$
DECLARE
    link_record RECORD;
    user_email text;
    user_nickname text;
    trip_owner_id uuid;
    target_tokens TEXT[];
    payload JSONB;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT * INTO link_record FROM public.trip_invitation_links WHERE token = p_token;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '유효하지 않은 링크입니다.';
    END IF;

    IF link_record.expires_at < now() THEN
        RAISE EXCEPTION '만료된 링크입니다.';
    END IF;

    -- Check if user is the owner
    IF EXISTS (SELECT 1 FROM public.trips WHERE id = link_record.trip_id AND user_id = auth.uid()) THEN
        RETURN link_record.trip_id; -- Already owner
    END IF;

    -- Check if user is already a member
    IF EXISTS (SELECT 1 FROM public.trip_members WHERE trip_id = link_record.trip_id AND user_id = auth.uid() AND status = 'accepted') THEN
        RETURN link_record.trip_id; -- Already a member
    END IF;

    -- Update or insert member
    SELECT email, nickname INTO user_email, user_nickname FROM public.profiles WHERE id = auth.uid();

    IF EXISTS (SELECT 1 FROM public.trip_members WHERE trip_id = link_record.trip_id AND user_id = auth.uid()) THEN
        UPDATE public.trip_members 
        SET status = 'accepted', role = 'editor'
        WHERE trip_id = link_record.trip_id AND user_id = auth.uid();
    ELSIF EXISTS (SELECT 1 FROM public.trip_members WHERE trip_id = link_record.trip_id AND invited_email = user_email) THEN
        UPDATE public.trip_members 
        SET status = 'accepted', role = 'editor', user_id = auth.uid()
        WHERE trip_id = link_record.trip_id AND invited_email = user_email;
    ELSE
        INSERT INTO public.trip_members (trip_id, user_id, invited_email, role, status)
        VALUES (link_record.trip_id, auth.uid(), user_email, 'editor', 'accepted');
    END IF;

    -- Send notification to trip owner
    SELECT user_id INTO trip_owner_id FROM public.trips WHERE id = link_record.trip_id;
    
    SELECT array_agg(d.fcm_token)
    INTO target_tokens
    FROM public.user_devices d
    WHERE d.user_id = trip_owner_id;

    IF target_tokens IS NOT NULL AND array_length(target_tokens, 1) > 0 THEN
        payload := jsonb_build_object(
            'tokens', target_tokens,
            'title', '새로운 동행자 참여!',
            'body', user_nickname || '님이 초대 링크를 통해 여정에 참여했습니다.',
            'data', jsonb_build_object(
                'tripId', link_record.trip_id::text,
                'type', 'join'
            )
        );

        PERFORM
          net.http_post(
            url := 'https://runbcaegpefqnljsswhv.supabase.co/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || COALESCE((current_setting('request.headers', true)::jsonb)->>'authorization', '')
            ),
            body := payload
        );
    END IF;

    RETURN link_record.trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
