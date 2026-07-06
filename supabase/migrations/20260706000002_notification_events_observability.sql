-- TASK-014: notification metadata queue and push token lifecycle.
-- Collaboration push uses metadata-only events. Legacy content-bearing plan/invitation triggers are disabled below.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- user_devices lifecycle ------------------------------------------------------
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'fcm' NOT NULL,
  ADD COLUMN IF NOT EXISTS token_status text DEFAULT 'active' NOT NULL,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS invalidated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS invalidation_reason text;

UPDATE public.user_devices
  SET provider = COALESCE(NULLIF(provider, ''), 'fcm'),
      token_status = COALESCE(NULLIF(token_status, ''), 'active'),
      last_seen_at = COALESCE(last_seen_at, updated_at, created_at)
  WHERE provider IS NULL
     OR provider = ''
     OR token_status IS NULL
     OR token_status = ''
     OR last_seen_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_devices_provider_check'
  ) THEN
    ALTER TABLE public.user_devices
      ADD CONSTRAINT user_devices_provider_check CHECK (provider IN ('fcm', 'expo'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_devices_token_status_check'
  ) THEN
    ALTER TABLE public.user_devices
      ADD CONSTRAINT user_devices_token_status_check CHECK (token_status IN ('active', 'invalid', 'revoked'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_devices_active_targets
  ON public.user_devices(user_id, provider, token_status)
  WHERE token_status = 'active' AND revoked_at IS NULL AND invalidated_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_devices_user_device_provider_key
  ON public.user_devices(user_id, device_id, provider)
  WHERE device_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cleanup_current_user_push_tokens(
  p_device_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  UPDATE public.user_devices
    SET token_status = 'revoked',
        revoked_at = COALESCE(revoked_at, timezone('utc'::text, now())),
        updated_at = timezone('utc'::text, now())
    WHERE user_id = auth.uid()
      AND token_status = 'active'
      AND (p_device_id IS NULL OR device_id = p_device_id);

  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN cleaned_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_current_user_push_tokens(text) TO authenticated;

-- notification_events ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'document_changed',
    'plan_changed',
    'checklist_changed',
    'member_joined',
    'member_removed'
  )),
  target_user_ids uuid[] NOT NULL CHECK (status = 'skipped' OR array_length(target_user_ids, 1) > 0),
  title_key text NOT NULL,
  body_key text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  dedupe_key text NOT NULL,
  batch_key text,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'delivered', 'skipped', 'failed')),
  scheduled_after timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  processing_started_at timestamp with time zone,
  delivered_at timestamp with time zone,
  failed_at timestamp with time zone,
  skipped_at timestamp with time zone,
  delivered_device_count integer DEFAULT 0 NOT NULL CHECK (delivered_device_count >= 0),
  failure_code text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notification_events FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS notification_events_pending_idx
  ON public.notification_events(status, scheduled_after, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS notification_events_document_status_idx
  ON public.notification_events(document_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_pending_dedupe_key
  ON public.notification_events(dedupe_key)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.notification_title_key_for_event(p_event_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT CASE p_event_type
    WHEN 'plan_changed' THEN 'notification.collaboration.plan_changed.title'
    WHEN 'checklist_changed' THEN 'notification.collaboration.checklist_changed.title'
    WHEN 'member_joined' THEN 'notification.collaboration.member_joined.title'
    WHEN 'member_removed' THEN 'notification.collaboration.member_removed.title'
    ELSE 'notification.collaboration.document_changed.title'
  END;
$$;

CREATE OR REPLACE FUNCTION public.notification_body_key_for_event(p_event_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT CASE p_event_type
    WHEN 'plan_changed' THEN 'notification.collaboration.plan_changed.body'
    WHEN 'checklist_changed' THEN 'notification.collaboration.checklist_changed.body'
    WHEN 'member_joined' THEN 'notification.collaboration.member_joined.body'
    WHEN 'member_removed' THEN 'notification.collaboration.member_removed.body'
    ELSE 'notification.collaboration.document_changed.body'
  END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_notification_metadata(p_metadata jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  input jsonb := COALESCE(p_metadata, '{}'::jsonb);
  output jsonb := '{}'::jsonb;
  key text;
  value jsonb;
  allowed_string_keys constant text[] := ARRAY[
    'document_type',
    'operation',
    'entity_type',
    'actor_role',
    'platform',
    'client_batch_id',
    'reason_code'
  ];
BEGIN
  IF jsonb_typeof(input) <> 'object' THEN
    RETURN '{}'::jsonb;
  END IF;

  FOREACH key IN ARRAY allowed_string_keys LOOP
    value := input -> key;
    IF value IS NOT NULL AND jsonb_typeof(value) = 'string' THEN
      output := output || jsonb_build_object(key, left(trim(both '"' from value::text), 80));
    END IF;
  END LOOP;

  value := input -> 'change_count';
  IF value IS NOT NULL AND jsonb_typeof(value) = 'number' THEN
    output := output || jsonb_build_object('change_count', LEAST(GREATEST(floor((value #>> '{}')::numeric)::integer, 1), 999));
  END IF;

  RETURN output;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_notification_event(
  p_document_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_client_dedupe_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  targets uuid[];
  safe_metadata jsonb := public.sanitize_notification_metadata(p_metadata);
  safe_client_key text;
  dedupe text;
  batch text;
  existing_event public.notification_events%ROWTYPE;
  inserted_event public.notification_events%ROWTYPE;
  incoming_count integer := 1;
  existing_count integer := 1;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_event_type NOT IN ('document_changed', 'plan_changed', 'checklist_changed', 'member_joined', 'member_removed') THEN
    RAISE EXCEPTION '유효하지 않은 알림 유형입니다.';
  END IF;

  IF NOT public.check_is_document_editor(p_document_id, actor) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT dm.user_id), ARRAY[]::uuid[])
    INTO targets
  FROM public.document_members dm
  WHERE dm.document_id = p_document_id
    AND dm.status = 'accepted'
    AND dm.user_id IS NOT NULL
    AND dm.user_id <> actor;

  IF array_length(targets, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'skipped',
      'reason_code', 'no_targets',
      'target_count', 0
    );
  END IF;

  incoming_count := COALESCE((safe_metadata ->> 'change_count')::integer, 1);
  batch := p_document_id::text || ':' || p_event_type || ':' || actor::text;
  safe_client_key := NULLIF(regexp_replace(COALESCE(p_client_dedupe_key, ''), '[^a-zA-Z0-9:_-]', '', 'g'), '');
  dedupe := COALESCE(
    left(p_document_id::text || ':' || p_event_type || ':' || actor::text || ':' || safe_client_key, 240),
    p_document_id::text || ':' || p_event_type || ':' || actor::text || ':' || to_char(timezone('utc'::text, now()), 'YYYYMMDDHH24MI')
  );

  SELECT *
    INTO existing_event
  FROM public.notification_events
  WHERE dedupe_key = dedupe
    AND status = 'pending'
  FOR UPDATE;

  IF FOUND THEN
    existing_count := COALESCE((existing_event.metadata ->> 'change_count')::integer, 1);

    UPDATE public.notification_events
      SET target_user_ids = (
            SELECT array_agg(DISTINCT target_id)
            FROM unnest(existing_event.target_user_ids || targets) AS target_id
          ),
          metadata = (existing_event.metadata || safe_metadata) ||
            jsonb_build_object('change_count', LEAST(existing_count + incoming_count, 999)),
          scheduled_after = LEAST(existing_event.scheduled_after, timezone('utc'::text, now()) + interval '30 seconds'),
          updated_at = timezone('utc'::text, now())
      WHERE id = existing_event.id
      RETURNING * INTO inserted_event;

    RETURN jsonb_build_object(
      'id', inserted_event.id,
      'status', 'deduped',
      'target_count', array_length(inserted_event.target_user_ids, 1),
      'dedupe_key', inserted_event.dedupe_key
    );
  END IF;

  INSERT INTO public.notification_events (
    document_id,
    actor_id,
    event_type,
    target_user_ids,
    title_key,
    body_key,
    metadata,
    dedupe_key,
    batch_key,
    scheduled_after
  )
  VALUES (
    p_document_id,
    actor,
    p_event_type,
    targets,
    public.notification_title_key_for_event(p_event_type),
    public.notification_body_key_for_event(p_event_type),
    safe_metadata || jsonb_build_object('change_count', incoming_count),
    dedupe,
    batch,
    timezone('utc'::text, now()) + interval '30 seconds'
  )
  RETURNING * INTO inserted_event;

  RETURN jsonb_build_object(
    'id', inserted_event.id,
    'status', 'queued',
    'target_count', array_length(inserted_event.target_user_ids, 1),
    'dedupe_key', inserted_event.dedupe_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_pending_notification_events(
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  trip_id uuid,
  event_type text,
  title_key text,
  body_key text,
  metadata jsonb,
  target_devices jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT ne.id
    FROM public.notification_events ne
    WHERE ne.status = 'pending'
      AND ne.scheduled_after <= timezone('utc'::text, now())
    ORDER BY ne.created_at ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
    FOR UPDATE SKIP LOCKED
  ),
  locked_events AS (
    UPDATE public.notification_events ne
      SET status = 'processing',
          processing_started_at = timezone('utc'::text, now()),
          updated_at = timezone('utc'::text, now())
      FROM candidates
      WHERE ne.id = candidates.id
      RETURNING ne.*
  )
  SELECT
    le.id,
    le.document_id,
    CASE WHEN d.type = 'trip' THEN le.document_id ELSE NULL END AS trip_id,
    le.event_type,
    le.title_key,
    le.body_key,
    le.metadata,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'user_id', ud.user_id,
          'device_row_id', ud.id,
          'device_id', ud.device_id,
          'provider', ud.provider,
          'fcm_token', ud.fcm_token
        )
      ) FILTER (WHERE ud.id IS NOT NULL),
      '[]'::jsonb
    ) AS target_devices
  FROM locked_events le
  JOIN public.documents d ON d.id = le.document_id
  LEFT JOIN public.user_devices ud
    ON ud.user_id = ANY(le.target_user_ids)
   AND ud.provider = 'fcm'
   AND ud.token_status = 'active'
   AND ud.revoked_at IS NULL
   AND ud.invalidated_at IS NULL
  GROUP BY le.id, le.document_id, d.type, le.event_type, le.title_key, le.body_key, le.metadata;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_event_delivered(
  p_event_id uuid,
  p_device_count integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  UPDATE public.notification_events
    SET status = 'delivered',
        delivered_at = timezone('utc'::text, now()),
        delivered_device_count = GREATEST(COALESCE(p_device_count, 0), 0),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_event_failed(
  p_event_id uuid,
  p_failure_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  UPDATE public.notification_events
    SET status = 'failed',
        failed_at = timezone('utc'::text, now()),
        failure_code = left(regexp_replace(COALESCE(p_failure_code, 'unknown'), '[^a-zA-Z0-9:_-]', '', 'g'), 80),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_event_skipped(
  p_event_id uuid,
  p_reason_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  UPDATE public.notification_events
    SET status = 'skipped',
        skipped_at = timezone('utc'::text, now()),
        failure_code = left(regexp_replace(COALESCE(p_reason_code, 'skipped'), '[^a-zA-Z0-9:_-]', '', 'g'), 80),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_document_notification_state(
  p_document_id uuid,
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer := 0;
BEGIN
  IF p_document_id IS NULL OR p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH updated AS (
    UPDATE public.notification_events ne
      SET target_user_ids = array_remove(ne.target_user_ids, p_user_id),
          status = CASE
            WHEN array_length(array_remove(ne.target_user_ids, p_user_id), 1) IS NULL THEN 'skipped'
            ELSE ne.status
          END,
          skipped_at = CASE
            WHEN array_length(array_remove(ne.target_user_ids, p_user_id), 1) IS NULL THEN timezone('utc'::text, now())
            ELSE ne.skipped_at
          END,
          failure_code = CASE
            WHEN array_length(array_remove(ne.target_user_ids, p_user_id), 1) IS NULL THEN 'target_revoked'
            ELSE ne.failure_code
          END,
          updated_at = timezone('utc'::text, now())
      WHERE ne.document_id = p_document_id
        AND ne.status = 'pending'
        AND p_user_id = ANY(ne.target_user_ids)
      RETURNING 1
  )
  SELECT count(*)::integer INTO affected_count FROM updated;

  RETURN affected_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_notification_event(uuid, text, jsonb, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_pending_notification_events(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_notification_event_delivered(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_notification_event_failed(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_notification_event_skipped(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_document_notification_state(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_pending_notification_events(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_event_delivered(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_event_failed(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_event_skipped(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_document_notification_state(uuid, uuid) TO service_role;

-- Permission revoke RPCs: preserve TASK-013 behavior and add pending notification target cleanup.
CREATE OR REPLACE FUNCTION public.revoke_document_member(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_member public.document_members%ROWTYPE;
  revoked_key_count integer := 0;
  cleaned_notification_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT *
    INTO target_member
  FROM public.document_members
  WHERE id = p_member_id;

  IF NOT FOUND OR NOT public.check_is_document_owner(target_member.document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF target_member.role = 'owner' OR target_member.user_id = auth.uid() THEN
    RAISE EXCEPTION '소유자 권한은 회수할 수 없습니다.';
  END IF;

  UPDATE public.document_members
    SET status = 'revoked',
        updated_at = timezone('utc'::text, now())
    WHERE id = p_member_id
    RETURNING * INTO target_member;

  IF target_member.user_id IS NOT NULL THEN
    UPDATE public.document_keys
      SET revoked_at = COALESCE(revoked_at, timezone('utc'::text, now()))
      WHERE document_id = target_member.document_id
        AND user_id = target_member.user_id
        AND revoked_at IS NULL;

    GET DIAGNOSTICS revoked_key_count = ROW_COUNT;

    cleaned_notification_count := public.cleanup_document_notification_state(
      target_member.document_id,
      target_member.user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'document_id', target_member.document_id,
    'member_id', target_member.id,
    'user_id', target_member.user_id,
    'revoked_key_count', revoked_key_count,
    'cleaned_notification_count', cleaned_notification_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_trip_document_member(p_trip_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_member public.trip_members%ROWTYPE;
  revoked_key_count integer := 0;
  cleaned_notification_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT *
    INTO target_member
  FROM public.trip_members
  WHERE id = p_trip_member_id;

  IF NOT FOUND OR NOT public.check_is_document_owner(target_member.trip_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF target_member.role = 'owner' OR target_member.user_id = auth.uid() THEN
    RAISE EXCEPTION '소유자 권한은 회수할 수 없습니다.';
  END IF;

  DELETE FROM public.trip_members
    WHERE id = p_trip_member_id;

  IF target_member.user_id IS NOT NULL THEN
    UPDATE public.document_members
      SET status = 'revoked',
          updated_at = timezone('utc'::text, now())
      WHERE document_id = target_member.trip_id
        AND user_id = target_member.user_id
        AND role <> 'owner';

    UPDATE public.document_keys
      SET revoked_at = COALESCE(revoked_at, timezone('utc'::text, now()))
      WHERE document_id = target_member.trip_id
        AND user_id = target_member.user_id
        AND revoked_at IS NULL;

    GET DIAGNOSTICS revoked_key_count = ROW_COUNT;

    cleaned_notification_count := public.cleanup_document_notification_state(
      target_member.trip_id,
      target_member.user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'document_id', target_member.trip_id,
    'trip_member_id', target_member.id,
    'user_id', target_member.user_id,
    'revoked_key_count', revoked_key_count,
    'cleaned_notification_count', cleaned_notification_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_document_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_trip_document_member(uuid) TO authenticated;

-- Disable legacy content-bearing DB push triggers. TASK-014 collaboration push
-- must flow through enqueue_notification_event(), which stores title/body keys
-- and allowlisted metadata only.
DROP TRIGGER IF EXISTS on_plan_created ON public.plans;
DROP TRIGGER IF EXISTS on_trip_invitation ON public.trip_members;
