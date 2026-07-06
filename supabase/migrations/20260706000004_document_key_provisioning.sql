-- TASK-015: device-level owner-side document key provisioning.
-- Stores public wrapping material and wrapped DEKs only. Plain DEKs/KEKs/private keys
-- must never be persisted or returned by these RPCs.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.document_keys') IS NULL
    OR to_regclass('public.document_members') IS NULL
    OR to_regclass('public.document_invitation_links') IS NULL
  THEN
    RAISE EXCEPTION
      'TASK-015 migration requires prior local-first/invitation migrations. Run 20260630000001_local_first_backup_schema.sql, 20260630000002_document_keys.sql, and 20260706000001_document_invitation_permission_registry.sql before this file.';
  END IF;

  IF to_regprocedure('public.document_registry_hash(text)') IS NULL
    OR to_regprocedure('public.check_is_document_editor(uuid, uuid)') IS NULL
    OR to_regprocedure('public.check_is_document_owner(uuid, uuid)') IS NULL
  THEN
    RAISE EXCEPTION
      'TASK-015 migration requires TASK-013 registry helper functions. Run 20260706000001_document_invitation_permission_registry.sql before this file.';
  END IF;
END $$;

-- document_keys device recipient compatibility -------------------------------
ALTER TABLE public.document_keys
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS material_id uuid,
  ADD COLUMN IF NOT EXISTS recipient_scope text DEFAULT 'legacy_user' NOT NULL;

ALTER TABLE public.document_keys
  DROP CONSTRAINT IF EXISTS document_keys_wrapping_alg_check;

ALTER TABLE public.document_keys
  ADD CONSTRAINT document_keys_wrapping_alg_check
  CHECK (wrapping_alg IN ('AES-KW-256', 'RSA-OAEP-256'));

ALTER TABLE public.document_keys
  DROP CONSTRAINT IF EXISTS document_keys_document_id_user_id_key_version_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_keys_recipient_scope_check'
  ) THEN
    ALTER TABLE public.document_keys
      ADD CONSTRAINT document_keys_recipient_scope_check
      CHECK (recipient_scope IN ('legacy_user', 'device'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_keys_device_recipient_shape_check'
  ) THEN
    ALTER TABLE public.document_keys
      ADD CONSTRAINT document_keys_device_recipient_shape_check
      CHECK (
        (
          recipient_scope = 'legacy_user'
          AND device_id IS NULL
          AND material_id IS NULL
        )
        OR (
          recipient_scope = 'device'
          AND NULLIF(device_id, '') IS NOT NULL
          AND material_id IS NOT NULL
        )
      );
  END IF;
END $$;

UPDATE public.document_keys
  SET recipient_scope = CASE
        WHEN device_id IS NULL THEN 'legacy_user'
        ELSE 'device'
      END
  WHERE recipient_scope IS NULL
     OR recipient_scope NOT IN ('legacy_user', 'device');

CREATE UNIQUE INDEX IF NOT EXISTS document_keys_active_legacy_user_key
  ON public.document_keys(document_id, user_id, key_version)
  WHERE revoked_at IS NULL AND device_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS document_keys_active_device_recipient_key
  ON public.document_keys(document_id, user_id, device_id, key_version)
  WHERE revoked_at IS NULL AND device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_keys_material_id_idx
  ON public.document_keys(material_id);

-- user_key_materials ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_key_materials (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  device_id text NOT NULL CHECK (char_length(trim(device_id)) BETWEEN 1 AND 160),
  wrapping_alg text NOT NULL CHECK (wrapping_alg IN ('RSA-OAEP-256')),
  public_key_jwk jsonb NOT NULL CHECK (jsonb_typeof(public_key_jwk) = 'object'),
  material_version integer DEFAULT 1 NOT NULL CHECK (material_version > 0),
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'revoked')),
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  revoked_at timestamp with time zone,
  UNIQUE(user_id, device_id, material_version)
);

CREATE INDEX IF NOT EXISTS user_key_materials_user_id_idx
  ON public.user_key_materials(user_id);

CREATE INDEX IF NOT EXISTS user_key_materials_active_device_idx
  ON public.user_key_materials(user_id, device_id, material_version)
  WHERE status = 'active' AND revoked_at IS NULL;

ALTER TABLE public.user_key_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select own user key materials" ON public.user_key_materials;
DROP POLICY IF EXISTS "Insert own user key materials" ON public.user_key_materials;
DROP POLICY IF EXISTS "Update own user key materials" ON public.user_key_materials;

CREATE POLICY "Select own user key materials"
  ON public.user_key_materials
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Insert own user key materials"
  ON public.user_key_materials
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update own user key materials"
  ON public.user_key_materials
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- add FK after table creation so repeated migrations stay idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_keys_material_id_fkey'
  ) THEN
    ALTER TABLE public.document_keys
      ADD CONSTRAINT document_keys_material_id_fkey
      FOREIGN KEY (material_id) REFERENCES public.user_key_materials(id) ON DELETE SET NULL;
  END IF;
END $$;

-- document_key_provisioning_requests ----------------------------------------
CREATE TABLE IF NOT EXISTS public.document_key_provisioning_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  device_id text,
  material_id uuid REFERENCES public.user_key_materials(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  key_version integer DEFAULT 1 NOT NULL CHECK (key_version > 0),
  status text DEFAULT 'pending' NOT NULL CHECK (
    status IN ('waiting_for_material', 'pending', 'processing', 'completed', 'failed', 'cancelled', 'superseded')
  ),
  error_code text,
  attempt_count integer DEFAULT 0 NOT NULL CHECK (attempt_count >= 0),
  requested_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  processing_started_at timestamp with time zone,
  fulfilled_at timestamp with time zone,
  failed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CHECK (
    (status = 'waiting_for_material' AND device_id IS NULL AND material_id IS NULL)
    OR (device_id IS NOT NULL AND material_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS document_key_provisioning_active_device_key
  ON public.document_key_provisioning_requests(document_id, user_id, device_id, key_version)
  WHERE device_id IS NOT NULL AND status IN ('waiting_for_material', 'pending', 'processing', 'failed');

CREATE UNIQUE INDEX IF NOT EXISTS document_key_provisioning_waiting_user_key
  ON public.document_key_provisioning_requests(document_id, user_id, key_version)
  WHERE device_id IS NULL AND status = 'waiting_for_material';

CREATE INDEX IF NOT EXISTS document_key_provisioning_status_idx
  ON public.document_key_provisioning_requests(status, updated_at);

CREATE INDEX IF NOT EXISTS document_key_provisioning_document_idx
  ON public.document_key_provisioning_requests(document_id);

ALTER TABLE public.document_key_provisioning_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select own provisioning request status" ON public.document_key_provisioning_requests;
CREATE POLICY "Select own provisioning request status"
  ON public.document_key_provisioning_requests
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND public.check_is_document_member(document_id, auth.uid())
  );

-- Direct key writes are replaced by RPCs below.
DROP POLICY IF EXISTS "Insert document keys as owner" ON public.document_keys;
DROP POLICY IF EXISTS "Revoke document keys as owner" ON public.document_keys;
DROP POLICY IF EXISTS "Delete document keys as owner" ON public.document_keys;

DROP POLICY IF EXISTS "Select document keys by owner or own active member" ON public.document_keys;
CREATE POLICY "Select own active document keys"
  ON public.document_keys
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND revoked_at IS NULL
    AND public.check_is_document_member(document_id, auth.uid())
  );

CREATE OR REPLACE FUNCTION public.sanitize_key_provisioning_error_code(p_error_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT left(
    regexp_replace(COALESCE(NULLIF(p_error_code, ''), 'unknown'), '[^a-zA-Z0-9:_-]', '', 'g'),
    80
  );
$$;

CREATE OR REPLACE FUNCTION public.has_active_document_key_for_device(
  p_document_id uuid,
  p_user_id uuid,
  p_device_id text DEFAULT NULL,
  p_key_version integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.document_keys dk
    WHERE dk.document_id = p_document_id
      AND dk.user_id = p_user_id
      AND dk.revoked_at IS NULL
      AND (p_key_version IS NULL OR dk.key_version = p_key_version)
      AND (
        NULLIF(p_device_id, '') IS NULL
        OR dk.device_id = p_device_id
        OR dk.device_id IS NULL
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.enqueue_key_provisioning_notification(
  p_document_id uuid,
  p_actor_id uuid,
  p_reason_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  targets uuid[];
  dedupe text;
BEGIN
  IF to_regclass('public.notification_events') IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT dm.user_id), ARRAY[]::uuid[])
    INTO targets
  FROM public.document_members dm
  WHERE dm.document_id = p_document_id
    AND dm.status = 'accepted'
    AND dm.user_id IS NOT NULL
    AND dm.user_id <> p_actor_id
    AND dm.role IN ('owner', 'editor');

  IF array_length(targets, 1) IS NULL THEN
    RETURN;
  END IF;

  dedupe := left(
    p_document_id::text || ':member_joined:' || COALESCE(p_actor_id::text, 'system') || ':' || p_reason_code,
    240
  );

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
    p_actor_id,
    'member_joined',
    targets,
    public.notification_title_key_for_event('member_joined'),
    public.notification_body_key_for_event('member_joined'),
    public.sanitize_notification_metadata(jsonb_build_object(
      'document_type', 'trip',
      'operation', 'updated',
      'entity_type', 'member',
      'reason_code', p_reason_code,
      'change_count', 1
    )),
    dedupe,
    p_document_id::text || ':member_joined:' || COALESCE(p_actor_id::text, 'system'),
    timezone('utc'::text, now()) + interval '30 seconds'
  )
  ON CONFLICT (dedupe_key) WHERE status = 'pending'
  DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_key_provisioning_requests_for_user(
  p_document_id uuid,
  p_user_id uuid,
  p_key_version integer DEFAULT 1,
  p_requested_by uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.document_members dm
    WHERE dm.document_id = p_document_id
      AND dm.user_id = p_user_id
      AND dm.status = 'accepted'
  ) THEN
    RETURN 0;
  END IF;

  WITH active_materials AS (
    SELECT ukm.id, ukm.device_id
    FROM public.user_key_materials ukm
    WHERE ukm.user_id = p_user_id
      AND ukm.status = 'active'
      AND ukm.revoked_at IS NULL
      AND NOT public.has_active_document_key_for_device(
        p_document_id,
        p_user_id,
        ukm.device_id,
        p_key_version
      )
  ),
  upserted AS (
    INSERT INTO public.document_key_provisioning_requests (
      document_id,
      user_id,
      device_id,
      material_id,
      requested_by,
      key_version,
      status,
      error_code,
      requested_at,
      updated_at
    )
    SELECT
      p_document_id,
      p_user_id,
      active_materials.device_id,
      active_materials.id,
      p_requested_by,
      p_key_version,
      'pending',
      NULL,
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    FROM active_materials
    ON CONFLICT (document_id, user_id, device_id, key_version)
      WHERE device_id IS NOT NULL AND status IN ('waiting_for_material', 'pending', 'processing', 'failed')
    DO UPDATE
      SET material_id = EXCLUDED.material_id,
          status = CASE
            WHEN public.document_key_provisioning_requests.status IN ('completed', 'cancelled') THEN public.document_key_provisioning_requests.status
            ELSE 'pending'
          END,
          error_code = NULL,
          requested_at = timezone('utc'::text, now()),
          updated_at = timezone('utc'::text, now())
    RETURNING 1
  )
  SELECT count(*)::integer INTO inserted_count FROM upserted;

  IF inserted_count > 0 THEN
    UPDATE public.document_key_provisioning_requests
      SET status = 'superseded',
          updated_at = timezone('utc'::text, now())
      WHERE document_id = p_document_id
        AND user_id = p_user_id
        AND key_version = p_key_version
        AND device_id IS NULL
        AND status = 'waiting_for_material';
  ELSIF NOT public.has_active_document_key_for_device(p_document_id, p_user_id, NULL, p_key_version) THEN
    INSERT INTO public.document_key_provisioning_requests (
      document_id,
      user_id,
      requested_by,
      key_version,
      status,
      requested_at,
      updated_at
    )
    VALUES (
      p_document_id,
      p_user_id,
      p_requested_by,
      p_key_version,
      'waiting_for_material',
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    )
    ON CONFLICT (document_id, user_id, key_version)
      WHERE device_id IS NULL AND status = 'waiting_for_material'
    DO UPDATE
      SET requested_by = COALESCE(EXCLUDED.requested_by, public.document_key_provisioning_requests.requested_by),
          updated_at = timezone('utc'::text, now());

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
  END IF;

  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_user_key_material(
  p_device_id text,
  p_wrapping_alg text,
  p_public_key_jwk jsonb,
  p_material_version integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  material_record public.user_key_materials%ROWTYPE;
  queued_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF NULLIF(trim(COALESCE(p_device_id, '')), '') IS NULL
    OR char_length(trim(p_device_id)) > 160
    OR p_wrapping_alg <> 'RSA-OAEP-256'
    OR COALESCE(p_material_version, 0) <= 0
    OR jsonb_typeof(COALESCE(p_public_key_jwk, 'null'::jsonb)) <> 'object'
  THEN
    RAISE EXCEPTION '유효하지 않은 키 등록 요청입니다.';
  END IF;

  INSERT INTO public.user_key_materials (
    user_id,
    device_id,
    wrapping_alg,
    public_key_jwk,
    material_version,
    status,
    last_seen_at,
    updated_at,
    revoked_at
  )
  VALUES (
    auth.uid(),
    trim(p_device_id),
    p_wrapping_alg,
    p_public_key_jwk,
    p_material_version,
    'active',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    NULL
  )
  ON CONFLICT (user_id, device_id, material_version)
  DO UPDATE
    SET wrapping_alg = EXCLUDED.wrapping_alg,
        public_key_jwk = EXCLUDED.public_key_jwk,
        status = 'active',
        last_seen_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now()),
        revoked_at = NULL
  RETURNING * INTO material_record;

  WITH accepted_documents AS (
    SELECT dm.document_id
    FROM public.document_members dm
    WHERE dm.user_id = auth.uid()
      AND dm.status = 'accepted'
  ),
  queued AS (
    SELECT public.upsert_key_provisioning_requests_for_user(
      ad.document_id,
      auth.uid(),
      1,
      auth.uid()
    ) AS affected
    FROM accepted_documents ad
  )
  SELECT COALESCE(sum(affected), 0)::integer INTO queued_count FROM queued;

  RETURN jsonb_build_object(
    'id', material_record.id,
    'user_id', material_record.user_id,
    'device_id', material_record.device_id,
    'wrapping_alg', material_record.wrapping_alg,
    'material_version', material_record.material_version,
    'status', material_record.status,
    'queued_request_count', queued_count,
    'created_at', material_record.created_at,
    'updated_at', material_record.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_user_key_material(
  p_device_id text,
  p_material_version integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  revoked_material_count integer := 0;
  cancelled_request_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  UPDATE public.user_key_materials
    SET status = 'revoked',
        revoked_at = COALESCE(revoked_at, timezone('utc'::text, now())),
        updated_at = timezone('utc'::text, now())
    WHERE user_id = auth.uid()
      AND device_id = trim(COALESCE(p_device_id, ''))
      AND material_version = COALESCE(p_material_version, 1)
      AND status = 'active';

  GET DIAGNOSTICS revoked_material_count = ROW_COUNT;

  UPDATE public.document_key_provisioning_requests
    SET status = 'cancelled',
        cancelled_at = COALESCE(cancelled_at, timezone('utc'::text, now())),
        updated_at = timezone('utc'::text, now())
    WHERE user_id = auth.uid()
      AND device_id = trim(COALESCE(p_device_id, ''))
      AND status IN ('pending', 'processing', 'failed');

  GET DIAGNOSTICS cancelled_request_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'revoked_material_count', revoked_material_count,
    'cancelled_request_count', cancelled_request_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_document_key_provisioning(
  p_document_id uuid,
  p_device_id text,
  p_key_version integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_material public.user_key_materials%ROWTYPE;
  request_record public.document_key_provisioning_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF NOT public.check_is_document_member(p_document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF public.has_active_document_key_for_device(
    p_document_id,
    auth.uid(),
    p_device_id,
    COALESCE(p_key_version, 1)
  ) THEN
    RETURN jsonb_build_object(
      'document_id', p_document_id,
      'user_id', auth.uid(),
      'device_id', p_device_id,
      'key_version', COALESCE(p_key_version, 1),
      'status', 'completed',
      'has_active_key', true,
      'retryable', false
    );
  END IF;

  SELECT *
    INTO current_material
  FROM public.user_key_materials
  WHERE user_id = auth.uid()
    AND device_id = trim(COALESCE(p_device_id, ''))
    AND status = 'active'
    AND revoked_at IS NULL
  ORDER BY material_version DESC, created_at DESC
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.document_key_provisioning_requests (
      document_id,
      user_id,
      device_id,
      material_id,
      requested_by,
      key_version,
      status,
      error_code,
      requested_at,
      updated_at
    )
    VALUES (
      p_document_id,
      auth.uid(),
      current_material.device_id,
      current_material.id,
      auth.uid(),
      COALESCE(p_key_version, 1),
      'pending',
      NULL,
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    )
    ON CONFLICT (document_id, user_id, device_id, key_version)
      WHERE device_id IS NOT NULL AND status IN ('waiting_for_material', 'pending', 'processing', 'failed')
    DO UPDATE
      SET material_id = EXCLUDED.material_id,
          requested_by = auth.uid(),
          status = 'pending',
          error_code = NULL,
          requested_at = timezone('utc'::text, now()),
          updated_at = timezone('utc'::text, now())
    RETURNING * INTO request_record;
  ELSE
    INSERT INTO public.document_key_provisioning_requests (
      document_id,
      user_id,
      requested_by,
      key_version,
      status,
      requested_at,
      updated_at
    )
    VALUES (
      p_document_id,
      auth.uid(),
      auth.uid(),
      COALESCE(p_key_version, 1),
      'waiting_for_material',
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    )
    ON CONFLICT (document_id, user_id, key_version)
      WHERE device_id IS NULL AND status = 'waiting_for_material'
    DO UPDATE
      SET requested_by = auth.uid(),
          updated_at = timezone('utc'::text, now())
    RETURNING * INTO request_record;
  END IF;

  PERFORM public.enqueue_key_provisioning_notification(
    p_document_id,
    auth.uid(),
    CASE WHEN request_record.status = 'waiting_for_material'
      THEN 'key_provisioning_waiting_for_material'
      ELSE 'key_provisioning_pending'
    END
  );

  RETURN jsonb_build_object(
    'id', request_record.id,
    'document_id', request_record.document_id,
    'user_id', request_record.user_id,
    'device_id', request_record.device_id,
    'key_version', request_record.key_version,
    'status', request_record.status,
    'error_code', request_record.error_code,
    'attempt_count', request_record.attempt_count,
    'has_active_key', false,
    'retryable', request_record.status IN ('waiting_for_material', 'failed', 'cancelled')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_document_key_provisioning_status(
  p_document_id uuid,
  p_device_id text,
  p_key_version integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record public.document_key_provisioning_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF NOT public.check_is_document_member(p_document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF public.has_active_document_key_for_device(
    p_document_id,
    auth.uid(),
    p_device_id,
    COALESCE(p_key_version, 1)
  ) THEN
    RETURN jsonb_build_object(
      'document_id', p_document_id,
      'user_id', auth.uid(),
      'device_id', p_device_id,
      'key_version', COALESCE(p_key_version, 1),
      'status', 'completed',
      'has_active_key', true,
      'retryable', false
    );
  END IF;

  SELECT *
    INTO request_record
  FROM public.document_key_provisioning_requests
  WHERE document_id = p_document_id
    AND user_id = auth.uid()
    AND key_version = COALESCE(p_key_version, 1)
    AND (
      device_id = trim(COALESCE(p_device_id, ''))
      OR device_id IS NULL
    )
  ORDER BY
    CASE WHEN device_id = trim(COALESCE(p_device_id, '')) THEN 0 ELSE 1 END,
    updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'document_id', p_document_id,
      'user_id', auth.uid(),
      'device_id', p_device_id,
      'key_version', COALESCE(p_key_version, 1),
      'status', 'none',
      'has_active_key', false,
      'retryable', true
    );
  END IF;

  RETURN jsonb_build_object(
    'id', request_record.id,
    'document_id', request_record.document_id,
    'user_id', request_record.user_id,
    'device_id', COALESCE(request_record.device_id, p_device_id),
    'key_version', request_record.key_version,
    'status', request_record.status,
    'error_code', request_record.error_code,
    'attempt_count', request_record.attempt_count,
    'requested_at', request_record.requested_at,
    'updated_at', request_record.updated_at,
    'has_active_key', false,
    'retryable', request_record.status IN ('waiting_for_material', 'failed', 'cancelled')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_pending_document_key_provisioning_requests(
  p_document_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  user_id uuid,
  device_id text,
  material_id uuid,
  wrapping_alg text,
  public_key_jwk jsonb,
  material_version integer,
  member_role text,
  status text,
  key_version integer,
  error_code text,
  attempt_count integer,
  requested_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  RETURN QUERY
  SELECT
    req.id,
    req.document_id,
    req.user_id,
    req.device_id,
    req.material_id,
    ukm.wrapping_alg,
    ukm.public_key_jwk,
    ukm.material_version,
    dm.role AS member_role,
    req.status,
    req.key_version,
    req.error_code,
    req.attempt_count,
    req.requested_at,
    req.updated_at
  FROM public.document_key_provisioning_requests req
  JOIN public.user_key_materials ukm ON ukm.id = req.material_id
  JOIN public.document_members dm
    ON dm.document_id = req.document_id
   AND dm.user_id = req.user_id
   AND dm.status = 'accepted'
  WHERE req.status IN ('pending', 'failed')
    AND ukm.status = 'active'
    AND ukm.revoked_at IS NULL
    AND (p_document_id IS NULL OR req.document_id = p_document_id)
    AND public.check_is_document_editor(req.document_id, auth.uid())
  ORDER BY req.updated_at ASC, req.requested_at ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_document_key_provisioning(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record public.document_key_provisioning_requests%ROWTYPE;
  material_record public.user_key_materials%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT *
    INTO request_record
  FROM public.document_key_provisioning_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.check_is_document_editor(request_record.document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF request_record.status = 'completed' THEN
    RETURN jsonb_build_object('id', request_record.id, 'status', 'completed');
  END IF;

  IF request_record.status NOT IN ('pending', 'failed')
    AND NOT (
      request_record.status = 'processing'
      AND request_record.processing_started_at < timezone('utc'::text, now()) - interval '10 minutes'
    )
  THEN
    RAISE EXCEPTION '처리할 수 없는 요청 상태입니다.';
  END IF;

  SELECT *
    INTO material_record
  FROM public.user_key_materials
  WHERE id = request_record.material_id
    AND user_id = request_record.user_id
    AND device_id = request_record.device_id
    AND status = 'active'
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    UPDATE public.document_key_provisioning_requests
      SET status = 'waiting_for_material',
          error_code = 'material_unavailable',
          updated_at = timezone('utc'::text, now())
      WHERE id = request_record.id
      RETURNING * INTO request_record;

    RETURN jsonb_build_object(
      'id', request_record.id,
      'status', request_record.status,
      'error_code', request_record.error_code
    );
  END IF;

  UPDATE public.document_key_provisioning_requests
    SET status = 'processing',
        requested_by = auth.uid(),
        processing_started_at = timezone('utc'::text, now()),
        attempt_count = attempt_count + 1,
        error_code = NULL,
        updated_at = timezone('utc'::text, now())
    WHERE id = request_record.id
    RETURNING * INTO request_record;

  RETURN jsonb_build_object(
    'id', request_record.id,
    'document_id', request_record.document_id,
    'user_id', request_record.user_id,
    'device_id', request_record.device_id,
    'material_id', request_record.material_id,
    'wrapping_alg', material_record.wrapping_alg,
    'public_key_jwk', material_record.public_key_jwk,
    'material_version', material_record.material_version,
    'status', request_record.status,
    'key_version', request_record.key_version,
    'attempt_count', request_record.attempt_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_document_key_provisioning(
  p_request_id uuid,
  p_wrapped_dek bytea,
  p_wrapping_alg text,
  p_key_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record public.document_key_provisioning_requests%ROWTYPE;
  target_member public.document_members%ROWTYPE;
  updated_key_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_wrapping_alg <> 'RSA-OAEP-256' OR p_wrapped_dek IS NULL THEN
    RAISE EXCEPTION '유효하지 않은 키 발급 요청입니다.';
  END IF;

  SELECT *
    INTO request_record
  FROM public.document_key_provisioning_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.check_is_document_editor(request_record.document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF request_record.status <> 'processing' THEN
    RAISE EXCEPTION '처리 중인 키 발급 요청만 완료할 수 있습니다.';
  END IF;

  IF request_record.requested_by IS DISTINCT FROM auth.uid()
    AND request_record.processing_started_at >= timezone('utc'::text, now()) - interval '10 minutes'
  THEN
    RAISE EXCEPTION '다른 사용자가 처리 중인 요청입니다.';
  END IF;

  SELECT *
    INTO target_member
  FROM public.document_members dm
  WHERE dm.document_id = request_record.document_id
    AND dm.user_id = request_record.user_id
    AND dm.status = 'accepted';

  IF NOT FOUND THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_key_materials ukm
    WHERE ukm.id = request_record.material_id
      AND ukm.user_id = request_record.user_id
      AND ukm.device_id = request_record.device_id
      AND ukm.status = 'active'
      AND ukm.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION '유효하지 않은 키 발급 요청입니다.';
  END IF;

  UPDATE public.document_keys
    SET wrapped_dek = p_wrapped_dek,
        wrapping_alg = p_wrapping_alg,
        material_id = request_record.material_id,
        recipient_scope = 'device',
        revoked_at = NULL
    WHERE document_id = request_record.document_id
      AND user_id = request_record.user_id
      AND device_id = request_record.device_id
      AND key_version = COALESCE(p_key_version, request_record.key_version)
      AND revoked_at IS NULL
    RETURNING id INTO updated_key_id;

  IF updated_key_id IS NULL THEN
    INSERT INTO public.document_keys (
      document_id,
      user_id,
      device_id,
      material_id,
      recipient_scope,
      key_version,
      wrapped_dek,
      wrapping_alg,
      revoked_at
    )
    VALUES (
      request_record.document_id,
      request_record.user_id,
      request_record.device_id,
      request_record.material_id,
      'device',
      COALESCE(p_key_version, request_record.key_version),
      p_wrapped_dek,
      p_wrapping_alg,
      NULL
    )
    RETURNING id INTO updated_key_id;
  END IF;

  UPDATE public.document_key_provisioning_requests
    SET status = 'completed',
        key_version = COALESCE(p_key_version, key_version),
        fulfilled_at = timezone('utc'::text, now()),
        error_code = NULL,
        updated_at = timezone('utc'::text, now())
    WHERE id = request_record.id
    RETURNING * INTO request_record;

  PERFORM public.enqueue_key_provisioning_notification(
    request_record.document_id,
    request_record.user_id,
    'key_provisioning_completed'
  );

  RETURN jsonb_build_object(
    'id', request_record.id,
    'document_id', request_record.document_id,
    'user_id', request_record.user_id,
    'device_id', request_record.device_id,
    'status', request_record.status,
    'document_key_id', updated_key_id,
    'key_version', request_record.key_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_document_key_provisioning_failed(
  p_request_id uuid,
  p_error_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record public.document_key_provisioning_requests%ROWTYPE;
  safe_code text := public.sanitize_key_provisioning_error_code(p_error_code);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT *
    INTO request_record
  FROM public.document_key_provisioning_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.check_is_document_editor(request_record.document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  UPDATE public.document_key_provisioning_requests
    SET status = 'failed',
        error_code = safe_code,
        failed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = request_record.id
    RETURNING * INTO request_record;

  PERFORM public.enqueue_key_provisioning_notification(
    request_record.document_id,
    request_record.user_id,
    'key_provisioning_failed'
  );

  RETURN jsonb_build_object(
    'id', request_record.id,
    'status', request_record.status,
    'error_code', request_record.error_code,
    'retryable', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_active_document_key(
  p_document_id uuid,
  p_device_id text DEFAULT NULL,
  p_key_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key_record public.document_keys%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF NOT public.check_is_document_member(p_document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  SELECT *
    INTO key_record
  FROM public.document_keys dk
  WHERE dk.document_id = p_document_id
    AND dk.user_id = auth.uid()
    AND dk.revoked_at IS NULL
    AND (p_key_version IS NULL OR dk.key_version = p_key_version)
    AND (
      NULLIF(p_device_id, '') IS NULL
      OR dk.device_id = p_device_id
      OR dk.device_id IS NULL
    )
  ORDER BY
    CASE WHEN dk.device_id = p_device_id THEN 0 ELSE 1 END,
    dk.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'document_id', key_record.document_id,
    'user_id', key_record.user_id,
    'device_id', key_record.device_id,
    'material_id', key_record.material_id,
    'recipient_scope', key_record.recipient_scope,
    'key_version', key_record.key_version,
    'wrapped_dek', key_record.wrapped_dek,
    'wrapping_alg', key_record.wrapping_alg,
    'created_at', key_record.created_at,
    'revoked_at', key_record.revoked_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_owner_document_key(
  p_document_id uuid,
  p_wrapped_dek bytea,
  p_wrapping_alg text,
  p_key_version integer DEFAULT 1,
  p_device_id text DEFAULT NULL,
  p_material_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key_id uuid;
  material_record public.user_key_materials%ROWTYPE;
  target_device_id text;
  target_material_id uuid;
  target_scope text := 'legacy_user';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF NOT public.check_is_document_owner(p_document_id, auth.uid()) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  IF p_wrapping_alg NOT IN ('AES-KW-256', 'RSA-OAEP-256') OR p_wrapped_dek IS NULL THEN
    RAISE EXCEPTION '유효하지 않은 키 저장 요청입니다.';
  END IF;

  IF p_wrapping_alg = 'RSA-OAEP-256' THEN
    IF NULLIF(trim(COALESCE(p_device_id, '')), '') IS NULL THEN
      RAISE EXCEPTION '유효하지 않은 키 저장 요청입니다.';
    END IF;

    SELECT *
      INTO material_record
    FROM public.user_key_materials ukm
    WHERE ukm.user_id = auth.uid()
      AND ukm.device_id = trim(p_device_id)
      AND ukm.wrapping_alg = 'RSA-OAEP-256'
      AND ukm.status = 'active'
      AND ukm.revoked_at IS NULL
      AND (p_material_version IS NULL OR ukm.material_version = p_material_version)
    ORDER BY ukm.material_version DESC, ukm.updated_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION '유효하지 않은 키 저장 요청입니다.';
    END IF;

    target_device_id := material_record.device_id;
    target_material_id := material_record.id;
    target_scope := 'device';
  ELSIF p_device_id IS NOT NULL THEN
    RAISE EXCEPTION '유효하지 않은 키 저장 요청입니다.';
  END IF;

  UPDATE public.document_keys
    SET wrapped_dek = p_wrapped_dek,
        wrapping_alg = p_wrapping_alg,
        device_id = target_device_id,
        material_id = target_material_id,
        recipient_scope = target_scope,
        revoked_at = NULL
    WHERE document_id = p_document_id
      AND user_id = auth.uid()
      AND device_id IS NOT DISTINCT FROM target_device_id
      AND key_version = COALESCE(p_key_version, 1)
      AND revoked_at IS NULL
    RETURNING id INTO key_id;

  IF key_id IS NULL THEN
    INSERT INTO public.document_keys (
      document_id,
      user_id,
      device_id,
      material_id,
      key_version,
      wrapped_dek,
      wrapping_alg,
      recipient_scope,
      revoked_at
    )
    VALUES (
      p_document_id,
      auth.uid(),
      target_device_id,
      target_material_id,
      COALESCE(p_key_version, 1),
      p_wrapped_dek,
      p_wrapping_alg,
      target_scope,
      NULL
    )
    RETURNING id INTO key_id;
  END IF;

  RETURN jsonb_build_object(
    'id', key_id,
    'document_id', p_document_id,
    'user_id', auth.uid(),
    'device_id', target_device_id,
    'material_id', target_material_id,
    'key_version', COALESCE(p_key_version, 1),
    'wrapping_alg', p_wrapping_alg,
    'recipient_scope', target_scope
  );
END;
$$;

-- Replace invitation/revoke RPCs with provisioning-aware behavior -------------
CREATE OR REPLACE FUNCTION public.accept_document_invitation(
  p_token text DEFAULT NULL,
  p_invite_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_record public.document_invitation_links%ROWTYPE;
  member_record public.document_members%ROWTYPE;
  current_email text;
  is_owner boolean;
  already_accepted boolean := false;
  has_active_key boolean := false;
  queued_request_count integer := 0;
  provisioning_status text := 'completed';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF NULLIF(p_token, '') IS NULL AND NULLIF(p_invite_code, '') IS NULL THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 초대입니다.';
  END IF;

  SELECT *
    INTO link_record
  FROM public.document_invitation_links
  WHERE (
      NULLIF(p_token, '') IS NOT NULL
      AND token_hash = public.document_registry_hash(p_token)
    )
    OR (
      NULLIF(p_invite_code, '') IS NOT NULL
      AND invite_code_hash = public.document_registry_hash(upper(regexp_replace(p_invite_code, '[^[:alnum:]]', '', 'g')))
    )
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND
    OR link_record.revoked_at IS NOT NULL
    OR (link_record.expires_at IS NOT NULL AND link_record.expires_at <= timezone('utc'::text, now()))
  THEN
    RAISE EXCEPTION '유효하지 않거나 만료된 초대입니다.';
  END IF;

  is_owner := public.check_is_document_owner(link_record.document_id, auth.uid());

  SELECT *
    INTO member_record
  FROM public.document_members
  WHERE document_id = link_record.document_id
    AND user_id = auth.uid()
  LIMIT 1;

  already_accepted := is_owner OR (FOUND AND member_record.status = 'accepted');

  IF NOT already_accepted THEN
    IF link_record.max_uses IS NOT NULL AND link_record.used_count >= link_record.max_uses THEN
      RAISE EXCEPTION '유효하지 않거나 만료된 초대입니다.';
    END IF;

    current_email := COALESCE(auth.jwt() ->> 'email', (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    ));

    IF member_record.id IS NOT NULL THEN
      UPDATE public.document_members
        SET role = link_record.role,
            status = 'accepted',
            updated_at = timezone('utc'::text, now())
        WHERE id = member_record.id
        RETURNING * INTO member_record;
    ELSIF current_email IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.document_members
      WHERE document_id = link_record.document_id
        AND invited_email = current_email
        AND status <> 'accepted'
    ) THEN
      UPDATE public.document_members
        SET user_id = auth.uid(),
            role = link_record.role,
            status = 'accepted',
            updated_at = timezone('utc'::text, now())
        WHERE document_id = link_record.document_id
          AND invited_email = current_email
          AND status <> 'accepted'
        RETURNING * INTO member_record;
    ELSE
      INSERT INTO public.document_members (
        document_id,
        user_id,
        invited_email,
        role,
        status
      )
      VALUES (
        link_record.document_id,
        auth.uid(),
        current_email,
        link_record.role,
        'accepted'
      )
      RETURNING * INTO member_record;
    END IF;

    UPDATE public.document_invitation_links
      SET used_count = used_count + 1,
          updated_at = timezone('utc'::text, now())
      WHERE id = link_record.id;
  END IF;

  IF NOT is_owner THEN
    has_active_key := public.has_active_document_key_for_device(link_record.document_id, auth.uid(), NULL, 1);

    IF NOT has_active_key THEN
      queued_request_count := public.upsert_key_provisioning_requests_for_user(
        link_record.document_id,
        auth.uid(),
        1,
        auth.uid()
      );

      SELECT req.status
        INTO provisioning_status
      FROM public.document_key_provisioning_requests req
      WHERE req.document_id = link_record.document_id
        AND req.user_id = auth.uid()
        AND req.status IN ('waiting_for_material', 'pending', 'processing', 'failed')
      ORDER BY
        CASE req.status
          WHEN 'pending' THEN 0
          WHEN 'processing' THEN 1
          WHEN 'failed' THEN 2
          ELSE 3
        END,
        req.updated_at DESC
      LIMIT 1;

      provisioning_status := COALESCE(provisioning_status, 'waiting_for_material');

      PERFORM public.enqueue_key_provisioning_notification(
        link_record.document_id,
        auth.uid(),
        CASE WHEN provisioning_status = 'waiting_for_material'
          THEN 'key_provisioning_waiting_for_material'
          ELSE 'key_provisioning_pending'
        END
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'document_id', link_record.document_id,
    'role', CASE WHEN is_owner THEN 'owner' ELSE member_record.role END,
    'status', 'accepted',
    'already_member', already_accepted,
    'requires_key_provisioning', (NOT is_owner AND NOT has_active_key),
    'key_provisioning_status', CASE
      WHEN is_owner OR has_active_key THEN 'completed'
      ELSE provisioning_status
    END,
    'queued_request_count', queued_request_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_document_member(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_member public.document_members%ROWTYPE;
  revoked_key_count integer := 0;
  cancelled_request_count integer := 0;
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

    UPDATE public.document_key_provisioning_requests
      SET status = 'cancelled',
          cancelled_at = COALESCE(cancelled_at, timezone('utc'::text, now())),
          updated_at = timezone('utc'::text, now())
      WHERE document_id = target_member.document_id
        AND user_id = target_member.user_id
        AND status IN ('waiting_for_material', 'pending', 'processing', 'failed');

    GET DIAGNOSTICS cancelled_request_count = ROW_COUNT;

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
    'cancelled_request_count', cancelled_request_count,
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
  cancelled_request_count integer := 0;
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

    UPDATE public.document_key_provisioning_requests
      SET status = 'cancelled',
          cancelled_at = COALESCE(cancelled_at, timezone('utc'::text, now())),
          updated_at = timezone('utc'::text, now())
      WHERE document_id = target_member.trip_id
        AND user_id = target_member.user_id
        AND status IN ('waiting_for_material', 'pending', 'processing', 'failed');

    GET DIAGNOSTICS cancelled_request_count = ROW_COUNT;

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
    'cancelled_request_count', cancelled_request_count,
    'cleaned_notification_count', cleaned_notification_count
  );
END;
$$;

-- Backfill accepted non-owner members that have no active key yet.
WITH accepted_without_key AS (
  SELECT dm.document_id, dm.user_id
  FROM public.document_members dm
  WHERE dm.user_id IS NOT NULL
    AND dm.status = 'accepted'
    AND dm.role <> 'owner'
    AND NOT EXISTS (
      SELECT 1
      FROM public.document_keys dk
      WHERE dk.document_id = dm.document_id
        AND dk.user_id = dm.user_id
        AND dk.revoked_at IS NULL
    )
)
SELECT public.upsert_key_provisioning_requests_for_user(document_id, user_id, 1, NULL)
FROM accepted_without_key;

GRANT EXECUTE ON FUNCTION public.sanitize_key_provisioning_error_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_document_key_for_device(uuid, uuid, text, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_key_provisioning_notification(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_key_provisioning_requests_for_user(uuid, uuid, integer, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.register_user_key_material(text, text, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_key_material(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_document_key_provisioning(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_document_key_provisioning_status(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pending_document_key_provisioning_requests(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_document_key_provisioning(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_document_key_provisioning(uuid, bytea, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_document_key_provisioning_failed(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_active_document_key(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_owner_document_key(uuid, bytea, text, integer, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_document_invitation(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_document_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_trip_document_member(uuid) TO authenticated;

-- Rollback reference:
-- DROP TABLE public.document_key_provisioning_requests;
-- DROP TABLE public.user_key_materials;
-- DROP FUNCTION public.register_user_key_material(text, text, jsonb, integer);
-- DROP FUNCTION public.request_document_key_provisioning(uuid, text, integer);
-- Restore document_keys unique(document_id,user_id,key_version), AES-KW-only check,
-- and TASK-014 versions of accept/revoke RPCs if TASK-015 is reverted.
