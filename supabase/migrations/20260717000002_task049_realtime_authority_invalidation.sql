-- TASK-049: Realtime carries small revision invalidations, never canonical
-- resource data. Clients reconcile through the authority bundle RPCs.

CREATE OR REPLACE FUNCTION public.can_receive_authority_topic(
  p_topic text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  resource_id uuid;
BEGIN
  IF p_topic IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_topic ~ '^trip:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    resource_id := split_part(p_topic, ':', 2)::uuid;
    RETURN public.check_can_read_authority_trip(resource_id, p_user_id);
  END IF;

  IF p_topic ~ '^template:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    resource_id := split_part(p_topic, ':', 2)::uuid;
    RETURN public.check_can_read_authority_template(resource_id, p_user_id);
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_receive_authority_topic(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_receive_authority_topic(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.broadcast_authority_state_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime, pg_temp
AS $$
DECLARE
  resource_type text;
  resource_id uuid;
  topic text;
  compact_changes jsonb;
  message_payload jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.revision IS NOT DISTINCT FROM NEW.revision THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'trip_authority_state' THEN
    resource_type := 'trip';
    resource_id := NEW.trip_id;
  ELSIF TG_TABLE_NAME = 'template_authority_state' THEN
    resource_type := 'template';
    resource_id := NEW.template_id;
  ELSE
    RETURN NEW;
  END IF;

  SELECT COALESCE(jsonb_agg(change), '[]'::jsonb)
  INTO compact_changes
  FROM (
    SELECT value AS change
    FROM jsonb_array_elements(NEW.changed_entities)
    LIMIT 6
  ) selected_changes;

  topic := resource_type || ':' || resource_id::text;
  message_payload := jsonb_build_object(
    'resource_type', resource_type,
    'resource_id', resource_id,
    'revision', NEW.revision,
    'change_count', jsonb_array_length(NEW.changed_entities),
    'changed_entities', compact_changes,
    'updated_at', NEW.updated_at
  );

  IF octet_length(message_payload::text) >= 1024 THEN
    message_payload := jsonb_build_object(
      'resource_type', resource_type,
      'resource_id', resource_id,
      'revision', NEW.revision,
      'change_count', jsonb_array_length(NEW.changed_entities),
      'changed_entities', '[]'::jsonb,
      'updated_at', NEW.updated_at
    );
  END IF;

  PERFORM realtime.send(message_payload, 'authority_changed', topic, true);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_authority_state_invalidation() FROM PUBLIC;

DROP TRIGGER IF EXISTS broadcast_trip_authority_invalidation
ON public.trip_authority_state;
CREATE TRIGGER broadcast_trip_authority_invalidation
AFTER INSERT OR UPDATE
ON public.trip_authority_state
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_authority_state_invalidation();

DROP TRIGGER IF EXISTS broadcast_template_authority_invalidation
ON public.template_authority_state;
CREATE TRIGGER broadcast_template_authority_invalidation
AFTER INSERT OR UPDATE
ON public.template_authority_state
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_authority_state_invalidation();

DROP POLICY IF EXISTS "authority readers can receive revision invalidations"
ON realtime.messages;
CREATE POLICY "authority readers can receive revision invalidations"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast'
  AND event = 'authority_changed'
  AND public.can_receive_authority_topic(realtime.topic(), (SELECT auth.uid()))
);
