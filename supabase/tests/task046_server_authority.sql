-- TASK-046 targeted smoke checks for local Supabase.
-- Run with: docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task046_server_authority.sql

BEGIN;
RESET ROLE;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000461', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task046-owner@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000462', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task046-editor@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000463', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task046-viewer@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000464', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task046-outsider@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.profiles (id, email, nickname) VALUES
  ('00000000-0000-0000-0000-000000000461', 'task046-owner@onvoy.local', 'owner'),
  ('00000000-0000-0000-0000-000000000462', 'task046-editor@onvoy.local', 'editor'),
  ('00000000-0000-0000-0000-000000000463', 'task046-viewer@onvoy.local', 'viewer'),
  ('00000000-0000-0000-0000-000000000464', 'task046-outsider@onvoy.local', 'outsider')
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, nickname = EXCLUDED.nickname;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000461';

DO $$
DECLARE
  result jsonb;
  affected_rows integer;
  visible_rows integer;
BEGIN
  result := public.apply_trip_commands(
    '46000000-0000-0000-0000-000000000001',
    jsonb_build_array(
      jsonb_build_object(
        'operation_id', '46000000-0000-0000-0000-000000000011',
        'entity_type', 'trip',
        'entity_id', '46000000-0000-0000-0000-000000000001',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'destination', '전주',
          'start_date', '2026-07-20',
          'end_date', '2026-07-24',
          'adults_count', 2,
          'children_count', 1
        )
      ),
      jsonb_build_object(
        'operation_id', '46000000-0000-0000-0000-000000000012',
        'entity_type', 'plan',
        'entity_id', '46000000-0000-0000-0000-000000000002',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'title', '한옥마을',
          'start_datetime_local', '2026-07-20 10:00:00',
          'end_datetime_local', '2026-07-20 12:00:00',
          'timezone_string', 'Asia/Seoul'
        )
      )
    ),
    0
  );

  IF result ->> 'status' <> 'applied' OR (result ->> 'revision')::bigint <> 1 THEN
    RAISE EXCEPTION 'Expected initial revision 1, got %', result;
  END IF;

  result := public.apply_trip_commands(
    '46000000-0000-0000-0000-000000000001',
    jsonb_build_array(
      jsonb_build_object(
        'operation_id', '46000000-0000-0000-0000-000000000011',
        'entity_type', 'trip',
        'entity_id', '46000000-0000-0000-0000-000000000001',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'destination', '전주',
          'start_date', '2026-07-20',
          'end_date', '2026-07-24',
          'adults_count', 2,
          'children_count', 1
        )
      ),
      jsonb_build_object(
        'operation_id', '46000000-0000-0000-0000-000000000012',
        'entity_type', 'plan',
        'entity_id', '46000000-0000-0000-0000-000000000002',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'title', '한옥마을',
          'start_datetime_local', '2026-07-20 10:00:00',
          'end_datetime_local', '2026-07-20 12:00:00',
          'timezone_string', 'Asia/Seoul'
        )
      )
    ),
    0
  );

  IF result ->> 'status' <> 'duplicate' OR (result ->> 'revision')::bigint <> 1 THEN
    RAISE EXCEPTION 'Expected duplicate revision 1, got %', result;
  END IF;

  SELECT count(*) INTO visible_rows
  FROM public.trips
  WHERE id = '46000000-0000-0000-0000-000000000001';
  IF visible_rows <> 0 THEN
    RAISE EXCEPTION 'Authority trip bypassed canonical read RPC';
  END IF;

  UPDATE public.trips
  SET destination = 'direct-write-bypass'
  WHERE id = '46000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'Authority trip bypassed canonical write RPC';
  END IF;
END $$;

RESET ROLE;
INSERT INTO public.document_members (document_id, user_id, role, status) VALUES
  ('46000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000462', 'editor', 'accepted'),
  ('46000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000463', 'viewer', 'accepted');

INSERT INTO public.checklists (id, trip_id, title)
VALUES (
  '46000000-0000-0000-0000-000000000003',
  '46000000-0000-0000-0000-000000000001',
  'private checklist'
);
INSERT INTO public.checklist_items (
  id, checklist_id, item_name, is_private, assigned_user_id, assignment_type
) VALUES (
  '46000000-0000-0000-0000-000000000004',
  '46000000-0000-0000-0000-000000000003',
  'owner only',
  true,
  '00000000-0000-0000-0000-000000000461',
  'specific'
);

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000462';

DO $$
DECLARE result jsonb;
BEGIN
  result := public.apply_trip_commands(
    '46000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '46000000-0000-0000-0000-000000000013',
      'entity_type', 'plan',
      'entity_id', '46000000-0000-0000-0000-000000000002',
      'action', 'upsert',
      'expected_version', 1,
      'payload', jsonb_build_object('memo', 'editor update')
    )),
    1
  );
  IF result ->> 'status' <> 'applied' OR (result ->> 'revision')::bigint <> 2 THEN
    RAISE EXCEPTION 'Expected editor revision 2, got %', result;
  END IF;
END $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000463';

DO $$
DECLARE changes jsonb; viewer_bundle jsonb;
BEGIN
  viewer_bundle := public.get_trip_authority_bundle('46000000-0000-0000-0000-000000000001');
  IF jsonb_array_length(viewer_bundle -> 'checklist_items') <> 0 THEN
    RAISE EXCEPTION 'Private checklist item leaked to viewer: %', viewer_bundle;
  END IF;
  changes := public.get_trip_authority_changes(
    '46000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'entity_type', 'plan',
      'entity_id', '46000000-0000-0000-0000-000000000002',
      'action', 'upsert'
    )),
    2
  );
  IF changes ->> 'status' <> 'ok'
    OR changes -> 'changes' -> 0 -> 'row' ->> 'memo' <> 'editor update' THEN
    RAISE EXCEPTION 'Expected canonical entity refresh, got %', changes;
  END IF;

  changes := public.get_trip_authority_changes(
    '46000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'entity_type', 'plan',
      'entity_id', '46000000-0000-0000-0000-000000000002',
      'action', 'upsert'
    )),
    1
  );
  IF changes ->> 'status' <> 'gap' OR (changes ->> 'revision')::bigint <> 2 THEN
    RAISE EXCEPTION 'Expected entity refresh gap, got %', changes;
  END IF;

  BEGIN
    PERFORM public.apply_trip_commands(
      '46000000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'operation_id', '46000000-0000-0000-0000-000000000014',
        'entity_type', 'trip',
        'entity_id', '46000000-0000-0000-0000-000000000001',
        'action', 'upsert',
        'payload', jsonb_build_object('destination', 'blocked')
      )),
      2
    );
    RAISE EXCEPTION 'Expected viewer write to fail';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000464';
DO $$
BEGIN
  BEGIN
    PERFORM public.get_trip_authority_bundle('46000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'Expected outsider read to fail';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000461';
DO $$
DECLARE result jsonb; bundle jsonb;
BEGIN
  result := public.apply_trip_commands(
    '46000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '46000000-0000-0000-0000-000000000015',
      'entity_type', 'plan',
      'entity_id', '46000000-0000-0000-0000-000000000002',
      'action', 'delete',
      'payload', '{}'::jsonb
    )),
    1
  );
  IF result ->> 'status' <> 'conflict' OR (result ->> 'revision')::bigint <> 2 THEN
    RAISE EXCEPTION 'Expected stale revision conflict, got %', result;
  END IF;

  result := public.apply_trip_commands(
    '46000000-0000-0000-0000-000000000001',
    jsonb_build_array(
      jsonb_build_object(
        'operation_id', '46000000-0000-0000-0000-000000000016',
        'entity_type', 'trip',
        'entity_id', '46000000-0000-0000-0000-000000000001',
        'action', 'upsert',
        'payload', jsonb_build_object('destination', 'rollback-required')
      ),
      jsonb_build_object(
        'operation_id', '46000000-0000-0000-0000-000000000017',
        'entity_type', 'plan',
        'entity_id', '46000000-0000-0000-0000-000000000002',
        'action', 'upsert',
        'expected_version', 1,
        'payload', jsonb_build_object('memo', 'stale update')
      )
    ),
    2
  );
  bundle := public.get_trip_authority_bundle('46000000-0000-0000-0000-000000000001');
  IF result ->> 'status' <> 'conflict'
    OR result -> 'conflict' ->> 'kind' <> 'entity_version'
    OR bundle -> 'trip' ->> 'destination' <> '전주' THEN
    RAISE EXCEPTION 'Expected atomic entity conflict rollback, got result %, bundle %', result, bundle;
  END IF;

  result := public.apply_trip_commands(
    '46000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '46000000-0000-0000-0000-000000000015',
      'entity_type', 'plan',
      'entity_id', '46000000-0000-0000-0000-000000000002',
      'action', 'delete',
      'payload', '{}'::jsonb
    )),
    2
  );
  bundle := public.get_trip_authority_bundle('46000000-0000-0000-0000-000000000001');
  IF result ->> 'status' <> 'applied'
    OR (result ->> 'revision')::bigint <> 3
    OR jsonb_array_length(bundle -> 'plans') <> 0 THEN
    RAISE EXCEPTION 'Expected tombstone revision 3, got result %, bundle %', result, bundle;
  END IF;

  result := public.apply_template_commands(
    '46000000-0000-0000-0000-000000000101',
    jsonb_build_array(
      jsonb_build_object(
        'operation_id', '46000000-0000-0000-0000-000000000111',
        'entity_type', 'template',
        'entity_id', '46000000-0000-0000-0000-000000000101',
        'action', 'upsert',
        'payload', jsonb_build_object('title', '여름 여행')
      ),
      jsonb_build_object(
        'operation_id', '46000000-0000-0000-0000-000000000112',
        'entity_type', 'template_item',
        'entity_id', '46000000-0000-0000-0000-000000000102',
        'action', 'upsert',
        'payload', jsonb_build_object('item_name', '선크림', 'category', '생활')
      )
    ),
    0
  );
  bundle := public.get_template_authority_bundle('46000000-0000-0000-0000-000000000101');
  IF result ->> 'status' <> 'applied'
    OR (result ->> 'revision')::bigint <> 1
    OR jsonb_array_length(bundle -> 'items') <> 1 THEN
    RAISE EXCEPTION 'Expected canonical template revision 1, got result %, bundle %', result, bundle;
  END IF;
END $$;

RESET ROLE;
INSERT INTO public.document_members (document_id, user_id, role, status)
VALUES (
  '46000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000463',
  'viewer',
  'accepted'
);

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000463';
DO $$
BEGIN
  PERFORM public.get_template_authority_bundle('46000000-0000-0000-0000-000000000101');
  BEGIN
    PERFORM public.apply_template_commands(
      '46000000-0000-0000-0000-000000000101',
      jsonb_build_array(jsonb_build_object(
        'operation_id', '46000000-0000-0000-0000-000000000113',
        'entity_type', 'template',
        'entity_id', '46000000-0000-0000-0000-000000000101',
        'action', 'upsert',
        'payload', jsonb_build_object('title', 'blocked')
      )),
      1
    );
    RAISE EXCEPTION 'Expected template viewer write to fail';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

RESET ROLE;
SELECT 'task046_server_authority_checks_passed' AS result;
ROLLBACK;
