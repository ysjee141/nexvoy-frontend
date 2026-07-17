-- TASK-054 targeted smoke checks for local Supabase.
-- trip_asset_objects registry RLS, register RPC 권한, orphan 판정을 고정한다.
-- Run with: docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task054_asset_objects.sql

BEGIN;
RESET ROLE;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000541', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task054-owner@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000542', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task054-editor@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000543', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task054-outsider@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.profiles (id, email, nickname) VALUES
  ('00000000-0000-0000-0000-000000000541', 'task054-owner@onvoy.local', 'owner'),
  ('00000000-0000-0000-0000-000000000542', 'task054-editor@onvoy.local', 'editor'),
  ('00000000-0000-0000-0000-000000000543', 'task054-outsider@onvoy.local', 'outsider')
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, nickname = EXCLUDED.nickname;

-- Owner가 trip + plan 2개(활성/삭제 예정)를 만든다.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000541';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000541","email":"task054-owner@onvoy.local"}';

DO $$
DECLARE
  result jsonb;
BEGIN
  result := public.apply_trip_commands(
    '54000000-0000-0000-0000-000000000001',
    jsonb_build_array(
      jsonb_build_object(
        'operation_id', '54000000-0000-0000-0000-000000000011',
        'entity_type', 'trip',
        'entity_id', '54000000-0000-0000-0000-000000000001',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'destination', '부산',
          'start_date', '2026-09-01',
          'end_date', '2026-09-03',
          'adults_count', 2,
          'children_count', 0
        )
      ),
      jsonb_build_object(
        'operation_id', '54000000-0000-0000-0000-000000000012',
        'entity_type', 'plan',
        'entity_id', '54000000-0000-0000-0000-000000000002',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'title', '해운대',
          'start_datetime_local', '2026-09-01 10:00:00',
          'end_datetime_local', '2026-09-01 11:00:00',
          'timezone_string', 'Asia/Seoul'
        )
      ),
      jsonb_build_object(
        'operation_id', '54000000-0000-0000-0000-000000000013',
        'entity_type', 'plan',
        'entity_id', '54000000-0000-0000-0000-000000000003',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'title', '광안리',
          'start_datetime_local', '2026-09-02 10:00:00',
          'end_datetime_local', '2026-09-02 11:00:00',
          'timezone_string', 'Asia/Seoul'
        )
      )
    ),
    0
  );
  IF result ->> 'status' <> 'applied' THEN
    RAISE EXCEPTION 'Expected trip/plan create to apply, got %', result;
  END IF;

  -- 본인 폴더 object 등록 (원본 + thumb, plan 2개)
  PERFORM public.register_place_photo_asset(
    '54000000-0000-0000-0000-000000000001',
    '54000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000541/54000000-0000-0000-0000-000000000001/54000000-0000-0000-0000-000000000002_aaaa1111_w800.jpg',
    800
  );
  PERFORM public.register_place_photo_asset(
    '54000000-0000-0000-0000-000000000001',
    '54000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000541/54000000-0000-0000-0000-000000000001/54000000-0000-0000-0000-000000000002_aaaa1111_w240.jpg',
    240
  );
  PERFORM public.register_place_photo_asset(
    '54000000-0000-0000-0000-000000000001',
    '54000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000541/54000000-0000-0000-0000-000000000001/54000000-0000-0000-0000-000000000003_bbbb2222_w800.jpg',
    800
  );

  -- 타인 폴더 경로 등록 차단
  BEGIN
    PERFORM public.register_place_photo_asset(
      '54000000-0000-0000-0000-000000000001',
      '54000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000543/54000000-0000-0000-0000-000000000001/x_w800.jpg',
      800
    );
    RAISE EXCEPTION 'Expected foreign-folder registration to be forbidden';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  -- 직접 INSERT는 RLS로 차단 (insert policy 없음)
  BEGIN
    INSERT INTO public.trip_asset_objects (trip_id, plan_id, user_id, object_path, width)
    VALUES (
      '54000000-0000-0000-0000-000000000001',
      '54000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000541',
      '00000000-0000-0000-0000-000000000541/direct.jpg',
      800
    );
    RAISE EXCEPTION 'Expected direct insert to be blocked by RLS';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$;

-- 비멤버는 등록도 조회도 불가
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000543';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000543","email":"task054-outsider@onvoy.local"}';

DO $$
DECLARE
  visible_count integer;
BEGIN
  BEGIN
    PERFORM public.register_place_photo_asset(
      '54000000-0000-0000-0000-000000000001',
      '54000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000543/54000000-0000-0000-0000-000000000001/x_w800.jpg',
      800
    );
    RAISE EXCEPTION 'Expected non-member registration to be forbidden';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  SELECT count(*) INTO visible_count
  FROM public.trip_asset_objects
  WHERE trip_id = '54000000-0000-0000-0000-000000000001';
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'Expected outsider to see no asset rows, saw %', visible_count;
  END IF;
END;
$$;

-- plans 상태를 조정해 orphan 판정을 검증한다.
RESET ROLE;
RESET request.jwt.claim.sub;
RESET request.jwt.claims;

-- plan 2(해운대)는 활성이며 aaaa1111 원본을 참조, plan 3(광안리)은 soft delete
UPDATE public.plans
  SET image_url = 'https://local.supabase/storage/v1/object/public/place-photos/00000000-0000-0000-0000-000000000541/54000000-0000-0000-0000-000000000001/54000000-0000-0000-0000-000000000002_aaaa1111_w800.jpg'
  WHERE id = '54000000-0000-0000-0000-000000000002';
UPDATE public.plans
  SET deleted_at = timezone('utc', now())
  WHERE id = '54000000-0000-0000-0000-000000000003';

DO $$
DECLARE
  orphan_count integer;
  fresh_orphan_count integer;
BEGIN
  -- retention 이전(신규 등록)에는 orphan이 없어야 한다
  SELECT count(*) INTO fresh_orphan_count
  FROM public.list_orphan_place_photo_assets(interval '7 days');
  IF fresh_orphan_count <> 0 THEN
    RAISE EXCEPTION 'Expected no orphans within retention, got %', fresh_orphan_count;
  END IF;

  -- 등록 시각을 8일 전으로 옮기면 삭제된 plan 3 원본만 orphan이 된다
  UPDATE public.trip_asset_objects
    SET created_at = timezone('utc', now()) - interval '8 days';

  SELECT count(*) INTO orphan_count
  FROM public.list_orphan_place_photo_assets(interval '7 days');
  IF orphan_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 orphan (deleted plan), got %', orphan_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.list_orphan_place_photo_assets(interval '7 days')
    WHERE object_path LIKE '%_bbbb2222_w800.jpg'
  ) THEN
    RAISE EXCEPTION 'Expected deleted-plan object to be the orphan';
  END IF;

  -- plan 2가 다른 사진으로 교체되면 이전 aaaa1111 원본/썸네일이 orphan이 된다
  UPDATE public.plans
    SET image_url = 'https://local.supabase/storage/v1/object/public/place-photos/00000000-0000-0000-0000-000000000541/54000000-0000-0000-0000-000000000001/54000000-0000-0000-0000-000000000002_cccc3333_w800.jpg'
    WHERE id = '54000000-0000-0000-0000-000000000002';

  SELECT count(*) INTO orphan_count
  FROM public.list_orphan_place_photo_assets(interval '7 days');
  IF orphan_count <> 3 THEN
    RAISE EXCEPTION 'Expected 3 orphans after replacement, got %', orphan_count;
  END IF;
END;
$$;

SELECT 'task054_asset_objects checks passed' AS result;

ROLLBACK;
