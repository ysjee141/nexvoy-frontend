-- TASK-046: normalized rows become the server authority behind idempotent
-- command RPCs. Existing direct-table policies remain during the staged
-- cutover; the new RPCs enforce the document registry as their authority.

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS cover_image_ref text,
  ADD COLUMN IF NOT EXISTS bg_color text,
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS is_visited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_key text,
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.plan_urls
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS sort_key text,
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS sort_key text,
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.checklist_item_assignees
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.checklist_item_user_checks
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.checklist_template_items
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS sort_key text,
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.checklist_template_shares
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_authority_row_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'trips',
    'plans',
    'plan_urls',
    'checklists',
    'checklist_items',
    'checklist_item_assignees',
    'checklist_item_user_checks',
    'checklist_templates',
    'checklist_template_items',
    'checklist_template_shares'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_authority_row_metadata ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER set_authority_row_metadata BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_authority_row_metadata()',
      table_name
    );
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS public.trip_authority_state (
  trip_id uuid PRIMARY KEY REFERENCES public.trips(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  changed_entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.template_authority_state (
  template_id uuid PRIMARY KEY REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  changed_entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.applied_operations (
  operation_id uuid PRIMARY KEY,
  resource_type text NOT NULL CHECK (resource_type IN ('trip', 'template')),
  resource_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  command_hash text NOT NULL,
  revision bigint NOT NULL CHECK (revision >= 0),
  canonical_change jsonb NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS applied_operations_resource_idx
  ON public.applied_operations(resource_type, resource_id, revision);
CREATE INDEX IF NOT EXISTS applied_operations_actor_applied_idx
  ON public.applied_operations(actor_id, applied_at DESC);

ALTER TABLE public.trip_authority_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_authority_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applied_operations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trip_authority_state FROM anon, authenticated;
REVOKE ALL ON TABLE public.template_authority_state FROM anon, authenticated;
REVOKE ALL ON TABLE public.applied_operations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_can_read_authority_trip(
  p_trip_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_trip_id IS NOT NULL
    AND (
      public.check_is_document_member(p_trip_id, p_user_id)
      OR public.check_is_public_trip(p_trip_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.check_can_write_authority_trip(
  p_trip_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_trip_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND public.check_is_document_editor(p_trip_id, p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.check_can_read_authority_template(
  p_template_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_template_id IS NOT NULL
    AND (
      public.check_is_document_member(p_template_id, p_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.checklist_templates template
        WHERE template.id = p_template_id
          AND template.deleted_at IS NULL
          AND template.user_id IS NULL
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.check_can_write_authority_template(
  p_template_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_template_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND public.check_is_document_editor(p_template_id, p_user_id);
$$;

REVOKE ALL ON FUNCTION public.check_can_read_authority_trip(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_can_write_authority_trip(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_can_read_authority_template(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_can_write_authority_template(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_can_read_authority_trip(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_can_write_authority_trip(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_can_read_authority_template(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_can_write_authority_template(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_trip_authority_resource(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_authority_state state WHERE state.trip_id = p_trip_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trip_authority_plan(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.plans plan
    JOIN public.trip_authority_state state ON state.trip_id = plan.trip_id
    WHERE plan.id = p_plan_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trip_authority_checklist(p_checklist_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.checklists checklist
    JOIN public.trip_authority_state state ON state.trip_id = checklist.trip_id
    WHERE checklist.id = p_checklist_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trip_authority_checklist_item(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.checklist_items item
    JOIN public.checklists checklist ON checklist.id = item.checklist_id
    JOIN public.trip_authority_state state ON state.trip_id = checklist.trip_id
    WHERE item.id = p_item_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_template_authority_resource(p_template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.template_authority_state state
    WHERE state.template_id = p_template_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_trip_authority_resource(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_trip_authority_plan(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_trip_authority_checklist(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_trip_authority_checklist_item(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_template_authority_resource(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_trip_authority_resource(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_trip_authority_plan(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_trip_authority_checklist(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_trip_authority_checklist_item(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_template_authority_resource(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "authority trips require canonical RPC" ON public.trips;
CREATE POLICY "authority trips require canonical RPC"
ON public.trips AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (NOT public.is_trip_authority_resource(id))
WITH CHECK (NOT public.is_trip_authority_resource(id));

DROP POLICY IF EXISTS "authority plans require canonical RPC" ON public.plans;
CREATE POLICY "authority plans require canonical RPC"
ON public.plans AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (NOT public.is_trip_authority_resource(trip_id))
WITH CHECK (NOT public.is_trip_authority_resource(trip_id));

DROP POLICY IF EXISTS "authority plan urls require canonical RPC" ON public.plan_urls;
CREATE POLICY "authority plan urls require canonical RPC"
ON public.plan_urls AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (NOT public.is_trip_authority_plan(plan_id))
WITH CHECK (NOT public.is_trip_authority_plan(plan_id));

DROP POLICY IF EXISTS "authority checklists require canonical RPC" ON public.checklists;
CREATE POLICY "authority checklists require canonical RPC"
ON public.checklists AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (NOT public.is_trip_authority_resource(trip_id))
WITH CHECK (NOT public.is_trip_authority_resource(trip_id));

DROP POLICY IF EXISTS "authority checklist items require canonical RPC" ON public.checklist_items;
CREATE POLICY "authority checklist items require canonical RPC"
ON public.checklist_items AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (NOT public.is_trip_authority_checklist(checklist_id))
WITH CHECK (NOT public.is_trip_authority_checklist(checklist_id));

DROP POLICY IF EXISTS "authority checklist assignees require canonical RPC"
ON public.checklist_item_assignees;
CREATE POLICY "authority checklist assignees require canonical RPC"
ON public.checklist_item_assignees AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (NOT public.is_trip_authority_checklist_item(item_id))
WITH CHECK (NOT public.is_trip_authority_checklist_item(item_id));

DROP POLICY IF EXISTS "authority checklist checks require canonical RPC"
ON public.checklist_item_user_checks;
CREATE POLICY "authority checklist checks require canonical RPC"
ON public.checklist_item_user_checks AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (NOT public.is_trip_authority_checklist_item(item_id))
WITH CHECK (NOT public.is_trip_authority_checklist_item(item_id));

DROP POLICY IF EXISTS "authority templates require canonical RPC" ON public.checklist_templates;
CREATE POLICY "authority templates require canonical RPC"
ON public.checklist_templates AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (NOT public.is_template_authority_resource(id))
WITH CHECK (NOT public.is_template_authority_resource(id));

DROP POLICY IF EXISTS "authority template items require canonical RPC"
ON public.checklist_template_items;
CREATE POLICY "authority template items require canonical RPC"
ON public.checklist_template_items AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (NOT public.is_template_authority_resource(template_id))
WITH CHECK (NOT public.is_template_authority_resource(template_id));

DROP POLICY IF EXISTS "authority template shares require canonical RPC"
ON public.checklist_template_shares;
CREATE POLICY "authority template shares require canonical RPC"
ON public.checklist_template_shares AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (NOT public.is_template_authority_resource(template_id))
WITH CHECK (NOT public.is_template_authority_resource(template_id));

DROP POLICY IF EXISTS "authority members can read trip state" ON public.trip_authority_state;
CREATE POLICY "authority members can read trip state"
ON public.trip_authority_state
FOR SELECT
TO anon, authenticated
USING (public.check_can_read_authority_trip(trip_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "authority readers can read template state" ON public.template_authority_state;
CREATE POLICY "authority readers can read template state"
ON public.template_authority_state
FOR SELECT
TO anon, authenticated
USING (public.check_can_read_authority_template(template_id, (SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.get_trip_authority_revision(p_trip_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.check_can_read_authority_trip(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'authority_trip_forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(
    (SELECT state.revision FROM public.trip_authority_state state WHERE state.trip_id = p_trip_id),
    0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_template_authority_revision(p_template_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.check_can_read_authority_template(p_template_id, auth.uid()) THEN
    RAISE EXCEPTION 'authority_template_forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(
    (SELECT state.revision FROM public.template_authority_state state WHERE state.template_id = p_template_id),
    0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trip_authority_bundle(p_trip_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  bundle jsonb;
BEGIN
  IF NOT public.check_can_read_authority_trip(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'authority_trip_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trips trip
    JOIN public.trip_authority_state state ON state.trip_id = trip.id
    WHERE trip.id = p_trip_id AND trip.deleted_at IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'resource_type', 'trip',
    'resource_id', p_trip_id,
    'revision', COALESCE(state.revision, 0),
    'server_updated_at', COALESCE(state.updated_at, trip.updated_at),
    'trip', to_jsonb(trip),
    'plans', COALESCE((
      SELECT jsonb_agg(to_jsonb(plan) ORDER BY plan.sort_key NULLS LAST, plan.start_datetime_local, plan.id)
      FROM public.plans plan
      WHERE plan.trip_id = p_trip_id AND plan.deleted_at IS NULL
    ), '[]'::jsonb),
    'plan_urls', COALESCE((
      SELECT jsonb_agg(to_jsonb(plan_url) ORDER BY plan_url.sort_key NULLS LAST, plan_url.created_at, plan_url.id)
      FROM public.plan_urls plan_url
      JOIN public.plans plan ON plan.id = plan_url.plan_id
      WHERE plan.trip_id = p_trip_id
        AND plan.deleted_at IS NULL
        AND plan_url.deleted_at IS NULL
    ), '[]'::jsonb),
    'checklists', COALESCE((
      SELECT jsonb_agg(to_jsonb(checklist) ORDER BY checklist.created_at, checklist.id)
      FROM public.checklists checklist
      WHERE checklist.trip_id = p_trip_id AND checklist.deleted_at IS NULL
    ), '[]'::jsonb),
    'checklist_items', COALESCE((
      SELECT jsonb_agg(to_jsonb(item) ORDER BY item.sort_key NULLS LAST, item.created_at, item.id)
      FROM public.checklist_items item
      JOIN public.checklists checklist ON checklist.id = item.checklist_id
      WHERE checklist.trip_id = p_trip_id
        AND checklist.deleted_at IS NULL
        AND item.deleted_at IS NULL
        AND (
          item.is_private = false
          OR item.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.checklist_item_assignees visible_assignee
            WHERE visible_assignee.item_id = item.id
              AND visible_assignee.user_id = auth.uid()
              AND visible_assignee.deleted_at IS NULL
          )
        )
    ), '[]'::jsonb),
    'checklist_item_assignees', COALESCE((
      SELECT jsonb_agg(to_jsonb(assignee) ORDER BY assignee.created_at, assignee.id)
      FROM public.checklist_item_assignees assignee
      JOIN public.checklist_items item ON item.id = assignee.item_id
      JOIN public.checklists checklist ON checklist.id = item.checklist_id
      WHERE checklist.trip_id = p_trip_id
        AND checklist.deleted_at IS NULL
        AND item.deleted_at IS NULL
        AND assignee.deleted_at IS NULL
        AND (
          item.is_private = false
          OR item.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.checklist_item_assignees visible_assignee
            WHERE visible_assignee.item_id = item.id
              AND visible_assignee.user_id = auth.uid()
              AND visible_assignee.deleted_at IS NULL
          )
        )
    ), '[]'::jsonb),
    'checklist_item_user_checks', COALESCE((
      SELECT jsonb_agg(to_jsonb(user_check) ORDER BY user_check.created_at, user_check.id)
      FROM public.checklist_item_user_checks user_check
      JOIN public.checklist_items item ON item.id = user_check.item_id
      JOIN public.checklists checklist ON checklist.id = item.checklist_id
      WHERE checklist.trip_id = p_trip_id
        AND checklist.deleted_at IS NULL
        AND item.deleted_at IS NULL
        AND user_check.deleted_at IS NULL
        AND (
          item.is_private = false
          OR item.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.checklist_item_assignees visible_assignee
            WHERE visible_assignee.item_id = item.id
              AND visible_assignee.user_id = auth.uid()
              AND visible_assignee.deleted_at IS NULL
          )
        )
    ), '[]'::jsonb)
  )
  INTO bundle
  FROM public.trips trip
  JOIN public.trip_authority_state state ON state.trip_id = trip.id
  WHERE trip.id = p_trip_id;

  RETURN bundle;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_template_authority_bundle(p_template_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  bundle jsonb;
BEGIN
  IF NOT public.check_can_read_authority_template(p_template_id, auth.uid()) THEN
    RAISE EXCEPTION 'authority_template_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.checklist_templates template
    JOIN public.template_authority_state state ON state.template_id = template.id
    WHERE template.id = p_template_id AND template.deleted_at IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'resource_type', 'template',
    'resource_id', p_template_id,
    'revision', COALESCE(state.revision, 0),
    'server_updated_at', COALESCE(state.updated_at, template.updated_at),
    'template', to_jsonb(template),
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(item) ORDER BY item.sort_key NULLS LAST, item.created_at, item.id)
      FROM public.checklist_template_items item
      WHERE item.template_id = p_template_id AND item.deleted_at IS NULL
    ), '[]'::jsonb),
    'shares', CASE
      WHEN template.user_id = auth.uid() THEN COALESCE((
        SELECT jsonb_agg(to_jsonb(share) ORDER BY share.created_at, share.id)
        FROM public.checklist_template_shares share
        WHERE share.template_id = p_template_id AND share.deleted_at IS NULL
      ), '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  )
  INTO bundle
  FROM public.checklist_templates template
  JOIN public.template_authority_state state ON state.template_id = template.id
  WHERE template.id = p_template_id;

  RETURN bundle;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_trip_authority_summaries()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(summary ORDER BY (summary ->> 'start_date') DESC, summary ->> 'resource_id'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'resource_type', 'trip',
      'resource_id', trip.id,
      'revision', COALESCE(state.revision, 0),
      'destination', trip.destination,
      'start_date', trip.start_date,
      'end_date', trip.end_date,
      'updated_at', COALESCE(state.updated_at, trip.updated_at),
      'role', member.role
    ) AS summary
    FROM public.trips trip
    JOIN public.document_members member
      ON member.document_id = trip.id
      AND member.user_id = auth.uid()
      AND member.status = 'accepted'
    JOIN public.trip_authority_state state ON state.trip_id = trip.id
    WHERE trip.deleted_at IS NULL
  ) summaries;
$$;

CREATE OR REPLACE FUNCTION public.list_my_template_authority_summaries()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(summary ORDER BY summary ->> 'title', summary ->> 'resource_id'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'resource_type', 'template',
      'resource_id', template.id,
      'revision', COALESCE(state.revision, 0),
      'title', template.title,
      'updated_at', COALESCE(state.updated_at, template.updated_at),
      'role', member.role
    ) AS summary
    FROM public.checklist_templates template
    JOIN public.document_members member
      ON member.document_id = template.id
      AND member.user_id = auth.uid()
      AND member.status = 'accepted'
    JOIN public.template_authority_state state ON state.template_id = template.id
    WHERE template.deleted_at IS NULL

    UNION ALL

    SELECT jsonb_build_object(
      'resource_type', 'template',
      'resource_id', template.id,
      'revision', COALESCE(state.revision, 0),
      'title', template.title,
      'updated_at', COALESCE(state.updated_at, template.updated_at),
      'role', 'default'
    ) AS summary
    FROM public.checklist_templates template
    JOIN public.template_authority_state state ON state.template_id = template.id
    WHERE template.user_id IS NULL
      AND template.deleted_at IS NULL
  ) summaries;
$$;

CREATE OR REPLACE FUNCTION public.get_trip_authority_changes(
  p_trip_id uuid,
  p_entities jsonb,
  p_revision bigint
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_revision bigint;
  state_updated_at timestamptz;
  entity jsonb;
  entity_type text;
  entity_id uuid;
  entity_action text;
  row_data jsonb;
  changes jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.check_can_read_authority_trip(p_trip_id, auth.uid()) THEN
    RAISE EXCEPTION 'authority_trip_forbidden' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_entities) <> 'array'
    OR jsonb_array_length(p_entities) < 1
    OR jsonb_array_length(p_entities) > 6 THEN
    RAISE EXCEPTION 'invalid_authority_change_request' USING ERRCODE = '22023';
  END IF;

  SELECT state.revision, state.updated_at
  INTO current_revision, state_updated_at
  FROM public.trip_authority_state state
  WHERE state.trip_id = p_trip_id;

  IF current_revision IS NULL OR current_revision <> p_revision THEN
    RETURN jsonb_build_object(
      'status', 'gap',
      'resource_type', 'trip',
      'resource_id', p_trip_id,
      'revision', COALESCE(current_revision, 0),
      'server_updated_at', COALESCE(state_updated_at, timezone('utc', now())),
      'changes', '[]'::jsonb
    );
  END IF;

  FOR entity IN SELECT value FROM jsonb_array_elements(p_entities)
  LOOP
    entity_type := entity ->> 'entity_type';
    entity_id := (entity ->> 'entity_id')::uuid;
    entity_action := entity ->> 'action';
    row_data := NULL;

    CASE entity_type
      WHEN 'trip' THEN
        IF entity_id <> p_trip_id THEN
          RAISE EXCEPTION 'authority_change_resource_mismatch' USING ERRCODE = '42501';
        END IF;
        SELECT to_jsonb(trip) INTO row_data
        FROM public.trips trip WHERE trip.id = entity_id;
      WHEN 'plan' THEN
        SELECT to_jsonb(plan) INTO row_data
        FROM public.plans plan
        WHERE plan.id = entity_id AND plan.trip_id = p_trip_id;
      WHEN 'plan_url' THEN
        SELECT to_jsonb(plan_url) INTO row_data
        FROM public.plan_urls plan_url
        JOIN public.plans plan ON plan.id = plan_url.plan_id
        WHERE plan_url.id = entity_id AND plan.trip_id = p_trip_id;
      WHEN 'checklist' THEN
        SELECT to_jsonb(checklist) INTO row_data
        FROM public.checklists checklist
        WHERE checklist.id = entity_id AND checklist.trip_id = p_trip_id;
      WHEN 'checklist_item' THEN
        SELECT to_jsonb(item) INTO row_data
        FROM public.checklist_items item
        JOIN public.checklists checklist ON checklist.id = item.checklist_id
        WHERE item.id = entity_id
          AND checklist.trip_id = p_trip_id
          AND (
            item.is_private = false
            OR item.assigned_user_id = auth.uid()
            OR EXISTS (
              SELECT 1
              FROM public.checklist_item_assignees visible_assignee
              WHERE visible_assignee.item_id = item.id
                AND visible_assignee.user_id = auth.uid()
                AND visible_assignee.deleted_at IS NULL
            )
          );
      WHEN 'checklist_item_assignees' THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.checklist_items item
          JOIN public.checklists checklist ON checklist.id = item.checklist_id
          WHERE item.id = entity_id AND checklist.trip_id = p_trip_id
        ) THEN
          RAISE EXCEPTION 'authority_change_resource_mismatch' USING ERRCODE = '42501';
        END IF;
        SELECT jsonb_build_object(
          'item_id', entity_id,
          'assignees', COALESCE(jsonb_agg(to_jsonb(assignee) ORDER BY assignee.user_id)
            FILTER (WHERE assignee.id IS NOT NULL), '[]'::jsonb)
        ) INTO row_data
        FROM public.checklist_item_assignees assignee
        WHERE assignee.item_id = entity_id
          AND assignee.deleted_at IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.checklist_items visible_item
            WHERE visible_item.id = entity_id
              AND (
                visible_item.is_private = false
                OR visible_item.assigned_user_id = auth.uid()
                OR EXISTS (
                  SELECT 1
                  FROM public.checklist_item_assignees visible_assignee
                  WHERE visible_assignee.item_id = visible_item.id
                    AND visible_assignee.user_id = auth.uid()
                    AND visible_assignee.deleted_at IS NULL
                )
              )
          );
      WHEN 'checklist_item_user_check' THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.checklist_items item
          JOIN public.checklists checklist ON checklist.id = item.checklist_id
          WHERE item.id = entity_id AND checklist.trip_id = p_trip_id
        ) THEN
          RAISE EXCEPTION 'authority_change_resource_mismatch' USING ERRCODE = '42501';
        END IF;
        SELECT jsonb_build_object(
          'item_id', entity_id,
          'checks', COALESCE(jsonb_agg(to_jsonb(user_check) ORDER BY user_check.user_id)
            FILTER (WHERE user_check.id IS NOT NULL), '[]'::jsonb)
        ) INTO row_data
        FROM public.checklist_item_user_checks user_check
        WHERE user_check.item_id = entity_id
          AND user_check.deleted_at IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.checklist_items visible_item
            WHERE visible_item.id = entity_id
              AND (
                visible_item.is_private = false
                OR visible_item.assigned_user_id = auth.uid()
                OR EXISTS (
                  SELECT 1
                  FROM public.checklist_item_assignees visible_assignee
                  WHERE visible_assignee.item_id = visible_item.id
                    AND visible_assignee.user_id = auth.uid()
                    AND visible_assignee.deleted_at IS NULL
                )
              )
          );
      ELSE
        RAISE EXCEPTION 'unsupported_trip_authority_change' USING ERRCODE = '22023';
    END CASE;

    changes := changes || jsonb_build_array(jsonb_build_object(
      'operation_id', 'invalidation:' || current_revision::text || ':' || entity_type || ':' || entity_id::text,
      'entity_type', entity_type,
      'entity_id', entity_id,
      'action', entity_action,
      'row', COALESCE(row_data, jsonb_build_object(
        'id', entity_id,
        'deleted_at', state_updated_at,
        'missing', true
      ))
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'ok',
    'resource_type', 'trip',
    'resource_id', p_trip_id,
    'revision', current_revision,
    'server_updated_at', state_updated_at,
    'changes', changes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_template_authority_changes(
  p_template_id uuid,
  p_entities jsonb,
  p_revision bigint
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_revision bigint;
  state_updated_at timestamptz;
  entity jsonb;
  entity_type text;
  entity_id uuid;
  entity_action text;
  row_data jsonb;
  changes jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.check_can_read_authority_template(p_template_id, auth.uid()) THEN
    RAISE EXCEPTION 'authority_template_forbidden' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_entities) <> 'array'
    OR jsonb_array_length(p_entities) < 1
    OR jsonb_array_length(p_entities) > 6 THEN
    RAISE EXCEPTION 'invalid_authority_change_request' USING ERRCODE = '22023';
  END IF;

  SELECT state.revision, state.updated_at
  INTO current_revision, state_updated_at
  FROM public.template_authority_state state
  WHERE state.template_id = p_template_id;

  IF current_revision IS NULL OR current_revision <> p_revision THEN
    RETURN jsonb_build_object(
      'status', 'gap',
      'resource_type', 'template',
      'resource_id', p_template_id,
      'revision', COALESCE(current_revision, 0),
      'server_updated_at', COALESCE(state_updated_at, timezone('utc', now())),
      'changes', '[]'::jsonb
    );
  END IF;

  FOR entity IN SELECT value FROM jsonb_array_elements(p_entities)
  LOOP
    entity_type := entity ->> 'entity_type';
    entity_id := (entity ->> 'entity_id')::uuid;
    entity_action := entity ->> 'action';
    row_data := NULL;

    CASE entity_type
      WHEN 'template' THEN
        IF entity_id <> p_template_id THEN
          RAISE EXCEPTION 'authority_change_resource_mismatch' USING ERRCODE = '42501';
        END IF;
        SELECT to_jsonb(template) INTO row_data
        FROM public.checklist_templates template WHERE template.id = entity_id;
      WHEN 'template_item' THEN
        SELECT to_jsonb(item) INTO row_data
        FROM public.checklist_template_items item
        WHERE item.id = entity_id AND item.template_id = p_template_id;
      WHEN 'template_share' THEN
        SELECT to_jsonb(share) INTO row_data
        FROM public.checklist_template_shares share
        WHERE share.id = entity_id
          AND share.template_id = p_template_id
          AND (
            public.check_is_document_owner(p_template_id, auth.uid())
            OR share.shared_with_user_id = auth.uid()
          );
      ELSE
        RAISE EXCEPTION 'unsupported_template_authority_change' USING ERRCODE = '22023';
    END CASE;

    changes := changes || jsonb_build_array(jsonb_build_object(
      'operation_id', 'invalidation:' || current_revision::text || ':' || entity_type || ':' || entity_id::text,
      'entity_type', entity_type,
      'entity_id', entity_id,
      'action', entity_action,
      'row', COALESCE(row_data, jsonb_build_object(
        'id', entity_id,
        'deleted_at', state_updated_at,
        'missing', true
      ))
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'ok',
    'resource_type', 'template',
    'resource_id', p_template_id,
    'revision', current_revision,
    'server_updated_at', state_updated_at,
    'changes', changes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_one_trip_authority_command(
  p_trip_id uuid,
  p_command jsonb,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  entity_type text := p_command ->> 'entity_type';
  action_name text := p_command ->> 'action';
  entity_id uuid := (p_command ->> 'entity_id')::uuid;
  payload jsonb := COALESCE(p_command -> 'payload', '{}'::jsonb);
  expected_version bigint := NULLIF(p_command ->> 'expected_version', '')::bigint;
  current_version bigint;
  parent_id uuid;
  changed_row jsonb;
  changed_rows jsonb;
  checked boolean;
BEGIN
  IF entity_type NOT IN (
    'trip',
    'plan',
    'plan_url',
    'checklist',
    'checklist_item',
    'checklist_item_assignees',
    'checklist_item_user_check'
  ) OR action_name NOT IN ('upsert', 'delete', 'set') THEN
    RAISE EXCEPTION 'unsupported_trip_authority_command' USING ERRCODE = '22023';
  END IF;

  IF expected_version IS NOT NULL AND entity_type IN ('trip', 'plan', 'plan_url', 'checklist', 'checklist_item') THEN
    CASE entity_type
      WHEN 'trip' THEN SELECT version INTO current_version FROM public.trips WHERE id = entity_id;
      WHEN 'plan' THEN SELECT version INTO current_version FROM public.plans WHERE id = entity_id;
      WHEN 'plan_url' THEN SELECT version INTO current_version FROM public.plan_urls WHERE id = entity_id;
      WHEN 'checklist' THEN SELECT version INTO current_version FROM public.checklists WHERE id = entity_id;
      WHEN 'checklist_item' THEN SELECT version INTO current_version FROM public.checklist_items WHERE id = entity_id;
    END CASE;

    IF current_version IS DISTINCT FROM expected_version THEN
      RAISE EXCEPTION 'authority_row_version_conflict' USING ERRCODE = '40001';
    END IF;
  END IF;

  IF entity_type = 'trip' THEN
    IF entity_id <> p_trip_id OR action_name NOT IN ('upsert', 'delete') THEN
      RAISE EXCEPTION 'invalid_trip_authority_command' USING ERRCODE = '22023';
    END IF;

    IF action_name = 'delete' THEN
      UPDATE public.trips AS target
      SET deleted_at = timezone('utc', now())
      WHERE target.id = p_trip_id
      RETURNING to_jsonb(target) INTO changed_row;
    ELSIF EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id) THEN
      UPDATE public.trips AS target
      SET destination = CASE WHEN payload ? 'destination' THEN payload ->> 'destination' ELSE target.destination END,
          start_date = CASE WHEN payload ? 'start_date' THEN (payload ->> 'start_date')::date ELSE target.start_date END,
          end_date = CASE WHEN payload ? 'end_date' THEN (payload ->> 'end_date')::date ELSE target.end_date END,
          adults_count = CASE WHEN payload ? 'adults_count' THEN (payload ->> 'adults_count')::integer ELSE target.adults_count END,
          children_count = CASE WHEN payload ? 'children_count' THEN (payload ->> 'children_count')::integer ELSE target.children_count END,
          cover_image_ref = CASE WHEN payload ? 'cover_image_ref' THEN payload ->> 'cover_image_ref' ELSE target.cover_image_ref END,
          bg_color = CASE WHEN payload ? 'bg_color' THEN payload ->> 'bg_color' ELSE target.bg_color END,
          deleted_at = NULL
      WHERE target.id = p_trip_id
      RETURNING to_jsonb(target) INTO changed_row;
    ELSE
      IF payload ->> 'destination' IS NULL
        OR payload ->> 'start_date' IS NULL
        OR payload ->> 'end_date' IS NULL THEN
        RAISE EXCEPTION 'missing_trip_fields' USING ERRCODE = '22023';
      END IF;

      PERFORM public.bootstrap_owner_document(p_trip_id, 'trip', 1);
      INSERT INTO public.trips AS target (
        id, user_id, destination, start_date, end_date,
        adults_count, children_count, cover_image_ref, bg_color
      ) VALUES (
        p_trip_id,
        p_actor_id,
        payload ->> 'destination',
        (payload ->> 'start_date')::date,
        (payload ->> 'end_date')::date,
        COALESCE((payload ->> 'adults_count')::integer, 1),
        COALESCE((payload ->> 'children_count')::integer, 0),
        payload ->> 'cover_image_ref',
        payload ->> 'bg_color'
      )
      RETURNING to_jsonb(target) INTO changed_row;
    END IF;

  ELSIF entity_type = 'plan' THEN
    IF EXISTS (SELECT 1 FROM public.plans WHERE id = entity_id AND trip_id <> p_trip_id) THEN
      RAISE EXCEPTION 'plan_resource_mismatch' USING ERRCODE = '42501';
    END IF;

    IF action_name = 'delete' THEN
      UPDATE public.plans AS target
      SET deleted_at = timezone('utc', now())
      WHERE target.id = entity_id AND target.trip_id = p_trip_id
      RETURNING to_jsonb(target) INTO changed_row;
    ELSIF EXISTS (SELECT 1 FROM public.plans WHERE id = entity_id) THEN
      UPDATE public.plans AS target
      SET title = CASE WHEN payload ? 'title' THEN payload ->> 'title' ELSE target.title END,
          location = CASE WHEN payload ? 'location' THEN payload ->> 'location' ELSE target.location END,
          cost = CASE WHEN payload ? 'cost' THEN NULLIF(payload ->> 'cost', '')::numeric ELSE target.cost END,
          memo = CASE WHEN payload ? 'memo' THEN payload ->> 'memo' ELSE target.memo END,
          start_datetime_local = CASE WHEN payload ? 'start_datetime_local' THEN (payload ->> 'start_datetime_local')::timestamp ELSE target.start_datetime_local END,
          end_datetime_local = CASE WHEN payload ? 'end_datetime_local' THEN (payload ->> 'end_datetime_local')::timestamp ELSE target.end_datetime_local END,
          timezone_string = CASE WHEN payload ? 'timezone_string' THEN payload ->> 'timezone_string' ELSE target.timezone_string END,
          alarm_minutes_before = CASE WHEN payload ? 'alarm_minutes_before' THEN NULLIF(payload ->> 'alarm_minutes_before', '')::integer ELSE target.alarm_minutes_before END,
          alarm_sent_at = CASE WHEN payload ? 'alarm_sent_at' THEN NULLIF(payload ->> 'alarm_sent_at', '')::timestamptz ELSE target.alarm_sent_at END,
          address = CASE WHEN payload ? 'address' THEN payload ->> 'address' ELSE target.address END,
          image_url = CASE WHEN payload ? 'image_url' THEN payload ->> 'image_url' ELSE target.image_url END,
          photo_reference = CASE WHEN payload ? 'photo_reference' THEN payload ->> 'photo_reference' ELSE target.photo_reference END,
          photo_unavailable = CASE WHEN payload ? 'photo_unavailable' THEN (payload ->> 'photo_unavailable')::boolean ELSE target.photo_unavailable END,
          google_place_id = CASE WHEN payload ? 'google_place_id' THEN payload ->> 'google_place_id' ELSE target.google_place_id END,
          location_lat = CASE WHEN payload ? 'location_lat' THEN NULLIF(payload ->> 'location_lat', '')::double precision ELSE target.location_lat END,
          location_lng = CASE WHEN payload ? 'location_lng' THEN NULLIF(payload ->> 'location_lng', '')::double precision ELSE target.location_lng END,
          is_visited = CASE WHEN payload ? 'is_visited' THEN (payload ->> 'is_visited')::boolean ELSE target.is_visited END,
          sort_key = CASE WHEN payload ? 'sort_key' THEN payload ->> 'sort_key' ELSE target.sort_key END,
          deleted_at = NULL
      WHERE target.id = entity_id
      RETURNING to_jsonb(target) INTO changed_row;
    ELSE
      IF payload ->> 'title' IS NULL
        OR payload ->> 'start_datetime_local' IS NULL
        OR payload ->> 'end_datetime_local' IS NULL
        OR payload ->> 'timezone_string' IS NULL THEN
        RAISE EXCEPTION 'missing_plan_fields' USING ERRCODE = '22023';
      END IF;

      INSERT INTO public.plans AS target (
        id, trip_id, title, location, cost, memo,
        start_datetime_local, end_datetime_local, timezone_string,
        alarm_minutes_before, alarm_sent_at, address, image_url,
        photo_reference, photo_unavailable, google_place_id,
        location_lat, location_lng, is_visited, sort_key
      ) VALUES (
        entity_id,
        p_trip_id,
        payload ->> 'title',
        payload ->> 'location',
        COALESCE(NULLIF(payload ->> 'cost', '')::numeric, 0),
        payload ->> 'memo',
        (payload ->> 'start_datetime_local')::timestamp,
        (payload ->> 'end_datetime_local')::timestamp,
        payload ->> 'timezone_string',
        NULLIF(payload ->> 'alarm_minutes_before', '')::integer,
        NULLIF(payload ->> 'alarm_sent_at', '')::timestamptz,
        payload ->> 'address',
        payload ->> 'image_url',
        payload ->> 'photo_reference',
        COALESCE((payload ->> 'photo_unavailable')::boolean, false),
        payload ->> 'google_place_id',
        NULLIF(payload ->> 'location_lat', '')::double precision,
        NULLIF(payload ->> 'location_lng', '')::double precision,
        COALESCE((payload ->> 'is_visited')::boolean, false),
        payload ->> 'sort_key'
      )
      RETURNING to_jsonb(target) INTO changed_row;
    END IF;

  ELSIF entity_type = 'plan_url' THEN
    IF action_name = 'upsert' THEN
      parent_id := COALESCE(
        NULLIF(payload ->> 'plan_id', '')::uuid,
        (SELECT plan_id FROM public.plan_urls WHERE id = entity_id)
      );
      IF NOT EXISTS (
        SELECT 1 FROM public.plans
        WHERE id = parent_id AND trip_id = p_trip_id AND deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'plan_url_resource_mismatch' USING ERRCODE = '42501';
      END IF;

      IF EXISTS (SELECT 1 FROM public.plan_urls WHERE id = entity_id) THEN
        UPDATE public.plan_urls AS target
        SET plan_id = parent_id,
            url = CASE WHEN payload ? 'url' THEN payload ->> 'url' ELSE target.url END,
            sort_key = CASE WHEN payload ? 'sort_key' THEN payload ->> 'sort_key' ELSE target.sort_key END,
            deleted_at = NULL
        WHERE target.id = entity_id
        RETURNING to_jsonb(target) INTO changed_row;
      ELSE
        INSERT INTO public.plan_urls AS target (id, plan_id, url, sort_key)
        VALUES (entity_id, parent_id, payload ->> 'url', payload ->> 'sort_key')
        RETURNING to_jsonb(target) INTO changed_row;
      END IF;
    ELSE
      UPDATE public.plan_urls AS target
      SET deleted_at = timezone('utc', now())
      FROM public.plans plan
      WHERE target.id = entity_id
        AND plan.id = target.plan_id
        AND plan.trip_id = p_trip_id
      RETURNING to_jsonb(target) INTO changed_row;
    END IF;

  ELSIF entity_type = 'checklist' THEN
    IF EXISTS (SELECT 1 FROM public.checklists WHERE id = entity_id AND trip_id <> p_trip_id) THEN
      RAISE EXCEPTION 'checklist_resource_mismatch' USING ERRCODE = '42501';
    END IF;

    IF action_name = 'delete' THEN
      UPDATE public.checklists AS target
      SET deleted_at = timezone('utc', now())
      WHERE target.id = entity_id AND target.trip_id = p_trip_id
      RETURNING to_jsonb(target) INTO changed_row;
    ELSIF EXISTS (SELECT 1 FROM public.checklists WHERE id = entity_id) THEN
      UPDATE public.checklists AS target
      SET title = CASE WHEN payload ? 'title' THEN payload ->> 'title' ELSE target.title END,
          deleted_at = NULL
      WHERE target.id = entity_id
      RETURNING to_jsonb(target) INTO changed_row;
    ELSE
      INSERT INTO public.checklists AS target (id, trip_id, title)
      VALUES (entity_id, p_trip_id, payload ->> 'title')
      RETURNING to_jsonb(target) INTO changed_row;
    END IF;

  ELSIF entity_type = 'checklist_item' THEN
    parent_id := COALESCE(
      NULLIF(payload ->> 'checklist_id', '')::uuid,
      (SELECT checklist_id FROM public.checklist_items WHERE id = entity_id)
    );
    IF NOT EXISTS (
      SELECT 1 FROM public.checklists
      WHERE id = parent_id AND trip_id = p_trip_id AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'checklist_item_resource_mismatch' USING ERRCODE = '42501';
    END IF;

    IF action_name = 'delete' THEN
      UPDATE public.checklist_items AS target
      SET deleted_at = timezone('utc', now())
      WHERE target.id = entity_id AND target.checklist_id = parent_id
      RETURNING to_jsonb(target) INTO changed_row;
    ELSIF EXISTS (SELECT 1 FROM public.checklist_items WHERE id = entity_id) THEN
      UPDATE public.checklist_items AS target
      SET checklist_id = parent_id,
          item_name = CASE WHEN payload ? 'item_name' THEN payload ->> 'item_name' ELSE target.item_name END,
          category = CASE WHEN payload ? 'category' THEN payload ->> 'category' ELSE target.category END,
          is_checked = CASE WHEN payload ? 'is_checked' THEN (payload ->> 'is_checked')::boolean ELSE target.is_checked END,
          assignment_type = CASE WHEN payload ? 'assignment_type' THEN payload ->> 'assignment_type' ELSE target.assignment_type END,
          assigned_user_id = CASE WHEN payload ? 'assigned_user_id' THEN NULLIF(payload ->> 'assigned_user_id', '')::uuid ELSE target.assigned_user_id END,
          is_private = CASE WHEN payload ? 'is_private' THEN (payload ->> 'is_private')::boolean ELSE target.is_private END,
          source_template_name = CASE WHEN payload ? 'source_template_name' THEN payload ->> 'source_template_name' ELSE target.source_template_name END,
          sort_key = CASE WHEN payload ? 'sort_key' THEN payload ->> 'sort_key' ELSE target.sort_key END,
          deleted_at = NULL
      WHERE target.id = entity_id
      RETURNING to_jsonb(target) INTO changed_row;
    ELSE
      INSERT INTO public.checklist_items AS target (
        id, checklist_id, item_name, category, is_checked,
        assignment_type, assigned_user_id, is_private,
        source_template_name, sort_key
      ) VALUES (
        entity_id,
        parent_id,
        payload ->> 'item_name',
        COALESCE(payload ->> 'category', '기타'),
        COALESCE((payload ->> 'is_checked')::boolean, false),
        COALESCE(payload ->> 'assignment_type', 'anyone'),
        NULLIF(payload ->> 'assigned_user_id', '')::uuid,
        COALESCE((payload ->> 'is_private')::boolean, false),
        payload ->> 'source_template_name',
        payload ->> 'sort_key'
      )
      RETURNING to_jsonb(target) INTO changed_row;
    END IF;

  ELSIF entity_type = 'checklist_item_assignees' THEN
    IF action_name <> 'set' OR NOT EXISTS (
      SELECT 1
      FROM public.checklist_items item
      JOIN public.checklists checklist ON checklist.id = item.checklist_id
      WHERE item.id = entity_id
        AND item.deleted_at IS NULL
        AND checklist.trip_id = p_trip_id
        AND checklist.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'assignee_resource_mismatch' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(payload -> 'user_ids', '[]'::jsonb)) requested(user_id)
      WHERE NOT public.check_is_document_member(p_trip_id, requested.user_id::uuid)
    ) THEN
      RAISE EXCEPTION 'assignee_is_not_document_member' USING ERRCODE = '22023';
    END IF;

    UPDATE public.checklist_item_assignees
    SET deleted_at = timezone('utc', now())
    WHERE item_id = entity_id AND deleted_at IS NULL;

    INSERT INTO public.checklist_item_assignees AS target (item_id, user_id, deleted_at)
    SELECT entity_id, requested.user_id::uuid, NULL
    FROM jsonb_array_elements_text(COALESCE(payload -> 'user_ids', '[]'::jsonb)) requested(user_id)
    ON CONFLICT (item_id, user_id) DO UPDATE SET deleted_at = NULL;

    SELECT COALESCE(jsonb_agg(to_jsonb(assignee) ORDER BY assignee.user_id), '[]'::jsonb)
    INTO changed_rows
    FROM public.checklist_item_assignees assignee
    WHERE assignee.item_id = entity_id AND assignee.deleted_at IS NULL;
    changed_row := jsonb_build_object('item_id', entity_id, 'assignees', changed_rows);

  ELSIF entity_type = 'checklist_item_user_check' THEN
    IF action_name <> 'set' OR NOT EXISTS (
      SELECT 1
      FROM public.checklist_items item
      JOIN public.checklists checklist ON checklist.id = item.checklist_id
      WHERE item.id = entity_id
        AND item.deleted_at IS NULL
        AND checklist.trip_id = p_trip_id
        AND checklist.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'user_check_resource_mismatch' USING ERRCODE = '42501';
    END IF;

    IF NULLIF(payload ->> 'user_id', '')::uuid IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'user_check_actor_mismatch' USING ERRCODE = '42501';
    END IF;

    checked := COALESCE((payload ->> 'checked')::boolean, false);
    IF checked THEN
      INSERT INTO public.checklist_item_user_checks AS target (item_id, user_id, deleted_at)
      VALUES (entity_id, p_actor_id, NULL)
      ON CONFLICT (item_id, user_id) DO UPDATE SET deleted_at = NULL
      RETURNING to_jsonb(target) INTO changed_row;
    ELSE
      UPDATE public.checklist_item_user_checks AS target
      SET deleted_at = timezone('utc', now())
      WHERE target.item_id = entity_id AND target.user_id = p_actor_id
      RETURNING to_jsonb(target) INTO changed_row;
      changed_row := COALESCE(changed_row, jsonb_build_object(
        'item_id', entity_id,
        'user_id', p_actor_id,
        'deleted_at', timezone('utc', now())
      ));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'entity_type', entity_type,
    'entity_id', entity_id,
    'action', action_name,
    'row', COALESCE(changed_row, jsonb_build_object(
      'id', entity_id,
      'deleted_at', timezone('utc', now()),
      'missing', true
    ))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_one_template_authority_command(
  p_template_id uuid,
  p_command jsonb,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  entity_type text := p_command ->> 'entity_type';
  action_name text := p_command ->> 'action';
  entity_id uuid := (p_command ->> 'entity_id')::uuid;
  payload jsonb := COALESCE(p_command -> 'payload', '{}'::jsonb);
  expected_version bigint := NULLIF(p_command ->> 'expected_version', '')::bigint;
  current_version bigint;
  shared_user_id uuid;
  share_role text;
  changed_row jsonb;
BEGIN
  IF entity_type NOT IN ('template', 'template_item', 'template_share')
    OR action_name NOT IN ('upsert', 'delete') THEN
    RAISE EXCEPTION 'unsupported_template_authority_command' USING ERRCODE = '22023';
  END IF;

  IF expected_version IS NOT NULL THEN
    CASE entity_type
      WHEN 'template' THEN SELECT version INTO current_version FROM public.checklist_templates WHERE id = entity_id;
      WHEN 'template_item' THEN SELECT version INTO current_version FROM public.checklist_template_items WHERE id = entity_id;
      WHEN 'template_share' THEN SELECT version INTO current_version FROM public.checklist_template_shares WHERE id = entity_id;
    END CASE;
    IF current_version IS DISTINCT FROM expected_version THEN
      RAISE EXCEPTION 'authority_row_version_conflict' USING ERRCODE = '40001';
    END IF;
  END IF;

  IF entity_type = 'template' THEN
    IF entity_id <> p_template_id THEN
      RAISE EXCEPTION 'invalid_template_authority_command' USING ERRCODE = '22023';
    END IF;

    IF action_name = 'delete' THEN
      UPDATE public.checklist_templates AS target
      SET deleted_at = timezone('utc', now())
      WHERE target.id = p_template_id
      RETURNING to_jsonb(target) INTO changed_row;
    ELSIF EXISTS (SELECT 1 FROM public.checklist_templates WHERE id = p_template_id) THEN
      UPDATE public.checklist_templates AS target
      SET title = CASE WHEN payload ? 'title' THEN payload ->> 'title' ELSE target.title END,
          deleted_at = NULL
      WHERE target.id = p_template_id
      RETURNING to_jsonb(target) INTO changed_row;
    ELSE
      IF payload ->> 'title' IS NULL THEN
        RAISE EXCEPTION 'missing_template_fields' USING ERRCODE = '22023';
      END IF;
      PERFORM public.bootstrap_owner_document(p_template_id, 'template', 1);
      INSERT INTO public.checklist_templates AS target (id, user_id, title)
      VALUES (p_template_id, p_actor_id, payload ->> 'title')
      RETURNING to_jsonb(target) INTO changed_row;
    END IF;

  ELSIF entity_type = 'template_item' THEN
    IF EXISTS (
      SELECT 1 FROM public.checklist_template_items
      WHERE id = entity_id AND template_id <> p_template_id
    ) THEN
      RAISE EXCEPTION 'template_item_resource_mismatch' USING ERRCODE = '42501';
    END IF;

    IF action_name = 'delete' THEN
      UPDATE public.checklist_template_items AS target
      SET deleted_at = timezone('utc', now())
      WHERE target.id = entity_id AND target.template_id = p_template_id
      RETURNING to_jsonb(target) INTO changed_row;
    ELSIF EXISTS (SELECT 1 FROM public.checklist_template_items WHERE id = entity_id) THEN
      UPDATE public.checklist_template_items AS target
      SET item_name = CASE WHEN payload ? 'item_name' THEN payload ->> 'item_name' ELSE target.item_name END,
          category = CASE WHEN payload ? 'category' THEN payload ->> 'category' ELSE target.category END,
          is_private = CASE WHEN payload ? 'is_private' THEN (payload ->> 'is_private')::boolean ELSE target.is_private END,
          sort_key = CASE WHEN payload ? 'sort_key' THEN payload ->> 'sort_key' ELSE target.sort_key END,
          deleted_at = NULL
      WHERE target.id = entity_id
      RETURNING to_jsonb(target) INTO changed_row;
    ELSE
      INSERT INTO public.checklist_template_items AS target (
        id, template_id, item_name, category, is_private, sort_key
      ) VALUES (
        entity_id,
        p_template_id,
        payload ->> 'item_name',
        COALESCE(payload ->> 'category', '기타'),
        COALESCE((payload ->> 'is_private')::boolean, false),
        payload ->> 'sort_key'
      )
      RETURNING to_jsonb(target) INTO changed_row;
    END IF;

  ELSIF entity_type = 'template_share' THEN
    IF NOT public.check_is_document_owner(p_template_id, p_actor_id) THEN
      RAISE EXCEPTION 'template_share_owner_required' USING ERRCODE = '42501';
    END IF;

    shared_user_id := COALESCE(
      NULLIF(payload ->> 'shared_with_user_id', '')::uuid,
      (SELECT shared_with_user_id FROM public.checklist_template_shares WHERE id = entity_id)
    );
    IF shared_user_id IS NULL OR shared_user_id = p_actor_id THEN
      RAISE EXCEPTION 'invalid_template_share_user' USING ERRCODE = '22023';
    END IF;

    IF action_name = 'delete' THEN
      UPDATE public.checklist_template_shares AS target
      SET deleted_at = timezone('utc', now())
      WHERE target.id = entity_id
        AND target.template_id = p_template_id
      RETURNING to_jsonb(target) INTO changed_row;

      UPDATE public.document_members
      SET status = 'revoked', updated_at = timezone('utc', now())
      WHERE document_id = p_template_id AND user_id = shared_user_id;
    ELSE
      share_role := COALESCE(payload ->> 'role', 'viewer');
      IF share_role NOT IN ('editor', 'viewer') THEN
        RAISE EXCEPTION 'invalid_template_share_role' USING ERRCODE = '22023';
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.checklist_template_shares
        WHERE id = entity_id AND template_id <> p_template_id
      ) THEN
        RAISE EXCEPTION 'template_share_resource_mismatch' USING ERRCODE = '42501';
      END IF;

      IF EXISTS (SELECT 1 FROM public.checklist_template_shares WHERE id = entity_id) THEN
        UPDATE public.checklist_template_shares AS target
        SET shared_with_user_id = shared_user_id,
            role = share_role,
            deleted_at = NULL
        WHERE target.id = entity_id
        RETURNING to_jsonb(target) INTO changed_row;
      ELSE
        INSERT INTO public.checklist_template_shares AS target (
          id, template_id, shared_with_user_id, role, created_by
        ) VALUES (
          entity_id, p_template_id, shared_user_id, share_role, p_actor_id
        )
        ON CONFLICT (template_id, shared_with_user_id) DO UPDATE
          SET role = EXCLUDED.role, deleted_at = NULL
        RETURNING to_jsonb(target) INTO changed_row;
      END IF;

      INSERT INTO public.document_members (
        document_id, user_id, role, status, updated_at
      ) VALUES (
        p_template_id, shared_user_id, share_role, 'accepted', timezone('utc', now())
      )
      ON CONFLICT (document_id, user_id) DO UPDATE
        SET role = EXCLUDED.role,
            status = 'accepted',
            updated_at = EXCLUDED.updated_at;

      entity_id := (changed_row ->> 'id')::uuid;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'entity_type', entity_type,
    'entity_id', entity_id,
    'action', action_name,
    'row', COALESCE(changed_row, jsonb_build_object(
      'id', entity_id,
      'deleted_at', timezone('utc', now()),
      'missing', true
    ))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_trip_authority_commands(
  p_trip_id uuid,
  p_commands jsonb,
  p_base_revision bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  actor_id uuid := auth.uid();
  command_count integer;
  command jsonb;
  requested_operation_id uuid;
  operation_hash text;
  prior_operation public.applied_operations%ROWTYPE;
  current_revision bigint;
  next_revision bigint;
  state_updated_at timestamptz;
  is_new_resource boolean;
  new_operation_count integer := 0;
  all_changes jsonb := '[]'::jsonb;
  new_receipts jsonb := '[]'::jsonb;
  acknowledged_ids jsonb := '[]'::jsonb;
  changed_entities jsonb := '[]'::jsonb;
  canonical_change jsonb;
  receipt jsonb;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_trip_id IS NULL OR jsonb_typeof(p_commands) <> 'array' THEN
    RAISE EXCEPTION 'invalid_trip_command_batch' USING ERRCODE = '22023';
  END IF;

  command_count := jsonb_array_length(p_commands);
  IF command_count < 1 OR command_count > 32 THEN
    RAISE EXCEPTION 'authority_command_batch_size' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('trip:' || p_trip_id::text, 0));
  is_new_resource := NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id);

  IF is_new_resource THEN
    IF NOT (
      p_commands -> 0 ->> 'entity_type' = 'trip'
      AND p_commands -> 0 ->> 'action' = 'upsert'
      AND (p_commands -> 0 ->> 'entity_id')::uuid = p_trip_id
      AND (
        NOT EXISTS (SELECT 1 FROM public.documents WHERE id = p_trip_id)
        OR public.check_can_write_authority_trip(p_trip_id, actor_id)
      )
    ) THEN
      RAISE EXCEPTION 'authority_trip_create_forbidden' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.check_can_write_authority_trip(p_trip_id, actor_id) THEN
    RAISE EXCEPTION 'authority_trip_write_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(state.revision, 0), COALESCE(state.updated_at, timezone('utc', now()))
  INTO current_revision, state_updated_at
  FROM (SELECT 1) singleton
  LEFT JOIN public.trip_authority_state state ON state.trip_id = p_trip_id;

  FOR command IN SELECT value FROM jsonb_array_elements(p_commands)
  LOOP
    IF command ->> 'operation_id' IS NULL
      OR command ->> 'entity_id' IS NULL
      OR command ->> 'entity_type' IS NULL
      OR command ->> 'action' IS NULL THEN
      RAISE EXCEPTION 'invalid_trip_authority_command' USING ERRCODE = '22023';
    END IF;

    requested_operation_id := (command ->> 'operation_id')::uuid;
    operation_hash := encode(digest(command::text, 'sha256'), 'hex');
    SELECT * INTO prior_operation
    FROM public.applied_operations applied
    WHERE applied.operation_id = requested_operation_id;

    IF FOUND THEN
      IF prior_operation.resource_type <> 'trip'
        OR prior_operation.resource_id <> p_trip_id
        OR prior_operation.actor_id <> actor_id
        OR prior_operation.command_hash <> operation_hash THEN
        RAISE EXCEPTION 'operation_id_reused' USING ERRCODE = '22023';
      END IF;
      all_changes := all_changes || jsonb_build_array(prior_operation.canonical_change);
    ELSE
      new_operation_count := new_operation_count + 1;
    END IF;
    acknowledged_ids := acknowledged_ids || jsonb_build_array(requested_operation_id::text);
  END LOOP;

  IF new_operation_count = 0 THEN
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'resource_type', 'trip',
      'resource_id', p_trip_id,
      'revision', current_revision,
      'server_updated_at', state_updated_at,
      'acknowledged_operation_ids', acknowledged_ids,
      'changes', all_changes
    );
  END IF;

  IF p_base_revision IS NOT NULL AND p_base_revision <> current_revision THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'resource_type', 'trip',
      'resource_id', p_trip_id,
      'revision', current_revision,
      'server_updated_at', state_updated_at,
      'acknowledged_operation_ids', '[]'::jsonb,
      'changes', '[]'::jsonb,
      'conflict', jsonb_build_object(
        'kind', 'resource_revision',
        'code', 'authority_revision_conflict'
      ),
      'bundle', CASE WHEN is_new_resource THEN NULL ELSE public.get_trip_authority_bundle(p_trip_id) END
    );
  END IF;

  BEGIN
    FOR command IN SELECT value FROM jsonb_array_elements(p_commands)
    LOOP
      requested_operation_id := (command ->> 'operation_id')::uuid;
      IF EXISTS (SELECT 1 FROM public.applied_operations WHERE applied_operations.operation_id = requested_operation_id) THEN
        CONTINUE;
      END IF;

      canonical_change := public.apply_one_trip_authority_command(p_trip_id, command, actor_id);
      canonical_change := canonical_change || jsonb_build_object('operation_id', requested_operation_id);
      all_changes := all_changes || jsonb_build_array(canonical_change);
      changed_entities := changed_entities || jsonb_build_array(jsonb_build_object(
        'entity_type', canonical_change ->> 'entity_type',
        'entity_id', canonical_change ->> 'entity_id',
        'action', canonical_change ->> 'action'
      ));
      new_receipts := new_receipts || jsonb_build_array(jsonb_build_object(
        'operation_id', requested_operation_id,
        'command_hash', encode(digest(command::text, 'sha256'), 'hex'),
        'canonical_change', canonical_change
      ));
    END LOOP;
  EXCEPTION
    WHEN serialization_failure THEN
      RETURN jsonb_build_object(
        'status', 'conflict',
        'resource_type', 'trip',
        'resource_id', p_trip_id,
        'revision', current_revision,
        'server_updated_at', state_updated_at,
        'acknowledged_operation_ids', '[]'::jsonb,
        'changes', '[]'::jsonb,
        'conflict', jsonb_build_object(
          'kind', 'entity_version',
          'code', 'authority_row_version_conflict',
          'entity_type', command ->> 'entity_type',
          'entity_id', command ->> 'entity_id'
        ),
        'bundle', public.get_trip_authority_bundle(p_trip_id)
      );
  END;

  SELECT COALESCE(jsonb_agg(unique_change.change ORDER BY unique_change.ordinal), '[]'::jsonb)
  INTO changed_entities
  FROM (
    SELECT DISTINCT ON (change ->> 'entity_type', change ->> 'entity_id')
      change,
      ordinal
    FROM jsonb_array_elements(changed_entities) WITH ORDINALITY expanded(change, ordinal)
    ORDER BY change ->> 'entity_type', change ->> 'entity_id', ordinal DESC
  ) unique_change;

  INSERT INTO public.trip_authority_state AS state (
    trip_id, revision, changed_entities, updated_at
  ) VALUES (
    p_trip_id, 1, changed_entities, timezone('utc', now())
  )
  ON CONFLICT (trip_id) DO UPDATE
    SET revision = state.revision + 1,
        changed_entities = EXCLUDED.changed_entities,
        updated_at = EXCLUDED.updated_at
  RETURNING revision, updated_at INTO next_revision, state_updated_at;

  FOR receipt IN SELECT value FROM jsonb_array_elements(new_receipts)
  LOOP
    INSERT INTO public.applied_operations (
      operation_id, resource_type, resource_id, actor_id,
      command_hash, revision, canonical_change
    ) VALUES (
      (receipt ->> 'operation_id')::uuid,
      'trip',
      p_trip_id,
      actor_id,
      receipt ->> 'command_hash',
      next_revision,
      receipt -> 'canonical_change'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'applied',
    'resource_type', 'trip',
    'resource_id', p_trip_id,
    'revision', next_revision,
    'server_updated_at', state_updated_at,
    'acknowledged_operation_ids', acknowledged_ids,
    'changes', all_changes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_template_authority_commands(
  p_template_id uuid,
  p_commands jsonb,
  p_base_revision bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  actor_id uuid := auth.uid();
  command_count integer;
  command jsonb;
  requested_operation_id uuid;
  operation_hash text;
  prior_operation public.applied_operations%ROWTYPE;
  current_revision bigint;
  next_revision bigint;
  state_updated_at timestamptz;
  is_new_resource boolean;
  new_operation_count integer := 0;
  all_changes jsonb := '[]'::jsonb;
  new_receipts jsonb := '[]'::jsonb;
  acknowledged_ids jsonb := '[]'::jsonb;
  changed_entities jsonb := '[]'::jsonb;
  canonical_change jsonb;
  receipt jsonb;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_template_id IS NULL OR jsonb_typeof(p_commands) <> 'array' THEN
    RAISE EXCEPTION 'invalid_template_command_batch' USING ERRCODE = '22023';
  END IF;

  command_count := jsonb_array_length(p_commands);
  IF command_count < 1 OR command_count > 32 THEN
    RAISE EXCEPTION 'authority_command_batch_size' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('template:' || p_template_id::text, 0));
  is_new_resource := NOT EXISTS (
    SELECT 1 FROM public.checklist_templates WHERE id = p_template_id
  );

  IF is_new_resource THEN
    IF NOT (
      p_commands -> 0 ->> 'entity_type' = 'template'
      AND p_commands -> 0 ->> 'action' = 'upsert'
      AND (p_commands -> 0 ->> 'entity_id')::uuid = p_template_id
      AND (
        NOT EXISTS (SELECT 1 FROM public.documents WHERE id = p_template_id)
        OR public.check_can_write_authority_template(p_template_id, actor_id)
      )
    ) THEN
      RAISE EXCEPTION 'authority_template_create_forbidden' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.check_can_write_authority_template(p_template_id, actor_id) THEN
    RAISE EXCEPTION 'authority_template_write_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(state.revision, 0), COALESCE(state.updated_at, timezone('utc', now()))
  INTO current_revision, state_updated_at
  FROM (SELECT 1) singleton
  LEFT JOIN public.template_authority_state state ON state.template_id = p_template_id;

  FOR command IN SELECT value FROM jsonb_array_elements(p_commands)
  LOOP
    IF command ->> 'operation_id' IS NULL
      OR command ->> 'entity_id' IS NULL
      OR command ->> 'entity_type' IS NULL
      OR command ->> 'action' IS NULL THEN
      RAISE EXCEPTION 'invalid_template_authority_command' USING ERRCODE = '22023';
    END IF;

    requested_operation_id := (command ->> 'operation_id')::uuid;
    operation_hash := encode(digest(command::text, 'sha256'), 'hex');
    SELECT * INTO prior_operation
    FROM public.applied_operations applied
    WHERE applied.operation_id = requested_operation_id;

    IF FOUND THEN
      IF prior_operation.resource_type <> 'template'
        OR prior_operation.resource_id <> p_template_id
        OR prior_operation.actor_id <> actor_id
        OR prior_operation.command_hash <> operation_hash THEN
        RAISE EXCEPTION 'operation_id_reused' USING ERRCODE = '22023';
      END IF;
      all_changes := all_changes || jsonb_build_array(prior_operation.canonical_change);
    ELSE
      new_operation_count := new_operation_count + 1;
    END IF;
    acknowledged_ids := acknowledged_ids || jsonb_build_array(requested_operation_id::text);
  END LOOP;

  IF new_operation_count = 0 THEN
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'resource_type', 'template',
      'resource_id', p_template_id,
      'revision', current_revision,
      'server_updated_at', state_updated_at,
      'acknowledged_operation_ids', acknowledged_ids,
      'changes', all_changes
    );
  END IF;

  IF p_base_revision IS NOT NULL AND p_base_revision <> current_revision THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'resource_type', 'template',
      'resource_id', p_template_id,
      'revision', current_revision,
      'server_updated_at', state_updated_at,
      'acknowledged_operation_ids', '[]'::jsonb,
      'changes', '[]'::jsonb,
      'conflict', jsonb_build_object(
        'kind', 'resource_revision',
        'code', 'authority_revision_conflict'
      ),
      'bundle', CASE WHEN is_new_resource THEN NULL ELSE public.get_template_authority_bundle(p_template_id) END
    );
  END IF;

  BEGIN
    FOR command IN SELECT value FROM jsonb_array_elements(p_commands)
    LOOP
      requested_operation_id := (command ->> 'operation_id')::uuid;
      IF EXISTS (SELECT 1 FROM public.applied_operations WHERE applied_operations.operation_id = requested_operation_id) THEN
        CONTINUE;
      END IF;

      canonical_change := public.apply_one_template_authority_command(
        p_template_id, command, actor_id
      );
      canonical_change := canonical_change || jsonb_build_object('operation_id', requested_operation_id);
      all_changes := all_changes || jsonb_build_array(canonical_change);
      changed_entities := changed_entities || jsonb_build_array(jsonb_build_object(
        'entity_type', canonical_change ->> 'entity_type',
        'entity_id', canonical_change ->> 'entity_id',
        'action', canonical_change ->> 'action'
      ));
      new_receipts := new_receipts || jsonb_build_array(jsonb_build_object(
        'operation_id', requested_operation_id,
        'command_hash', encode(digest(command::text, 'sha256'), 'hex'),
        'canonical_change', canonical_change
      ));
    END LOOP;
  EXCEPTION
    WHEN serialization_failure THEN
      RETURN jsonb_build_object(
        'status', 'conflict',
        'resource_type', 'template',
        'resource_id', p_template_id,
        'revision', current_revision,
        'server_updated_at', state_updated_at,
        'acknowledged_operation_ids', '[]'::jsonb,
        'changes', '[]'::jsonb,
        'conflict', jsonb_build_object(
          'kind', 'entity_version',
          'code', 'authority_row_version_conflict',
          'entity_type', command ->> 'entity_type',
          'entity_id', command ->> 'entity_id'
        ),
        'bundle', public.get_template_authority_bundle(p_template_id)
      );
  END;

  SELECT COALESCE(jsonb_agg(unique_change.change ORDER BY unique_change.ordinal), '[]'::jsonb)
  INTO changed_entities
  FROM (
    SELECT DISTINCT ON (change ->> 'entity_type', change ->> 'entity_id')
      change,
      ordinal
    FROM jsonb_array_elements(changed_entities) WITH ORDINALITY expanded(change, ordinal)
    ORDER BY change ->> 'entity_type', change ->> 'entity_id', ordinal DESC
  ) unique_change;

  INSERT INTO public.template_authority_state AS state (
    template_id, revision, changed_entities, updated_at
  ) VALUES (
    p_template_id, 1, changed_entities, timezone('utc', now())
  )
  ON CONFLICT (template_id) DO UPDATE
    SET revision = state.revision + 1,
        changed_entities = EXCLUDED.changed_entities,
        updated_at = EXCLUDED.updated_at
  RETURNING revision, updated_at INTO next_revision, state_updated_at;

  FOR receipt IN SELECT value FROM jsonb_array_elements(new_receipts)
  LOOP
    INSERT INTO public.applied_operations (
      operation_id, resource_type, resource_id, actor_id,
      command_hash, revision, canonical_change
    ) VALUES (
      (receipt ->> 'operation_id')::uuid,
      'template',
      p_template_id,
      actor_id,
      receipt ->> 'command_hash',
      next_revision,
      receipt -> 'canonical_change'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'applied',
    'resource_type', 'template',
    'resource_id', p_template_id,
    'revision', next_revision,
    'server_updated_at', state_updated_at,
    'acknowledged_operation_ids', acknowledged_ids,
    'changes', all_changes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_one_trip_authority_command(uuid, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_one_template_authority_command(uuid, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_trip_authority_commands(uuid, jsonb, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_template_authority_commands(uuid, jsonb, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_trip_authority_revision(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_template_authority_revision(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_trip_authority_bundle(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_template_authority_bundle(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_trip_authority_changes(uuid, jsonb, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_template_authority_changes(uuid, jsonb, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_trip_authority_summaries() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_template_authority_summaries() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.apply_trip_commands(
  p_trip_id uuid,
  p_commands jsonb,
  p_base_revision bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.apply_trip_authority_commands(p_trip_id, p_commands, p_base_revision);
$$;

CREATE OR REPLACE FUNCTION public.apply_template_commands(
  p_template_id uuid,
  p_commands jsonb,
  p_base_revision bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.apply_template_authority_commands(p_template_id, p_commands, p_base_revision);
$$;

REVOKE ALL ON FUNCTION public.apply_trip_commands(uuid, jsonb, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_template_commands(uuid, jsonb, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_trip_authority_commands(uuid, jsonb, bigint) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_template_authority_commands(uuid, jsonb, bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_trip_commands(uuid, jsonb, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_template_commands(uuid, jsonb, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trip_authority_revision(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_template_authority_revision(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trip_authority_bundle(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_template_authority_bundle(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trip_authority_changes(uuid, jsonb, bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_template_authority_changes(uuid, jsonb, bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_trip_authority_summaries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_template_authority_summaries() TO authenticated;
