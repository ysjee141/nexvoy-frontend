-- TASK-056: allow stale resource revisions to rebase only when every new
-- command carries enough entity-level concurrency information. Legacy or
-- aggregate whole-set commands keep the conservative resource conflict.

CREATE OR REPLACE FUNCTION public.trip_authority_stale_batch_is_rebasable(
  p_trip_id uuid,
  p_commands jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  command jsonb;
  entity_type text;
  entity_id uuid;
  action_name text;
  row_exists boolean;
BEGIN
  IF jsonb_typeof(p_commands) <> 'array' THEN
    RETURN false;
  END IF;

  FOR command IN SELECT value FROM jsonb_array_elements(p_commands)
  LOOP
    IF command ->> 'operation_id' IS NULL
      OR command ->> 'entity_type' IS NULL
      OR command ->> 'entity_id' IS NULL
      OR command ->> 'action' IS NULL THEN
      RETURN false;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.applied_operations applied
      WHERE applied.operation_id = (command ->> 'operation_id')::uuid
    ) THEN
      CONTINUE;
    END IF;

    entity_type := command ->> 'entity_type';
    entity_id := (command ->> 'entity_id')::uuid;
    action_name := command ->> 'action';

    -- Per-user checks are deterministic set operations. The assignee command
    -- replaces a whole set and has no aggregate version, so it must retain the
    -- conservative resource-level conflict behavior.
    IF entity_type = 'checklist_item_user_check' THEN
      CONTINUE;
    ELSIF entity_type = 'checklist_item_assignees' THEN
      RETURN false;
    END IF;

    IF entity_type = 'trip' THEN
      row_exists := EXISTS (
        SELECT 1 FROM public.trips row_value
        WHERE row_value.id = entity_id AND entity_id = p_trip_id
      );
    ELSIF entity_type = 'plan' THEN
      row_exists := EXISTS (
        SELECT 1 FROM public.plans row_value
        WHERE row_value.id = entity_id AND row_value.trip_id = p_trip_id
      );
    ELSIF entity_type = 'plan_url' THEN
      row_exists := EXISTS (
        SELECT 1
        FROM public.plan_urls row_value
        JOIN public.plans parent ON parent.id = row_value.plan_id
        WHERE row_value.id = entity_id AND parent.trip_id = p_trip_id
      );
    ELSIF entity_type = 'checklist' THEN
      row_exists := EXISTS (
        SELECT 1 FROM public.checklists row_value
        WHERE row_value.id = entity_id AND row_value.trip_id = p_trip_id
      );
    ELSIF entity_type = 'checklist_item' THEN
      row_exists := EXISTS (
        SELECT 1
        FROM public.checklist_items row_value
        JOIN public.checklists parent ON parent.id = row_value.checklist_id
        WHERE row_value.id = entity_id AND parent.trip_id = p_trip_id
      );
    ELSE
      RETURN false;
    END IF;

    IF row_exists AND NULLIF(command ->> 'expected_version', '') IS NULL THEN
      RETURN false;
    END IF;
    IF NOT row_exists AND action_name NOT IN ('upsert', 'delete') THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.template_authority_stale_batch_is_rebasable(
  p_template_id uuid,
  p_commands jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  command jsonb;
  entity_type text;
  entity_id uuid;
  action_name text;
  row_exists boolean;
BEGIN
  IF jsonb_typeof(p_commands) <> 'array' THEN
    RETURN false;
  END IF;

  FOR command IN SELECT value FROM jsonb_array_elements(p_commands)
  LOOP
    IF command ->> 'operation_id' IS NULL
      OR command ->> 'entity_type' IS NULL
      OR command ->> 'entity_id' IS NULL
      OR command ->> 'action' IS NULL THEN
      RETURN false;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.applied_operations applied
      WHERE applied.operation_id = (command ->> 'operation_id')::uuid
    ) THEN
      CONTINUE;
    END IF;

    entity_type := command ->> 'entity_type';
    entity_id := (command ->> 'entity_id')::uuid;
    action_name := command ->> 'action';

    IF entity_type = 'template' THEN
      row_exists := EXISTS (
        SELECT 1 FROM public.checklist_templates row_value
        WHERE row_value.id = entity_id AND entity_id = p_template_id
      );
    ELSIF entity_type = 'template_item' THEN
      row_exists := EXISTS (
        SELECT 1 FROM public.checklist_template_items row_value
        WHERE row_value.id = entity_id AND row_value.template_id = p_template_id
      );
    ELSIF entity_type = 'template_share' THEN
      row_exists := EXISTS (
        SELECT 1 FROM public.checklist_template_shares row_value
        WHERE row_value.id = entity_id AND row_value.template_id = p_template_id
      );
    ELSE
      RETURN false;
    END IF;

    IF row_exists AND NULLIF(command ->> 'expected_version', '') IS NULL THEN
      RETURN false;
    END IF;
    IF NOT row_exists AND action_name NOT IN ('upsert', 'delete') THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_trip_commands(
  p_trip_id uuid,
  p_commands jsonb,
  p_base_revision bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_revision bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('trip:' || p_trip_id::text, 0));
  SELECT COALESCE((
    SELECT state.revision
    FROM public.trip_authority_state state
    WHERE state.trip_id = p_trip_id
  ), 0) INTO current_revision;

  IF p_base_revision IS NOT NULL
    AND p_base_revision <> current_revision
    AND public.trip_authority_stale_batch_is_rebasable(p_trip_id, p_commands) THEN
    RETURN public.apply_trip_authority_commands(
      p_trip_id,
      p_commands,
      current_revision
    );
  END IF;

  RETURN public.apply_trip_authority_commands(
    p_trip_id,
    p_commands,
    p_base_revision
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_template_commands(
  p_template_id uuid,
  p_commands jsonb,
  p_base_revision bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_revision bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('template:' || p_template_id::text, 0));
  SELECT COALESCE((
    SELECT state.revision
    FROM public.template_authority_state state
    WHERE state.template_id = p_template_id
  ), 0) INTO current_revision;

  IF p_base_revision IS NOT NULL
    AND p_base_revision <> current_revision
    AND public.template_authority_stale_batch_is_rebasable(p_template_id, p_commands) THEN
    RETURN public.apply_template_authority_commands(
      p_template_id,
      p_commands,
      current_revision
    );
  END IF;

  RETURN public.apply_template_authority_commands(
    p_template_id,
    p_commands,
    p_base_revision
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trip_authority_stale_batch_is_rebasable(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.template_authority_stale_batch_is_rebasable(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_trip_commands(uuid, jsonb, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_template_commands(uuid, jsonb, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_trip_commands(uuid, jsonb, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_template_commands(uuid, jsonb, bigint) TO authenticated;
