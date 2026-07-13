-- TASK-028: rotating room topics for P2P signaling.
--
-- P2P signaling topics should not be derivable from raw document ids. This
-- migration introduces server-issued opaque topics and tightens Realtime
-- Authorization so only active server-issued topics are accepted.

CREATE TABLE IF NOT EXISTS public.document_signaling_room_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  room_topic text NOT NULL UNIQUE,
  active_from timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_signaling_room_topics_topic_format_check
    CHECK (room_topic ~ '^signaling:[0-9a-f]{64}$'),
  CONSTRAINT document_signaling_room_topics_valid_window_check
    CHECK (expires_at > active_from)
);

CREATE INDEX IF NOT EXISTS document_signaling_room_topics_document_active_idx
  ON public.document_signaling_room_topics(document_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS document_signaling_room_topics_room_topic_idx
  ON public.document_signaling_room_topics(room_topic);

ALTER TABLE public.document_signaling_room_topics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_signaling_room_topics FROM anon, authenticated;

DROP POLICY IF EXISTS "deny direct signaling topic reads" ON public.document_signaling_room_topics;
DROP POLICY IF EXISTS "deny direct signaling topic writes" ON public.document_signaling_room_topics;

CREATE POLICY "deny direct signaling topic reads"
ON public.document_signaling_room_topics
FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "deny direct signaling topic writes"
ON public.document_signaling_room_topics
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.issue_document_signaling_room_topic(p_document_id uuid)
RETURNS TABLE (
  room_topic text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  selected_topic public.document_signaling_room_topics%ROWTYPE;
  topic_seed text;
  topic_ttl interval := interval '1 hour';
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_document_id IS NULL THEN
    RAISE EXCEPTION 'missing_document_id' USING ERRCODE = '22023';
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1
      FROM public.document_members dm
      WHERE dm.document_id = p_document_id
        AND dm.user_id = current_user_id
        AND dm.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = p_document_id
        AND (
          public.check_is_trip_owner(t.id, current_user_id)
          OR public.check_is_trip_member(t.id, current_user_id)
        )
    )
  ) THEN
    RAISE EXCEPTION 'signaling_topic_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO selected_topic
  FROM public.document_signaling_room_topics dst
  WHERE dst.document_id = p_document_id
    AND dst.revoked_at IS NULL
    AND dst.active_from <= now()
    AND dst.expires_at > now() + interval '2 minutes'
  ORDER BY dst.expires_at DESC
  LIMIT 1;

  IF selected_topic.id IS NULL THEN
    UPDATE public.document_signaling_room_topics dst
    SET revoked_at = now()
    WHERE dst.document_id = p_document_id
      AND dst.revoked_at IS NULL
      AND dst.expires_at <= now();

    topic_seed := p_document_id::text || ':' || gen_random_uuid()::text || ':' || extract(epoch FROM clock_timestamp())::text;

    INSERT INTO public.document_signaling_room_topics (
      document_id,
      room_topic,
      active_from,
      expires_at,
      created_by
    )
    VALUES (
      p_document_id,
      'signaling:' || public.document_registry_hash(topic_seed),
      now(),
      now() + topic_ttl,
      current_user_id
    )
    RETURNING * INTO selected_topic;
  END IF;

  room_topic := selected_topic.room_topic;
  expires_at := selected_topic.expires_at;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_document_signaling_room_topic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_document_signaling_room_topic(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_receive_document_signaling_topic(
  p_room_topic text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_room_topic IS NOT NULL
    AND p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.document_signaling_room_topics dst
      WHERE dst.room_topic = p_room_topic
        AND dst.revoked_at IS NULL
        AND dst.active_from <= now()
        AND dst.expires_at > now()
        AND (
          EXISTS (
            SELECT 1
            FROM public.document_members dm
            WHERE dm.document_id = dst.document_id
              AND dm.user_id = p_user_id
              AND dm.status = 'accepted'
          )
          OR EXISTS (
            SELECT 1
            FROM public.trips t
            WHERE t.id = dst.document_id
              AND (
                public.check_is_trip_owner(t.id, p_user_id)
                OR public.check_is_trip_member(t.id, p_user_id)
              )
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_send_document_signaling_topic(
  p_room_topic text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_room_topic IS NOT NULL
    AND p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.document_signaling_room_topics dst
      WHERE dst.room_topic = p_room_topic
        AND dst.revoked_at IS NULL
        AND dst.active_from <= now()
        AND dst.expires_at > now()
        AND (
          EXISTS (
            SELECT 1
            FROM public.document_members dm
            WHERE dm.document_id = dst.document_id
              AND dm.user_id = p_user_id
              AND dm.status = 'accepted'
              AND dm.role IN ('owner', 'editor')
          )
          OR EXISTS (
            SELECT 1
            FROM public.trips t
            WHERE t.id = dst.document_id
              AND (
                public.check_is_trip_owner(t.id, p_user_id)
                OR public.check_is_trip_editor(t.id, p_user_id)
              )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_receive_document_signaling_topic(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_send_document_signaling_topic(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_receive_document_signaling_topic(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_document_signaling_topic(text, uuid) TO authenticated;

DROP POLICY IF EXISTS "accepted document members can receive signaling broadcast"
ON realtime.messages;

DROP POLICY IF EXISTS "accepted non-viewer document members can send signaling broadcast"
ON realtime.messages;

CREATE POLICY "accepted document members can receive signaling broadcast"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.can_receive_document_signaling_topic(realtime.topic(), (SELECT auth.uid())));

CREATE POLICY "accepted non-viewer document members can send signaling broadcast"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.can_send_document_signaling_topic(realtime.topic(), (SELECT auth.uid())));
