-- TASK-058 production P0 SQL gate.
-- Verifies cross-resource command tampering, outsider access, invitation
-- activation, and immediate revoke enforcement for read/write/Realtime.
-- Run only against local Supabase:
-- docker exec -i supabase_db_travel-pack psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/task058_production_p0_automation.sql

BEGIN;
RESET ROLE;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000581', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task058-owner@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000582', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task058-editor@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000583', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'task058-outsider@onvoy.local', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.profiles (id, email, nickname) VALUES
  ('00000000-0000-0000-0000-000000000581', 'task058-owner@onvoy.local', 'owner'),
  ('00000000-0000-0000-0000-000000000582', 'task058-editor@onvoy.local', 'editor'),
  ('00000000-0000-0000-0000-000000000583', 'task058-outsider@onvoy.local', 'outsider')
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, nickname = EXCLUDED.nickname;

CREATE TEMP TABLE task058_state (
  key text PRIMARY KEY,
  value text NOT NULL
) ON COMMIT DROP;
GRANT SELECT, INSERT, UPDATE ON task058_state TO authenticated;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000581';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000581","email":"task058-owner@onvoy.local"}';

DO $$
DECLARE
  result jsonb;
BEGIN
  result := public.apply_trip_commands(
    '58000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '58000000-0000-0000-0000-000000000011',
      'entity_type', 'trip',
      'entity_id', '58000000-0000-0000-0000-000000000001',
      'action', 'upsert',
      'payload', jsonb_build_object(
        'destination', '서울',
        'start_date', '2026-09-01',
        'end_date', '2026-09-03'
      )
    )),
    0
  );
  IF result ->> 'status' <> 'applied' THEN
    RAISE EXCEPTION 'Expected trip A creation, got %', result;
  END IF;

  result := public.apply_trip_commands(
    '58000000-0000-0000-0000-000000000002',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '58000000-0000-0000-0000-000000000012',
      'entity_type', 'trip',
      'entity_id', '58000000-0000-0000-0000-000000000002',
      'action', 'upsert',
      'payload', jsonb_build_object(
        'destination', '부산',
        'start_date', '2026-09-05',
        'end_date', '2026-09-07'
      )
    )),
    0
  );
  IF result ->> 'status' <> 'applied' THEN
    RAISE EXCEPTION 'Expected trip B creation, got %', result;
  END IF;

  result := public.apply_trip_commands(
    '58000000-0000-0000-0000-000000000002',
    jsonb_build_array(jsonb_build_object(
      'operation_id', '58000000-0000-0000-0000-000000000013',
      'entity_type', 'plan',
      'entity_id', '58000000-0000-0000-0000-000000000102',
      'action', 'upsert',
      'payload', jsonb_build_object(
        'title', '부산 일정',
        'start_datetime_local', '2026-09-05 10:00:00',
        'end_datetime_local', '2026-09-05 11:00:00',
        'timezone_string', 'Asia/Seoul'
      )
    )),
    1
  );
  IF result ->> 'status' <> 'applied' THEN
    RAISE EXCEPTION 'Expected trip B plan creation, got %', result;
  END IF;

  result := public.create_document_invitation_link(
    '58000000-0000-0000-0000-000000000001',
    'editor',
    NULL,
    1,
    'task058-editor@onvoy.local',
    '서울',
    '2026-09-01',
    '2026-09-03'
  );
  IF result ->> 'token' IS NULL THEN
    RAISE EXCEPTION 'Expected editor invitation token, got %', result;
  END IF;
  INSERT INTO task058_state (key, value) VALUES ('editor_token', result ->> 'token');
END;
$$;

-- NEW-A12: acceptance grants canonical read and Realtime topic access.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000582';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000582","email":"task058-editor@onvoy.local"}';

DO $$
DECLARE
  result jsonb;
  invite_token text;
BEGIN
  SELECT value INTO invite_token FROM task058_state WHERE key = 'editor_token';
  result := public.accept_document_invitation(invite_token, NULL);
  IF result ->> 'status' <> 'accepted' OR result ->> 'role' <> 'editor' THEN
    RAISE EXCEPTION 'Expected editor acceptance, got %', result;
  END IF;

  result := public.get_trip_authority_bundle('58000000-0000-0000-0000-000000000001');
  IF result -> 'trip' ->> 'destination' <> '서울' THEN
    RAISE EXCEPTION 'Expected accepted editor to read trip A, got %', result;
  END IF;

  IF NOT public.can_receive_authority_topic(
    'trip:58000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000582'
  ) THEN
    RAISE EXCEPTION 'Expected accepted editor to receive trip A topic';
  END IF;
END;
$$;

-- NEW-A11: an editor cannot attach an entity owned by trip B to trip A.
DO $$
BEGIN
  BEGIN
    PERFORM public.apply_trip_commands(
      '58000000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'operation_id', '58000000-0000-0000-0000-000000000021',
        'entity_type', 'plan',
        'entity_id', '58000000-0000-0000-0000-000000000102',
        'action', 'upsert',
        'payload', jsonb_build_object('title', '변조된 일정')
      )),
      public.get_trip_authority_revision('58000000-0000-0000-0000-000000000001')
    );
    RAISE EXCEPTION 'Expected cross-trip plan ID tampering to fail';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$;

-- NEW-A11: an outsider cannot read or write through authority RPCs.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000583';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000583","email":"task058-outsider@onvoy.local"}';

DO $$
BEGIN
  BEGIN
    PERFORM public.get_trip_authority_bundle('58000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'Expected outsider bundle read to fail';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    PERFORM public.apply_trip_commands(
      '58000000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'operation_id', '58000000-0000-0000-0000-000000000022',
        'entity_type', 'plan',
        'entity_id', '58000000-0000-0000-0000-000000000103',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'title', '비회원 일정',
          'start_datetime_local', '2026-09-02 10:00:00',
          'end_datetime_local', '2026-09-02 11:00:00',
          'timezone_string', 'Asia/Seoul'
        )
      )),
      2
    );
    RAISE EXCEPTION 'Expected outsider command to fail';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$;

-- Owner revokes the editor after the invitation has been accepted.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000581';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000581","email":"task058-owner@onvoy.local"}';

DO $$
DECLARE
  member_id uuid;
BEGIN
  SELECT id INTO member_id
  FROM public.document_members
  WHERE document_id = '58000000-0000-0000-0000-000000000001'
    AND user_id = '00000000-0000-0000-0000-000000000582'
    AND status = 'accepted';

  IF member_id IS NULL THEN
    RAISE EXCEPTION 'Expected accepted editor membership before revoke';
  END IF;
  PERFORM public.revoke_document_member(member_id);
END;
$$;

-- NEW-A12: revoke wins over stale clients immediately.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000582';
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000582","email":"task058-editor@onvoy.local"}';

DO $$
DECLARE
  invite_token text;
BEGIN
  IF public.can_receive_authority_topic(
    'trip:58000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000582'
  ) THEN
    RAISE EXCEPTION 'Expected revoked editor to lose trip A topic';
  END IF;

  BEGIN
    PERFORM public.get_trip_authority_bundle('58000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'Expected revoked editor bundle read to fail';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    PERFORM public.apply_trip_commands(
      '58000000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'operation_id', '58000000-0000-0000-0000-000000000023',
        'entity_type', 'plan',
        'entity_id', '58000000-0000-0000-0000-000000000104',
        'action', 'upsert',
        'payload', jsonb_build_object(
          'title', '해지 후 stale 일정',
          'start_datetime_local', '2026-09-02 12:00:00',
          'end_datetime_local', '2026-09-02 13:00:00',
          'timezone_string', 'Asia/Seoul'
        )
      )),
      2
    );
    RAISE EXCEPTION 'Expected revoked stale command to fail';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  SELECT value INTO invite_token FROM task058_state WHERE key = 'editor_token';
  BEGIN
    PERFORM public.accept_document_invitation(invite_token, NULL);
    RAISE EXCEPTION 'Expected consumed invitation reuse after revoke to fail';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'Expected consumed invitation reuse after revoke to fail' THEN
        RAISE;
      END IF;
  END;
END;
$$;

RESET ROLE;
RESET request.jwt.claim.sub;
RESET request.jwt.claims;

DO $$
BEGIN
  IF (SELECT title FROM public.plans WHERE id = '58000000-0000-0000-0000-000000000102') <> '부산 일정' THEN
    RAISE EXCEPTION 'Cross-resource tampering changed trip B plan';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.plans
    WHERE id IN (
      '58000000-0000-0000-0000-000000000103',
      '58000000-0000-0000-0000-000000000104'
    )
  ) THEN
    RAISE EXCEPTION 'Forbidden outsider or revoked command materialized rows';
  END IF;
END;
$$;

SELECT 'task058_production_p0_automation checks passed' AS result;

ROLLBACK;
