-- TASK-054: Direct asset storage and delivery.
--
-- place photo object 를 metadata registry(trip_asset_objects)에 등록하고,
-- plan 삭제/photo 교체로 더 이상 참조되지 않는 object 를 retention 이후
-- orphan 으로 판정한다. 실제 object 삭제는 Storage API(service role)가
-- 수행하며 SQL 은 storage.objects 를 직접 조작하지 않는다.

CREATE TABLE IF NOT EXISTS public.trip_asset_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  plan_id uuid,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket_id text NOT NULL DEFAULT 'place-photos',
  object_path text NOT NULL,
  width integer,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc', now())
);

-- trips/plans 는 document-primary 이력 데이터에서 row 가 없을 수 있어 FK 를 걸지 않는다.
CREATE UNIQUE INDEX IF NOT EXISTS trip_asset_objects_bucket_path_key
  ON public.trip_asset_objects(bucket_id, object_path);
CREATE INDEX IF NOT EXISTS trip_asset_objects_trip_id_idx
  ON public.trip_asset_objects(trip_id);
CREATE INDEX IF NOT EXISTS trip_asset_objects_plan_id_idx
  ON public.trip_asset_objects(plan_id);

ALTER TABLE public.trip_asset_objects ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 또는 trip 멤버 (authority 읽기 권한과 동일 기준)
DROP POLICY IF EXISTS "trip_asset_objects_select_member" ON public.trip_asset_objects;
CREATE POLICY "trip_asset_objects_select_member"
ON public.trip_asset_objects FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.check_can_read_authority_trip(trip_id, (SELECT auth.uid()))
);

-- INSERT/UPDATE/DELETE: client 직접 쓰기 금지 — register RPC 와 service role 만 사용한다.

-- ingest 완료 후 metadata 등록. trip 쓰기 권한(owner/editor)을 요구한다.
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_trip_id IS NULL OR NULLIF(p_object_path, '') IS NULL THEN
    RAISE EXCEPTION 'invalid_asset_registration' USING ERRCODE = '22023';
  END IF;

  -- 업로드 RLS(own folder)와 같은 경계: 본인 폴더 object 만 등록할 수 있다.
  IF split_part(p_object_path, '/', 1) <> auth.uid()::text THEN
    RAISE EXCEPTION 'asset_path_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.check_can_write_authority_trip(p_trip_id, auth.uid())
    OR public.check_is_trip_owner(p_trip_id, auth.uid())
    OR public.check_is_trip_editor(p_trip_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'asset_trip_forbidden' USING ERRCODE = '42501';
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

-- orphan 판정: 등록된 object 중 아래 조건을 모두 만족하는 것.
--   1) retention 경과
--   2) plan 이 (a) soft delete 되었거나 (b) 현재 image_url 이 이 object(원본 폭 sibling)를
--      참조하지 않음(교체됨)
-- plans row 가 아예 없는 metadata(문서-primary 이력)는 판정 불가로 보고 보수적으로 제외한다.
CREATE OR REPLACE FUNCTION public.list_orphan_place_photo_assets(
  p_retention interval DEFAULT interval '7 days'
)
RETURNS TABLE (
  asset_id uuid,
  bucket_id text,
  object_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT asset.id, asset.bucket_id, asset.object_path
  FROM public.trip_asset_objects asset
  JOIN public.plans plan ON plan.id = asset.plan_id
  WHERE asset.created_at < timezone('utc', now()) - p_retention
    AND (
      plan.deleted_at IS NOT NULL
      OR plan.image_url IS NULL
      OR position(
        regexp_replace(asset.object_path, '_w240\.jpg$', '_w800.jpg') IN plan.image_url
      ) = 0
    );
$$;

REVOKE ALL ON FUNCTION public.list_orphan_place_photo_assets(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_orphan_place_photo_assets(interval) TO service_role;
