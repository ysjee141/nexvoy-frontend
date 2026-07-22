-- TASK-056 entity-version concurrency and conservative aggregate conflict checks.
-- Run with: docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task056_production_gate.sql

BEGIN;
RESET ROLE;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000561', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task056-owner@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000562', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task056-editor@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.profiles (id, email, nickname) VALUES
  ('00000000-0000-0000-0000-000000000561', 'task056-owner@onvoy.local', 'owner'),
  ('00000000-0000-0000-0000-000000000562', 'task056-editor@onvoy.local', 'editor')
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, nickname = EXCLUDED.nickname;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000561';

DO $$
DECLARE result jsonb;
BEGIN
  result := public.apply_trip_commands(
    '56000000-0000-0000-0000-000000000001',
    jsonb_build_array(
      jsonb_build_object(
        'operation_id', '56000000-0000-0000-0000-000000000011',
        'entity_type', 'trip',
        'entity_id', '56000000-0000-0000-0000-000000000001',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'destination', '부산',
          'start_date', '2026-08-01',
          'end_date', '2026-08-03'
        )
      ),
      jsonb_build_object(
        'operation_id', '56000000-0000-0000-0000-000000000012',
        'entity_type', 'plan',
        'entity_id', '56000000-0000-0000-0000-000000000002',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'title', '첫 일정',
          'start_datetime_local', '2026-08-01 10:00:00',
          'end_datetime_local', '2026-08-01 11:00:00',
          'timezone_string', 'Asia/Seoul'
        )
      ),
      jsonb_build_object(
        'operation_id', '56000000-0000-0000-0000-000000000013',
        'entity_type', 'plan',
        'entity_id', '56000000-0000-0000-0000-000000000003',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'title', '둘째 일정',
          'start_datetime_local', '2026-08-01 12:00:00',
          'end_datetime_local', '2026-08-01 13:00:00',
          'timezone_string', 'Asia/Seoul'
        )
      ),
      jsonb_build_object(
        'operation_id', '56000000-0000-0000-0000-000000000014',
        'entity_type', 'checklist',
        'entity_id', '56000000-0000-0000-0000-000000000004',
        'action', 'upsert',
        'payload', jsonb_build_object('title', '준비물')
      ),
      jsonb_build_object(
        'operation_id', '56000000-0000-0000-0000-000000000015',
        'entity_type', 'checklist_item',
        'entity_id', '56000000-0000-0000-0000-000000000005',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'checklist_id', '56000000-0000-0000-0000-000000000004',
          'item_name', '여권'
        )
      )
    ),
    0
  );
  IF result ->> 'status' <> 'applied' OR (result ->> 'revision')::bigint <> 1 THEN
    RAISE EXCEPTION 'Expected TASK-056 trip revision 1, got %', result;
  END IF;
END $$;

RESET ROLE;
INSERT INTO public.document_members (document_id, user_id, role, status)
VALUES (
  '56000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000562',
  'editor',
  'accepted'
);

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000561';
DO $$
DECLARE result jsonb;
BEGIN
  result := public.apply_trip_commands(
    '56000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '56000000-0000-0000-0000-000000000016',
      'entity_type', 'plan',
      'entity_id', '56000000-0000-0000-0000-000000000002',
      'action', 'upsert',
      'expected_version', 1,
      'payload', jsonb_build_object('memo', 'owner change')
    )),
    1
  );
  IF result ->> 'status' <> 'applied' OR (result ->> 'revision')::bigint <> 2 THEN
    RAISE EXCEPTION 'Expected first entity update revision 2, got %', result;
  END IF;
END $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000562';
DO $$
DECLARE result jsonb; bundle jsonb;
BEGIN
  result := public.apply_trip_commands(
    '56000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '56000000-0000-0000-0000-000000000017',
      'entity_type', 'plan',
      'entity_id', '56000000-0000-0000-0000-000000000003',
      'action', 'upsert',
      'expected_version', 1,
      'payload', jsonb_build_object('memo', 'editor independent change')
    )),
    1
  );
  IF result ->> 'status' <> 'applied' OR (result ->> 'revision')::bigint <> 3 THEN
    RAISE EXCEPTION 'Different entity stale update did not rebase: %', result;
  END IF;

  bundle := public.get_trip_authority_bundle('56000000-0000-0000-0000-000000000001');
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(bundle -> 'plans') plan
    WHERE plan ->> 'id' = '56000000-0000-0000-0000-000000000002'
      AND plan ->> 'memo' = 'owner change'
  ) OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(bundle -> 'plans') plan
    WHERE plan ->> 'id' = '56000000-0000-0000-0000-000000000003'
      AND plan ->> 'memo' = 'editor independent change'
  ) THEN
    RAISE EXCEPTION 'Independent entity changes did not converge: %', bundle;
  END IF;

  result := public.apply_trip_commands(
    '56000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '56000000-0000-0000-0000-000000000018',
      'entity_type', 'plan',
      'entity_id', '56000000-0000-0000-0000-000000000002',
      'action', 'upsert',
      'expected_version', 1,
      'payload', jsonb_build_object('memo', 'stale same entity')
    )),
    1
  );
  IF result ->> 'status' <> 'conflict'
    OR result -> 'conflict' ->> 'kind' <> 'entity_version'
    OR result -> 'conflict' ->> 'entity_id' <> '56000000-0000-0000-0000-000000000002' THEN
    RAISE EXCEPTION 'Expected same entity version conflict, got %', result;
  END IF;

  result := public.apply_trip_commands(
    '56000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '56000000-0000-0000-0000-000000000019',
      'entity_type', 'checklist_item_user_check',
      'entity_id', '56000000-0000-0000-0000-000000000005',
      'action', 'set',
      'payload', jsonb_build_object(
        'user_id', '00000000-0000-0000-0000-000000000562',
        'checked', true
      )
    )),
    1
  );
  IF result ->> 'status' <> 'applied' OR (result ->> 'revision')::bigint <> 4 THEN
    RAISE EXCEPTION 'Per-user set command should safely rebase: %', result;
  END IF;

  result := public.apply_trip_commands(
    '56000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '56000000-0000-0000-0000-000000000020',
      'entity_type', 'checklist_item_assignees',
      'entity_id', '56000000-0000-0000-0000-000000000005',
      'action', 'set',
      'payload', jsonb_build_object(
        'user_ids', jsonb_build_array('00000000-0000-0000-0000-000000000562')
      )
    )),
    1
  );
  IF result ->> 'status' <> 'conflict'
    OR result -> 'conflict' ->> 'kind' <> 'resource_revision' THEN
    RAISE EXCEPTION 'Stale whole-set command must remain conservative: %', result;
  END IF;
END $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000561';
DO $$
DECLARE result jsonb;
BEGIN
  result := public.apply_trip_commands(
    '56000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '56000000-0000-0000-0000-000000000016',
      'entity_type', 'plan',
      'entity_id', '56000000-0000-0000-0000-000000000002',
      'action', 'upsert',
      'expected_version', 1,
      'payload', jsonb_build_object('memo', 'owner change')
    )),
    1
  );
  IF result ->> 'status' <> 'duplicate' OR (result ->> 'revision')::bigint <> 4 THEN
    RAISE EXCEPTION 'Stale duplicate was not acknowledged exactly once: %', result;
  END IF;

  result := public.apply_template_commands(
    '56000000-0000-0000-0000-000000000101',
    jsonb_build_array(
      jsonb_build_object(
        'operation_id', '56000000-0000-0000-0000-000000000111',
        'entity_type', 'template',
        'entity_id', '56000000-0000-0000-0000-000000000101',
        'action', 'upsert',
        'payload', jsonb_build_object('title', '여름 여행')
      ),
      jsonb_build_object(
        'operation_id', '56000000-0000-0000-0000-000000000112',
        'entity_type', 'template_item',
        'entity_id', '56000000-0000-0000-0000-000000000102',
        'action', 'upsert',
        'payload', jsonb_build_object('item_name', '선크림')
      ),
      jsonb_build_object(
        'operation_id', '56000000-0000-0000-0000-000000000113',
        'entity_type', 'template_item',
        'entity_id', '56000000-0000-0000-0000-000000000103',
        'action', 'upsert',
        'payload', jsonb_build_object('item_name', '모자')
      )
    ),
    0
  );
  IF result ->> 'status' <> 'applied' OR (result ->> 'revision')::bigint <> 1 THEN
    RAISE EXCEPTION 'Expected TASK-056 template revision 1, got %', result;
  END IF;

  result := public.apply_template_commands(
    '56000000-0000-0000-0000-000000000101',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '56000000-0000-0000-0000-000000000114',
      'entity_type', 'template_item',
      'entity_id', '56000000-0000-0000-0000-000000000102',
      'action', 'upsert',
      'expected_version', 1,
      'payload', jsonb_build_object('category', '피부')
    )),
    1
  );
  IF result ->> 'status' <> 'applied' OR (result ->> 'revision')::bigint <> 2 THEN
    RAISE EXCEPTION 'Expected first template entity update revision 2, got %', result;
  END IF;

  result := public.apply_template_commands(
    '56000000-0000-0000-0000-000000000101',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '56000000-0000-0000-0000-000000000115',
      'entity_type', 'template_item',
      'entity_id', '56000000-0000-0000-0000-000000000103',
      'action', 'upsert',
      'expected_version', 1,
      'payload', jsonb_build_object('category', '의류')
    )),
    1
  );
  IF result ->> 'status' <> 'applied' OR (result ->> 'revision')::bigint <> 3 THEN
    RAISE EXCEPTION 'Different template entity stale update did not rebase: %', result;
  END IF;

  result := public.apply_template_commands(
    '56000000-0000-0000-0000-000000000101',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '56000000-0000-0000-0000-000000000116',
      'entity_type', 'template_item',
      'entity_id', '56000000-0000-0000-0000-000000000102',
      'action', 'upsert',
      'expected_version', 1,
      'payload', jsonb_build_object('category', 'stale')
    )),
    1
  );
  IF result ->> 'status' <> 'conflict'
    OR result -> 'conflict' ->> 'kind' <> 'entity_version'
    OR result -> 'conflict' ->> 'entity_id' <> '56000000-0000-0000-0000-000000000102' THEN
    RAISE EXCEPTION 'Expected template entity version conflict, got %', result;
  END IF;
END $$;

RESET ROLE;
SELECT 'task056_production_gate_checks_passed' AS result;
ROLLBACK;
