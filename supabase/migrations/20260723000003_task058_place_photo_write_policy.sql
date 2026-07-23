-- TASK-058: bind place-photo writes to the canonical trip authority boundary.
--
-- The bucket caches public Google place imagery, so object bytes remain public.
-- Upload/update/delete still require an authenticated owner/editor, an active
-- plan in the trip encoded by the path, and the uploader's own user folder.

CREATE OR REPLACE FUNCTION public.check_can_write_place_photo_object(
  p_object_name text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  path_parts text[];
  path_trip_id uuid;
  path_plan_id uuid;
BEGIN
  IF p_user_id IS NULL
    OR p_user_id IS DISTINCT FROM auth.uid()
    OR NULLIF(p_object_name, '') IS NULL THEN
    RETURN false;
  END IF;

  path_parts := string_to_array(p_object_name, '/');
  IF array_length(path_parts, 1) <> 3
    OR path_parts[1] <> p_user_id::text
    OR path_parts[3] !~ '^[0-9a-f-]{36}_[0-9a-f]{8}_w(240|800)\.jpg$' THEN
    RETURN false;
  END IF;

  BEGIN
    path_trip_id := path_parts[2]::uuid;
    path_plan_id := split_part(path_parts[3], '_', 1)::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN false;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.plans plan
    WHERE plan.id = path_plan_id
      AND plan.trip_id = path_trip_id
      AND plan.deleted_at IS NULL
  ) THEN
    RETURN false;
  END IF;

  RETURN public.check_can_write_authority_trip(path_trip_id, p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.check_can_write_place_photo_object(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_can_write_place_photo_object(text, uuid) TO authenticated;

DROP POLICY IF EXISTS "trip_asset_objects_select_member" ON public.trip_asset_objects;
CREATE POLICY "trip_asset_objects_select_member"
ON public.trip_asset_objects FOR SELECT
TO authenticated
USING (
  public.check_can_read_authority_trip(trip_id, (SELECT auth.uid()))
);

CREATE OR REPLACE FUNCTION public.register_place_photo_asset(
  p_trip_id uuid,
  p_plan_id uuid,
  p_object_path text,
  p_width integer,
  p_bucket_id text DEFAULT 'place-photos'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  asset_id uuid;
  file_name text := split_part(p_object_path, '/', 3);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_trip_id IS NULL
    OR p_plan_id IS NULL
    OR p_bucket_id IS DISTINCT FROM 'place-photos'
    OR p_width IS NULL
    OR p_width NOT IN (240, 800)
    OR split_part(p_object_path, '/', 2) <> p_trip_id::text
    OR split_part(file_name, '_', 1) <> p_plan_id::text
    OR file_name !~ ('_w' || p_width::text || '\.jpg$')
    OR NOT public.check_can_write_place_photo_object(p_object_path, auth.uid()) THEN
    RAISE EXCEPTION 'asset_path_forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.trip_asset_objects (
    trip_id, plan_id, user_id, bucket_id, object_path, width
  ) VALUES (
    p_trip_id, p_plan_id, auth.uid(), p_bucket_id, p_object_path, p_width
  )
  ON CONFLICT (bucket_id, object_path) DO UPDATE
    SET plan_id = EXCLUDED.plan_id,
        width = EXCLUDED.width
  RETURNING id INTO asset_id;

  RETURN asset_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_place_photo_asset(uuid, uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_place_photo_asset(uuid, uuid, text, integer, text) TO authenticated;

DROP POLICY IF EXISTS "place_photos_insert_own" ON storage.objects;
CREATE POLICY "place_photos_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'place-photos'
  AND public.check_can_write_place_photo_object(name, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "place_photos_update_own" ON storage.objects;
CREATE POLICY "place_photos_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'place-photos'
  AND public.check_can_write_place_photo_object(name, (SELECT auth.uid()))
)
WITH CHECK (
  bucket_id = 'place-photos'
  AND public.check_can_write_place_photo_object(name, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "place_photos_delete_own" ON storage.objects;
CREATE POLICY "place_photos_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'place-photos'
  AND public.check_can_write_place_photo_object(name, (SELECT auth.uid()))
);

COMMENT ON FUNCTION public.check_can_write_place_photo_object(text, uuid) IS
  'Validates canonical place-photo path ownership, active plan membership, and trip write authority.';
