-- TASK-014 reviewer hardening: remove legacy content-bearing direct push paths
-- and tighten metadata-only notification sanitization.

CREATE OR REPLACE FUNCTION public.sanitize_notification_metadata(p_metadata jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  input jsonb := COALESCE(p_metadata, '{}'::jsonb);
  output jsonb := '{}'::jsonb;
  safe_text text;
  tokenish_pattern constant text := '^[a-zA-Z0-9:_-]{32,}$';
  email_pattern constant text := '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$';
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  IF jsonb_typeof(input) <> 'object' THEN
    RETURN '{}'::jsonb;
  END IF;

  safe_text := input ->> 'document_type';
  IF safe_text IN ('trip', 'template') THEN
    output := output || jsonb_build_object('document_type', safe_text);
  END IF;

  safe_text := input ->> 'operation';
  IF safe_text IN ('created', 'updated', 'deleted', 'restored', 'summary') THEN
    output := output || jsonb_build_object('operation', safe_text);
  END IF;

  safe_text := input ->> 'entity_type';
  IF safe_text IN ('document', 'plan', 'checklist', 'member') THEN
    output := output || jsonb_build_object('entity_type', safe_text);
  END IF;

  safe_text := input ->> 'actor_role';
  IF safe_text IN ('owner', 'editor', 'viewer') THEN
    output := output || jsonb_build_object('actor_role', safe_text);
  END IF;

  safe_text := input ->> 'platform';
  IF safe_text IN ('web', 'ios', 'android', 'unknown') THEN
    output := output || jsonb_build_object('platform', safe_text);
  END IF;

  safe_text := trim(COALESCE(input ->> 'client_batch_id', ''));
  IF safe_text ~ '^[a-zA-Z0-9:_-]{1,80}$'
     AND safe_text !~ tokenish_pattern
     AND safe_text !~* email_pattern
     AND safe_text !~* uuid_pattern THEN
    output := output || jsonb_build_object('client_batch_id', safe_text);
  END IF;

  safe_text := trim(COALESCE(input ->> 'reason_code', ''));
  IF safe_text ~ '^[a-zA-Z0-9:_-]{1,80}$'
     AND safe_text !~ tokenish_pattern
     AND safe_text !~* email_pattern
     AND safe_text !~* uuid_pattern THEN
    output := output || jsonb_build_object('reason_code', safe_text);
  END IF;

  IF jsonb_typeof(input -> 'change_count') = 'number' THEN
    output := output || jsonb_build_object(
      'change_count',
      LEAST(GREATEST(floor((input ->> 'change_count')::numeric)::integer, 1), 999)
    );
  END IF;

  RETURN output;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_trip_via_token(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_record public.trip_invitation_links%ROWTYPE;
  user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT *
    INTO link_record
  FROM public.trip_invitation_links
  WHERE token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION '유효하지 않은 링크입니다.';
  END IF;

  IF link_record.expires_at < now() THEN
    RAISE EXCEPTION '만료된 링크입니다.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.trips
    WHERE id = link_record.trip_id
      AND user_id = auth.uid()
  ) THEN
    RETURN link_record.trip_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.trip_members
    WHERE trip_id = link_record.trip_id
      AND user_id = auth.uid()
      AND status = 'accepted'
  ) THEN
    RETURN link_record.trip_id;
  END IF;

  SELECT email
    INTO user_email
  FROM public.profiles
  WHERE id = auth.uid();

  IF EXISTS (
    SELECT 1
    FROM public.trip_members
    WHERE trip_id = link_record.trip_id
      AND user_id = auth.uid()
  ) THEN
    UPDATE public.trip_members
      SET status = 'accepted',
          role = 'editor'
      WHERE trip_id = link_record.trip_id
        AND user_id = auth.uid();
  ELSIF EXISTS (
    SELECT 1
    FROM public.trip_members
    WHERE trip_id = link_record.trip_id
      AND invited_email = user_email
  ) THEN
    UPDATE public.trip_members
      SET status = 'accepted',
          role = 'editor',
          user_id = auth.uid()
      WHERE trip_id = link_record.trip_id
        AND invited_email = user_email;
  ELSE
    INSERT INTO public.trip_members (trip_id, user_id, invited_email, role, status)
    VALUES (link_record.trip_id, auth.uid(), user_email, 'editor', 'accepted');
  END IF;

  -- Direct push removed: this legacy RPC must not compose nickname/body payloads
  -- or call send-push-notification. Collaboration push should use metadata-only
  -- notification_events where document mapping is explicit.
  RETURN link_record.trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_trip_via_token(text) TO authenticated;

-- Rollback reference:
-- Re-apply supabase/migrations/20260502000001_trip_invitation_links.sql function
-- body only if the legacy content-bearing direct push path is intentionally restored.
