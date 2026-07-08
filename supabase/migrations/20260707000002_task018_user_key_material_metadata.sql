-- TASK-018: metadata for mobile non-exportable key material registration.
--
-- Stores only public wrapping material and coarse metadata. Raw private keys,
-- native key handles/aliases, raw DEKs, and raw KEKs must never be sent here.

DO $$
BEGIN
  IF to_regclass('public.user_key_materials') IS NULL THEN
    RAISE EXCEPTION
      'TASK-018 migration requires user_key_materials. Run 20260706000004_document_key_provisioning.sql before this file.';
  END IF;
END $$;

ALTER TABLE public.user_key_materials
  ADD COLUMN IF NOT EXISTS material_type text DEFAULT 'securestore_jwk' NOT NULL,
  ADD COLUMN IF NOT EXISTS platform text DEFAULT 'unknown' NOT NULL,
  ADD COLUMN IF NOT EXISTS hardware_backed boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attestation_status text DEFAULT 'not_verified' NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_key_materials_material_type_check'
  ) THEN
    ALTER TABLE public.user_key_materials
      ADD CONSTRAINT user_key_materials_material_type_check
      CHECK (material_type IN ('securestore_jwk', 'native_rsa'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_key_materials_platform_check'
  ) THEN
    ALTER TABLE public.user_key_materials
      ADD CONSTRAINT user_key_materials_platform_check
      CHECK (platform IN ('web', 'ios', 'android', 'unknown'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_key_materials_attestation_status_check'
  ) THEN
    ALTER TABLE public.user_key_materials
      ADD CONSTRAINT user_key_materials_attestation_status_check
      CHECK (attestation_status IN ('not_supported', 'not_verified', 'verified'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_key_materials_metadata_claim_check'
  ) THEN
    ALTER TABLE public.user_key_materials
      ADD CONSTRAINT user_key_materials_metadata_claim_check
      CHECK (
        (attestation_status <> 'verified' OR hardware_backed IS TRUE)
        AND (
          material_type = 'native_rsa'
          OR (
            hardware_backed IS DISTINCT FROM TRUE
            AND attestation_status <> 'verified'
          )
        )
      );
  END IF;
END $$;

-- user_key_materials writes must go through RPCs so clients cannot persist
-- private JWK fields or local-only native handles/aliases directly.
DROP POLICY IF EXISTS "Insert own user key materials" ON public.user_key_materials;
DROP POLICY IF EXISTS "Update own user key materials" ON public.user_key_materials;

DROP FUNCTION IF EXISTS public.register_user_key_material(text, text, jsonb, integer);

CREATE OR REPLACE FUNCTION public.register_user_key_material(
  p_device_id text,
  p_wrapping_alg text,
  p_public_key_jwk jsonb,
  p_material_version integer DEFAULT 1,
  p_material_type text DEFAULT 'securestore_jwk',
  p_platform text DEFAULT 'unknown',
  p_hardware_backed boolean DEFAULT NULL,
  p_attestation_status text DEFAULT 'not_verified'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  material_record public.user_key_materials%ROWTYPE;
  queued_count integer := 0;
  normalized_material_type text := COALESCE(NULLIF(trim(p_material_type), ''), 'securestore_jwk');
  normalized_platform text := COALESCE(NULLIF(trim(p_platform), ''), 'unknown');
  normalized_attestation_status text := COALESCE(NULLIF(trim(p_attestation_status), ''), 'not_verified');
  public_jwk_has_only_allowed_keys boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF jsonb_typeof(COALESCE(p_public_key_jwk, 'null'::jsonb)) = 'object' THEN
    SELECT COALESCE(
      bool_and(key IN ('kty', 'alg', 'key_ops', 'ext', 'n', 'e')),
      false
    )
    INTO public_jwk_has_only_allowed_keys
    FROM jsonb_object_keys(p_public_key_jwk) AS key;
  END IF;

  IF NULLIF(trim(COALESCE(p_device_id, '')), '') IS NULL
    OR char_length(trim(p_device_id)) > 160
    OR p_wrapping_alg <> 'RSA-OAEP-256'
    OR COALESCE(p_material_version, 0) <= 0
    OR jsonb_typeof(COALESCE(p_public_key_jwk, 'null'::jsonb)) <> 'object'
    OR NOT public_jwk_has_only_allowed_keys
    OR NOT (p_public_key_jwk ?& ARRAY['kty', 'alg', 'key_ops', 'ext', 'n', 'e'])
    OR p_public_key_jwk->>'kty' IS DISTINCT FROM 'RSA'
    OR p_public_key_jwk->>'alg' IS DISTINCT FROM 'RSA-OAEP-256'
    OR p_public_key_jwk->'key_ops' IS DISTINCT FROM '["wrapKey"]'::jsonb
    OR jsonb_typeof(p_public_key_jwk->'ext') IS DISTINCT FROM 'boolean'
    OR p_public_key_jwk->'ext' IS DISTINCT FROM 'true'::jsonb
    OR jsonb_typeof(p_public_key_jwk->'n') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_public_key_jwk->'e') IS DISTINCT FROM 'string'
    OR COALESCE(p_public_key_jwk->>'n', '') !~ '^[A-Za-z0-9_-]+$'
    OR COALESCE(p_public_key_jwk->>'e', '') !~ '^[A-Za-z0-9_-]+$'
    OR normalized_material_type NOT IN ('securestore_jwk', 'native_rsa')
    OR normalized_platform NOT IN ('web', 'ios', 'android', 'unknown')
    OR normalized_attestation_status NOT IN ('not_supported', 'not_verified', 'verified')
    OR (normalized_attestation_status = 'verified' AND p_hardware_backed IS DISTINCT FROM TRUE)
    OR (
      normalized_material_type <> 'native_rsa'
      AND (
        p_hardware_backed IS TRUE
        OR normalized_attestation_status = 'verified'
      )
    )
  THEN
    RAISE EXCEPTION '유효하지 않은 키 등록 요청입니다.';
  END IF;

  INSERT INTO public.user_key_materials (
    user_id,
    device_id,
    wrapping_alg,
    public_key_jwk,
    material_version,
    material_type,
    platform,
    hardware_backed,
    attestation_status,
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
    normalized_material_type,
    normalized_platform,
    p_hardware_backed,
    normalized_attestation_status,
    'active',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    NULL
  )
  ON CONFLICT (user_id, device_id, material_version)
  DO UPDATE
    SET wrapping_alg = EXCLUDED.wrapping_alg,
        public_key_jwk = EXCLUDED.public_key_jwk,
        material_type = EXCLUDED.material_type,
        platform = EXCLUDED.platform,
        hardware_backed = EXCLUDED.hardware_backed,
        attestation_status = EXCLUDED.attestation_status,
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
    'material_type', material_record.material_type,
    'platform', material_record.platform,
    'hardware_backed', material_record.hardware_backed,
    'attestation_status', material_record.attestation_status,
    'status', material_record.status,
    'queued_request_count', queued_count,
    'created_at', material_record.created_at,
    'updated_at', material_record.updated_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_user_key_material(text, text, jsonb, integer, text, text, boolean, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_user_key_material(text, text, jsonb, integer, text, text, boolean, text)
  TO authenticated;

-- Rollback reference:
-- DROP FUNCTION public.register_user_key_material(text, text, jsonb, integer, text, text, boolean, text);
-- Restore 20260706000004 register_user_key_material(text, text, jsonb, integer).
-- Optionally drop TASK-018 metadata columns after confirming no client reads them.
